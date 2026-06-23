const bcrypt = require('bcrypt');
const { User, Job, ImageJob, Package, Transaction, ImageAnalysis, VideoJob, sequelize } = require('../models');

const toBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.toLowerCase());
  return false;
};

// Dynamically expand the Sequelize model enum definition for transaction status to allow 'Expired'
if (Transaction && Transaction.rawAttributes && Transaction.rawAttributes.status) {
  Transaction.rawAttributes.status.values = ['pending', 'success', 'failed', 'Expired'];
  if (Transaction.rawAttributes.status.type) {
    Transaction.rawAttributes.status.type.values = ['pending', 'success', 'failed', 'Expired'];
  }
}

/**
 * GET /api/user/profile
 * Retrieve profile and credits balance of logged-in user
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Tự động xóa trạng thái khóa khi thời gian cấm đã trôi qua
    if (user.banned_until && new Date() >= new Date(user.banned_until)) {
      user.banned_until = null;
      user.mat_than_muted_until = null;
      await user.save();
    }

    return res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      credits: user.credits,
      status: user.status,
      avatar: user.avatar,
      is_two_factor_enabled: toBoolean(user.is_two_factor_enabled),
      theme_preference: user.theme_preference || 'dark',
      current_package: user.current_package || 'free',
      banned_until: user.banned_until ? new Date(user.banned_until).toISOString() : null
    });
  } catch (err) {
    console.error('[USER CONTROLLER] getProfile error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải thông tin.' });
  }
};

/**
 * GET /api/user/history
 * Retrieve user's render jobs history
 */
const getHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Quét dữ liệu Video AI và Giọng nói từ bảng jobs cũ.
    //    CHỈ lấy type Video và Voice — KHÔNG lấy Image để tránh trùng lặp
    //    với bảng image_jobs mới (nơi lưu ảnh Fal.ai Flux Schnell).
    const jobs = await Job.findAll({
      where: {
        userId,
        type: ['Video', 'Voice']
      },
      order: [['id', 'DESC']]
    });

    // 2. Quét dữ liệu Tạo Ảnh AI từ bảng image_jobs (Fal.ai Flux Schnell)
    const imageJobs = await ImageJob.findAll({
      where: { userId },
      order: [['id', 'DESC']]
    });

    // 3. Quét dữ liệu phân tích ảnh Mắt Thần AI
    const analyses = await ImageAnalysis.findAll({
      where: { user_id: userId, status: 'success' },
      order: [['id', 'DESC']]
    });

    // 4. Quét dữ liệu Video AI từ bảng video_jobs (Fal.ai pipeline mới)
    const videoJobs = await VideoJob.findAll({
      where: { userId },
      order: [['id', 'DESC']]
    });

    const mappedJobs = jobs.map(job => {
      const jobPlain = job.get({ plain: true });
      const isVideo = jobPlain.type === 'Video' || jobPlain.type === 'video' || jobPlain.type === 'render_task';
      const isImage = jobPlain.type === 'Image' || jobPlain.type === 'image';
      return {
        ...jobPlain,
        type: isImage ? 'image' : (isVideo ? 'video' : 'audio')
      };
    });

    const mappedImageJobs = imageJobs.map(job => {
      const jobPlain = job.get({ plain: true });
      return {
        ...jobPlain,
        type: 'image',
        // Thêm field provider để frontend hiển thị đúng tên model
        provider: 'Fal.ai Flux Schnell',
        // Đảm bảo aspectRatio luôn có mặt (Sequelize dùng alias camelCase)
        aspectRatio: jobPlain.aspectRatio || jobPlain.aspect_ratio || '1:1',
      };
    });

    const mappedAnalyses = analyses.map(analysis => {
      const analysisPlain = analysis.get({ plain: true });
      return {
        ...analysisPlain,
        type: 'analysis'
      };
    });

    // 5. Map dữ liệu VideoJob sang định dạng chung
    const mappedVideoJobs = videoJobs.map(job => {
      const jobPlain = job.get({ plain: true });
      return {
        ...jobPlain,
        type: 'video',
        // Đảm bảo 'status' tương thích cả 2 hệ thống (success vs Completed)
        status: jobPlain.status === 'success' ? 'Completed' : jobPlain.status === 'failed' ? 'Failed' : jobPlain.status === 'queueing' || jobPlain.status === 'processing' ? 'Pending' : jobPlain.status,
        // Giữ nguyên videoUrl để frontend mapping
        videoUrl: jobPlain.videoUrl || jobPlain.video_url || null,
        // Fallback output_url từ videoUrl (tương thích ngược)
        output_url: jobPlain.videoUrl || jobPlain.video_url || jobPlain.output_url || null,
      };
    });

    // Gộp cả 5 loại dữ liệu
    const combinedHistory = [...mappedJobs, ...mappedVideoJobs, ...mappedImageJobs, ...mappedAnalyses];

    // Sắp xếp theo thời gian createdAt mới nhất đến cũ nhất
    combinedHistory.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.created_at);
      const dateB = new Date(b.createdAt || b.created_at);
      return dateB - dateA;
    });

    return res.status(200).json({
      success: true,
      data: combinedHistory
    });

  } catch (err) {
    console.error('[USER CONTROLLER] getHistory error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử.' });
  }
};

