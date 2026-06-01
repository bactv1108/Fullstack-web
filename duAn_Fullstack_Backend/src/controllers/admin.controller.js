const adminService = require('../services/admin.service');
const { ApiCost, CreditStat, Job } = require('../models');

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
    return res.status(200).json(result);
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
    const costs = await ApiCost.findAll();
    const totalCosts = costs.reduce((sum, c) => sum + parseFloat(c.cost), 0);
    return res.status(200).json({
      total: parseFloat(totalCosts.toFixed(2)),
      providers: costs.map(c => ({ name: c.provider, cost: parseFloat(c.cost) }))
    });
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
 * Retrieve all product image analyses history logs
 */
const getImageAnalyses = async (req, res) => {
  try {
    const { ImageAnalysis, User } = require('../models');
    const analyses = await ImageAnalysis.findAll({
      order: [['id', 'DESC']],
      include: [{
        model: User,
        as: 'owner',
        attributes: ['name', 'email']
      }]
    });
    return res.status(200).json(analyses);
  } catch (err) {
    console.error('[ADMIN CONTROLLER] getImageAnalyses error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử Mắt Thần.' });
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
  getImageAnalyses
};
