const bcrypt = require('bcrypt');
const { User, Transaction, Package, Notification } = require('../models');

/**
 * Cập nhật hồ sơ người dùng (Họ tên, Avatar và Mật khẩu bảo mật)
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }

    const { name, oldPassword, newPassword } = req.body;

    // Cập nhật tên hiển thị nếu có
    if (name) {
      user.name = name;
    }

    // Cập nhật Avatar nếu có file tải lên
    if (req.file) {
      // Lưu đường dẫn tương đối (Ví dụ: /uploads/avatars/filename.jpg)
      const relativePath = `/uploads/avatars/${req.file.filename}`;
      user.avatar = relativePath;
    }

    // Xử lý đổi mật khẩu nếu được yêu cầu
    if (newPassword) {
      if (!oldPassword) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp mật khẩu cũ.' });
      }

      // Đối chiếu mật khẩu cũ với hash trong DB
      const isMatch = await bcrypt.compare(oldPassword, user.password || '');
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác' });
      }

      // Mã hóa mật khẩu mới trước khi cập nhật
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hồ sơ thành công.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
        credits_balance: user.credits_balance,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (err) {
    console.error('[PROFILE CONTROLLER] updateProfile error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi cập nhật hồ sơ.' });
  }
};

/**
 * Lấy lịch sử giao dịch của người dùng
 */
const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    const formatted = transactions.map(tx => ({
      id: tx.id,
      userId: tx.userId,
      package_name: tx.package_name,
      package: { name: tx.package_name },
      amount: tx.amount,
      credits_added: tx.credits_added,
      status: tx.status,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt
    }));

    return res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    console.error('[PROFILE CONTROLLER] getTransactions error:', err.message);
    return res.status(200).json({ success: true, data: [] });
  }
};

/**
 * Lấy danh sách thông báo của người dùng
 */
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });
    return res.status(200).json({ success: true, data: notifications });
  } catch (err) {
    console.error('[PROFILE CONTROLLER] getNotifications error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy thông báo.' });
  }
};

module.exports = {
  updateProfile,
  getTransactions,
  getNotifications
};