/**
 * POST /api/user/jobs
 * Enqueue a new rendering job and deduct credits
 */
const createJob = async (req, res) => {
  const { name, type, prompt, meta_data } = req.body;
  if (!type || !['Video', 'Voice'].includes(type)) {
    return res.status(400).json({ message: 'Loại tác vụ không hợp lệ.' });
  }

  let textToSynthesize = '';
  if (type === 'Voice') {
    const kịchBản = req.body.text || req.body.prompt || req.body.script || req.body.content;
    console.log("===> [TTS COMPATIBLE] Dữ liệu kịch bản trích xuất được:", kịchBản);

    if (!kịchBản || String(kịchBản).trim() === "" || kịchBản === "undefined" || kịchBản === "null") {
        console.log("❌ [TTS VALIDATION FAILED] Chặn đứng request do kịch bản trống hoặc undefined!");
        return res.status(400).json({ 
            success: false, 
            message: "Nội dung văn bản kịch bản gửi lên không hợp lệ hoặc bị để trống. Vui lòng kiểm tra lại!" 
        });
    }

    // Sau khi vượt qua check này, gán lại giá trị chuẩn cho biến truyền vào Edge TTS:
    textToSynthesize = String(kịchBản).trim();
  } else {
    if (!prompt) {
      return res.status(400).json({ message: 'Vui lòng cung cấp mô tả (prompt).' });
    }
  }

  const cost = type === 'Video' ? 10 : 5;

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    if (user.credits < cost) {
      return res.status(400).json({ message: 'Số dư tín dụng (credits) của bạn không đủ để thực hiện tác vụ này.' });
    }

    if (type === 'Voice') {
      const voiceService = require('../services/voice.service');
      const fs = require('fs');
      const path = require('path');

      let meta = meta_data;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch (e) {}
      }
      const targetVoice = meta?.voiceModel || meta?.voice || 'vi-VN-NamMinhNeural';
      const speed = meta?.speed !== undefined ? meta.speed : 1.0;
      const pitch = meta?.pitch !== undefined ? meta.pitch : 0;

      const tempId = Date.now() + '_' + Math.floor(Math.random() * 1000);
      let relativeFilePath;
      try {
        relativeFilePath = await voiceService.textToSpeech(textToSynthesize, targetVoice, tempId, speed, pitch);
      } catch (error) {
        console.error(`[USER CONTROLLER] Voice job TTS failed:`, error.message);

        // Ghi trực tiếp vào Database bảng notifications khi thất bại
        try {
          const { Notification } = require('../models');
          const notificationEmitter = require('../utils/notificationEmitter');

          const failNotif = await Notification.create({
            userId: user.id,
            title: 'Lỗi xử lý tác vụ',
            message: `Lỗi kết xuất âm thanh: ${error.message}`,
            type: 'error',
            is_read: false
          });
          console.log('[DB DEBUG] Đã insert thành công 1 dòng thất bại vào bảng notifications. ID:', failNotif.id);
          notificationEmitter.emit('send_notification', failNotif);
        } catch (notifErr) {
          console.error('[USER CONTROLLER] Explicit failure notification error:', notifErr.message);
        }

        return res.status(400).json({ success: false, message: error.message || "Lỗi kết xuất âm thanh" });
      }

      const dirPath = path.join(__dirname, '../../public/uploads/voices');
      const filePath = path.join(dirPath, `voice_job_${tempId}.mp3`);

      if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.size === 0) {
              console.error(`❌ [TTS ERROR] Phát hiện file sinh ra bị rỗng (0 bytes): ${filePath}`);
              try { fs.unlinkSync(filePath); } catch (e) { console.error("Không thể xóa file rỗng:", e); } // Xóa file lỗi tránh rác ổ đĩa

              // Ghi trực tiếp vào Database bảng notifications khi thất bại
              try {
                const { Notification } = require('../models');
                const notificationEmitter = require('../utils/notificationEmitter');

                const failNotif = await Notification.create({
                  userId: user.id,
                  title: 'Lỗi xử lý tác vụ',
                  message: `Lỗi kết xuất âm thanh: Dịch vụ giọng đọc AI đang quá tải hoặc văn bản không hợp lệ.`,
                  type: 'error',
                  is_read: false
                });
                console.log('[DB DEBUG] Đã insert thành công 1 dòng thất bại vào bảng notifications. ID:', failNotif.id);
                notificationEmitter.emit('send_notification', failNotif);
              } catch (notifErr) {
                console.error('[USER CONTROLLER] Explicit failure notification error:', notifErr.message);
              }

              return res.status(400).json({ success: false, message: "Văn bản nhập vào không hợp lệ hoặc dịch vụ giọng đọc AI đang quá tải. Vui lòng kiểm tra lại kịch bản của bạn!" });
          }
      } else {
          // Ghi trực tiếp vào Database bảng notifications khi thất bại
          try {
            const { Notification } = require('../models');
            const notificationEmitter = require('../utils/notificationEmitter');

            const failNotif = await Notification.create({
              userId: user.id,
              title: 'Lỗi xử lý tác vụ',
              message: `Không tìm thấy file âm thanh vật lý sau khi khởi tạo!`,
              type: 'error',
              is_read: false
            });
            console.log('[DB DEBUG] Đã insert thành công 1 dòng thất bại vào bảng notifications. ID:', failNotif.id);
            notificationEmitter.emit('send_notification', failNotif);
          } catch (notifErr) {
            console.error('[USER CONTROLLER] Explicit failure notification error:', notifErr.message);
          }

          return res.status(500).json({ success: false, message: "Không tìm thấy file âm thanh vật lý sau khi khởi tạo!" });
      }

      // ONLY DEDUCT AND WRITE TRANSACTION LEDGER ON SUCCESS
      await user.decrement('credits', { by: cost });
      await user.reload();

      // Sinh mã giao dịch tự động dạng TRX- kết hợp chuỗi ngẫu nhiên
      const transactionId = 'TRX-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

      // Tạo bản ghi giao dịch trừ phí dịch vụ
      await Transaction.create({
        id: transactionId,
        userId: user.id,
        package_name: 'Tạo Giọng Nói',
        amount: 0,
        credits_added: -cost,
        status: 'success',
        type: 'Trừ phí dịch vụ'
      });

      // Create render job in the DB (MySQL INSERT)
      const jobName = name || 'Tạo Giọng Nói';
      const job = await Job.create({
        userId: user.id,
        name: jobName,
        type,
        prompt: textToSynthesize,
        meta_data,
        status: 'Completed',
        progress: 100,
        credits_used: cost
      });

      // Rename generated files to final job ID filenames
      const finalFilePath = path.join(dirPath, `voice_job_${job.id}.mp3`);
      fs.renameSync(filePath, finalFilePath);
      
      const tempCompat1 = path.join(dirPath, `AI_Studio_Voice_ID_${tempId}.mp3`);
      const finalCompat1 = path.join(dirPath, `AI_Studio_Voice_ID_${job.id}.mp3`);
      if (fs.existsSync(tempCompat1)) fs.renameSync(tempCompat1, finalCompat1);
      
      const tempCompat2 = path.join(dirPath, `voice_${tempId}.mp3`);
      const finalCompat2 = path.join(dirPath, `voice_${job.id}.mp3`);
      if (fs.existsSync(tempCompat2)) fs.renameSync(tempCompat2, finalCompat2);

      const port = process.env.PORT || 3000;
      const outputUrl = `http://localhost:${port}/uploads/voices/voice_job_${job.id}.mp3`;
      job.output_url = outputUrl;
      try {
        job.audio_url = outputUrl;
        job.setDataValue('audio_url', outputUrl);
      } catch (e) {}
      await job.save();

      // Ghi trực tiếp vào Database bảng notifications khi thành công
      try {
        const { Notification } = require('../models');
        const notificationEmitter = require('../utils/notificationEmitter');

        const newNotif = await Notification.create({
          userId: user.id, // ID của user sở hữu tác vụ âm thanh này
          title: 'Tạo âm thanh thành công',
          message: `Giọng nói bản nháp của bạn đã được khởi tạo thành công!`,
          type: 'info',
          is_read: false
        });
        console.log('[DB DEBUG] Đã insert thành công 1 dòng vào bảng notifications. ID:', newNotif.id);

        // Bắn tín hiệu real-time sang luồng SSE qua Emitter
        notificationEmitter.emit('send_notification', newNotif);
        console.log('[SSE DEBUG] Đã emit sự kiện send_notification cho User:', user.id);
      } catch (notifErr) {
        console.error('[USER CONTROLLER] Explicit notification insert error:', notifErr.message);
      }

      return res.status(201).json({
        message: 'Tạo tác vụ thành công, tiến trình đang được xử lý.',
        job,
        credits: user.credits
      });
    }

    // Create standard video render job in the DB (instantly Pending)
    const jobName = name || 'Tạo Video';
    const job = await Job.create({
      userId: user.id,
      name: jobName,
      type,
      prompt,
      meta_data,
      status: 'Pending',
      progress: 0,
      credits_used: cost
    });

    // Deduct credits and log transaction for Video creation (which succeeds immediately)
    await user.decrement('credits', { by: cost });
    await user.reload();

    const transactionId = 'TRX-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);

    await Transaction.create({
      id: transactionId,
      userId: user.id,
      package_name: 'Tạo Video',
      amount: 0,
      credits_added: -cost,
      status: 'success',
      type: 'Trừ phí dịch vụ'
    });

    return res.status(201).json({
      message: 'Tạo tác vụ thành công, tiến trình đang được xử lý.',
      job,
      credits: user.credits
    });
  } catch (err) {
    console.error('[USER CONTROLLER] createJob error:', err.message);
    if (err.message === "Lỗi kết xuất âm thanh" || err.message === "Văn bản nhập vào không hợp lệ hoặc dịch vụ giọng đọc AI đang quá tải. Vui lòng kiểm tra lại kịch bản của bạn!") {
      return res.status(400).json({ success: false, message: "Văn bản nhập vào không hợp lệ hoặc dịch vụ giọng đọc AI đang quá tải. Vui lòng kiểm tra lại kịch bản của bạn!" });
    }
    return res.status(500).json({ message: 'Lỗi hệ thống khi tạo tác vụ.' });
  }
};

