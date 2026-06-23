const payos = require('../config/payos');
const db = require('../config/db');
const { Package, Transaction } = require('../models');

/**
 * POST /api/payment/create-link
 * Khởi tạo link thanh toán quét mã QR qua PayOS
 */
const createPaymentLink = async (req, res) => {
  try {
    const { packageId } = req.body;
    const userId = req.user.id; // Lấy từ auth middleware (authenticateJWT)

    if (!packageId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin gói cước (packageId).' });
    }

    const packageIdLower = packageId.toLowerCase();

    // 1. Chặn nếu user cố tình nạp gói free (giá 0đ)
    if (packageIdLower === 'free') {
      return res.status(400).json({ success: false, message: 'Gói Free không hỗ trợ thanh toán nạp tiền.' });
    }

    // 2. Tìm gói cước động từ database
    let pkg = await Package.findByPk(packageIdLower);
    let amount;
    let creditsAdded;
    let packageName;

    if (pkg) {
      amount = Math.round(Number(pkg.price));
      creditsAdded = pkg.credits;
      packageName = pkg.name;
    } else {
      // Cấu hình dự phòng nếu bảng packages trong DB đang trống
      const fallbackPlans = {
        basic: { name: 'Gói Basic', credits: 200, price: 150000 },
        premium: { name: 'Gói Premium', credits: 1000, price: 500000 }
      };

      const fallback = fallbackPlans[packageIdLower];
      if (!fallback) {
        return res.status(400).json({ success: false, message: 'Gói cước yêu cầu không tồn tại trên hệ thống.' });
      }

      amount = fallback.price;
      creditsAdded = fallback.credits;
      packageName = fallback.name;
    }

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền thanh toán phải lớn hơn 0đ.' });
    }

    // 3. Tạo orderCode duy nhất kiểu Number (PayOS yêu cầu dạng số nguyên tối đa 15 chữ số)
    // Dùng 10 chữ số cuối của Date.now() + 3 chữ số ngẫu nhiên
    const orderCode = parseInt(
      Date.now().toString().slice(-10) + Math.floor(Math.random() * 1000).toString(),
      10
    );

    // 4. Lưu thông tin giao dịch vào bảng payment_transactions với trạng thái 'PENDING'
    await db.execute(
      `INSERT INTO payment_transactions (user_id, order_code, amount, credits_added, status) 
       VALUES (?, ?, ?, ?, 'PENDING')`,
      [userId, orderCode, amount, creditsAdded]
    );

    console.log(`[PAYMENT] Tạo đơn hàng thành công: orderCode=${orderCode}, userId=${userId}, gói=${packageName}, số tiền=${amount}đ`);

    // 5. Chuẩn bị thông tin gửi sang PayOS
    // Description: Chuỗi KHÔNG DẤU, tối đa 25 ký tự
    const description = `Nap xu ${packageIdLower.slice(0, 10)} AI Studio`.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25);

    const paymentData = {
      orderCode,
      amount,
      description,
      cancelUrl: 'http://localhost:5173/payment-cancel',
      returnUrl: 'http://localhost:5173/payment-success'
    };

    // 6. Gọi PayOS SDK để tạo link thanh toán
    const paymentResponse = await payos.createPaymentLink(paymentData);

    return res.status(200).json({
      success: true,
      message: 'Khởi tạo link thanh toán thành công!',
      checkoutUrl: paymentResponse.checkoutUrl,
      orderCode
    });

  } catch (error) {
    console.error('❌ [CREATE PAYMENT LINK ERROR] Lỗi khởi tạo thanh toán:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi khởi tạo thanh toán.' });
  }
};

/**
 * POST /api/payment/webhook
 * Tiếp nhận thông báo chuyển khoản thành công từ PayOS (Public API)
 */
