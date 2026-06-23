const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
// CHÈN THÊM ĐOẠN NÀY:
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('❌ [CRITICAL] JWT_SECRET hoặc JWT_REFRESH_SECRET chưa được cấu hình trong file .env!');
  process.exit(1); // Dừng server ngay lập tức
}

// ── Ngrok Auto-Tunnel (chỉ dev) ───────────────────────────────────────────────
// Import an toàn: nếu package chưa được cài sẽ bỏ qua thay vì crash server
let ngrok = null;
try {
  ngrok = require('@ngrok/ngrok');
} catch (_) {
  console.warn('[NGROK] ⚠️  Package @ngrok/ngrok chưa được cài đặt — bỏ qua auto-tunnel.');
}

/**
 * startAutotunnel(port)
 * ──────────────────────────────────────────────────────────────────────────────
 * Khởi động Ngrok tunnel tự động cho môi trường phát triển.
 * Điều kiện kích hoạt:
 *   • process.env.ENABLE_TUNNEL === 'true'
 *   • process.env.NODE_ENV      !== 'production'
 *   • package @ngrok/ngrok đã được cài đặt
 *
 * Sau khi thành công:
 *   • In log trực quan ra Terminal (Local / Public / Webhook URL)
 *   • Gán process.env.DYNAMIC_WEBHOOK_URL để controller bốc ra dùng
 * ──────────────────────────────────────────────────────────────────────────────
 */
async function startAutotunnel(port) {
  // ── Guard conditions ─────────────────────────────────────────────────────
  if (!ngrok) {
    console.warn('[NGROK] ⚠️  Bỏ qua tunnel: package không khả dụng.');
    return;
  }
  if (process.env.ENABLE_TUNNEL !== 'true') {
    console.log('[NGROK] ℹ️  Tunnel bị tắt. Đặt ENABLE_TUNNEL=true trong .env để bật.');
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn('[NGROK] ⚠️  Bỏ qua tunnel: không sử dụng Ngrok ở môi trường production.');
    return;
  }

  const authToken = process.env.NGROK_AUTHTOKEN;
  if (!authToken) {
    console.warn('[NGROK] ⚠️  Thiếu NGROK_AUTHTOKEN trong .env — bỏ qua auto-tunnel.');
    return;
  }

  try {
    // Nạp auth token vào ngrok session
    await ngrok.authtoken(authToken);

    // Mở tunnel HTTP → port local
    const listener = await ngrok.connect({ proto: 'http', addr: port });
    const tunnelUrl = listener.url();

    if (!tunnelUrl) throw new Error('ngrok.connect() không trả về URL hợp lệ.');

    // Tạo webhook URL hoàn chỉnh
    const webhookPath   = '/api/video-jobs/webhook';
    const webhookFullUrl = `${tunnelUrl}${webhookPath}`;

    // Gán vào biến môi trường động để controller đọc tại runtime
    process.env.DYNAMIC_WEBHOOK_URL = webhookFullUrl;

    // In log trực quan
    const LINE = '═'.repeat(60);
    console.log(`\n${LINE}`);
    console.log('  🚇 NGROK AUTO-TUNNEL — ACTIVE');
    console.log(LINE);
    console.log(`  📍 Local Server   : http://localhost:${port}`);
    console.log(`  🌐 Public Tunnel  : ${tunnelUrl}`);
    console.log(`  🔗 Webhook URL    : ${webhookFullUrl}`);
    console.log(LINE);
    console.log('  💡 Dán URL Webhook này vào cấu hình Fal.ai Dashboard');
    console.log('     hoặc hệ thống sẽ tự động sử dụng qua DYNAMIC_WEBHOOK_URL');
    console.log(`${LINE}\n`);

  } catch (err) {
    console.error('[NGROK] ❌ Không thể khởi động tunnel:', err.message);
    console.warn('[NGROK]    Hệ thống sẽ tiếp tục chạy bình thường (không có tunnel).');
    // Không ném lỗi ra ngoài — server vẫn phải tiếp tục hoạt động
  }
}

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const userRoutes = require('./routes/user.routes');
const assetRouter = require('./routes/asset.route');
const videoRoutes = require('./routes/video.route');
const systemConfigRouter = require('./routes/systemConfig.route');
const voiceRouter = require('./routes/voice.route');
const imageAnalyzerRouter = require('./routes/imageAnalyzer.routes');
const profileRoutes = require('./routes/profile.routes');
const notificationRouter = require('./routes/notification.routes');
const imageRouter = require('./routes/image.routes');
const affiliateRouter = require('./routes/affiliate.routes');
const sessionRouter = require('./routes/session.routes');
const adminNotificationRouter = require('./routes/adminNotification.routes');
const moderationRouter = require('./routes/moderation.routes');
const videoJobRouter   = require('./routes/videoJob.routes');
const paymentRouter   = require('./routes/payment.routes');