/**
 * PUT /api/user/settings
 * Update user settings
 */
const updateSettings = async (req, res) => {
  const { name, email, avatar } = req.body;
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    if (name) user.name = name;
    if (email) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();
    return res.status(200).json({
      message: 'Cập nhật cài đặt thành công.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        credits: user.credits,
        avatar: user.avatar,
        banned_until: user.banned_until ? new Date(user.banned_until).toISOString() : null
      }
    });
  } catch (err) {
    console.error('[USER CONTROLLER] updateSettings error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi lưu cài đặt.' });
  }
};

/**
 * DELETE /api/user/jobs/:id
 * Delete a job record
 */
const deleteJob = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await Job.findOne({ where: { id, userId: req.user.id } });
    if (!job) {
      return res.status(404).json({ message: 'Không tìm thấy tác vụ.' });
    }
    await job.destroy();
    return res.status(200).json({ success: true, message: 'Xoá tác vụ thành công.' });
  } catch (err) {
    console.error('[USER CONTROLLER] deleteJob error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xoá tác vụ.' });
  }
};

/**
 * PUT /api/user/update-profile
 * Update user's profile identity and avatar
 */
const updateProfile = async (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const { name, fullname, phone, avatar: inputAvatar, deleteAvatar, theme_preference } = req.body;
  try {
    // 1. Tìm user bằng Sequelize ORM
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Cơ chế dọn rác ảnh cũ khỏi ổ đĩa server
    const deleteOldAvatarFile = (avatarPath) => {
      if (avatarPath && !avatarPath.startsWith('data:')) {
        const fullPath = path.join(__dirname, '../..', 'public', avatarPath);
        if (fs.existsSync(fullPath)) {
          try {
            fs.unlinkSync(fullPath);
          } catch (err) {
            console.error('[USER CONTROLLER] Failed to delete old avatar file:', err.message);
          }
        }
      }
    };

    // 2. Gán giá trị mới nếu có truyền lên, nếu không thì giữ nguyên cũ
    const nextName = name !== undefined ? name : fullname;
    if (nextName !== undefined) {
      user.name = nextName;
    }
    if (phone !== undefined) {
      user.phone = phone === '' ? null : phone;
    }

    if (theme_preference !== undefined) {
      user.theme_preference = theme_preference;
    }

    if (deleteAvatar === 'true' || inputAvatar === null || inputAvatar === '') {
      deleteOldAvatarFile(user.avatar);
      user.avatar = null;
    } else if (req.file) {
      deleteOldAvatarFile(user.avatar);
      user.avatar = `/uploads/avatars/${req.file.filename}`;
    } else if (inputAvatar !== undefined) {
      user.avatar = inputAvatar;
    }

    // 3. Lưu trực tiếp xuống DB thông qua ORM (An toàn, tự động xử lý SQL)
    await user.save();

    // 4. Trả về kết quả
    return res.status(200).json({
      message: 'Cập nhật thông tin hồ sơ thành công!',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        credits: user.credits,
        banned_until: user.banned_until ? new Date(user.banned_until).toISOString() : null
      }
    });
  } catch (err) {
    console.error('[USER CONTROLLER] updateProfile error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật hồ sơ.' });
  }
};
/**
 * PUT /api/user/change-password
 * Change user password
 */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin mật khẩu cũ và mới.' });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
    }

    // Compare currentPassword with DB hash (user.password_hash or user.password)
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không chính xác' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    const isSameAsOld = await bcrypt.compare(newPassword, user.password_hash || '');
    if (isSameAsOld) {
      return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    // Hash the new password with 12 salt rounds (as done in auth.controller.js)
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await user.update({ password_hash: hashedPassword });

    return res.status(200).json({
      message: 'Mật khẩu đã được thay đổi và cập nhật thành công!'
    });
  } catch (err) {
    console.error('[USER CONTROLLER] changePassword error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi cập nhật mật khẩu.' });
  }
};

