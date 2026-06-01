const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { analyzeProductImage } = require('../controllers/imageAnalyzer.controller');

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

module.exports = router;