const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});


// Export io để các controller có thể sử dụng
app.io = io;
global.io = io;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'], // Frontend & Admin URLs
  credentials: true
}));
// ĐẶT NGAY DƯỚI DÒNG app.use(cors(...)) TRONG FILE server.js
app.use((req, res, next) => {
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:5176'];
  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  // NẾU LÀ REQUEST TIỀN TRẠM OPTIONS -> TRẢ VỀ 200 NGAY LẬP TỨC, CẤM CHẠY XUỐNG CÁC LỚP BẢO VỆ DƯỚI
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Middleware to attach io to request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Body-parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));
app.use('/previews', express.static(path.join(__dirname, '../public/previews')));
app.use(express.static(path.join(__dirname, '../public')));

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
    console.log('[SSE BACKEND] Client đã ngắt kết nối, hủy luồng lắng nghe.');
    clients = clients.filter(client => client !== res);
    res.end();
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

// ===== API V1 ENDPOINTS - REAL-TIME SIMULATORS =====

// POST /api/v1/generate-image - Simulate image generation with progress
app.post('/api/v1/generate-image', (req, res) => {
  const { prompt } = req.body;
  
  console.log(`🎨 Image generation requested with prompt: "${prompt}"`);
  
  // Send initial response
  res.json({
    success: true,
    message: 'Bắt đầu tạo ảnh...',
    jobId: Date.now()
  });

  // Emit started event
  io.emit('image_generation_started', {
    prompt: prompt,
    timestamp: new Date()
  });

  // Simulate progress from 10% to 90% every 500ms
  let progress = 10;
  const progressInterval = setInterval(() => {
    if (progress <= 90) {
      io.emit('image_generation_progress', {
        percent: progress,
        status: `Đang xử lý... ${progress}%`
      });
      console.log(`📊 Image generation progress: ${progress}%`);
      progress += 10;
    } else {
      clearInterval(progressInterval);
      
      // Emit completed event after progress reaches 100%
      setTimeout(() => {
        io.emit('image_generation_completed', {
          imageUrl: 'https://via.placeholder.com/512x512?text=AI+Generated+Image',
          prompt: prompt,
          message: 'Đã tạo ảnh thành công!',
          timestamp: new Date()
        });
        console.log(`✅ Image generation completed for prompt: "${prompt}"`);
      }, 500);
    }
  }, 500);
});

// POST /api/v1/generate-voice - Simulate voice generation
app.post('/api/v1/generate-voice', (req, res) => {
  const { text } = req.body;
  
  console.log(`🎤 Voice generation requested with text: "${text}"`);
  
  // Send initial response
  res.json({
    success: true,
    message: 'Bắt đầu render giọng nói AI...',
    jobId: Date.now()
  });

  // Emit started event
  io.emit('voice_generation_started', {
    text: text,
    timestamp: new Date()
  });

  // Simulate completion after 2 seconds
  setTimeout(() => {
    io.emit('voice_generation_completed', {
      audioUrl: '/uploads/mock-audio-' + Date.now() + '.mp3',
      text: text,
      message: 'Đã render xong giọng nói AI!',
      timestamp: new Date()
    });
    console.log(`✅ Voice generation completed for text: "${text}"`);
  }, 2000);
});

