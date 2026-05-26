const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'], // Frontend & Admin URLs
  credentials: true
}));

app.use(express.json());

// Real-time notification stream (SSE) for Admin
let clients = [];

app.get('/api/admin/notifications/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.push(res);

  // Send initial notification
  const welcomeNotif = {
    id: Date.now(),
    type: 'success',
    title: 'Hệ thống kết nối',
    message: 'Đã thiết lập liên kết thời gian thực với Server!',
    time: 'Vừa xong'
  };
  res.write(`data: ${JSON.stringify(welcomeNotif)}\n\n`);

  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// Periodic notification broadcast (simulating changes from server side)
const eventTypes = [
  { type: 'info', title: 'Người dùng đăng ký', message: 'Tài khoản mới "viet_anh99@gmail.com" vừa đăng ký thành công.' },
  { type: 'success', title: 'Hoàn thành render', message: 'Video ID #4322 của Trần Bắc đã kết xuất thành công.' },
  { type: 'warning', title: 'Cảnh báo tài nguyên', message: 'ElevenLabs API usage đã đạt ngưỡng 85% dung lượng.' },
  { type: 'danger', title: 'Kiểm duyệt nội dung', message: 'Hệ thống tự động ẩn video ID #4325 do phát hiện từ khoá cấm.' },
  { type: 'info', title: 'Giao dịch mới', message: 'Người dùng Nguyễn Oanh vừa nạp 200 Credits.' }
];

setInterval(() => {
  if (clients.length > 0) {
    const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const notif = {
      id: Date.now(),
      type: randomEvent.type,
      title: randomEvent.title,
      message: randomEvent.message,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    clients.forEach(client => {
      client.write(`data: ${JSON.stringify(notif)}\n\n`);
    });
  }
}, 10000); // Broadcast every 10 seconds

// Routes
app.use('/api/auth', authRoutes);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
