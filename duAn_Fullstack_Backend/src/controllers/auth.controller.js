const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const axios = require('axios');
const UAParser = require('ua-parser-js');
const db = require('../config/db');
const queueService = require('../services/queue.service');
const authService = require('../services/auth.service');
const { User, Transaction, UserSession, Package, sequelize } = require('../models');
require('dotenv').config();

// ── Helper: Ghi nhận phiên đăng nhập vào bảng user_sessions ──────────────────
const recordSession = async (userId, refreshToken, userAgent, rawIp) => {
  try {
    // 1. Parse User-Agent → device_string
    const parser = new UAParser(userAgent || '');
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const browserName = browser.name ? `${browser.name} Browser` : 'Unknown Browser';
    const osName = os.name
      ? `${os.name}${os.version ? ' ' + os.version : ''} OS`
      : 'Unknown OS';
    const deviceModel = device.model ? ` (${device.vendor || ''} ${device.model})`.trim() : '';
    const device_string = `${browserName} — ${osName}${deviceModel}`;

    // 2. Lấy IP thực (bỏ qua IPv6 prefix)
    let ip = (rawIp || '').replace('::ffff:', '').trim();
    if (!ip) ip = '127.0.0.1';

    // 3. Lấy vị trí qua ip-api.com
    let location = 'Hà Nội, Việt Nam'; // fallback cho localhost
    const isLocalhost = ['127.0.0.1', '::1', 'localhost', ''].includes(ip);
    if (!isLocalhost) {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${ip}?lang=vi`, { timeout: 3000 });
        const geo = geoRes.data;
        if (geo && geo.status === 'success') {
          location = `${geo.city || ''}, ${geo.country || ''}`.replace(/^,\s*/, '').trim();
        }
      } catch (geoErr) {
        console.warn('[SESSION] ip-api lookup failed:', geoErr.message);
      }
    }

    // 4. INSERT bản ghi vào user_sessions
    await UserSession.create({
      user_id: userId,
      refresh_token: refreshToken,
      device_string,
      ip_address: ip,
      location,
    });

    console.log(`[SESSION] ✅ Ghi nhận phiên mới — userId: ${userId} | device: ${device_string} | ip: ${ip}`);
  } catch (err) {
    // Không để lỗi ghi session làm hỏng flow đăng nhập
    console.error('[SESSION] recordSession error:', err.message);
  }
};

// Helper to parse cookies manually from raw headers
const parseCookies = (cookieHeader) => {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
};

// Tái sử dụng dịch vụ gửi email từ email.service
const { sendVerificationEmail, sendForgotPasswordEmail } = require('../services/email.service');

// ── Google OAuth (existing) ─────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL || process.env.GOOGLE_REDIRECT_URI
);

const googleAuth = (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  res.redirect(url);
};

const googleCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: 'v2',
    });

    const userInfoResponse = await oauth2.userinfo.get();
    const { id: google_id, email, name, picture: avatar } = userInfoResponse.data;

    const refresh_token = tokens.refresh_token;

    const { Op } = require('sequelize');

    // Check if user exists using standard Sequelize ORM
    let user = await User.findOne({
      where: {
        [Op.or]: [
          { google_id },
          { email }
        ]
      }
    });

    if (user) {
      // UPSERT: Update google_id, name, avatar, is_verified, and conditionally refresh_token
      user.name = name;
      user.avatar = avatar;
      user.is_verified = true;
      if (!user.google_id && google_id) {
        user.google_id = google_id;
      }
      if (refresh_token) {
        user.refresh_token = refresh_token;
      }
      await user.save();
    } else {
      // 1. Truy vấn cấu hình gói FREE từ Database
      const freePackage = await Package.findOne({ where: { id: 'free' } });

      // 2. Chốt chặn nghiêm ngặt: Nếu DB chưa cấu hình gói FREE, báo lỗi hệ thống ngay lập tức
      if (!freePackage) {
        console.error("[CRITICAL ERROR]: Gói cước 'free' chưa được cấu hình trong Database!");
        return res.status(500).json({
          success: false,
          message: "Lỗi hệ thống: Cấu hình gói mặc định không tồn tại. Vui lòng liên hệ Admin!"
        });
      }

      const defaultFreeCredits = freePackage.credits;

      // INSERT using sequelize.transaction() to guarantee atomic registration gifts
      user = await sequelize.transaction(async (t) => {
        const newUser = await User.create({
          google_id,
          email,
          name,
          avatar,
          refresh_token: refresh_token || null,
          is_verified: true,
          credits: defaultFreeCredits,
          credits_balance: defaultFreeCredits
        }, { transaction: t });

        // Sinh mã giao dịch tự động dạng TRX- kết hợp chuỗi ngẫu nhiên
        const transactionId = 'TRX-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

        // 2. Tạo tự động một bản ghi lịch sử giao dịch trong bảng transactions
        await Transaction.create({
          id: transactionId,
          userId: newUser.id,
          package_name: (freePackage.name === 'tiền lương' ? 'Hệ thống tặng' : freePackage.name) || 'Gói Free',
          amount: 0,
          credits_added: defaultFreeCredits,
          status: 'success', // Trạng thái "Thành công" theo cấu hình
          type: 'Hệ thống tặng' // Phân loại giao dịch hiển thị trên UI
        }, { transaction: t });

        return newUser;
      });
    }

    // Sign system tokens
    const systemTokens = authService.generateTokens(user);
    await authService.storeRefreshToken(user.id, systemTokens.refresh_token);

    // ── Ghi nhận phiên đăng nhập qua Google OAuth ────────────────────
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    await recordSession(user.id, systemTokens.refresh_token, req.headers['user-agent'], rawIp);
    // 📡 Bắn real-time — cập nhật danh sách phiên
    if (typeof req.app.emitSessionChanged === 'function') req.app.emitSessionChanged(user.id);

    // Save refresh token in HttpOnly cookie
    res.cookie('refresh_token', systemTokens.refresh_token, authService.getCookieOptions());

    // Redirect back to frontend with both access token and refresh token
    const frontendRedirectUrl = `${process.env.FRONTEND_URL}/auth/google/callback?token=${systemTokens.access_token}&refresh_token=${systemTokens.refresh_token}`;
    res.redirect(frontendRedirectUrl);

  } catch (error) {
    console.error('[AUTH] Google Callback error:', error.message);
    res.status(500).json({ error: 'Internal Server Error during Google Authentication' });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  TRADITIONAL AUTH: Register, Login, Verify Email, Forgot Password
// ═══════════════════════════════════════════════════════════════════

// ── REGISTER ────────────────────────────────────────────────────────
const register = async (request, response) => {
  const { name, email, password } = request.body;
  console.log(`[AUTH] POST /register — email: ${email}`);

  // ── Validation ──
  if (!name || !email || !password) {
    console.log('[AUTH] Validation failed: Missing required fields');
    return response.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin (tên, email, mật khẩu).' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log(`[AUTH] Validation failed: Invalid email format — ${email}`);
    return response.status(400).json({ message: 'Email không đúng định dạng.' });
  }

  if (password.length < 8) {
    console.log('[AUTH] Validation failed: Password too short');
    return response.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }

  try {
    // Check for existing email using standard Sequelize ORM
    const existingUser = await User.findOne({
      where: { email },
      attributes: ['id']
    });
    if (existingUser) {
      console.log(`[AUTH] Validation failed: Email already exists — ${email}`);
      return response.status(409).json({ message: 'Email này đã được đăng ký.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token and expiration date
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ kể từ thời điểm hiện tại

    // 1. Truy vấn cấu hình gói FREE từ Database
    const freePackage = await Package.findOne({ where: { id: 'free' } });

    // 2. Chốt chặn nghiêm ngặt: Nếu DB chưa cấu hình gói FREE, báo lỗi hệ thống ngay lập tức
    if (!freePackage) {
      console.error("[CRITICAL ERROR]: Gói cước 'free' chưa được cấu hình trong Database!");
      return response.status(500).json({
        success: false,
        message: "Lỗi hệ thống: Cấu hình gói mặc định không tồn tại. Vui lòng liên hệ Admin!"
      });
    }

    const defaultFreeCredits = freePackage.credits;

    // Sử dụng sequelize.transaction() để bọc cả hai câu lệnh chèn người dùng mới và chèn giao dịch hệ thống tặng
    await sequelize.transaction(async (databaseTransaction) => {
      // 1. Khởi tạo User mới với số credits động
      const newUser = await User.create({
        name,
        email,
        password_hash: passwordHash,
        is_verified: false,
        verification_token: verificationToken,
        verification_token_expires: verificationTokenExpires,
        credits: defaultFreeCredits,
        credits_balance: defaultFreeCredits
      }, { transaction: databaseTransaction });

      // Sinh mã giao dịch tự động dạng TRX- kết hợp chuỗi ngẫu nhiên
      const transactionId = 'TRX-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

      // 2. Tạo tự động một bản ghi lịch sử giao dịch trong bảng transactions
      await Transaction.create({
        id: transactionId,
        userId: newUser.id,
        package_name: (freePackage.name === 'tiền lương' ? 'Hệ thống tặng' : freePackage.name) || 'Gói Free',
        amount: 0,
        credits_added: defaultFreeCredits,
        status: 'success', // Trạng thái "Thành công" theo cấu hình
        type: 'Hệ thống tặng' // Phân loại giao dịch hiển thị trên UI
      }, { transaction: databaseTransaction });
    });

    // Xây dựng đường dẫn liên kết kích hoạt tài khoản có cấu trúc tường minh truyền lên Frontend
    const activationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Gọi hàm dịch vụ gửi thư trực tiếp và bất đồng bộ trong một khối lệnh try-catch riêng biệt để phòng thủ tuyệt đối
    // Lỗi từ email không bao giờ được phép chặn tiến trình phản hồi đăng ký thành công về giao diện Frontend
    sendVerificationEmail(email, activationUrl, name)
      .then((sendVerificationEmailResult) => {
        console.log(`[EMAIL SUCCESS] Đã gửi thư xác thực thành công tới địa chỉ: ${email}`);
      })
      .catch((emailVerificationError) => {
        console.error('[EMAIL ERROR] Gặp lỗi nghiêm trọng khi kích hoạt tiến trình gửi email xác thực:', emailVerificationError.message);
      });

    return response.status(201).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.' });

  } catch (registrationError) {
    console.error('[AUTH] Register error:', registrationError.message);
    return response.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── VERIFY EMAIL ────────────────────────────────────────────────────
const verifyEmail = async (request, response) => {
  const { token } = request.query;
  console.log(`[AUTH] GET /verify-email — token: ${token ? token.substring(0, 12) + '...' : 'MISSING'}`);

  if (!token) {
    console.log('[AUTH] Validation failed: Missing verification token');
    return response.status(400).json({ message: 'Token xác thực không hợp lệ.' });
  }

  try {
    const [databaseQueryResultRows] = await db.execute(
      'SELECT id, is_verified, verification_token_expires FROM users WHERE verification_token = ?',
      [token]
    );

    console.log('[DEBUG VERIFY] Token client gửi lên:', token);

    if (databaseQueryResultRows.length === 0) {
      console.log('[DEBUG VERIFY] MySQL không tìm thấy user nào khớp với token này');
      console.log('[AUTH] Validation failed: Token not found in database');
      return response.status(400).json({ message: 'Token xác thực không hợp lệ hoặc đã hết hạn.' });
    }

    const matchedUser = databaseQueryResultRows[0];
    console.log('[DEBUG VERIFY] Khớp user. Giờ hết hạn trong DB:', matchedUser.verification_token_expires, 'Giờ hiện tại của Server:', new Date());

    // Kiểm tra thời hạn hiệu lực của mã xác thực bằng Epoch time (timestamp số) để tránh lệch múi giờ
    if (matchedUser.verification_token_expires) {
      const tokenExpirationTimestamp = new Date(matchedUser.verification_token_expires).getTime();
      const currentTimestamp = Date.now();
      if (currentTimestamp > tokenExpirationTimestamp) {
        console.log('[AUTH] Validation failed: Verification token has expired');
        return response.status(400).json({ message: 'Mã xác thực đã hết hạn hiệu lực. Vui lòng yêu cầu gửi lại mã mới.' });
      }
    }

    if (matchedUser.is_verified === 1) {
      return response.status(200).json({ message: 'Tài khoản đã được xác thực trước đó.', status: 'already_verified' });
    }

    // Cập nhật trạng thái người dùng thành đã xác thực và xóa bỏ token xác thực
    await db.execute(
      'UPDATE users SET is_verified = 1, verification_token = NULL, verification_token_expires = NULL WHERE id = ?',
      [matchedUser.id]
    );

    console.log(`[AUTH] User ID ${matchedUser.id} verified successfully.`);
    return response.status(200).json({ message: 'Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay.', status: 'success' });

  } catch (error) {
    console.error('[AUTH] Verify Email Error:', error);
    return response.status(500).json({ message: 'Lỗi hệ thống trong quá trình xác thực email.' });
  }
};

// ── LOGIN ───────────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;
  console.log(`[AUTH] POST /login — email: ${email}`);

  if (!email || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu.' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email không tồn tại trên hệ thống.' });
    }

    const user = rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ message: 'Tài khoản này sử dụng đăng nhập Google. Vui lòng đăng nhập bằng Google.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Mật khẩu không chính xác.' });
    }

    if (user.is_verified !== 1) {
      return res.status(403).json({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn.',
      });
    }

    if (user.status === 'Banned') {
      return res.status(403).json({ message: 'Tài khoản của bạn đã bị khoá.' });
    }

    // ── 2FA Check: if enabled, pause here and ask for OTP ──────────
    if (user.is_two_factor_enabled) {
      console.log(`[AUTH] 2FA required for user ID: ${user.id}`);
      return res.status(200).json({
        success: true,
        require2FA: true,
        userId: user.id,
        message: 'Vui lòng nhập mã 6 số từ ứng dụng Authenticator.'
      });
    }

    // Generate real tokens via authService
    const tokens = authService.generateTokens(user);
    await authService.storeRefreshToken(user.id, tokens.refresh_token);

    // Clear verification token from database upon successful login if present
    if (user.verification_token) {
      await db.execute('UPDATE users SET verification_token = NULL WHERE id = ?', [user.id]);
    }

    // ── Ghi nhận phiên đăng nhập mới ────────────────────────────────
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    await recordSession(user.id, tokens.refresh_token, req.headers['user-agent'], rawIp);
    // 📡 Bắn real-time — cập nhật danh sách phiên
    if (typeof req.app.emitSessionChanged === 'function') req.app.emitSessionChanged(user.id);

    // Save refresh token in HttpOnly cookie
    res.cookie('refresh_token', tokens.refresh_token, authService.getCookieOptions());

    return res.status(200).json({
      message: 'Đăng nhập thành công!',
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, avatar: user.avatar },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });

  } catch (error) {
    console.error('[AUTH] Login error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── REFRESH TOKEN ───────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const oldRefreshToken = req.body.refreshToken || req.body.refresh_token || cookies.refresh_token || req.query.refreshToken || req.query.refresh_token;

    if (!oldRefreshToken) {
      return res.status(400).json({ success: false, message: 'Thiếu Refresh Token.' });
    }

    const result = await authService.rotateTokens(oldRefreshToken);
    
    // Save new refresh token in HttpOnly cookie
    res.cookie('refresh_token', result.tokens.refresh_token, authService.getCookieOptions());

    return res.status(200).json({
      success: true,
      accessToken: result.tokens.access_token,
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
      refreshToken: result.tokens.refresh_token
    });
  } catch (err) {
    console.error('[AUTH] Refresh Token error:', err.message);

    // If token invalid, attempt to clear token database record for the user session
    try {
      const cookies = parseCookies(req.headers.cookie);
      const oldRefreshToken = req.body.refreshToken || req.body.refresh_token || cookies.refresh_token || req.query.refreshToken || req.query.refresh_token;
      if (oldRefreshToken) {
        const decoded = jwt.decode(oldRefreshToken);
        if (decoded && decoded.id) {
          const { User } = require('../models');
          const user = await User.findByPk(decoded.id);
          if (user) {
            user.refresh_token = null;
            await user.save();
          }
        }
      }
    } catch (e) {
      console.error('[AUTH] Failed to clear invalid token record:', e.message);
    }

    res.clearCookie('refresh_token');

    return res.status(403).json({ 
      success: false, 
      message: 'Refresh Token không hợp lệ hoặc đã hết hạn.' 
    });
  }
};


// ── RESEND VERIFICATION ─────────────────────────────────────────────
const resendVerification = async (request, response) => {
  const { email } = request.body;
  console.log(`[AUTH] POST /resend-verification — email: ${email}`);

  if (!email) {
    console.log('[AUTH] Validation failed: Missing email');
    return response.status(400).json({ message: 'Vui lòng nhập email.' });
  }

  try {
    const [databaseQueryResultRows] = await db.execute(
      'SELECT id, name, is_verified FROM users WHERE email = ?',
      [email]
    );

    if (databaseQueryResultRows.length === 0) {
      // Don't reveal whether email exists for security
      return response.status(200).json({ message: 'Nếu email tồn tại, chúng tôi đã gửi lại link xác thực.' });
    }

    const matchedUser = databaseQueryResultRows[0];

    if (matchedUser.is_verified === 1) {
      return response.status(200).json({ message: 'Tài khoản đã được xác thực. Bạn có thể đăng nhập.' });
    }

    // Generate new token and expiration date
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 giờ kể từ thời điểm hiện tại

    await db.execute(
      'UPDATE users SET verification_token = ?, verification_token_expires = ? WHERE id = ?',
      [verificationToken, verificationTokenExpires, matchedUser.id]
    );

    // Xây dựng đường dẫn liên kết kích hoạt tài khoản có cấu trúc tường minh truyền lên Frontend
    const activationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    // Gọi hàm dịch vụ gửi thư trực tiếp và bất đồng bộ trong một khối lệnh try-catch riêng biệt để phòng thủ tuyệt đối
    sendVerificationEmail(email, activationUrl, matchedUser.name)
      .then((sendVerificationEmailResult) => {
        console.log(`[EMAIL SUCCESS resend] Đã gửi lại thư xác thực thành công tới địa chỉ: ${email}`);
      })
      .catch((emailVerificationError) => {
        console.error('[EMAIL ERROR resend] Gặp lỗi nghiêm trọng khi kích hoạt tiến trình gửi email xác thực lại:', emailVerificationError.message);
      });

    return response.status(200).json({ message: 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.' });

  } catch (resendVerificationProcessError) {
    console.error('[AUTH] Resend verification error:', resendVerificationProcessError.message);
    return response.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── FORGOT PASSWORD ─────────────────────────────────────────────────
const forgotPassword = async (request, response) => {
  const { email } = request.body;
  console.log(`[AUTH] POST /forgot-password — email: ${email}`);

  if (!email) {
    console.log('[AUTH] Validation failed: Missing email');
    return response.status(400).json({ message: 'Vui lòng nhập email.' });
  }

  try {
    // Tìm kiếm người dùng trong cơ sở dữ liệu dựa trên địa chỉ email
    const matchedUser = await User.findOne({
      where: { email }
    });

    if (!matchedUser) {
      console.log(`[AUTH] Forgot password validation failed: Email not found — ${email}`);
      return response.status(404).json({ message: 'Địa chỉ email không tồn tại trên hệ thống.' });
    }

    // Sinh mã ngẫu nhiên khôi phục mật khẩu dài 32 ký tự dạng chuỗi thập lục phân
    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 giờ kể từ thời điểm hiện tại

    // Lưu mã xác thực khôi phục mật khẩu và thời gian hết hạn vào bản ghi người dùng
    matchedUser.reset_password_token = resetPasswordToken;
    matchedUser.reset_password_expires = resetPasswordExpires;
    await matchedUser.save();

    // Xây dựng đường dẫn liên kết đặt lại mật khẩu trỏ thẳng về giao diện ứng dụng khách Frontend
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetPasswordToken}`;

    // Gọi hàm gửi email đặt lại mật khẩu ngầm bất đồng bộ không chặn luồng phản hồi của Frontend
    sendForgotPasswordEmail(email, resetUrl, matchedUser.name)
      .then((sendForgotPasswordEmailResult) => {
        console.log(`[EMAIL SUCCESS forgot] Đã gửi email đặt lại mật khẩu thành công tới địa chỉ: ${email}`);
      })
      .catch((emailForgotPasswordError) => {
        console.error('[EMAIL ERROR forgot] Gặp lỗi nghiêm trọng khi kích hoạt tiến trình gửi email đặt lại mật khẩu:', emailForgotPasswordError.message);
      });

    return response.status(200).json({ success: true, message: 'Liên kết đặt lại mật khẩu đã được gửi đi thành công.' });

  } catch (forgotPasswordProcessError) {
    console.error('[AUTH] Forgot password error:', forgotPasswordProcessError.message);
    return response.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── RESET PASSWORD (TÍCH HỢP MỚI ĐỂ ĐÓNG HÒM LOGIC) ─────────────────────
const resetPassword = async (request, response) => {
  console.log('[DEBUG RESET] Toàn bộ dữ liệu Body nhận được:', request.body);
  console.log('[DEBUG RESET] Toàn bộ dữ liệu Query nhận được:', request.query);

  const token = request.body.token || request.query.token;
  const newPassword = request.body.newPassword || request.body.password;

  console.log('[DEBUG RESET] Token sau khi trích xuất:', token);
  console.log(`[AUTH] POST /reset-password — token: ${token ? token.substring(0, 12) + '...' : 'MISSING'}`);

  if (!token) {
    return response.status(400).json({ success: false, message: 'Mã xác thực đặt lại mật khẩu không hợp lệ.' });
  }

  if (!newPassword) {
    return response.status(400).json({ success: false, message: 'Thiếu thông tin mật khẩu mới.' });
  }

  if (newPassword.length < 8) {
    return response.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
  }

  try {
    // Bước 1: Tìm kiếm tài khoản duy nhất chỉ dựa trên chuỗi Token (Sequelize ORM)
    const userRecord = await User.findOne({
      where: { reset_password_token: token }
    });

    if (!userRecord) {
      console.log('[AUTH] Reset password validation failed: Token not found in database');
      return response.status(400).json({ success: false, message: 'Mã xác thực đặt lại mật khẩu không hợp lệ.' });
    }

    // Bước 2: Thẩm định thời gian hết hạn bằng dấu thời gian số nguyên (Bẻ gãy lỗi lệch múi giờ)
    const expirationTimestamp = new Date(userRecord.reset_password_expires).getTime();
    const currentTimestamp = Date.now();

    if (currentTimestamp > expirationTimestamp) {
      console.log('[AUTH] Reset password validation failed: Token expired');
      return response.status(400).json({ success: false, message: 'Mã xác thực đặt lại mật khẩu đã hết hạn hiệu lực.' });
    }

    // Kiểm tra xem mật khẩu mới có trùng mật khẩu cũ không
    if (userRecord.password_hash) {
      const isSamePassword = await bcrypt.compare(newPassword, userRecord.password_hash);
      if (isSamePassword) {
        return response.status(400).json({ success: false, message: 'Mật khẩu mới không được trùng với mật khẩu cũ.' });
      }
    }

    // Bước 3: Cập nhật mật khẩu mới và dọn dẹp bộ nhớ đệm
    const newHashedPassword = await bcrypt.hash(newPassword, 12);
    
    userRecord.password_hash = newHashedPassword;
    userRecord.reset_password_token = null;
    userRecord.reset_password_expires = null;
    await userRecord.save();

    console.log(`[AUTH] User ID ${userRecord.id} reset password successfully.`);

    // Phản hồi kết quả về Frontend
    return response.status(200).json({ success: true, message: 'Mật khẩu của bạn đã được cập nhật thành công. Vui lòng đăng nhập lại.' });

  } catch (resetPasswordProcessError) {
    console.error('[AUTH] Reset password error:', resetPasswordProcessError.message);
    return response.status(500).json({ success: false, message: 'Lỗi hệ thống từ server. Vui lòng thử lại sau.' });
  }
};

const logout = async (request, response) => {
  try {
    response.clearCookie('refresh_token', authService.getCookieOptions());
    return response.status(200).json({ success: true, message: 'Đăng xuất thành công.' });
  } catch (error) {
    console.error('[AUTH] Logout error:', error.message);
    return response.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng xuất.' });
  }
};

module.exports = {
  googleAuth,
  googleCallback,
  register,
  verifyEmail,
  login,
  logout,
  refreshToken,
  resendVerification,
  forgotPassword,
  resetPassword,
};
