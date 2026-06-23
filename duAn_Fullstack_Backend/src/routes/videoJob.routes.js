/**
 * videoJob.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Router cho tính năng "Tạo Video AI Animation".
 *
 * Prefix mount tại server.js:
 *   app.use('/api/video-jobs', videoJobRouter);
 *
 * Bảng ánh xạ Endpoint → Controller:
 * ┌──────────────────────────────────────────┬──────────────────────┬────────┐
 * │ Endpoint                                 │ Controller Handler   │ Auth?  │
 * ├──────────────────────────────────────────┼──────────────────────┼────────┤
 * │ POST /api/video-jobs/generate            │ generateVideo        │  JWT   │
 * │ POST /api/video-jobs/webhook             │ handleWebhook        │  ❌    │
 * │ GET  /api/video-jobs/recent              │ getRecentJobs        │  JWT   │
 * │ POST /api/video-jobs/extend              │ extendVideo          │  JWT   │
 * └──────────────────────────────────────────┴──────────────────────┴────────┘
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const router  = express.Router();

const { authenticateJWT }  = require('../middlewares/auth.middleware');
const uploadCloudinary    = require('../middlewares/uploadCloudinary.middleware');
const videoJobController   = require('../controllers/videoJob.controller');

// ══════════════════════════════════════════════════════════════════════════════
// ⚠️  PUBLIC ROUTE — PHẢI ĐẶT TRƯỚC TẤT CẢ MIDDLEWARE BẢO MẬT
// ── [1] POST /api/video-jobs/webhook ─────────────────────────────────────────
// Fal.ai callback — KHÔNG yêu cầu JWT. Bên ngoài gọi vào nên không có token.
// Route này PHẢI khai báo đầu tiên để không bị chặn bởi authenticateJWT.
// ══════════════════════════════════════════════════════════════════════════════
router.post(
  '/webhook',
  (req, _res, next) => {
    console.log('➡️ [WEBHOOK] Request đã chạm tới cửa ngõ Router!');
    next();
  },
  videoJobController.handleWebhook
);

// ── [2] POST /api/video-jobs/generate ────────────────────────────────────────
// Xếp hàng tác vụ Fal.ai — yêu cầu JWT hợp lệ (gán req.user.id)
router.post(
  '/generate',
  authenticateJWT,
  videoJobController.generateVideo
);

// ── [3] GET /api/video-jobs/recent ───────────────────────────────────────────
// Trả về 4 VideoJob mới nhất của user đang đăng nhập để đổ vào lưới thẻ lịch sử.
router.get(
  '/recent',
  authenticateJWT,
  videoJobController.getRecentJobs
);

// ── [4] POST /api/video-jobs/extend ─────────────────────────────────────────────
router.post(
  '/extend',
  authenticateJWT,
  videoJobController.extendVideo
);

// ── [5] DELETE /api/video-jobs/:id ──────────────────────────────────────────
// Xoa video job theo id — yeu cau JWT
router.delete(
  '/:id',
  authenticateJWT,
  videoJobController.deleteVideoJob
);

// ── [6] POST /api/video-jobs/upload-image ───────────────────────────────────
// Nhận ảnh dán từ clipboard (Ctrl+V) → lưu disk → trả về URL đầy đủ
router.post(
  '/upload-image',
  authenticateJWT,
  uploadCloudinary.single('image'),
  videoJobController.uploadImage
);

module.exports = router;
