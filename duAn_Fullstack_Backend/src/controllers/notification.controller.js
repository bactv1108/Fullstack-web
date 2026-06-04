const { Notification } = require('../models');
const { Op } = require('sequelize');
const notificationEmitter = require('../utils/notificationEmitter');

/**
 * GET /api/notifications/stream
 * Establish real-time SSE stream for notifications
 */
const streamNotifications = (req, res) => {
  const userId = req.user.id;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.flushHeaders();

  // Send initial connection heartbeat
  res.write(`data: ${JSON.stringify({ id: 0, type: 'info', title: 'SSE Connected', message: 'Kết nối thời gian thực đã hoạt động.' })}\n\n`);

  // Event handler callback
  const handleNotification = (notification) => {
    // Unicast to specific user or Broadcast (userId is null)
    if (notification.userId === null || notification.userId === userId) {
      res.write(`data: ${JSON.stringify(notification)}\n\n`);
    }
  };

  // Register listener
  notificationEmitter.on('send_notification', handleNotification);

  // Clean up on disconnect to prevent memory leaks
  req.on('close', () => {
    notificationEmitter.removeListener('send_notification', handleNotification);
    res.end();
  });
};

/**
 * GET /api/notifications
 * Load 10 newest notifications for the current user (unicast & broadcast)
 */
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.findAll({
      where: {
        [Op.or]: [
          { userId },
          { userId: null }
        ]
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    return res.status(200).json(notifications);
  } catch (err) {
    console.error('[NOTIFICATION CONTROLLER] getNotifications error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải thông báo.' });
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all unread notifications of this user as read
 */
const readAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.update(
      { is_read: true },
      {
        where: {
          userId,
          is_read: false
        }
      }
    );
    return res.status(200).json({ success: true, message: 'Đã đánh dấu đọc toàn bộ thông báo.' });
  } catch (err) {
    console.error('[NOTIFICATION CONTROLLER] readAll error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật trạng thái thông báo.' });
  }
};

/**
 * DELETE /api/notifications/clear-all
 * Clear all notifications of the current user from DB
 */
const clearAllNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    await Notification.destroy({
      where: {
        userId
      }
    });
    return res.status(200).json({ success: true, message: 'Đã xóa toàn bộ lịch sử thông báo.' });
  } catch (err) {
    console.error('[NOTIFICATION CONTROLLER] clearAll error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xóa thông báo.' });
  }
};

/**
 * POST /api/admin/notifications
 * Admin triggers broadcast or unicast notification
 */
const createAdminNotification = async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: 'Tiêu đề và nội dung là bắt buộc.' });
    }

    const newNotification = await Notification.create({
      userId: userId || null, // null maps to broadcast
      title,
      message,
      type: type || 'info',
      is_read: false
    });

    // Emit event in real time
    notificationEmitter.emit('send_notification', newNotification);

    return res.status(201).json(newNotification);
  } catch (err) {
    console.error('[NOTIFICATION CONTROLLER] createAdminNotification error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tạo thông báo admin.' });
  }
};

module.exports = {
  streamNotifications,
  getNotifications,
  readAllNotifications,
  clearAllNotifications,
  createAdminNotification
};
