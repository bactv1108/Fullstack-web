const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rate-limiter.middleware');

// Google OAuth
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

// Traditional Auth
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/refresh-token', authController.refreshToken);
router.get('/refresh', authController.refreshToken);
router.get('/refresh-token', authController.refreshToken);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authLimiter, authController.forgotPassword);

// 🔥 KÍCH NỔ CỔNG ĐÓN DATA LƯU VÀO DATABASE TẠI ĐÂY
router.post('/reset-password', authLimiter, authController.resetPassword);

module.exports = router;