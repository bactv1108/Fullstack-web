const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

// Protected route to fetch packages
router.get('/packages', authenticateJWT, userController.getPackages);

// Public webhook endpoint from payment gateway (NO authMiddleware!)
router.post('/payment/webhook', userController.receiveWebhook);

// Payment endpoints (Protected)
router.post('/payment/create', authenticateJWT, userController.createPayment);
router.get('/payment/status/:id', authenticateJWT, userController.checkPaymentStatus);

// Apply token authentication middleware for the remaining routes
router.use(authenticateJWT);

router.get('/profile', userController.getProfile);
router.get('/history', userController.getHistory);
router.get('/transactions', userController.getTransactions);
router.post('/jobs', userController.createJob);
router.put('/settings', userController.updateSettings);
router.delete('/jobs/:id', userController.deleteJob);
router.put('/update-profile', userController.updateProfile);
router.put('/change-password', userController.changePassword);

module.exports = router;
