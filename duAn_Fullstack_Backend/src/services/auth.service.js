const jwt = require('jsonwebtoken');
const { User, UserSession } = require('../models');
require('dotenv').config();

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate a new pair of Access & Refresh tokens
 */
const generateTokens = (user) => {
  const isTwoFactorEnabled = Boolean(Number(user.is_two_factor_enabled));

  const access_token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      is_two_factor_enabled: isTwoFactorEnabled,
      two_factor_enabled: isTwoFactorEnabled,
      twofa: isTwoFactorEnabled
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refresh_token = jwt.sign(
    { id: user.id },
      process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { access_token, refresh_token };
};

/**
 * Persist the refresh token in the user's database row
 */
const storeRefreshToken = async (userId, token) => {
  const user = await User.findByPk(userId);
  if (user) {
    user.refresh_token = token;
    await user.save();
  }
};

const rotatedTokensCache = new Map();

// Clear expired cache entries every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rotatedTokensCache.entries()) {
    if (now - value.rotatedAt > 30000) {
      rotatedTokensCache.delete(key);
    }
  }
}, 30000);

/**
 * Rotate access & refresh tokens using an existing refresh token
 */
const rotateTokens = async (oldRefreshToken) => {
  try {
    // Check if token is in grace period cache to prevent concurrent race conditions
    if (rotatedTokensCache.has(oldRefreshToken)) {
      const cached = rotatedTokensCache.get(oldRefreshToken);
      if (Date.now() - cached.rotatedAt < 20000) { // 20 seconds grace period
        console.log('[AUTH SERVICE] Grace period match for refresh token. Returning cached tokens.');
        return { tokens: cached.tokens, user: cached.user };
      }
    }

    const decoded = jwt.verify(
      oldRefreshToken, 
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'refresh_secret'
    );
    const user = await User.findByPk(decoded.id);

    if (!user || user.refresh_token !== oldRefreshToken || user.status === 'Banned') {
      throw new Error('Refresh token is invalid or user is banned.');
    }

    // ── Kiểm tra session trong user_sessions ────────────────────────────────
    // Nếu không tồn tại (phiên cũ trước khi có tính năng) → tự tạo mới thay vì chặn
    const sessionRow = await UserSession.findOne({
      where: { refresh_token: oldRefreshToken, user_id: user.id },
    });

    const tokens = generateTokens(user);
    await storeRefreshToken(user.id, tokens.refresh_token);

    if (sessionRow) {
      // Phiên tồn tại → cập nhật token mới (token rotation)
      await sessionRow.update({ refresh_token: tokens.refresh_token });
    } else {
      // Phiên cũ (trước khi có bảng user_sessions) → tạo mới để không bị khoá
      console.warn('[AUTH SERVICE] Legacy session detected — creating new session row.');
      await UserSession.create({
        user_id: user.id,
        refresh_token: tokens.refresh_token,
        device_string: 'Legacy Session (trước khi cài đặt tính năng)',
        ip_address: '',
        location: '',
      });
    }

    // Save in grace period cache
    rotatedTokensCache.set(oldRefreshToken, {
      tokens,
      user,
      rotatedAt: Date.now()
    });

    return { tokens, user };
  } catch (error) {
    console.error('[AUTH SERVICE] rotateTokens error:', error.message);
    throw new Error('Refresh token rotation failed: ' + error.message);
  }
};

/**
 * Get standard options for the refresh token cookie
 */
const getCookieOptions = () => {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

module.exports = {
  generateTokens,
  storeRefreshToken,
  rotateTokens,
  getCookieOptions
};
