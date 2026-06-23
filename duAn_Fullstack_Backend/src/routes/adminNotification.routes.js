const express = require('express');
const router = express.Router();
const adminNotificationController = require('../controllers/adminNotification.controller');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.middleware');

// Nếu là request kiểm tra OPTIONS của trình duyệt thì cho qua luôn, không bắt xác thực token
router.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Tất cả route yêu cầu đăng nhập + quyền Admin
router.use(authenticateJWT);
router.use(isAdmin);

// GET    /api/v1/auth/notifications            — Danh sách thông báo (phân trang)
router.get('/notifications', adminNotificationController.getAdminNotifications);

// GET    /api/v1/auth/notifications/unread-count — Đếm nhanh số chưa đọc
router.get('/notifications/unread-count', adminNotificationController.getUnreadCount);

// PUT    /api/v1/auth/notifications/read-all    — Đánh dấu đọc tất cả
router.put('/notifications/read-all', adminNotificationController.markAllAsRead);

// PUT    /api/v1/auth/notifications/mark-as-read — Đánh dấu đọc tất cả (đồng bộ với frontend)
router.put('/notifications/mark-as-read', adminNotificationController.markAllAsRead);

// PUT    /api/v1/auth/notifications/:id/read    — Đánh dấu 1 thông báo đã đọc
router.put('/notifications/:id/read', adminNotificationController.markAsRead);

// DELETE /api/v1/auth/notifications/clear-all   — Xóa toàn bộ
router.delete('/notifications/clear-all', adminNotificationController.clearAll);

module.exports = router;