/**
 * GET /api/user/packages
 * Retrieve all packages from database
 */
const getPackages = async (req, res) => {
  try {
    const packages = await Package.findAll();
    
    // Programmatically sort by order: Free, Basic, Premium
    const order = ['free', 'basic', 'premium'];
    packages.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    
    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      price: Math.round(Number(pkg.price)),
      credits: pkg.credits
    }));
    
    return res.status(200).json(formattedPackages);
  } catch (err) {
    console.error('[USER CONTROLLER] getPackages error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải danh sách gói cước.' });
  }
};

/**
 * POST /api/user/payment/create
 * Generate order and transaction record in DB, return payment information
 */
const createPayment = async (req, res) => {
  const { packageId } = req.body;
  if (!packageId) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mã gói cước (packageId).' });
  }

  try {
    const pkg = await Package.findByPk(packageId.toLowerCase());
    if (!pkg) {
      return res.status(404).json({ message: 'Không tìm thấy gói cước phù hợp.' });
    }

    const price = Math.round(Number(pkg.price));
    const credits = pkg.credits;

    // Generate unique TRX ID (e.g. STDU + random suffix digits)
    const transactionId = 'STDU' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);

    const transaction = await Transaction.create({
      id: transactionId,
      userId: req.user.id,
      package_name: pkg.name,
      amount: price,
      credits_added: credits,
      status: 'pending'
    });

    // Emit real-time update via Socket.io
    const io = req.io;
    if (io) {
      const transactionData = transaction.toJSON();
      transactionData.user = {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      };
      io.emit('transaction:created', transactionData);
      console.log(`[SOCKET.IO] Emitted 'transaction:created' for transaction ID: ${transactionId}`);
    }

    // Bắn thông báo real-time về Admin Dashboard
    if (req.app && req.app.emitAdminNotification) {
      req.app.emitAdminNotification({
        title: 'Đơn nạp tiền mới 💰',
        content: `Người dùng "${req.user.name || req.user.email}" vừa tạo đơn nạp ${pkg.name} - ${price.toLocaleString()}đ (Mã: ${transactionId})`,
        type: 'billing',
        transactionCode: transactionId,
        redirectUrl: `/admin/deposits?search=${transactionId}`
      });
    }

    const memo = `STUDIO NAP ${req.user.id} ${transaction.id}`;

    return res.status(201).json({
      id: transaction.id,
      amount: transaction.amount,
      credits: transaction.credits_added,
      memo
    });
  } catch (err) {
    console.error('[USER CONTROLLER] createPayment error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi khởi tạo đơn nạp tiền.' });
  }
};

