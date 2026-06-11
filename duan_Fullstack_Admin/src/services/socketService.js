/**
 * socketService.js
 * Singleton Socket.io-client — dùng chung một kết nối cho toàn bộ Admin Panel.
 * Tránh tạo nhiều kết nối gây leak.
 */
import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';

let socketInstance = null;

/**
 * Khởi tạo (hoặc trả về) socket instance.
 * Tự động gửi sự kiện 'authenticate' sau khi kết nối.
 */
export const getSocket = () => {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (!socketInstance) {
    socketInstance = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      console.log('[SOCKET] Kết nối thành công. socketId:', socketInstance.id);
      authenticateSocket();
    });

    socketInstance.on('authenticated', (data) => {
      console.log('[SOCKET] Xác thực thành công:', data);
    });

    socketInstance.on('auth_error', (data) => {
      console.warn('[SOCKET] Xác thực thất bại:', data.message);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[SOCKET] Ngắt kết nối. Lý do:', reason);
    });
  } else if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

/**
 * Gửi access_token + refresh_token lên server để join user_room.
 * Gọi sau khi socket connect thành công.
 */
export const authenticateSocket = () => {
  const socket = socketInstance;
  if (!socket) return;

  const accessToken =
    localStorage.getItem('admin_access_token') ||
    localStorage.getItem('access_token');
  const refreshToken =
    localStorage.getItem('admin_refresh_token') ||
    localStorage.getItem('refresh_token');

  if (!accessToken) {
    console.warn('[SOCKET] Không có access token để xác thực socket.');
    return;
  }

  socket.emit('authenticate', {
    token: accessToken,
    refresh_token: refreshToken,
  });
};

/**
 * Ngắt kết nối socket (dùng khi logout).
 */
export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    console.log('[SOCKET] Đã ngắt kết nối socket singleton.');
  }
};

export default { getSocket, authenticateSocket, disconnectSocket };