const receiveWebhook = async (req, res) => {
  try {
    // 1. Chặn đứng request Ping Test của PayOS
    if (!req.body || !req.body.data || req.body.desc === 'confirm' || !req.body.data.orderCode) {
      console.log("🔔 [PAYOS WEBHOOK PING] Nhận request xác thực kết nối từ PayOS. Trả về 200 OK.");
      return res.status(200).json({ success: true, message: 'Webhook connected successfully' });
    }

    console.log("📥 [PAYOS WEBHOOK RECEIVED] Nhận request webhook từ PayOS:", JSON.stringify(req.body));

    // 2. Xác thực chữ ký bảo mật từ PayOS
    const webhookData = await payos.verifyPaymentData(req.body);
    const orderCode = webhookData.orderCode;
    const receivedAmount = webhookData.amount;

    console.log(`🔍 [PAYOS WEBHOOK DATA] Xác thực chữ ký thành công. orderCode: ${orderCode}, Số tiền: ${receivedAmount}đ`);

    // 3. Tìm thông tin giao dịch tương ứng trong DB (bảng payment_transactions)
    const [transactions] = await db.execute(
      'SELECT * FROM payment_transactions WHERE order_code = ?',
      [orderCode]
    );

    if (transactions.length === 0) {
      console.warn(`⚠️ [PAYOS WEBHOOK] Không tìm thấy mã đơn hàng ${orderCode} trong bảng payment_transactions.`);
      return res.status(200).json({ success: true, message: 'Giao dịch không tồn tại, bỏ qua.' });
    }

    const transaction = transactions[0];
    console.log(`📖 [PAYOS WEBHOOK] Đã tìm thấy giao dịch: ID=${transaction.id}, User ID=${transaction.user_id}, Trạng thái hiện tại=${transaction.status}`);

    // 4. Kiểm tra trạng thái giao dịch để tránh xử lý trùng lặp (Idempotency)
    if (transaction.status !== 'PENDING') {
      console.log(`ℹ️ [PAYOS WEBHOOK] Đơn hàng ${orderCode} đã được xử lý trước đó (Trạng thái hiện tại: ${transaction.status}). Bỏ qua.`);
      return res.status(200).json({ success: true, message: 'Giao dịch đã được xử lý trước đó.' });
    }

    // 5. Cập nhật trạng thái giao dịch trong bảng payment_transactions thành SUCCESS dựa trên đúng orderCode
    const [updateTxResult] = await db.execute(
      'UPDATE payment_transactions SET status = "SUCCESS" WHERE order_code = ?',
      [orderCode]
    );
    console.log(`💾 [PAYOS WEBHOOK] Cập nhật bảng payment_transactions thành SUCCESS cho orderCode ${orderCode}. Kết quả:`, updateTxResult);

    // 6. Cộng credits tương ứng cho tài khoản người dùng
    const userId = transaction.user_id;
    const creditsAdded = transaction.credits_added;

    // Suy ra package tương ứng để cập nhật cột current_package cho tài khoản (phục vụ phân quyền nâng cao)
    let userPackageId = 'basic';
    if (creditsAdded >= 1000) {
      userPackageId = 'premium';
    }

    const [updateUserResult] = await db.execute(
      'UPDATE users SET credits = credits + ?, current_package = ? WHERE id = ?',
      [creditsAdded, userPackageId, userId]
    );
    console.log(`💾 [PAYOS WEBHOOK] Đã cộng +${creditsAdded} credits cho User ID ${userId} (Gói: ${userPackageId}). Kết quả:`, updateUserResult);

    // 7. Tạo bản ghi lịch sử giao dịch vào bảng transactions (Sequelize Transaction model) để hiển thị ở "Lịch sử giao dịch"
    const transactionId = String(orderCode);
    const newTx = await Transaction.create({
      id: transactionId,
      userId,
      package_name: creditsAdded >= 1000 ? 'Premium Plan' : 'Basic Plan',
      amount: transaction.amount,
      credits_added: creditsAdded,
      status: 'success',
      type: 'Nạp gói cước'
    });
    console.log(`💾 [PAYOS WEBHOOK] Đã lưu lịch sử giao dịch thành công vào bảng transactions: ID=${transactionId}`);

    // 8. Phát sự kiện Socket.io cập nhật số dư tức thì lên Frontend
    const io = req.app ? req.app.io : null;
    if (io) {
      // Bắn sự kiện Socket.io cho Admin Panel để tự động tải lại bảng Lịch sử giao dịch
      try {
        const [users] = await db.execute('SELECT email FROM users WHERE id = ?', [userId]);
        const userEmail = users.length > 0 ? users[0].email : '';
        const txJson = newTx.toJSON();
        txJson.user = { email: userEmail };

        io.to('admin_room').emit('transaction:created', txJson);
        io.to('admin_room').emit('transaction:updated', txJson);
        console.log(`📡 [SOCKET.IO] Đã bắn transaction:created & transaction:updated lên admin_room cho GD: ${transactionId}`);
      } catch (socketErr) {
        console.error('❌ [PAYOS WEBHOOK] Lỗi bắn socket transaction:created/updated:', socketErr.message);
      }
      const [updatedUsers] = await db.execute('SELECT credits FROM users WHERE id = ?', [userId]);
      const newCredits = updatedUsers.length > 0 ? updatedUsers[0].credits : null;

      // Phát cả hai sự kiện để đảm bảo Frontend nhận được
      io.emit('user:credit_updated', {
        userId,
        credits: newCredits,
        creditsAdded,
        timestamp: new Date()
      });

      io.emit('USER_PIPELINE_UPDATE', {
        userId,
        credits: newCredits,
        notification: {
          id: Date.now(),
          title: 'Nạp tiền thành công ✓',
          message: `Tài khoản của bạn đã được cộng thêm +${creditsAdded} Credits vào số dư ví qua cổng PayOS.`,
          createdAt: new Date()
        }
      });
      console.log(`📡 [SOCKET.IO] Đã phát sự kiện cập nhật số dư mới cho user ID: ${userId}, số dư mới: ${newCredits}`);
    }

    // 9. Lưu trữ thông báo trong DB (Notification) để hiện ở quả chuông đỏ
    try {
      const { Notification } = require('../models');
      const notificationEmitter = require('../utils/notificationEmitter');

      const newNotif = await Notification.create({
        userId,
        title: 'Nạp tiền thành công ✓',
        message: `Tài khoản của bạn đã được cộng thêm +${creditsAdded} Credits vào số dư ví qua cổng PayOS.`,
        type: 'info',
        is_read: false
      });

      // Phát thông báo SSE Gateway
      notificationEmitter.emit('send_notification', newNotif);
      console.log('🔔 [PAYOS WEBHOOK] Đã tạo thông báo Notification trong DB và phát qua SSE.');
    } catch (notifErr) {
      console.error('❌ [PAYOS WEBHOOK] Lỗi lưu thông báo vào cơ sở dữ liệu:', notifErr.message);
    }

    // 10. Bắn thông báo tới Admin Dashboard (Billing Activity)
    try {
      if (req.app && typeof req.app.emitAdminNotification === 'function') {
        const [users] = await db.execute('SELECT name, email FROM users WHERE id = ?', [userId]);
        const paidUser = users[0];
        req.app.emitAdminNotification({
          title: 'Nạp tiền thành công ✓',
          content: `Tài khoản "${paidUser?.name || paidUser?.email || 'User #' + userId}" đã nạp thành công gói cước +${creditsAdded} Credits (${receivedAmount.toLocaleString()}đ). Mã GD: ${orderCode}`,
          type: 'billing',
          transactionCode: orderCode,
          timestamp: new Date()
        });
      }
    } catch (adminNotifErr) {
      console.error('❌ [PAYOS WEBHOOK] Lỗi phát thông báo Admin Panel:', adminNotifErr.message);
    }

    return res.status(200).json({ code: "00", message: "Success" });

  } catch (error) {
    console.error("❌ [PAYOS WEBHOOK VERIFY FAILED] Lỗi xử lý webhook:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createPaymentLink,
  receiveWebhook
};
