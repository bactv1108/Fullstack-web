/**
 * ===== TEST SOCKET.IO CLIENT =====
 * File kiểm thử giả lập các Admin Client kết nối qua WebSocket
 * 
 * CÁCH SỬ DỤNG:
 * 1. Đảm bảo server đang chạy: npm run dev
 * 2. Trong terminal khác, chạy: node test_socket_client.js
 * 3. Quan sát kết nối và giao tiếp real-time
 * 
 * ⚠️ CHỈNH SỬA: Thay đổi SERVER_URL nếu server chạy trên port khác
 */

const io = require('socket.io-client');

// ===== CẤU HÌNH =====
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const CLIENT_COUNT = 3;  // Số lượng client giả lập

console.log(`
╔════════════════════════════════════════════╗
║    🧪 KHỞI ĐỘNG KIỂM THỬ SOCKET.IO      ║
╚════════════════════════════════════════════╝

📍 Kết nối đến: ${SERVER_URL}
👥 Số lượng client test: ${CLIENT_COUNT}
⏱️ Thời gian chạy: 30 giây
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

// ===== HÀM TẠO CLIENT TEST =====
function createTestClient(clientNumber) {
  const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    transports: ['websocket', 'polling']
  });

  // ===== SỰ KIỆN: KẾT NỐI THÀNH CÔNG =====
  socket.on('connect', () => {
    console.log(`✅ [Client ${clientNumber}] Kết nối thành công. ID: ${socket.id}`);
    
    // Gửi thông điệp xác thực
    socket.emit('authenticate', {
      token: `test_token_${clientNumber}`,
      adminId: `admin_${clientNumber}`,
      timestamp: new Date().toLocaleString('vi-VN')
    });

    console.log(`🔐 [Client ${clientNumber}] Gửi token xác thực`);
  });

  // ===== SỰ KIỆN: NHẬN CHÀO MỪNG TỪ SERVER =====
  socket.on('connection_established', (data) => {
    console.log(`📨 [Client ${clientNumber}] ${data.message}`);
  });

  // ===== SỰ KIỆN: NHẬN CẬP NHẬT TRẠNG THÁI HỆ THỐNG =====
  socket.on('system_status_update', (data) => {
    console.log(`📊 [Client ${clientNumber}] Cập nhật: ${data.activeConnections} client đang kết nối`);
  });

  // ===== SỰ KIỆN: PHẢN HỒI TRẠNG THÁI HỆ THỐNG =====
  socket.on('system_status_response', (data) => {
    console.log(`✔️ [Client ${clientNumber}] Trạng thái hệ thống: ${data.status}`);
  });

  // ===== SỰ KIỆN: NGẮT KẾT NỐI =====
  socket.on('disconnect', (reason) => {
    console.log(`❌ [Client ${clientNumber}] Ngắt kết nối. Lý do: ${reason}`);
  });

  // ===== SỰ KIỆN: LỖI KẾT NỐI =====
  socket.on('connect_error', (error) => {
    console.error(`⚠️ [Client ${clientNumber}] Lỗi kết nối:`, error.message);
  });

  return socket;
}

// ===== CHẠY TEST =====
const testClients = [];

console.log(`⏳ Tạo ${CLIENT_COUNT} client test...\n`);

for (let i = 1; i <= CLIENT_COUNT; i++) {
  setTimeout(() => {
    const socket = createTestClient(i);
    testClients.push(socket);
  }, i * 500);  // Tạo client với khoảng cách 500ms
}

// ===== GỬI YÊU CẦU TRẠNG THÁI HỆ THỐNG SAU 3 GIÂY =====
setTimeout(() => {
  console.log(`\n📤 Gửi yêu cầu trạng thái hệ thống...\n`);
  testClients.forEach((socket, index) => {
    if (socket.connected) {
      socket.emit('get_system_status', {
        clientId: socket.id,
        requestTime: new Date().toLocaleString('vi-VN')
      });
    }
  });
}, 3000);

// ===== GIÁM SÁT THỜI GIAN: SAU 10 GIÂY =====
setTimeout(() => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BÁNH CÁO SAU 10 GIÂY:
├─ Tổng client tạo: ${testClients.length}
├─ Client còn kết nối: ${testClients.filter(s => s.connected).length}
└─ Client ngắt kết nối: ${testClients.filter(s => !s.connected).length}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}, 10000);

// ===== DỪNG TEST GRACEFULLY SAU 30 GIÂY =====
setTimeout(() => {
  console.log(`\n🛑 Dừng test và ngắt tất cả kết nối...\n`);
  testClients.forEach(socket => socket.disconnect());
  
  setTimeout(() => {
    console.log(`
╔════════════════════════════════════════════╗
║    ✅ KIỂM THỬ HOÀN THÀNH THÀNH CÔNG     ║
╚════════════════════════════════════════════╝\n`);
    process.exit(0);
  }, 1000);
}, 30000);
