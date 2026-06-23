const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { analyzeProductImage, getAnalysisDetail, deleteAnalysis, getMatThanLogs } = require('../controllers/imageAnalyzer.controller');
const { SystemConfig } = require('../models');

// Đảm bảo thư mục lưu trữ ảnh tồn tại trong dự án
const uploadDir = path.join(__dirname, '../../uploads/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Disk Storage cho Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Kiểm tra tính hợp lệ của file tải lên
const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // Giới hạn kích thước file tối đa 50MB để bảo vệ tài nguyên
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận các tập tin định dạng hình ảnh (jpg, jpeg, png, webp, gif)!'));
  }
});

/**
 * Định nghĩa route POST /analyze-image
 * Thực hiện upload file ảnh với key 'productImage' và chuyển tiếp xử lý sang Controller
 */
router.post('/analyze-image', authenticateJWT, upload.single('productImage'), analyzeProductImage);
router.get('/history/:id', authenticateJWT, getAnalysisDetail);
router.delete('/:id', authenticateJWT, deleteAnalysis);

// ── GET /api/image-analyzer/mat-than-logs ────────────────────────────────────
// Trả về 16 bản phân tích thành công gần nhất để EyeSelectionModal ở VideoStudio
// PHẢI khai báo TRƯỚC route frontend-blacklist (public) để không bị nuốt mất
router.get('/mat-than-logs', authenticateJWT, getMatThanLogs);

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/image-analyzer/frontend-blacklist
//  Route công khai (không cần JWT) — Frontend gọi khi component mount
//  Đọc danh sách từ khóa cấm từ SystemConfig (key: 'blacklist_words')
//  Trả về: { success: true, keywords: ['từ1', 'từ2', ...] } (mảng lowercased)
// ═══════════════════════════════════════════════════════════════════════════
router.get('/frontend-blacklist', async (req, res) => {
  try {
    const row = await SystemConfig.findByPk('blacklist_words');

    let rawList = [];
    if (row && row.value) {
      try {
        rawList = JSON.parse(row.value);
      } catch {
        // Fallback nếu giá trị lưu dạng CSV thay vì JSON
        rawList = row.value.split(',').map(w => w.trim()).filter(Boolean);
      }
    }

    // Chuẩn hóa: loại bỏ phần tử rỗng, chuyển thành chữ viết thường
    const keywords = rawList
      .filter(w => typeof w === 'string' && w.trim().length > 0)
      .map(w => w.trim().toLowerCase());

    console.log(`[FRONTEND BLACKLIST] Đã cấp phát ${keywords.length} từ khóa cấm cho Frontend.`);

    return res.status(200).json({
      success:  true,
      keywords,
    });
  } catch (err) {
    console.error('[FRONTEND BLACKLIST] Lỗi khi đọc blacklist_words từ DB:', err.message);
    // Fallback an toàn: trả mảng rỗng để không làm crash Frontend
    return res.status(200).json({ success: false, keywords: [] });
  }
});

module.exports = router;
