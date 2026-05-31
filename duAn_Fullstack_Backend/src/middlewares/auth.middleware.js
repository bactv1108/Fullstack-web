const jwt = require('jsonwebtoken');

/**
 * Verify Bearer token in headers and attach payload to req.user
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Quyền truy cập bị từ chối. Vui lòng cung cấp token.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
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
