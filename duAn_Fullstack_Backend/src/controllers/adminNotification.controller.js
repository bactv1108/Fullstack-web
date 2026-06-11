const { AdminNotification } = require('../models');
const { Op } = require('sequelize');

// Đánh dấu 1 thông báo đã đọc
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    // Tìm và cập nhật
    const notification = await AdminNotification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    notification.is_read = true;
    await notification.save();

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error('Lỗi markAsRead:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// Đánh dấu đọc tất cả
exports.markAllAsRead = async (req, res) => {
  try {
    await AdminNotification.update(
        { is_read: true },
        { where: { is_read: false } }
    );
    return res.status(200).json({ success: true, message: 'Đã đọc tất cả thông báo' });
  } catch (error) {
    console.error('Lỗi markAllAsRead:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
/**
 * GET /api/v1/auth/notifications
 * Lấy danh sách thông báo admin + đếm số chưa đọc
 */
const getAdminNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query?.page, 10) || 1;
    const limit = parseInt(req.query?.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { count: totalItems, rows: notifications } = await AdminNotification.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const unreadCount = await AdminNotification.count({
      where: { is_read: false }
    });

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('[ADMIN NOTIFICATION] getAdminNotifications error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải thông báo admin.' });
  }
};

/**
 * GET /api/v1/auth/notifications/unread-count
 * Đếm nhanh số lượng thông báo chưa đọc
 */
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await AdminNotification.count({
      where: { is_read: false }
    });
    return res.status(200).json({ success: true, unreadCount });
  } catch (err) {
    console.error('[ADMIN NOTIFICATION] getUnreadCount error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống.' });
  }
};

/**
 * PUT /api/v1/auth/notifications/:id/read
 * Đánh dấu một thông báo là đã đọc
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await AdminNotification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    }
    await notification.update({ is_read: true });
    return res.status(200).json({ success: true, message: 'Đã đánh dấu đã đọc.' });
  } catch (err) {
    console.error('[ADMIN NOTIFICATION] markAsRead error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống.' });
  }
};

/**
 * PUT /api/v1/auth/notifications/read-all
 * Đánh dấu tất cả thông báo là đã đọc
 */
const markAllAsRead = async (req, res) => {
  try {
    await AdminNotification.update(
      { is_read: true },
      { where: { is_read: false } }
    );
    return res.status(200).json({ success: true, message: 'Đã đánh dấu đọc tất cả.' });
  } catch (err) {
    console.error('[ADMIN NOTIFICATION] markAllAsRead error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống.' });
  }
};

/**
 * DELETE /api/v1/auth/notifications/clear-all
 * Xóa toàn bộ thông báo admin
 */
const clearAll = async (req, res) => {
  try {
    await AdminNotification.destroy({ where: {} });
    return res.status(200).json({ success: true, message: 'Đã xóa toàn bộ thông báo.' });
  } catch (err) {
    console.error('[ADMIN NOTIFICATION] clearAll error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống.' });
  }
};

module.exports = {
  getAdminNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  clearAll
};
