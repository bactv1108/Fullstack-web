const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const twoFactorController = require('../controllers/twoFactor.controller');
const { authLimiter } = require('../middlewares/rate-limiter.middleware');
const { authenticateJWT } = require('../middlewares/auth.middleware');

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
router.post('/reset-password', authLimiter, authController.resetPassword);

// 2FA Routes (TOTP - Google Authenticator)
router.get('/2fa/generate', authenticateJWT, twoFactorController.generate2FA);
router.post('/2fa/enable', authenticateJWT, twoFactorController.enable2FA);
router.post('/2fa/disable', authenticateJWT, twoFactorController.disable2FA);
router.post('/2fa/verify-login', authLimiter, twoFactorController.verifyLogin2FA);

module.exports = router;