/**
 * socketService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Singleton Socket.io client cho User Frontend.
 * Chịu trách nhiệm:
 *   1. Khởi tạo 1 instance duy nhất trong suốt vòng đời ứng dụng
 *   2. Kết nối và tự động gửi sự kiện 'authenticate' khi có token
 *   3. Cung cấp các helper để subscribe / unsubscribe sự kiện an toàn
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { io } from 'socket.io-client';

// ── Lấy URL backend từ biến ENV, fallback localhost:3000 ─────────────────────
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : null) ||
  'http://localhost:3000';

// ── Một socket instance duy nhất cho toàn app ────────────────────────────────
let socket = null;

/**
 * Lấy (hoặc khởi tạo) socket instance.
 * autoConnect = false để kiểm soát thời điểm kết nối.
 */
const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    // Log kết nối / ngắt kết nối để debug
    socket.on('connect', () => {
      console.log(`[SOCKET] ✅ Kết nối thành công → socketId: ${socket.id}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] ❌ Ngắt kết nối — lý do: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[SOCKET] ⚠️ Lỗi kết nối: ${err.message}`);
    });

    socket.on('authenticated', (data) => {
      console.log(`[SOCKET] 🔐 Xác thực thành công → room: ${data.room}`);
    });

    socket.on('auth_error', (data) => {
      console.warn(`[SOCKET] 🔒 Xác thực thất bại: ${data.message}`);
    });
  }
  return socket;
};

/**
 * Kết nối socket và gửi sự kiện 'authenticate' ngay sau khi connected.
 * Có thể gọi nhiều lần — chỉ kết nối nếu chưa connected.
 * @param {string} [token] - JWT access token. Nếu không truyền, tự đọc từ localStorage.
 */
const connectSocket = (token) => {
  const s = getSocket();

  // Đọc token từ tham số hoặc localStorage
  const accessToken =
    token ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('Access_token') ||
    localStorage.getItem('token');

  const refreshToken =
    localStorage.getItem('admin_refresh_token') ||
    localStorage.getItem('refresh_token');

  if (!accessToken) {
    console.warn('[SOCKET] Không có access token — bỏ qua kết nối socket.');
    return s;
  }

  // Xóa listener authenticate cũ để tránh duplicate
  s.off('connect', _onConnectAuthenticate);

  // Gắn handler: khi connect xong → authenticate ngay lập tức
  const _authPayload = { token: accessToken, refresh_token: refreshToken };
  const _handler = () => {
    s.emit('authenticate', _authPayload);
    console.log('[SOCKET] 📤 Đã gửi sự kiện authenticate.');
  };

  // Lưu tham chiếu để cleanup được
  s._authHandler = _handler;
  s.on('connect', _handler);

  if (!s.connected) {
    s.connect();
    console.log(`[SOCKET] 🔌 Đang kết nối tới ${SOCKET_URL}...`);
  } else {
    // Đã connected → authenticate ngay
    s.emit('authenticate', _authPayload);
  }

  return s;
};

/** Tham chiếu placeholder để off trước khi on mới — tránh stack overflow */
function _onConnectAuthenticate() {}

/**
 * Ngắt kết nối socket (khi logout hoặc không cần nữa).
 */
const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log('[SOCKET] 🔌 Đã ngắt kết nối socket.');
  }
};

/**
 * Đăng ký lắng nghe một sự kiện.
 * @param {string} event
 * @param {Function} handler
 */
const on = (event, handler) => {
  getSocket().on(event, handler);
};

/**
 * Hủy đăng ký lắng nghe một sự kiện (cleanup).
 * @param {string} event
 * @param {Function} [handler] - Nếu không truyền, xóa toàn bộ listener của event đó.
 */
const off = (event, handler) => {
  if (handler) {
    getSocket().off(event, handler);
  } else {
    getSocket().off(event);
  }
};

const socketService = {
  getSocket,
  connectSocket,
  disconnectSocket,
  on,
  off,
};

export default socketService;
