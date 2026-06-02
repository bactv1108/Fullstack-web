const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Verify Bearer token in headers and attach payload to req.user
 */
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Quyền truy cập bị từ chối. Vui lòng cung cấp token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;

    // Đảm bảo Token của tài khoản mới phải tìm thấy trong DB
    if (decoded && decoded.id) {
      const dbUser = await User.findByPk(decoded.id);
      if (!dbUser) {
        req.user = null;
      }
    } else {
      req.user = null;
    }

    if (!req.user) {
        console.log("❌ [AUTH FAILED] Chặn đứng API do không tìm thấy thông tin User từ Token!");
        return res.status(401).json({ success: false, message: "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại!" });
    }

    next();
  } catch (error) {
    console.error('[AUTH MIDDLEWARE] Token verification failed:', error.message);
    return res.status(401).json({ success: false, message: "Token expired or invalid" });
  }
};

/**
 * Authorize only users with role 'Admin' or 'Super Admin'
 */
const isAdmin = (req, res, next) => {
  if (!req.user || !['Admin', 'Super Admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Quyền truy cập bị từ chối. Chỉ dành cho Admin.' });
  }
  next();
};

module.exports = {
  authenticateJWT,
  isAdmin,
};
