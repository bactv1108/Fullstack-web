const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

// Real-time SSE notification stream
router.get('/notifications/stream', authenticateJWT, notificationController.streamNotifications);

// User notification CRUD endpoints
router.get('/notifications', authenticateJWT, notificationController.getNotifications);
router.put('/notifications/read-all', authenticateJWT, notificationController.readAllNotifications);
router.delete('/notifications/clear-all', authenticateJWT, notificationController.clearAllNotifications);

// Admin notification post-event trigger
router.post('/admin/notifications', authenticateJWT, notificationController.createAdminNotification);

module.exports = router;