// Routes mounted below body-parser middlewares
app.use('/api/auth', authRoutes);
app.use('/api/admin/system-configs', systemConfigRouter);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/assets', assetRouter);
app.use('/api/video', videoRoutes);
app.use('/api/voices', voiceRouter);
app.use('/api/image-analyzer', imageAnalyzerRouter);
app.use('/api/profile', profileRoutes);
app.use('/api', notificationRouter);
app.use('/api/image', imageRouter);
app.use('/api/affiliate', affiliateRouter);
app.use('/api/v1/auth', sessionRouter);           // Session Management
app.use('/api/v1/auth', adminNotificationRouter); // Admin Notifications
app.use('/api/v1/admin', moderationRouter);       // Image Moderation Queue & Review
app.use('/api/video-jobs', videoJobRouter);        // Video AI Animation (Fal.ai)
app.use('/api/payment', paymentRouter);           // PayOS Payment Integration


// ===== SOCKET.IO - REAL-TIME HANDLERS =====
const jwt = require('jsonwebtoken');

io.on('connection', (socket) => {
  const clientIp = socket.handshake.address;
  const timestamp = new Date().toLocaleString('vi-VN');

  console.log(`
  ✅ KẾt NỐI WEBSOCKET THÀNH CÔNG
  ├─ Client ID: ${socket.id}
  ├─ IP Address: ${clientIp}
  ├─ Thời gian: ${timestamp}
  └─ Số client hiện tại: ${io.engine.clientsCount}
  `);

  // Gửi thông điệp chào mừng về client
  socket.emit('connection_established', {
    message: 'Kết nối thành công với server qua WebSocket',
    clientId: socket.id,
    timestamp: new Date()
  });

  // ─────────────────────────────────────────────────────────────────────────────
  //  SỰ KIỆN: authenticate
  //  Client gửi: { token: <access_token>, refresh_token: <refresh_token> }
  //  Server: xác thực JWT, gắn userId + refresh_token vào socket, join room riêng
  // ─────────────────────────────────────────────────────────────────────────────
  socket.on('authenticate', (data) => {
    try {
      const token = data?.token || data?.access_token;
      const refreshToken = data?.refresh_token || data?.refreshToken;

      if (!token) {
        socket.emit('auth_error', { message: 'Thiếu access token.' });
        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Gắn thông tin user vào socket instance
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.admin_refresh_token = refreshToken || null;

      // Cho socket join vào phòng riêng của user
      const roomName = `user_room_${decoded.id}`;
      socket.join(roomName);

      // ── AUTO-JOIN ADMIN ROOM: Nếu role là Admin/Super Admin → join admin_room ──
      if (['Admin', 'Super Admin'].includes(decoded.role)) {
        socket.join('admin_room');
        console.log(`👑 [SOCKET AUTH] Admin user ${decoded.id} đã join admin_room`);
      }

      console.log(`🔐 [SOCKET AUTH] userId: ${decoded.id} | role: ${decoded.role} | room: ${roomName} | socketId: ${socket.id}`);

      socket.emit('authenticated', {
        success: true,
        userId: decoded.id,
        room: roomName,
        message: 'Xác thực socket thành công!'
      });
    } catch (err) {
      console.warn(`[SOCKET AUTH] Xác thực thất bại socket ${socket.id}:`, err.message);
      socket.emit('auth_error', { message: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
  });

  // Lắng nghe khi client ngắt kết nối
  socket.on('disconnect', (reason) => {
    console.log(`
  ❌ NGẮT KẾt NỐI WEBSOCKET
  ├─ Client ID: ${socket.id}
  ├─ UserId: ${socket.userId || 'chưa xác thực'}
  ├─ Lý do: ${reason}
  ├─ Thời gian: ${new Date().toLocaleString('vi-VN')}
  └─ Số client còn lại: ${io.engine.clientsCount}
    `);
  });

  // Lắng nghe sự kiện yêu cầu trạng thái hệ thống
  socket.on('get_system_status', (data) => {
    console.log(`📊 Client ${socket.id} yêu cầu trạng thái hệ thống`);
    socket.emit('system_status_response', {
      status: 'ok',
      activeConnections: io.engine.clientsCount,
      timestamp: new Date()
    });
  });

  // Lắng nghe sự kiện admin request status (kiểm tra sức khỏe server)
  socket.on('admin:request_status', (data) => {
    console.log(`🏥 [Admin] ${socket.id} yêu cầu kiểm tra sức khỏe server`);
    const cpuUsage = Math.floor(Math.random() * 50);
    const ramUsage = Math.floor(Math.random() * 60);
    io.emit('system_notification', {
      type: 'success',
      message: `Hệ thống ổn định. CPU: ${cpuUsage}%, RAM: ${ramUsage}%`,
      timestamp: new Date()
    });
  });

  // Xử lý lỗi socket
  socket.on('error', (error) => {
    console.error(`⚠️ Lỗi socket từ client ${socket.id}:`, error);
  });
});

// ── Helper toàn cục: bắn SESSION_LIST_CHANGED về phòng của user ───────────────────────
// Được sử dụng bởi session.controller.js và auth.controller.js
app.emitSessionChanged = (userId) => {
  io.to(`user_room_${userId}`).emit('SESSION_LIST_CHANGED');
  console.log(`📡 [SESSION EVENT] SESSION_LIST_CHANGED → user_room_${userId}`);
};

// ── Helper: tìm socket theo userId + refresh_token rồi force logout ─────────────
app.forceLogoutSocket = (userId, revokedRefreshToken) => {
  // Duyệt tất cả socket đang kết nối trong room của user
  const roomName = `user_room_${userId}`;
  const socketsInRoom = io.sockets.adapter.rooms.get(roomName);

  if (socketsInRoom) {
    for (const socketId of socketsInRoom) {
      const targetSocket = io.sockets.sockets.get(socketId);
      if (
        targetSocket &&
        targetSocket.userId === userId &&
        targetSocket.admin_refresh_token === revokedRefreshToken
      ) {
        console.log(`🔴 [FORCE LOGOUT] Bắn FORCE_LOGOUT → socketId: ${socketId} | userId: ${userId}`);
        targetSocket.emit('FORCE_LOGOUT', {
          message: 'Phiên đăng nhập của bạn đã bị Admin hủy từ xa!'
        });
        targetSocket.disconnect(true);
      }
    }
  }

  // Bắn cập nhật danh sách cho các máy còn lại
  io.to(roomName).emit('SESSION_LIST_CHANGED');
  console.log(`📡 [SESSION EVENT] SESSION_LIST_CHANGED (sau revoke) → ${roomName}`);
};

// ── Helper toàn cục: tạo admin notification + bắn socket về admin_room ──────────────
app.emitAdminNotification = async ({ title, content, type = 'system', transactionCode, redirectUrl }) => {
  try {
    const { AdminNotification } = require('./models');
    const notif = await AdminNotification.create({
      title,
      content,
      type,
      is_read: false
    });
    const notifData = notif.toJSON();

    if (transactionCode) notifData.transactionCode = transactionCode;
    if (redirectUrl) notifData.redirectUrl = redirectUrl;

    io.to('admin_room').emit('NEW_ADMIN_NOTIFICATION', notifData);
    console.log(`🔔 [ADMIN NOTIF] Đã bắn thông báo → admin_room: "${title}"`);
    return notifData;
  } catch (err) {
    console.error('[ADMIN NOTIF ERROR] Không thể tạo thông báo admin:', err.message);
    return null;
  }
};

// Cập nhật trạng thái hệ thống cho tất cả client kết nối
setInterval(() => {
  if (io.engine.clientsCount > 0) {
    io.emit('system_status_update', {
      activeConnections: io.engine.clientsCount,
      timestamp: new Date()
    });
  }
}, 30000);

// Broadcast credit balance update mỗi 10 giây
setInterval(() => {
  if (io.engine.clientsCount > 0) {
    const newBalance = Math.floor(Math.random() * 1000);
    io.emit('credit_balance_updated', {
      balance: newBalance,
      timestamp: new Date()
    });
    console.log(`💰 Credit balance update broadcast: ${newBalance} credits`);
  }
}, 10000);

const PORT = process.env.PORT || 3000;

const db = require('./models');
const { startScheduler } = require('./services/scheduler.service');

// ═══════════════════════════════════════════════════════════════════════════
// 💡 BỌC THÉP TỐI THƯỢNG: Sửa ENUM trực tiếp TRƯỚC KHI gọi sync()
//    Nguyên nhân gốc rễ: sync({ alter: true }) crash khi Sequelize cố ALTER
//    cột ENUM đang có giá trị không có trong danh sách Model mới → khối lệnh
//    phía sau sync không bao giờ chạy tới.
//    Giải pháp: Authenticate DB → chạy raw ALTER TABLE → rồi mới sync().
// ═══════════════════════════════════════════════════════════════════════════
const fixImageAnalysesEnum = async () => {
  try {
    await db.sequelize.query(
      "ALTER TABLE `image_analyses` MODIFY COLUMN `status` ENUM('processing','pending','success','failed','rejected','confirmed_violation') NOT NULL DEFAULT 'processing'"
    );
    console.log('[DB PATCH] ✅ image_analyses.status ENUM cập nhật thành công (rejected, confirmed_violation đã thêm vào).');
  } catch (err) {
    // Bảng chưa tồn tại (lần khởi chạy đầu tiên) hoặc ENUM đã khớp → bỏ qua an toàn
    console.warn('[DB PATCH] ⚠️  Bỏ qua ALTER TABLE image_analyses (có thể bảng chưa tồn tại hoặc ENUM đã đúng):', err.message);
  }
};

// Database synchronization executing correctly on startup
(async () => {
  try {
    // BƯỚC 0: Cưỡng chế sửa ENUM TRƯỚC sync() để tránh sync crash vì conflict cột status
    await fixImageAnalysesEnum();

    // BƯỚC 1: Sync schema như bình thường sau khi ENUM đã ổn định
    // NOTE: Không drop bảng — dữ liệu cần được bảo toàn.
    // alter: true — tự động thêm cột mới (model_name, current_package) mà không mất dữ liệu cũ
    await db.sequelize.sync({ force: false, alter: true });
    console.log('Database synced successfully.');

    try {
      await db.sequelize.query("ALTER TABLE jobs MODIFY COLUMN type ENUM('Video', 'Voice', 'Image') NOT NULL DEFAULT 'Video'");
      console.log('ENUM column for jobs.type altered to include Image.');
    } catch (err) {
      console.warn('Could not alter jobs.type ENUM column, it may already be updated:', err.message);
    }

    // ── admin_notifications: Nới rộng ENUM type để thêm 'moderation' ─────────
    try {
      await db.sequelize.query(
        "ALTER TABLE `admin_notifications` MODIFY COLUMN `type` ENUM('billing','error','system','moderation') NOT NULL DEFAULT 'system'"
      );
      console.log('[DB MIGRATION] ✅ admin_notifications.type ENUM nới rộng thành công (thêm moderation).');
    } catch (err) {
      console.warn('[DB MIGRATION] ⚠️  Không thể nới rộng admin_notifications.type ENUM:', err.message);
    }

    // ── video_jobs: Thêm cột analysis_id (INT NULL) nếu chưa tồn tại ──────────
    // Liên kết FK tuỳ chọn tới bảng image_analyses (kịch bản Mắt Thần AI)
    try {
      await db.sequelize.query(
        'ALTER TABLE video_jobs ADD COLUMN analysis_id INT NULL AFTER user_id'
      );
      console.log('[MIGRATION] ✅ video_jobs.analysis_id column added successfully.');
    } catch (err) {
      if (err.original?.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
        console.log('[MIGRATION] ℹ️  video_jobs.analysis_id already exists — skipped.');
      } else {
        console.warn('[MIGRATION] ⚠️  Could not add video_jobs.analysis_id:', err.message);
      }
    }

    // ── video_jobs: Thêm cột input_image_url (VARCHAR 2048 NULL) nếu chưa tồn tại
    // Lưu URL ảnh đầu vào cho luồng image-to-video của Fal.ai
    try {
      await db.sequelize.query(
        'ALTER TABLE video_jobs ADD COLUMN input_image_url VARCHAR(2048) NULL AFTER prompt'
      );
      console.log('[MIGRATION] ✅ video_jobs.input_image_url column added successfully.');
    } catch (err) {
      if (err.original?.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
        console.log('[MIGRATION] ℹ️  video_jobs.input_image_url already exists — skipped.');
      } else {
        console.warn('[MIGRATION] ⚠️  Could not add video_jobs.input_image_url:', err.message);
      }
    }

    // ── video_jobs: Đảm bảo ENUM aspect_ratio có đủ 3 giá trị (thêm '4:3') ────
    try {
      await db.sequelize.query(
        "ALTER TABLE video_jobs MODIFY COLUMN aspect_ratio ENUM('9:16','16:9','4:3') NOT NULL DEFAULT '16:9'"
      );
      console.log('[MIGRATION] ✅ video_jobs.aspect_ratio ENUM updated (added 4:3).');
    } catch (err) {
      console.warn('[MIGRATION] ⚠️  Could not alter video_jobs.aspect_ratio ENUM:', err.message);
    }

    // ── video_jobs: Đảm bảo ENUM status khớp với giá trị DB thực tế ────────────
    try {
      await db.sequelize.query(
        "ALTER TABLE video_jobs MODIFY COLUMN status ENUM('queueing','processing','success','failed') NOT NULL DEFAULT 'queueing'"
      );
      console.log('[MIGRATION] ✅ video_jobs.status ENUM updated.');
    } catch (err) {
      console.warn('[MIGRATION] ⚠️  Could not alter video_jobs.status ENUM:', err.message);
    }

    // ── image_jobs: Đảm bảo ENUM status khớp với giá trị DB thực tế ────────────
    try {
      await db.sequelize.query(
        "ALTER TABLE image_jobs MODIFY COLUMN status ENUM('Pending','Rendering','Failed','Completed','failed_violation') NOT NULL DEFAULT 'Pending'"
      );
      console.log('[MIGRATION] ✅ image_jobs.status ENUM updated (added failed_violation).');
    } catch (err) {
      console.warn('[MIGRATION] ⚠️  Could not alter image_jobs.status ENUM:', err.message);
    }


    // -- video_jobs: Them cot error_log (TEXT NULL) neu chua ton tai --
    // Luu chi tiet loi khi Fal.ai tu choi request (422, 401, network error...)
    try {
      await db.sequelize.query(
        'ALTER TABLE video_jobs ADD COLUMN error_log TEXT NULL AFTER video_url'
      );
      console.log('[MIGRATION] video_jobs.error_log column added successfully.');
    } catch (err) {
      if (err.original?.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
        console.log('[MIGRATION] video_jobs.error_log already exists - skipped.');
      } else {
        console.warn('[MIGRATION] Could not add video_jobs.error_log:', err.message);
      }
    }

    startScheduler();
    server.listen(PORT, async () => {
      console.log(`🚀 Server đang chạy trên: http://localhost:${PORT}`);
      console.log(`📡 WebSocket sẵn sàng kết nối`);
      // Khởi động Ngrok auto-tunnel sau khi server local đã sẵn sàng
      await startAutotunnel(PORT);
    });
  } catch (err) {
    console.error('Failed to sync database:', err.message);
    // Start server even if DB connection fails temporarily
    server.listen(PORT, async () => {
      console.log(`Server is running on port ${PORT} (Database sync failed)`);
      // Vẫn khởi động tunnel dù DB sync lỗi
      await startAutotunnel(PORT);
    });
  }
})();