/**
 * GET /api/user/payment/status/:id
 * Check the status of a payment transaction
 */
const checkPaymentStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await Transaction.findOne({
      where: { id, userId: req.user.id }
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch nạp tiền.' });
    }
    return res.status(200).json({ status: transaction.status });
  } catch (err) {
    console.error('[USER CONTROLLER] checkPaymentStatus error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi kiểm tra trạng thái đơn nạp tiền.' });
  }
};

/**
 * POST /api/user/payment/webhook
 * Public webhook callback to confirm transaction nạp tiền và credits update
 */
const receiveWebhook = async (req, res) => {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'STUDIO_SECRET_2026';
  
  // 1. Signature check
  const signature = req.headers['x-webhook-signature'] || req.body.signature;
  if (!signature || signature !== WEBHOOK_SECRET) {
    console.warn('[WEBHOOK WARNING] Unauthorized webhook attempt. Signature mismatch.');
    return res.status(401).json({ success: false, message: 'Unauthorized webhook signature mismatch.' });
  }

  const { amount, content, description } = req.body;
  const memoText = content || description || '';

  // 2. Parse memo for STDUxxxxxxxx transaction code
  const match = memoText.match(/STDU[0-9a-zA-Z]+/i);
  if (!match) {
    console.error('[WEBHOOK ERROR] Transaction code not found in content:', memoText);
    return res.status(400).json({ success: false, message: 'Mã đơn hàng giao dịch không tìm thấy trong nội dung chuyển khoản.' });
  }
  const transactionId = match[0].toUpperCase();

  try {
    const { Op } = require('sequelize');
    // 3. Data Integrity check - Chấp nhận cả đơn 'pending' và 'Expired' (Soft-Expired & Resurrection Pattern)
    const transaction = await Transaction.findOne({
      where: {
        id: transactionId,
        status: { [Op.in]: ['pending', 'Expired'] }
      }
    });

    if (!transaction) {
      // Kiểm tra xem đơn đã được xử lý thành công trước đó chưa
      const existingTx = await Transaction.findByPk(transactionId);
      if (existingTx && (existingTx.status === 'success' || existingTx.status === 'Completed')) {
        return res.status(200).json({ success: true, message: 'Giao dịch này đã được xử lý từ trước' });
      }
      console.error('[WEBHOOK ERROR] Transaction not found in database or invalid status:', transactionId);
      return res.status(404).json({ success: false, message: 'Giao dịch không tồn tại trên hệ thống hoặc đã hoàn tất/thất bại.' });
    }

    // Check paid amount
    const receivedAmount = Math.round(Number(amount));
    const expectedAmount = Math.round(Number(transaction.amount));
    if (receivedAmount < expectedAmount) {
      await transaction.update({ status: 'failed' });
      console.error(`[WEBHOOK ERROR] Transaction ${transactionId} failed. Received amount ${receivedAmount} is lower than expected ${expectedAmount}.`);
      return res.status(400).json({ success: false, message: 'Số tiền nạp thực tế không khớp gói cước.' });
    }

    // 4. Atomically update transaction status and user credits inside Sequelize transaction
    const t = await sequelize.transaction();
    try {
      // Step 1: Update transaction status
      await transaction.update({ status: 'success' }, { transaction: t });

      // Step 2 & 3: Update credits and current_package
      const targetPackage = transaction.package_name.toLowerCase().includes('premium') ? 'premium' : 'free';
      await User.update(
        { 
          credits: sequelize.literal(`credits + ${transaction.credits_added}`),
          current_package: targetPackage
        }, 
        { where: { id: transaction.userId }, transaction: t }
      );

      await t.commit();
      console.log(`[WEBHOOK SUCCESS] Processed transaction ${transactionId} successfully. Added ${transaction.credits_added} credits to user ID ${transaction.userId}.`);

      // Emit real-time credit update via Socket.io to notify user's frontend Header
      const io = req.app ? req.app.io : (req.io || null);
      if (io) {
        // Fetch updated user credits after increment
        const updatedUser = await User.findByPk(transaction.userId, { attributes: ['id', 'credits'] });
        io.emit('user:credit_updated', {
          userId: transaction.userId,
          credits: updatedUser ? updatedUser.credits : null,
          creditsAdded: transaction.credits_added,
          transactionId: transactionId,
          timestamp: new Date()
        });
        console.log(`[SOCKET.IO] Emitted 'user:credit_updated' for user ID: ${transaction.userId}, new balance: ${updatedUser?.credits}`);
      }

      // Ghi nhận trực tiếp thông báo nạp tiền thành công
      try {
        const { Notification } = require('../models');
        const notificationEmitter = require('../utils/notificationEmitter');

        const newPaymentNotif = await Notification.create({
          userId: transaction.userId, // ID của user nạp tiền
          title: 'Nạp tiền thành công ✓',
          message: `Tài khoản của bạn đã được cộng thêm +${transaction.credits_added} Credits vào số dư.`,
          type: 'info',
          is_read: false
        });
        // Bắn tín hiệu real-time về client của user qua SSE Gateway
        notificationEmitter.emit('send_notification', newPaymentNotif);
        console.log('[PAYMENT SUCCESS] Đã ghi DB và phát thông báo nạp tiền cho User:', transaction.userId);
      } catch (notifErr) {
        console.error('[WEBHOOK PAYMENT SUCCESS] Explicit notification insert error:', notifErr.message);
      }

      // Bắn thông báo real-time về Admin Dashboard khi nạp tiền thành công
      try {
        if (req.app && req.app.emitAdminNotification) {
          const paidUser = await User.findByPk(transaction.userId, { attributes: ['id', 'name', 'email'] });
          req.app.emitAdminNotification({
            title: 'Nạp tiền thành công ✓',
            content: `"${paidUser?.name || paidUser?.email || 'User #' + transaction.userId}" đã nạp thành công +${transaction.credits_added} Credits (${receivedAmount.toLocaleString()}đ). Mã GD: ${transactionId}`,
            type: 'billing',
            transactionCode: transactionId,
            redirectUrl: `/admin/deposits?search=${transactionId}`
          });
        }
      } catch (adminNotifErr) {
        console.error('[WEBHOOK] Admin notification error:', adminNotifErr.message);
      }

      return res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (transactionError) {
      await t.rollback();
      throw transactionError;
    }
  } catch (err) {
    console.error('[WEBHOOK CRITICAL ERROR] Server failed to process webhook callback:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi xử lý webhook callback.' });
  }
};

