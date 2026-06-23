const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { createPaymentLink, receiveWebhook } = require('../controllers/payment.controller');

// Route POST /api/payment/create-link - Tạo liên kết thanh toán quét mã QR (Yêu cầu đăng nhập)
router.post('/create-link', authenticateJWT, createPaymentLink);

// Route POST /api/payment/webhook - Cổng tiếp nhận Webhook từ PayOS khi thanh toán thành công (Công khai)
router.post('/webhook', receiveWebhook);

module.exports = router;
