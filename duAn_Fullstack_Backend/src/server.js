const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const assetRouter = require('./routes/asset.route');

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'], // Frontend & Admin URLs
  credentials: true
}));

// Body-parsing middleware
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Routes mounted below body-parser middlewares
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/assets', assetRouter);

const PORT = process.env.PORT || 3000;

const db = require('./models');
const { startScheduler } = require('./services/scheduler.service');

// Database synchronization executing correctly on startup
db.sequelize.sync({ force: false }).then(() => {
  console.log('Database synced successfully.');
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err.message);
  // Start server even if DB connection fails temporarily
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} (Database sync failed)`);
  });
});