/**
 * GET /api/user/transactions
 * Retrieve transaction history of logged-in user using Sequelize ORM
 */
const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query?.page, 10) || 1;
    const limit = 10; // Ép cứng giới hạn tối đa 10 dòng
    const offset = (page - 1) * limit;
    const { Op } = require('sequelize');

    let whereClause = { userId };
    const typeFilter = req.query?.type;

    if (typeFilter === 'income') {
      whereClause[Op.or] = [
        { id: { [Op.like]: 'TRX-REFUND-%' } },
        { type: 'refund' },
        { package_name: { [Op.like]: '%Free%' } },
        { type: 'Gift' },
        { type: 'Hệ thống tặng' },
        { amount: { [Op.gt]: 0 } }
      ];
    } else if (typeFilter === 'expense') {
      whereClause[Op.and] = [
        { amount: { [Op.lte]: 0 } },
        { id: { [Op.notLike]: 'TRX-REFUND-%' } },
        { type: { [Op.notIn]: ['refund', 'Gift', 'Hệ thống tặng'] } },
        { package_name: { [Op.notLike]: '%Free%' } }
      ];
    }

    const { count, rows: transactions } = await Transaction.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      success: true,
      data: transactions,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (err) {
    console.error('[USER CONTROLLER] getTransactions error:', err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi tải lịch sử giao dịch.' });
  }
};

