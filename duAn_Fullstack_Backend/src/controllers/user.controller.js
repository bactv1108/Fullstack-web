const bcrypt = require('bcrypt');
const { User, Job, Package, Transaction, ImageAnalysis, sequelize } = require('../models');

/**
 * GET /api/user/profile
 * Retrieve profile and credits balance of logged-in user
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }
    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      status: user.status,
      avatar: user.avatar
    });
  } catch (err) {
    console.error('[USER CONTROLLER] getProfile error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin.' });
  }
};

/**
 * GET /api/user/history
 * Retrieve user's render jobs history
 */
const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Quét dữ liệu Video AI và Giọng nói (Giữ nguyên)
    const jobs = await Job.findAll({
      where: { userId },
      order: [['id', 'DESC']]
    });

    // 2. Quét dữ liệu phân tích ảnh Mắt Thần AI
    const analyses = await ImageAnalysis.findAll({
      where: { user_id: userId, status: 'success' },
      order: [['id', 'DESC']]
    });

    // 3. Map thuộc tính định danh & gộp mảng
    const mappedJobs = jobs.map(job => {
      const jobPlain = job.get({ plain: true });
      const isVideo = jobPlain.type === 'Video' || jobPlain.type === 'video' || jobPlain.type === 'render_task';
      return {
        ...jobPlain,
        type: isVideo ? 'video' : 'audio'
      };
    });

    const mappedAnalyses = analyses.map(analysis => {
      const analysisPlain = analysis.get({ plain: true });
      return {
        ...analysisPlain,
        type: 'analysis'
      };
    });

    // Gộp cả 3 loại dữ liệu
    const combinedHistory = [...mappedJobs, ...mappedAnalyses];

    // Sắp xếp theo thời gian createdAt mới nhất đến cũ nhất
    combinedHistory.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at);
      const dateB = new Date(b.createdAt || b.created_at);
      return dateB - dateA;
    });

    return res.status(200).json(combinedHistory);

  } catch (err) {
    console.error('[USER CONTROLLER] getHistory error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử.' });
  }
};

/**
 * POST /api/user/jobs
 * Enqueue a new rendering job and deduct credits
 */
const createJob = async (req, res) => {
  const { name, type, prompt, meta_data } = req.body;
  if (!prompt) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mô tả (prompt).' });
  }
  if (!type || !['Video', 'Voice'].includes(type)) {
    return res.status(400).json({ message: 'Loại tác vụ không hợp lệ.' });
  }

  const cost = type === 'Video' ? 10 : 5;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    if (user.credits < cost) {
      return res.status(400).json({ message: 'Số dư tín dụng (credits) của bạn không đủ để thực hiện tác vụ này.' });
    }

    // Atomically deduct credits
    await user.decrement('credits', { by: cost });
    await user.reload();

    // Create render job in the DB
    const jobName = name || (type === 'Video' ? 'Tạo Video' : 'Tạo Giọng Nói');
    const job = await Job.create({
      userId: user.id,
      name: jobName,
      type,
      prompt,
      meta_data,
      status: 'Pending',
      progress: 0,
      credits_used: cost
    });

    return res.status(201).json({
      message: 'Tạo tác vụ thành công, tiến trình đang được xử lý.',
      job,
      credits: user.credits
    });
  } catch (err) {
    console.error('[USER CONTROLLER] createJob error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tạo tác vụ.' });
  }
};

/**
 * PUT /api/user/settings
 * Update user settings
 */
const updateSettings = async (req, res) => {
  const { name, email, avatar } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (avatar) user.avatar = avatar;

    await user.save();
    return res.status(200).json({
      message: 'Cập nhật cài đặt thành công.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('[USER CONTROLLER] updateSettings error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi lưu cài đặt.' });
  }
};

/**
 * DELETE /api/user/jobs/:id
 * Delete a job record
 */
const deleteJob = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await Job.findOne({ where: { id, userId: req.user.id } });
    if (!job) {
      return res.status(404).json({ message: 'Không tìm thấy tác vụ.' });
    }
    await job.destroy();
    return res.status(200).json({ success: true, message: 'Xoá tác vụ thành công.' });
  } catch (err) {
    console.error('[USER CONTROLLER] deleteJob error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xoá tác vụ.' });
  }
};

/**
 * PUT /api/user/update-profile
 * Update user's fullname and avatar
 */
const updateProfile = async (req, res) => {
  const { fullname, avatar } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    if (fullname !== undefined) {
      user.name = fullname;
    }
    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();
    return res.status(200).json({
      message: 'Cập nhật thông tin hồ sơ thành công!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        credits: user.credits
      }
    });
  } catch (err) {
    console.error('[USER CONTROLLER] updateProfile error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật hồ sơ.' });
  }
};

/**
 * PUT /api/user/change-password
 * Change user password
 */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin mật khẩu cũ và mới.' });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Compare currentPassword with DB hash (user.password_hash or user.password)
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.password_hash || '');
    if (isSameAsOld) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    // Hash the new password with 12 salt rounds (as done in auth.controller.js)
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password_hash: hashedPassword });

    return res.status(200).json({
      message: 'Mật khẩu đã được thay đổi và cập nhật thành công!'
    });
  } catch (err) {
    console.error('[USER CONTROLLER] changePassword error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật mật khẩu.' });
  }
};

