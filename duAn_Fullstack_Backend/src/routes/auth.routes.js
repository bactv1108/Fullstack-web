const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Google OAuth
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

// Traditional Auth
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/forgot-password', authController.forgotPassword);

// 🔥 KÍCH NỔ CỔNG ĐÓN DATA LƯU VÀO DATABASE TẠI ĐÂY
router.post('/reset-password', authController.resetPassword);

module.exports = router;