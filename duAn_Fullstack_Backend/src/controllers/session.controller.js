const { UserSession } = require('../models');

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/v1/auth/sessions
//  Returns all active sessions for the currently authenticated user.
// ─────────────────────────────────────────────────────────────────────────────
const getSessions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    const sessions = await UserSession.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'refresh_token', 'device_string', 'ip_address', 'location', 'created_at'],
    });

    return res.status(200).json({ success: true, sessions });
  } catch (err) {
    console.error('[SESSION] getSessions error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi lấy danh sách phiên.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/v1/auth/sessions/revoke
//  Body: { sessionId }
//  1. Lấy refresh_token của phiên trước khi xóa
//  2. Xóa bản ghi khỏi DB
//  3. Bắn FORCE_LOGOUT tới socket của thiết bị bị revoke
//  4. Bắn SESSION_LIST_CHANGED tới tất cả thiết bị còn lại trong room
// ─────────────────────────────────────────────────────────────────────────────
const revokeSession = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { sessionId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }

    if (!sessionId) {
      return res.status(400).json({ success: false, message: 'Thiếu sessionId.' });
    }

    // ── Bước 1: Tìm phiên để lấy refresh_token trước khi xóa ──────────────────
    const session = await UserSession.findOne({
      where: { id: sessionId, user_id: userId },
      attributes: ['id', 'refresh_token'],
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phiên hoặc bạn không có quyền xoá.' });
    }

    const revokedRefreshToken = session.refresh_token;

    // ── Bước 2: Xóa phiên khỏi DB ─────────────────────────────────────────────
    await session.destroy();

    // ── Bước 3 & 4: Bắn FORCE_LOGOUT + SESSION_LIST_CHANGED qua WebSocket ──────
    // Lấy đối tượng app từ req để truy cập helper đã đăng ký trong server.js
    const app = req.app;
    if (app && typeof app.forceLogoutSocket === 'function') {
      app.forceLogoutSocket(userId, revokedRefreshToken);
    }

    return res.status(200).json({ success: true, message: 'Đã đăng xuất phiên thành công.' });
  } catch (err) {
    console.error('[SESSION] revokeSession error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi thu hồi phiên.' });
  }
};

module.exports = { getSessions, revokeSession };
