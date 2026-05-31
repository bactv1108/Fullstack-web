const { User, Job } = require('../models');

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
    const jobs = await Job.findAll({
      where: { userId: req.user.id },
      order: [['id', 'DESC']]
    });
    return res.status(200).json(jobs);
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

module.exports = {
  getProfile,
  getHistory,
  createJob,
  updateSettings,
  deleteJob
};
