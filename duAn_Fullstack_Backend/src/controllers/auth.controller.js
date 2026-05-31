const { google } = require('googleapis');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const queueService = require('../services/queue.service');
const authService = require('../services/auth.service');
require('dotenv').config();

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

// ── Nodemailer Transporter ──────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── Google OAuth (existing) ─────────────────────────────────────────
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
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

    // Check if user exists
    const [rows] = await db.execute('SELECT * FROM users WHERE google_id = ? OR email = ?', [google_id, email]);
    let user = rows[0];

    if (user) {
      // UPSERT: Update google_id, name, avatar, is_verified, and conditionally refresh_token
      let updateQuery = 'UPDATE users SET name = ?, avatar = ?, is_verified = 1';
      let queryParams = [name, avatar];

      if (!user.google_id && google_id) {
        updateQuery += ', google_id = ?';
        queryParams.push(google_id);
      }

      if (refresh_token) {
        updateQuery += ', refresh_token = ?';
        queryParams.push(refresh_token);
      }

      updateQuery += ' WHERE id = ?';
      queryParams.push(user.id);

      await db.execute(updateQuery, queryParams);

      // Update local user object for JWT
      user.name = name;
      user.avatar = avatar;
      if (!user.google_id && google_id) {
        user.google_id = google_id;
      }
      user.is_verified = 1;
    } else {
      // INSERT
      const [insertResult] = await db.execute(
          'INSERT INTO users (google_id, email, name, avatar, refresh_token, is_verified) VALUES (?, ?, ?, ?, ?, 1)',
          [google_id, email, name, avatar, refresh_token || null]
      );
      user = {
        id: insertResult.insertId,
        google_id,
        email,
        name,
        avatar,
        role: 'user'
      };
    }

    // Sign local JWT
    const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '15m' }
    );

    // Redirect back to frontend
    const frontendRedirectUrl = `http://localhost:5173/auth/google/callback?token=${token}`;
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
const register = async (req, res) => {
  const { name, email, password } = req.body;
  console.log(`[AUTH] POST /register — email: ${email}`);

  // ── Validation ──
  if (!name || !email || !password) {
    console.log('[AUTH] Validation failed: Missing required fields');
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin (tên, email, mật khẩu).' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    console.log(`[AUTH] Validation failed: Invalid email format — ${email}`);
    return res.status(400).json({ message: 'Email không đúng định dạng.' });
  }

  if (password.length < 8) {
    console.log('[AUTH] Validation failed: Password too short');
    return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 8 ký tự.' });
  }

  try {
    // Check for existing email
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log(`[AUTH] Validation failed: Email already exists — ${email}`);
      return res.status(409).json({ message: 'Email này đã được đăng ký.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verification_token = crypto.randomBytes(32).toString('hex');

    // Insert user with is_verified = 0
    await db.execute(
        'INSERT INTO users (name, email, password_hash, is_verified, verification_token) VALUES (?, ?, ?, 0, ?)',
        [name, email, password_hash, verification_token]
    );

    // Send verification email
    const verifyUrl = `http://localhost:3000/api/auth/verify-email?token=${verification_token}`;

    await queueService.enqueue('send_email', {
      to: email,
      subject: 'Xác thực tài khoản của bạn',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#18181b;border-radius:16px;color:#e4e4e7;">
          <h2 style="color:#f59e0b;margin-top:0;">Xin chào ${name},</h2>
          <p>Cảm ơn bạn đã đăng ký. Vui lòng bấm nút bên dưới để xác thực email:</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#0f0f13;font-weight:bold;text-decoration:none;border-radius:8px;margin:16px 0;">
            Xác thực Email
          </a>
          <p style="font-size:13px;color:#71717a;margin-top:20px;">Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>
        </div>
      `,
    });

    return res.status(201).json({ message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.' });

  } catch (error) {
    console.error('[AUTH] Register error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── VERIFY EMAIL ────────────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  const { token } = req.query;
  console.log(`[AUTH] GET /verify-email — token: ${token ? token.substring(0, 12) + '...' : 'MISSING'}`);

  if (!token) {
    console.log('[AUTH] Validation failed: Missing verification token');
    return res.status(400).json({ message: 'Token xác thực không hợp lệ.' });
  }

  try {
    const [rows] = await db.execute('SELECT id, is_verified FROM users WHERE verification_token = ?', [token]);

    if (rows.length === 0) {
      console.log('[AUTH] Validation failed: Token not found in database');
      return res.status(400).json({ message: 'Token xác thực không hợp lệ hoặc đã hết hạn.' });
    }

    if (rows[0].is_verified === 1) {
      return res.redirect('http://localhost:5173/login?verified=already');
    }

    // Mark as verified and clear token
    await db.execute('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [rows[0].id]);

    // Redirect to frontend login page with success flag
    return res.redirect('http://localhost:5173/login?verified=true');

  } catch (error) {
    console.error('[AUTH] Verify email error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xác thực email.' });
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

    // Generate real tokens via authService
    const tokens = authService.generateTokens(user);
    await authService.storeRefreshToken(user.id, tokens.refresh_token);

    // Save refresh token in HttpOnly cookie
    res.cookie('refresh_token', tokens.refresh_token, authService.getCookieOptions());

    return res.status(200).json({
      message: 'Đăng nhập thành công!',
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
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
const resendVerification = async (req, res) => {
  const { email } = req.body;
  console.log(`[AUTH] POST /resend-verification — email: ${email}`);

  if (!email) {
    console.log('[AUTH] Validation failed: Missing email');
    return res.status(400).json({ message: 'Vui lòng nhập email.' });
  }

  try {
    const [rows] = await db.execute('SELECT id, name, is_verified FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      // Don't reveal whether email exists for security
      return res.status(200).json({ message: 'Nếu email tồn tại, chúng tôi đã gửi lại link xác thực.' });
    }

    const user = rows[0];

    if (user.is_verified === 1) {
      return res.status(200).json({ message: 'Tài khoản đã được xác thực. Bạn có thể đăng nhập.' });
    }

    // Generate new token
    const verification_token = crypto.randomBytes(32).toString('hex');
    await db.execute('UPDATE users SET verification_token = ? WHERE id = ?', [verification_token, user.id]);

    const verifyUrl = `http://localhost:3000/api/auth/verify-email?token=${verification_token}`;

    await queueService.enqueue('send_email', {
      to: email,
      subject: 'Xác thực tài khoản của bạn (gửi lại)',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#18181b;border-radius:16px;color:#e4e4e7;">
          <h2 style="color:#f59e0b;margin-top:0;">Xin chào ${user.name},</h2>
          <p>Bạn đã yêu cầu gửi lại link xác thực. Vui lòng bấm nút bên dưới:</p>
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#0f0f13;font-weight:bold;text-decoration:none;border-radius:8px;margin:16px 0;">
            Xác thực Email
          </a>
        </div>
      `,
    });

    return res.status(200).json({ message: 'Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.' });

  } catch (error) {
    console.error('[AUTH] Resend verification error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── FORGOT PASSWORD ─────────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log(`[AUTH] POST /forgot-password — email: ${email}`);

  if (!email) {
    console.log('[AUTH] Validation failed: Missing email');
    return res.status(400).json({ message: 'Vui lòng nhập email.' });
  }

  try {
    const [rows] = await db.execute('SELECT id, name FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      // Don't reveal whether email exists
      return res.status(200).json({ message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu.' });
    }

    const user = rows[0];
    const reset_token = crypto.randomBytes(32).toString('hex');
    const reset_token_expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.execute(
        'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?',
        [reset_token, reset_token_expires, user.id]
    );

    const resetUrl = `http://localhost:5173/reset-password?token=${reset_token}`;

    await queueService.enqueue('send_email', {
      to: email,
      subject: 'Đặt lại mật khẩu',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#18181b;border-radius:16px;color:#e4e4e7;">
          <h2 style="color:#f59e0b;margin-top:0;">Xin chào ${user.name},</h2>
          <p>Bạn đã yêu cầu đặt lại mật khẩu. Bấm nút bên dưới để tiếp tục:</p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#f59e0b;color:#0f0f13;font-weight:bold;text-decoration:none;border-radius:8px;margin:16px 0;">
            Đặt lại mật khẩu
          </a>
          <p style="font-size:13px;color:#71717a;margin-top:20px;">Link có hiệu lực trong 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        </div>
      `,
    });

    return res.status(200).json({ message: 'Đã gửi link đặt lại mật khẩu đến email của bạn.' });

  } catch (error) {
    console.error('[AUTH] Forgot password error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống. Vui lòng thử lại sau.' });
  }
};

// ── RESET PASSWORD (TÍCH HỢP MỚI ĐỂ ĐÓNG HÒM LOGIC) ─────────────────────
const resetPassword = async (req, res) => {
  const { token, password } = req.body;
  console.log(`[AUTH] POST /reset-password — token: ${token ? token.substring(0, 12) + '...' : 'MISSING'}`);

  if (!token || !password) {
    return res.status(400).json({ message: 'Thiếu thông tin mã xác thực (Token) hoặc mật khẩu mới.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' });
  }

  try {
    // Tìm user có token trùng khớp
    const [rows] = await db.execute(
        'SELECT id, password_hash, reset_token_expires FROM users WHERE reset_token = ?',
        [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã từng được sử dụng.' });
    }

    const user = rows[0];

    // Kiểm tra thời hạn hiệu lực (1 giờ)
    const now = new Date();
    const expires = new Date(user.reset_token_expires);
    if (now > expires) {
      return res.status(400).json({ message: 'Mã xác thực đặt lại mật khẩu đã hết hạn hiệu lực.' });
    }

    // Kiểm tra xem mật khẩu mới có trùng mật khẩu cũ không
    if (user.password_hash) {
      const isSamePassword = await bcrypt.compare(password, user.password_hash);
      if (isSamePassword) {
        return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu cũ.' });
      }
    }

    // Băm mật khẩu mới bằng thư viện bcrypt gốc chuẩn 12 vòng băm
    const password_hash = await bcrypt.hash(password, 12);

    // Lưu đè dữ liệu mới vào cơ sở dữ liệu và dọn dẹp token
    await db.execute(
        'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
        [password_hash, user.id]
    );

    // TRẢ VỀ JSON CHUẨN ĐỂ FRONTEND KHÔNG BỊ "UNEXPECTED END OF JSON"
    return res.status(200).json({ message: 'Cập nhật mật khẩu mới vào cơ sở dữ liệu thành công!' });

  } catch (error) {
    console.error('[AUTH] Reset password error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống từ server. Vui lòng thử lại sau.' });
  }
};

module.exports = {
  googleAuth,
  googleCallback,
  register,
  verifyEmail,
  login,
  refreshToken,
  resendVerification,
  forgotPassword,
  resetPassword, // Đã kích nổ export hàm mới
};