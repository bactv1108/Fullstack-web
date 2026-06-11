const otplib = require('otplib');
const QRCode = require('qrcode');
const { User, UserSession } = require('../models');
const authService = require('../services/auth.service');
const db = require('../config/db');
const axios = require('axios');
const UAParser = require('ua-parser-js');

// ── Helper: Ghi nhận phiên (dùng chung với auth.controller) ─────────────────
const recordSession = async (userId, refreshToken, userAgent, rawIp) => {
  try {
    const parser = new UAParser(userAgent || '');
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    const browserName = browser.name ? `${browser.name} Browser` : 'Unknown Browser';
    const osName = os.name ? `${os.name}${os.version ? ' ' + os.version : ''} OS` : 'Unknown OS';
    const deviceModel = device.model ? ` (${device.vendor || ''} ${device.model})`.trim() : '';
    const device_string = `${browserName} — ${osName}${deviceModel}`;
    let ip = (rawIp || '').replace('::ffff:', '').trim();
    if (!ip) ip = '127.0.0.1';
    let location = 'Hà Nội, Việt Nam';
    const isLocalhost = ['127.0.0.1', '::1', 'localhost', ''].includes(ip);
    if (!isLocalhost) {
      try {
        const geoRes = await axios.get(`http://ip-api.com/json/${ip}?lang=vi`, { timeout: 3000 });
        const geo = geoRes.data;
        if (geo && geo.status === 'success') {
          location = `${geo.city || ''}, ${geo.country || ''}`.replace(/^,\s*/, '').trim();
        }
      } catch (_) {}
    }
    await UserSession.create({ user_id: userId, refresh_token: refreshToken, device_string, ip_address: ip, location });
    console.log(`[SESSION] ✅ 2FA phiên mới — userId: ${userId} | device: ${device_string}`);
  } catch (err) {
    console.error('[SESSION] 2FA recordSession error:', err.message);
  }
};

const authenticator = otplib.authenticator || otplib;

const verifyOtpToken = async (token, secret) => {
  const result = await authenticator.verify({ token: String(token), secret });
  return typeof result === 'object' ? result.valid === true : result === true;
};

const generate2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await db.execute('SELECT email FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }
    const email = rows[0].email;

    const secret = otplib.generateSecret();
    const uri = otplib.generateURI({ issuer: 'DuAn Fullstack', label: email, secret });
    const qrCode = await QRCode.toDataURL(uri);

    return res.status(200).json({
      success: true,
      secret,
      qrCode,
    });
  } catch (error) {
    console.error('[2FA] Generate error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tạo mã 2FA.' });
  }
};

const enable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { secret, token } = req.body;

    if (!secret || !token) {
      return res.status(400).json({ message: 'Thiếu thông tin secret hoặc mã xác thực.' });
    }

    const isValid = await verifyOtpToken(token, secret);
    if (!isValid) {
      return res.status(400).json({ message: 'Mã xác thực không chính xác. Vui lòng thử lại.' });
    }

    await db.execute(
      'UPDATE users SET two_factor_secret = ?, is_two_factor_enabled = 1 WHERE id = ?',
      [secret, userId]
    );

    // Lấy thông tin user mới nhất từ DB để ký token có payload cập nhật
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Cấp lại cặp token mới (payload mới nhất có 2FA = true)
    const tokens = authService.generateTokens(user);
    await authService.storeRefreshToken(user.id, tokens.refresh_token);

    // Ghi refresh token mới vào cookie httpOnly
    res.cookie('refresh_token', tokens.refresh_token, authService.getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Đã kích hoạt bảo mật hai lớp (2FA) thành công!',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error('[2FA] Enable error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi kích hoạt 2FA.' });
  }
};

const disable2FA = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Thiếu mã xác thực.' });
    }

    const [rows] = await db.execute(
      'SELECT two_factor_secret FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    const storedSecret = rows[0].two_factor_secret;
    if (!storedSecret) {
      return res.status(400).json({ message: '2FA chưa được kích hoạt.' });
    }

    const isValid = await verifyOtpToken(token, storedSecret);
    if (!isValid) {
      return res.status(400).json({ message: 'Mã xác thực không chính xác.' });
    }

    await db.execute(
      'UPDATE users SET two_factor_secret = NULL, is_two_factor_enabled = 0 WHERE id = ?',
      [userId]
    );

    // Lấy user mới nhất từ DB để ký token mới (payload không còn 2FA)
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Cấp lại cặp token mới
    const tokens = authService.generateTokens(user);
    await authService.storeRefreshToken(user.id, tokens.refresh_token);

    // Ghi refresh token mới vào cookie httpOnly
    res.cookie('refresh_token', tokens.refresh_token, authService.getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Đã tắt bảo mật hai lớp (2FA).',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error('[2FA] Disable error:', error.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tắt 2FA.' });
  }
};

const verifyLogin2FA = async (req, res) => {
  try {
    const { userId, token, code } = req.body;
    const otpToken = token || code;

    if (!userId || !otpToken) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng nhập.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Người dùng không tồn tại.' });
    }

    if (!user.is_two_factor_enabled || !user.two_factor_secret) {
      return res.status(400).json({ success: false, message: 'Tài khoản chưa cấu hình 2FA' });
    }

    const isValid = await verifyOtpToken(otpToken, user.two_factor_secret);

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Mã xác thực 2FA không chính xác hoặc đã hết hạn' });
    }

    const tokens = authService.generateTokens(user);
    await authService.storeRefreshToken(user.id, tokens.refresh_token);

    if (user.verification_token) {
      await db.execute('UPDATE users SET verification_token = NULL WHERE id = ?', [user.id]);
    }

    // ── Ghi nhận phiên sau 2FA ──────────────────────────────────
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    await recordSession(user.id, tokens.refresh_token, req.headers['user-agent'], rawIp);

    res.cookie('refresh_token', tokens.refresh_token, authService.getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công!',
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  } catch (error) {
    console.error('🔥 LỖI TẠI VERIFY-LOGIN 2FA:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xác thực 2FA' });
  }
};

module.exports = {
  generate2FA,
  enable2FA,
  disable2FA,
  verifyLogin2FA,
};
