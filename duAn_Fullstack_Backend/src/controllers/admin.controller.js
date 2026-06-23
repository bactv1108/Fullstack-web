const adminService = require('../services/admin.service');
const { ApiCost, CreditStat, Job, sequelize } = require('../models');

/**
 * GET /api/admin/dashboard/stats
 * Retrieve credit line aggregates, API costs, and active rendering jobs
 */
const getDashboardStats = async (req, res) => {
  try {
    const costs = await ApiCost.findAll();
    const stats = await CreditStat.findAll();
    const activeQueue = await Job.findAll({
      where: { status: ['Pending', 'Rendering'] },
      limit: 10,
      order: [['id', 'DESC']]
    });

    const totalCosts = costs.reduce((sum, c) => sum + parseFloat(c.cost), 0);
    const totalCreditsUsed = stats.reduce((sum, s) => sum + s.creditsUsed, 0);
    const totalCreditsPurchased = stats.reduce((sum, s) => sum + s.creditsPurchased, 0);

    return res.status(200).json({
      creditStats: {
        used: totalCreditsUsed,
        purchased: totalCreditsPurchased
      },
      apiCosts: {
        total: parseFloat(totalCosts.toFixed(2)),
        providers: costs.map(c => ({ provider: c.provider, cost: parseFloat(c.cost) }))
      },
      activeQueue: activeQueue.map(q => ({
        id: q.id,
        name: q.name,
        type: q.type,
        status: q.status,
        progress: q.progress
      }))
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getDashboardStats error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải thống kê Dashboard.' });
  }
};

/**
 * GET /api/admin/billing/plans
 * Fetch credit allocations and packages configuration
 */
const getBillingPlans = async (req, res) => {
  try {
    const { Package } = require('../models');
    const packages = await Package.findAll();
    
    const plans = {};
    packages.forEach(pkg => {
      const key = pkg.id.toLowerCase();
      plans[key] = {
        credits: pkg.credits,
        price: Math.round(Number(pkg.price))
      };
    });
    
    // Fallback if packages table is empty
    if (Object.keys(plans).length === 0) {
      plans['free'] = { credits: 60, price: 0 };
      plans['basic'] = { credits: 200, price: 150000 };
      plans['premium'] = { credits: 1000, price: 500000 };
    }
    
    return res.status(200).json({
      success: true,
      plans
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getBillingPlans error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải cấu hình gói cước.' });
  }
};

/**
 * PUT /api/admin/billing/plans
 * Update credits packages configurations
 */
const updateBillingPlans = async (req, res) => {
  const { plans } = req.body;
  
  // Validation chặt chẽ cấu trúc bọc vỏ plans từ Frontend Admin gửi lên
  if (!plans || !plans.free || !plans.basic || !plans.premium) {
    return res.status(400).json({ message: 'Dữ liệu cấu hình gói cước không hợp lệ.' });
  }

  try {
    const { Package, SystemConfig } = require('../models');
    
    // BƯỚC 1: Duyệt qua các key và cập nhật trực tiếp vào từng hàng tương ứng của bảng packages trong MySQL
    for (const key of Object.keys(plans)) {
      const targetId = key.toLowerCase(); // Ép chữ thường: 'free', 'basic', 'premium' để khớp khóa chính id trong DB
      await Package.update(
        {
          price: parseInt(plans[key].price, 10) || 0,
          credits: parseInt(plans[key].credits, 10) || 0
        },
        { where: { id: targetId } }
      );
    }

    // BƯỚC 2: Ghi đè chuỗi JSON vào bảng system_configs để đảm bảo tính tương thích ngược toàn cục
    await SystemConfig.upsert({ 
      key: 'billing_plans', 
      value: JSON.stringify(plans) 
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Cấu hình gói cước đã được cập nhật đồng bộ vào cả hai bảng dữ liệu thành công!' 
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] updateBillingPlans error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật gói cước.' });
  }
};

/**
 * GET /api/admin/billing/transactions
 * Retrieve a paginated array matrix tracking transaction logs
 */
const getBillingTransactions = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    // Generate paginated mockup matrix since Transaction model is not defined in ORM schema
    const transactions = [
      { id: 1, email: 'alice@example.com', amount: 50, credits: 500, status: 'Success', date: new Date(Date.now() - 2 * 3600 * 1000) },
      { id: 2, email: 'charlie@example.com', amount: 30, credits: 2000, status: 'Success', date: new Date(Date.now() - 10 * 3600 * 1000) },
      { id: 3, email: 'tranvanbac21003@gmail.com', amount: 100, credits: 5000, status: 'Success', date: new Date(Date.now() - 24 * 3600 * 1000) }
    ];
    
    return res.status(200).json({
      total: transactions.length,
      pages: 1,
      currentPage: page,
      transactions
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getBillingTransactions error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử giao dịch.' });
  }
};

/**
 * GET /api/admin/moderation/blacklist
 * Fetch blacklisted keywords array
 */
const getBlacklist = async (req, res) => {
  try {
    const words = await adminService.getBlacklistWords();
    return res.status(200).json(words);
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getBlacklist error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách từ cấm.' });
  }
};

/**
 * POST /api/admin/moderation/blacklist
 * Add a keyword to the blacklist
 */
const addWordToBlacklist = async (req, res) => {
  const { word } = req.body;
  if (!word) {
    return res.status(400).json({ message: 'Thiếu từ khoá cần thêm.' });
  }

  try {
    const words = await adminService.addWordToBlacklist(word);
    return res.status(200).json({ success: true, blacklist: words });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] addWordToBlacklist error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * DELETE /api/admin/moderation/blacklist
 * Remove a keyword from the blacklist
 */
const removeWordFromBlacklist = async (req, res) => {
  const word = req.query.word || req.body.word;
  if (!word) {
    return res.status(400).json({ message: 'Thiếu từ khoá cần xoá.' });
  }

  try {
    const words = await adminService.removeWordFromBlacklist(word);
    return res.status(200).json({ success: true, blacklist: words });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] removeWordFromBlacklist error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/users
 * Retrieve raw client records filtered by keywords (search, page, limit)
 */
const getUsers = async (req, res) => {
  const search = req.query.search || '';
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const result = await adminService.fetchPaginatedUsers(search, page, limit);
    return res.status(200).json({
      users: result.users,
      totalUsers: result.total,
      totalPages: result.pages,
      currentPage: result.currentPage
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getUsers error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách người dùng.' });
  }
};

/**
 * PUT /api/admin/users/:id/credits
 * Atomically adjust user credit balance
 */
const updateUserCredits = async (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;

  if (amount === undefined || isNaN(Number(amount))) {
    return res.status(400).json({ message: 'Số lượng credit thay đổi không hợp lệ.' });
  }

  try {
    const user = await adminService.adjustUserCredits(id, amount);

    // Emit real-time credit update via Socket.io so user's frontend Header reflects new balance immediately
    const io = req.io;
    if (io) {
      io.emit('user:credit_updated', {
        userId: user.id,
        credits: user.credits,
        creditsAdded: Number(amount),
        timestamp: new Date()
      });
      console.log(`[SOCKET.IO] Emitted 'user:credit_updated' (ADMIN ADJUST) for user ID: ${user.id}, new balance: ${user.credits}`);
    }

    return res.status(200).json({
      message: 'Cập nhật credit thành công.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] updateUserCredits error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/admin/users/:id/status
 * Toggle user operations between Active and Banned
 */
const updateUserStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['Active', 'Banned'].includes(status)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ. Chỉ chấp nhận Active hoặc Banned.' });
  }

  try {
    const user = await adminService.toggleUserStatus(id, status);
    return res.status(200).json({
      message: 'Cập nhật trạng thái thành công.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] updateUserStatus error:', err.message);
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/admin/config/keys
 * Fetch API credentials
 */
const getApiKeys = async (req, res) => {
  try {
    const keys = await adminService.getApiKeys();
    return res.status(200).json(keys);
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getApiKeys error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải API Keys.' });
  }
};

/**
 * PUT /api/admin/config/keys
 * Save OpenAI & Elevenlabs credentials
 */
const updateApiKeys = async (req, res) => {
  const { openai, elevenlabs, gemini } = req.body;
  try {
    const keys = await adminService.updateApiKeys(openai, elevenlabs, gemini);
    return res.status(200).json({ success: true, message: 'Cập nhật API Keys thành công.', keys });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] updateApiKeys error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật API Keys.' });
  }
};

/**
 * GET /api/admin/system/queue
 * Retrieve active rendering logs
 */
const getQueueStatus = async (req, res) => {
  try {
    const queue = await Job.findAll({
      where: { status: ['Pending', 'Rendering', 'Failed'] },
      limit: 20,
      order: [['id', 'DESC']]
    });
    return res.status(200).json(queue.map(q => ({
      id: q.id,
      video: q.name,
      type: q.type,
      status: q.status,
      progress: q.progress
    })));
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getQueueStatus error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải hàng đợi render.' });
  }
};

/**
 * GET /api/admin/system/costs
 * Retrieve external API costs
 */
const getApiCosts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const providerStats = await ApiCost.findAll({
      where: {
        createdAt: {
          [Op.gte]: startOfMonth
        }
      },
      attributes: [
        'provider',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_calls'],
        [sequelize.fn('SUM', sequelize.col('cost')), 'total_spend']
      ],
      group: ['provider'], 
      order: [[sequelize.literal('total_spend'), 'DESC']],
      raw: true
    });

    return res.status(200).json({ success: true, data: providerStats });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getApiCosts error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải chi phí API.' });
  }
};

/**
 * GET /api/admin/system/credits
 * Retrieve credit usage logs for dashboard charts
 */
const getCreditStats = async (req, res) => {
  try {
    const stats = await CreditStat.findAll({ order: [['id', 'ASC']] });
    return res.status(200).json(stats.map(s => ({
      name: s.month,
      creditsUsed: s.creditsUsed,
      creditsPurchased: s.creditsPurchased
    })));
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getCreditStats error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải thống kê tín dụng.' });
  }
};

/**
 * GET /api/admin/image-analyses
 * Retrieve paginated & filtered product image analyses history logs
 * Query params: page (default 1), limit (forced 10), status ('all'|'success'|'failed')
 * Returns: { rows, totalPages, currentPage, totalItems, countAll, countSuccess, countFailed }
 */
const getImageAnalyses = async (req, res) => {
  try {
    const { ImageAnalysis, User } = require('../models');

    // ── Hard-lock pagination: 10 rows per page ──
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // ── Status filter from query string ──
    const statusParam = (req.query.status || 'all').trim().toLowerCase();
    const whereClause = {};
    if (statusParam === 'success' || statusParam === 'failed') {
      whereClause.status = statusParam;
    }
    // statusParam === 'all' → no where filter → return all statuses

    // ── Parallel: paginated query + global counts for tab badges ──
    const [{ count, rows }, countAll, countSuccess, countFailed] = await Promise.all([
      ImageAnalysis.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['id', 'DESC']],
        include: [{
          model: User,
          as: 'owner',
          attributes: ['name', 'email']
        }]
      }),
      ImageAnalysis.count(),
      ImageAnalysis.count({ where: { status: 'success' } }),
      ImageAnalysis.count({ where: { status: 'failed' } }),
    ]);

    const totalPages = Math.ceil(count / limit) || 1;

    return res.status(200).json({
      rows,
      totalPages,
      currentPage: page,
      totalItems: count,
      countAll,
      countSuccess,
      countFailed,
      counts: {
        all: countAll,
        success: countSuccess,
        failed: countFailed
      }
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getImageAnalyses error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử Mắt Thần.' });
  }
};

/**
 * GET /api/admin/transactions
 * GET /api/admin/admin/transactions
 * Retrieve a paginated array matrix tracking actual transaction logs from the database
 */
const getAllTransactions = async (req, res) => {
  const page = parseInt(req.query?.page, 10) || 1;
  const limit = parseInt(req.query?.limit, 10) || 10;
  const offset = (page - 1) * limit;
  const search = req.query?.search || '';
  const type = req.query?.type || 'all'; // 'all' | 'thu' | 'ban'

  try {
    const { Transaction, User } = require('../models');
    const { Op } = require('sequelize');

    // Build conditions as array so search + type can safely coexist
    const conditions = [];

    // Search filter (by id or user email)
    if (search) {
      conditions.push({
        [Op.or]: [
          { id: { [Op.like]: `%${search}%` } },
          { '$user.email$': { [Op.like]: `%${search}%` } }
        ]
      });
    }

    // Type filter — mirrors the isBan() helper on the frontend
    if (type === 'ban') {
      // Outflow: amount > 0 OR type = 'Hệ thống tặng' OR package_name = 'Gói Free'
      conditions.push({
        [Op.or]: [
          { amount: { [Op.gt]: 0 } },
          { type: 'Hệ thống tặng' },
          { package_name: 'Gói Free' }
        ]
      });
    } else if (type === 'thu') {
      // Inflow: NOT (amount > 0 OR type = 'Hệ thống tặng' OR package_name = 'Gói Free')
      conditions.push({
        amount: { [Op.lte]: 0 },
        type: { [Op.ne]: 'Hệ thống tặng' },
        package_name: { [Op.ne]: 'Gói Free' }
      });
    }
    // type === 'all' -> no additional filter

    const whereClause = conditions.length > 0 ? { [Op.and]: conditions } : {};

    let { count, rows: transactions } = await Transaction.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      where: whereClause,
      subQuery: false,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['email']
        }
      ]
    });

    let transactionList = transactions.map(t => t.toJSON());

    // Fallback search in payment_transactions table when searching
    if (search) {
      try {
        const db = require('../config/db');
        const [paymentTxs] = await db.execute(
          `SELECT pt.*, u.email FROM payment_transactions pt
           JOIN users u ON pt.user_id = u.id
           WHERE pt.order_code = ? OR pt.id = ? OR u.email LIKE ?`,
          [search, search, `%${search}%`]
        );

        if (paymentTxs && paymentTxs.length > 0) {
          const statusMap = {
            'SUCCESS': 'success',
            'PENDING': 'pending',
            'CANCELLED': 'failed'
          };
          
          paymentTxs.forEach(row => {
            const orderCodeStr = String(row.order_code);
            const exists = transactionList.some(t => String(t.id) === orderCodeStr);
            if (!exists) {
              const formatted = {
                id: orderCodeStr,
                userId: row.user_id,
                package_name: row.credits_added >= 1000 ? 'Premium Plan' : 'Basic Plan',
                amount: row.amount,
                credits_added: -Math.abs(row.credits_added), // Return negative number for Admin "Bán" display
                status: statusMap[row.status] || row.status.toLowerCase(),
                type: 'ban', // Must be 'ban'
                createdAt: row.created_at,
                updatedAt: row.created_at,
                user: {
                  email: row.email
                }
              };
              transactionList.unshift(formatted);
              count += 1;
            }
          });
        }
      } catch (dbErr) {
        console.error('[ADMIN CONTROLLER] getAllTransactions fallback error:', dbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      data: transactionList,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getAllTransactions error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải tất cả lịch sử giao dịch.' });
  }
};

/**
 * GET /api/admin/transactions/:id
 * Retrieve detail of a transaction by ID with fallback support for PayOS transactions
 */
const getTransactionDetail = async (req, res) => {
  const transactionId = req.params.id;

  try {
    const { Transaction, User } = require('../models');
    
    // Step 1: Find transaction in old transactions table
    const transaction = await Transaction.findOne({
      where: { id: transactionId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['email']
        }
      ]
    });

    if (transaction) {
      return res.status(200).json({
        success: true,
        data: transaction
      });
    }

    // Step 2: Fallback to payment_transactions table
    const db = require('../config/db');
    const [rows] = await db.execute(
      `SELECT pt.*, u.email FROM payment_transactions pt
       JOIN users u ON pt.user_id = u.id
       WHERE pt.order_code = ? OR pt.id = ?`,
      [transactionId, transactionId]
    );

    if (rows && rows.length > 0) {
      const row = rows[0];
      const statusMap = {
        'SUCCESS': 'success',
        'PENDING': 'pending',
        'CANCELLED': 'failed'
      };

      // Step 3: Map payment_transactions to old transactions JSON structure
      const formattedTx = {
        id: String(row.order_code),
        userId: row.user_id,
        package_name: row.credits_added >= 1000 ? 'Premium Plan' : 'Basic Plan',
        amount: row.amount,
        credits_added: -Math.abs(row.credits_added), // Return negative number for Admin "Bán" display
        status: statusMap[row.status] || row.status.toLowerCase(),
        type: 'ban', // Must be 'ban'
        createdAt: row.created_at,
        updatedAt: row.created_at,
        user: {
          email: row.email
        }
      };

      return res.status(200).json({
        success: true,
        data: formattedTx
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Không tìm thấy chi tiết giao dịch.'
    });

  } catch (err) {
    console.error('[ADMIN CONTROLLER] getTransactionDetail error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống khi lấy chi tiết giao dịch.'
    });
  }
};

/**
 * PUT /api/admin/transactions/:id/approve
 * Manually approve a pending payment transaction and award credits to user
 */
const approveTransactionManually = async (req, res) => {
  const transactionId = req.params.id;

  try {
    const { Transaction, User, sequelize } = require('../models');
    
    // Find transaction
    const transaction = await Transaction.findByPk(transactionId);
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch nạp tiền.' });
    }

    // Check duplicate approval
    if (transaction.status === 'success') {
      return res.status(400).json({ success: false, message: 'Giao dịch này đã được xử lý từ trước' });
    }

    // Initialize atomic Sequelize transaction
    const t = await sequelize.transaction();
    try {
      // 1. Update status
      await transaction.update({ status: 'success' }, { transaction: t });

      // 2 & 3. Update credits and current_package
      const targetPackage = transaction.package_name.toLowerCase().includes('premium') ? 'premium' : 'free';
      await User.update(
        { 
          credits: sequelize.literal(`credits + ${transaction.credits_added}`),
          current_package: targetPackage
        }, 
        { where: { id: transaction.userId }, transaction: t }
      );

      await t.commit();
      console.log(`[MANUAL APPROVAL SUCCESS] Transaction ${transactionId} approved manually by Admin. Added ${transaction.credits_added} credits to user ID ${transaction.userId}.`);

      // Emit real-time update via Socket.io
      const io = req.io;
      if (io) {
        const updatedTransaction = transaction.toJSON();
        const user = await User.findByPk(transaction.userId, {
          attributes: ['id', 'name', 'email', 'credits']
        });
        updatedTransaction.user = user ? { id: user.id, name: user.name, email: user.email } : {};
        io.emit('transaction:updated', updatedTransaction);
        console.log(`[SOCKET.IO] Emitted 'transaction:updated' (APPROVED) for transaction ID: ${transactionId}`);

        // Also emit user:credit_updated so the user's Header updates the balance live
        if (user) {
          io.emit('user:credit_updated', {
            userId: transaction.userId,
            credits: user.credits,
            creditsAdded: transaction.credits_added,
            transactionId: transactionId,
            timestamp: new Date()
          });
          console.log(`[SOCKET.IO] Emitted 'user:credit_updated' (MANUAL APPROVAL) for user ID: ${transaction.userId}, new balance: ${user.credits}`);
        }
      }

      // Ghi nhận trực tiếp thông báo nạp tiền thành công
      try {
        const { Notification } = require('../models');
        const notificationEmitter = require('../utils/notificationEmitter');

        const newPaymentNotif = await Notification.create({
          userId: transaction.userId, // ID của user nạp tiền
          title: 'Nạp tiền thành công ✓',
          message: `Tài khoản của bạn đã được cộng thêm +${transaction.credits_added} Credits vào số dư.`,
          type: 'info',
          is_read: false
        });
        // Bắn tín hiệu real-time về client của user qua SSE Gateway
        notificationEmitter.emit('send_notification', newPaymentNotif);
        console.log('[PAYMENT SUCCESS] Đã ghi DB và phát thông báo nạp tiền cho User:', transaction.userId);
      } catch (notifErr) {
        console.error('[MANUAL APPROVAL PAYMENT SUCCESS] Explicit notification insert error:', notifErr.message);
      }

      return res.status(200).json({ success: true, message: 'Duyệt đơn hàng thành công!' });
    } catch (transactionError) {
      await t.rollback();
      throw transactionError;
    }
  } catch (err) {
    console.error('[ADMIN CONTROLLER] approveTransactionManually error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi duyệt giao dịch thủ công.' });
  }
};

/**
 * GET /api/admin/moderation/queue
 * Lấy danh sách các Job đang chờ kiểm duyệt (status = 'Pending')
 * Kèm thông tin owner (name, email, avatar) để hiển thị trên Card
 */
const getModerationQueue = async (req, res) => {
  try {
    const { Job, User } = require('../models');
    const items = await Job.findAll({
      where: { status: 'Pending' },
      order: [['id', 'DESC']],
      limit: 50,
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email', 'avatar']
      }]
    });

    return res.status(200).json({
      success: true,
      items: items.map(job => ({
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        prompt: job.prompt,
        output_url: job.output_url,
        meta_data: job.meta_data,
        created_at: job.created_at,
        user: job.owner ? {
          id: job.owner.id,
          name: job.owner.name,
          email: job.owner.email,
          avatar: job.owner.avatar
        } : null
      }))
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getModerationQueue error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải hàng đợi kiểm duyệt.' });
  }
};

/**
 * POST /api/admin/moderation/review
 * Xử lý quyết định kiểm duyệt của Admin
 * Body: { itemId: number, action: 'approved' | 'rejected' }
 * - 'approved' → cập nhật status = 'Completed'
 * - 'rejected'  → cập nhật status = 'Failed'
 */
const reviewModerationItem = async (req, res) => {
  const { itemId, action } = req.body;

  if (!itemId || !['approved', 'rejected'].includes(action)) {
    return res.status(400).json({
      message: 'Dữ liệu không hợp lệ. Cần itemId và action (approved | rejected).'
    });
  }

  try {
    const { Job } = require('../models');
    const job = await Job.findByPk(itemId);

    if (!job) {
      return res.status(404).json({ message: `Không tìm thấy item ID ${itemId}.` });
    }

    const newStatus = action === 'approved' ? 'Completed' : 'Failed';
    await job.update({ status: newStatus });

    console.log(`[MODERATION] Item #${itemId} → ${newStatus} bởi Admin`);

    return res.status(200).json({
      success: true,
      message: action === 'approved'
        ? `Đã duyệt item #${itemId} thành công.`
        : `Đã từ chối item #${itemId}.`,
      itemId,
      newStatus
    });
  } catch (err) {
    console.error('[ADMIN CONTROLLER] reviewModerationItem error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xử lý kiểm duyệt.' });
  }
};

/**
 * GET /api/admin/video-jobs
 * Retrieve paginated & filtered video jobs history logs
 * Query params: page (default 1), limit (forced 10), status ('all'|'success'|'failed'|'processing'|'queueing'), modelName ('wan_turbo'|'kling_v2_5_standard'), search/searchWord (optional string)
 * Returns: { rows, totalPages, currentPage, totalItems, countAll, countSuccess, countFailed, countProcessing, countQueueing, countWanTurbo, countKlingStandard, counts }
 */
const getVideoJobs = async (req, res) => {
  try {
    const { VideoJob, User } = require('../models');
    const { Op } = require('sequelize');

    // ── Hard-lock pagination: 10 rows per page ──
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    // ── Search filter (by id, user name, or user email) ──
    const searchWord = (req.query.search || req.query.searchWord || '').trim();
    const statusParam = (req.query.status || 'all').trim().toLowerCase();
    const modelNameParam = (req.query.modelName || '').trim().toLowerCase();

    let isSearchNumeric = false;
    if (searchWord) {
      const parsedId = parseInt(searchWord, 10);
      if (!isNaN(parsedId) && String(parsedId) === searchWord) {
        isSearchNumeric = true;
      }
    }

    const hasUserTextSearch = searchWord && !isSearchNumeric;
    const includeRequired = hasUserTextSearch ? true : false;

    // Build main where condition
    const whereClause = {};
    if (searchWord) {
      if (isSearchNumeric) {
        whereClause.id = parseInt(searchWord, 10);
      } else {
        whereClause[Op.or] = [
          { '$owner.name$': { [Op.like]: `%${searchWord}%` } },
          { '$owner.email$': { [Op.like]: `%${searchWord}%` } }
        ];
      }
    }

    if (['success', 'failed', 'processing', 'queueing'].includes(statusParam)) {
      whereClause.status = statusParam;
    }

    if (['wan_turbo', 'kling_v2_5_standard'].includes(modelNameParam)) {
      whereClause.modelName = modelNameParam;
    }

    // Build base where condition for tab counts (ignores status and model filters, applies search filter)
    const baseWhere = {};
    if (searchWord) {
      if (isSearchNumeric) {
        baseWhere.id = parseInt(searchWord, 10);
      } else {
        baseWhere[Op.or] = [
          { '$owner.name$': { [Op.like]: `%${searchWord}%` } },
          { '$owner.email$': { [Op.like]: `%${searchWord}%` } }
        ];
      }
    }

    const countInclude = [{
      model: User,
      as: 'owner',
      attributes: [],
      required: includeRequired
    }];

    // ── Parallel: paginated query + counts for tab badges ──
    const [
      { count, rows },
      countAll,
      countSuccess,
      countFailed,
      countProcessing,
      countQueueing,
      countWanTurbo,
      countKlingStandard
    ] = await Promise.all([
      VideoJob.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [['id', 'DESC']],
        include: [{
          model: User,
          as: 'owner',
          attributes: ['name', 'email'],
          required: includeRequired
        }]
      }),
      VideoJob.count({
        where: baseWhere,
        include: countInclude
      }),
      VideoJob.count({
        where: { ...baseWhere, status: 'success' },
        include: countInclude
      }),
      VideoJob.count({
        where: { ...baseWhere, status: 'failed' },
        include: countInclude
      }),
      VideoJob.count({
        where: { ...baseWhere, status: 'processing' },
        include: countInclude
      }),
      VideoJob.count({
        where: { ...baseWhere, status: 'queueing' },
        include: countInclude
      }),
      VideoJob.count({
        where: { ...baseWhere, modelName: 'wan_turbo' },
        include: countInclude
      }),
      VideoJob.count({
        where: { ...baseWhere, modelName: 'kling_v2_5_standard' },
        include: countInclude
      })
    ]);

    const totalPages = Math.ceil(count / limit) || 1;

    const formattedData = rows.map(r => ({
      id: r.id,
      prompt: r.prompt,
      model_name: r.modelName || r.model_name,
      aspect_ratio: r.aspectRatio || r.aspect_ratio,
      status: r.status,
      videoUrl: r.videoUrl,
      createdAt: r.createdAt,
      owner: r.owner ? {
        name: r.owner.name,
        email: r.owner.email
      } : null
    }));

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        totalItems: count,
        totalPages: totalPages,
        currentPage: page,
        counts: {
          all: countAll,
          success: countSuccess,
          failed: countFailed,
          processing: countProcessing,
          queueing: countQueueing,
          wan_turbo: countWanTurbo,
          kling_v2_5_standard: countKlingStandard
        }
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER] getVideoJobs error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử Video AI.' });
  }
};

const getCreditStatistics = async (request, response) => {
  try {
    const statisticsData = await CreditStat.findAll({ order: [['id', 'ASC']] });
    const formattedData = statisticsData.map((item) => ({
      id: item.id,
      month: item.month,
      credits_used: item.creditsUsed,
      credits_purchased: item.creditsPurchased
    }));
    return response.json({ success: true, data: formattedData });
  } catch (error) {
    console.error('[ADMIN CONTROLLER] getCreditStatistics error:', error.message);
    return response.status(500).json({ success: false, message: 'Lỗi hệ thống khi tải dữ liệu thống kê tín dụng.' });
  }
};

const getDetailedApiLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;
    const { provider } = req.query;

    const whereClause = {};
    if (provider) {
      whereClause.provider = provider;
    }

    const { count, rows } = await ApiCost.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [['createdAt', 'DESC']],
      raw: true
    });

    // Ánh xạ dữ liệu sang định dạng hiển thị
    const mappedLogs = rows.map(log => ({
      id: log.id,
      provider_name: log.provider,
      amount: log.cost,
      action_type: 'Gọi API ' + log.provider,
      userId: 'Hệ thống',
      createdAt: log.createdAt
    }));

    return res.status(200).json({
      success: true,
      data: mappedLogs,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        itemsPerPage: limit
      }
    });
  } catch (error) {
    console.error('[ADMIN CONTROLLER] getDetailedApiLogs error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const confirmImageViolation = async (req, res) => {
  try {
    const { imageId } = req.body;
    const { ImageAnalysis } = require('../models');
    const log = await ImageAnalysis.findByPk(imageId);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi kiểm duyệt.' });
    }

    // Cập nhật trạng thái vĩnh viễn xuống DB chống lỗi F5 hiện lại
    await log.update({ status: 'rejected' });

    // Phát tin nhắn socket cho user room để đồng bộ trạng thái ở client nếu cần
    const io = req.io;
    if (io && log.user_id) {
      const userRoom = `user_room_${log.user_id}`;
      io.to(userRoom).emit('image_analysis_result', {
        itemId: Number(imageId),
        status: 'failed',
        resultData: {
          id: log.id,
          prompt_output: log.prompt_output || null,
          input_tokens: log.input_tokens || null,
          output_tokens: log.output_tokens || null,
          status: 'failed',
          error_message: log.error_message || 'Ảnh của bạn đã bị Admin xác nhận vi phạm chính sách.',
        },
        message: 'Ảnh của bạn đã bị Admin xác nhận vi phạm chính sách.'
      });
    }

    return res.status(200).json({ success: true, message: 'Đã cập nhật trạng thái vi phạm vĩnh viễn.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getBillingPlans,
  updateBillingPlans,
  getBillingTransactions,
  getBlacklist,
  addWordToBlacklist,
  removeWordFromBlacklist,
  getUsers,
  updateUserCredits,
  updateUserStatus,
  getApiKeys,
  updateApiKeys,
  getQueueStatus,
  getApiCosts,
  getCreditStats,
  getImageAnalyses,
  getAllTransactions,
  getTransactionDetail,
  approveTransactionManually,
  getModerationQueue,
  reviewModerationItem,
  getVideoJobs,
  getCreditStatistics,
  getDetailedApiLogs,
  confirmImageViolation
};