/**
 * GET /api/user/packages
 * Retrieve all packages from database
 */
const getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll();
    
    // Programmatically sort by order: Free, Basic, Premium
    const order = ['free', 'basic', 'premium'];
    packages.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    
    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: Math.round(Number(pkg.price)),
      credits: pkg.credits
    }));
    
    return res.status(200).json(formattedPackages);
  } catch (err) {
    console.error('[USER CONTROLLER] getPackages error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách gói cước.' });
  }
};

/**
 * POST /api/user/payment/create
 * Generate order and transaction record in DB, return payment information
 */
const createPayment = async (req, res) => {
  const { packageId } = req.body;
  if (!packageId) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mã gói cước (packageId).' });
  }

  try {
    const pkg = await Package.findByPk(packageId.toLowerCase());
    if (!pkg) {
      return res.status(404).json({ message: 'Không tìm thấy gói cước phù hợp.' });
    }

    const price = Math.round(Number(pkg.price));
    const credits = pkg.credits;

    // Generate unique TRX ID (e.g. STDU + random suffix digits)
    const transactionId = 'STDU' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);

    const transaction = await Transaction.create({
      id: transactionId,
      userId: req.user.id,
      package_name: pkg.name,
      amount: price,
      credits_added: credits,
      status: 'pending'
    });

    const memo = `STUDIO NAP ${req.user.id} ${transaction.id}`;

    return res.status(201).json({
      id: transaction.id,
      amount: transaction.amount,
      credits: transaction.credits_added,
      memo
    });
  } catch (err) {
    console.error('[USER CONTROLLER] createPayment error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi khởi tạo đơn nạp tiền.' });
  }
};

/**
 * GET /api/user/payment/status/:id
 * Check the status of a payment transaction
 */
const checkPaymentStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await Transaction.findOne({
      where: { id, userId: req.user.id }
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch nạp tiền.' });
    }
    return res.status(200).json({ status: transaction.status });
  } catch (err) {
    console.error('[USER CONTROLLER] checkPaymentStatus error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi kiểm tra trạng thái đơn nạp tiền.' });
  }
};

/**
 * POST /api/user/payment/webhook
 * Public webhook callback to confirm transaction nạp tiền và credits update
 */
const receiveWebhook = async (req, res) => {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'STUDIO_SECRET_2026';
  
  // 1. Signature check
  const signature = req.headers['x-webhook-signature'] || req.body.signature;
  if (!signature || signature !== WEBHOOK_SECRET) {
    console.warn('[WEBHOOK WARNING] Unauthorized webhook attempt. Signature mismatch.');
    return res.status(401).json({ success: false, message: 'Unauthorized webhook signature mismatch.' });
  }

  const { amount, content, description } = req.body;
  const memoText = content || description || '';

  // 2. Parse memo for STDUxxxxxxxx transaction code
  const match = memoText.match(/STDU[0-9a-zA-Z]+/i);
  if (!match) {
    console.error('[WEBHOOK ERROR] Transaction code not found in content:', memoText);
    return res.status(400).json({ success: false, message: 'Mã đơn hàng giao dịch không tìm thấy trong nội dung chuyển khoản.' });
  }
  const transactionId = match[0].toUpperCase();

  try {
    // 3. Data Integrity check
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) {
      console.error('[WEBHOOK ERROR] Transaction not found in database:', transactionId);
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại trên hệ thống.' });
    }

    // Checking duplication
    if (transaction.status === 'success') {
      return res.status(200).json({ success: true, message: 'Giao dịch này đã được xử lý từ trước' });
    }

    // Check paid amount
    const receivedAmount = Math.round(Number(amount));
    const expectedAmount = Math.round(Number(transaction.amount));
    if (receivedAmount < expectedAmount) {
      await transaction.update({ status: 'failed' });
      console.error(`[WEBHOOK ERROR] Transaction ${transactionId} failed. Received amount ${receivedAmount} is lower than expected ${expectedAmount}.`);
      return res.status(400).json({ success: false, message: 'Số tiền nạp thực tế không khớp gói cước.' });
    }

    // 4. Atomically update transaction status and user credits inside Sequelize transaction
    const t = await sequelize.transaction();
    try {
      // Step 1: Update transaction status
      await transaction.update({ status: 'success' }, { transaction: t });

      // Step 2: Increment credits
      await User.increment(
        { credits: transaction.credits_added },
        { where: { id: transaction.userId }, transaction: t }
      );

      await t.commit();
      console.log(`[WEBHOOK SUCCESS] Processed transaction ${transactionId} successfully. Added ${transaction.credits_added} credits to user ID ${transaction.userId}.`);
      return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (transactionError) {
      await t.rollback();
      throw transactionError;
    }
  } catch (err) {
    console.error('[WEBHOOK CRITICAL ERROR] Server failed to process webhook callback:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý webhook callback.' });
  }
};

module.exports = {
  getProfile,
  getHistory,
  createJob,
  updateSettings,
  deleteJob,
  updateProfile,
  changePassword,
  getPackages,
  createPayment,
  checkPaymentStatus,
  receiveWebhook
};
