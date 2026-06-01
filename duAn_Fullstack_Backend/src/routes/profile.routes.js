const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { updateProfile, getTransactions, getNotifications } = require('../controllers/profile.controller');

// Đảm bảo thư mục lưu trữ avatar tồn tại
const uploadDir = path.join(__dirname, '../../public/uploads/avatars');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình Storage cho Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Khởi tạo upload middleware với giới hạn 2MB
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB tối đa
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

// Định nghĩa route PUT /update
// Xác thực JWT, bắt file avatar từ key 'avatar', gọi hàm xử lý updateProfile
router.put('/update', authenticateJWT, upload.single('avatar'), updateProfile);

// Định nghĩa các route lấy thông tin giao dịch & thông báo
router.get('/transactions', authenticateJWT, getTransactions);
router.get('/notifications', authenticateJWT, getNotifications);

module.exports = router;