/**
 * PUT /api/user/payment/cancel/:id
 * Cancel/Delete a pending transaction order to prevent garbage data in DB
 */
const cancelPayment = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await Transaction.findOne({
      where: {
        id,
        userId: req.user.id,
        status: 'pending'
      }
    });

    if (!transaction) {
      return res.status(400).json({ message: 'Giao dịch không thể hủy' });
    }

    // Store transaction data before deleting for socket.io emit
    const transactionData = transaction.toJSON();
    transactionData.user = {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email
    };

    // Destroy the pending transaction record to clean database garbage
    await transaction.destroy();
    console.log(`[PAYMENT CANCEL] Deleted pending transaction ${id} for user ID ${req.user.id}.`);
    
    // Emit real-time update via Socket.io
    const io = req.io;
    if (io) {
      io.emit('transaction:deleted', { id: transactionData.id, ...transactionData });
      console.log(`[SOCKET.IO] Emitted 'transaction:deleted' for transaction ID: ${id}`);
    }
    
    return res.status(200).json({ success: true, message: 'Hủy giao dịch nạp tiền thành công.' });
  } catch (err) {
    console.error('[USER CONTROLLER] cancelPayment error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi hủy đơn nạp tiền.' });
  }
};

/**
 * PATCH /api/user/payment/expire/:id
 * Soft-expire a pending transaction order instead of hard-deleting it immediately
 */
