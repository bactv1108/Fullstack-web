const multer = require('multer');
const path = require('path');
const fs = require('fs');

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
    const userId = req.user && req.user.id ? req.user.id : 'unknown';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    // e.g. avatar-user-44-1685934523423.jpg
    cb(null, `avatar-user-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

// Khởi tạo upload middleware với giới hạn 2MB và bộ lọc định dạng ảnh
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB tối đa
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Chỉ chấp nhận các tập tin định dạng hình ảnh (jpg, jpeg, png, webp)!'));
  }
});

module.exports = upload;