const expirePayment = async (req, res) => {
  const { id } = req.params;
  try {
    const transaction = await Transaction.findOne({
      where: {
        id,
        userId: req.user.id,
        status: 'pending'
      }
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Không tìm thấy giao dịch hoặc trạng thái giao dịch không phù hợp.' });
    }

    await transaction.update({ status: 'Expired' });
    console.log(`[PAYMENT EXPIRE] Soft-expired transaction ${id} for user ID ${req.user.id}.`);

    // Emit real-time update via Socket.io
    const io = req.io;
    if (io) {
      const transactionData = transaction.toJSON();
      transactionData.user = {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email
      };
      io.emit('transaction:updated', transactionData);
      console.log(`[SOCKET.IO] Emitted 'transaction:updated' (EXPIRED) for transaction ID: ${id}`);
    }

    return res.status(200).json({ success: true, status: 'Expired', message: 'Hủy mềm giao dịch nạp tiền thành công.' });
  } catch (err) {
    console.error('[USER CONTROLLER] expirePayment error:', err.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi hủy mềm đơn nạp tiền.' });
  }
};

// Background Cleanup Task (Tự động quét rác muộn)
// Chạy mỗi 15 phút một lần để xóa vĩnh viễn các đơn 'Expired' được tạo trước đó hơn 15 phút
setInterval(async () => {
  try {
    const { Op } = require('sequelize');
    const timeThreshold = new Date(Date.now() - 15 * 60 * 1000); 
    const deletedCount = await Transaction.destroy({
      where: {
        status: 'Expired',
        createdAt: { [Op.lt]: timeThreshold }
      }
    });
    if (deletedCount > 0) {
      console.log(`[CLEANUP TASK] Deleted vĩnh viễn ${deletedCount} đơn hàng 'Expired' đã tạo quá 15 phút.`);
    }
  } catch (err) {
    console.error('[CLEANUP TASK ERROR] Lỗi khi dọn dẹp đơn hết hạn muộn:', err.message);
  }
}, 15 * 60 * 1000);

module.exports = {
  getProfile,
  getHistory,
  createJob,
  updateSettings,
  deleteJob,
  updateProfile,
  changePassword,
  getPackages,
  createPayment,
  checkPaymentStatus,
  receiveWebhook,
  getTransactions,
  cancelPayment,
  expirePayment
};
