// =====================================================================
// src/controllers/image.controller.js
// Provider: Google Gemini (gemini-2.5-flash-image)
// Các fix production đã có:
//   ✅ Atomic credit deduction chống Race Condition (Op.gte)
//   ✅ Status 'Rendering' (đúng ENUM) trước khi gọi API
//   ✅ Ghi file async (fsPromises — không blocking Event Loop)
//   ✅ Worker tách hàm riêng + .catch() tầng ngoài cùng
//   ✅ Hoàn trả credits + ghi Transaction khi thất bại
//   ✅ job.save() trong catch được bọc try/catch riêng
//   ✅ Log đầy đủ Job ID + User ID + từng bước
// =====================================================================

const axios      = require('axios');
const fsPromises = require('fs').promises;  // Async I/O — không blocking Event Loop
const path       = require('path');
const { Op }     = require('sequelize');    // Dùng Op.gte chống Race Condition

const {
  User,
  ImageJob,
  Transaction,
  Notification,
  SystemConfig,
  sequelize,                                // Instance Sequelize để dùng literal()
} = require('../models');

const notificationEmitter = require('../utils/notificationEmitter');

// ─────────────────────────────────────────────────────────────────────
// HÀM CHÍNH: Tiếp nhận request, xác thực, trừ xu, tạo job, trả 200 OK
// ─────────────────────────────────────────────────────────────────────
const generateImage = async (req, res) => {

  // ── BƯỚC 1: Xác thực & làm sạch đầu vào ──────────────────────────
  const rawPrompt = req.body.prompt;
  const { aspectRatio } = req.body;

  const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({
      error: 'Kịch bản/Mô tả prompt cho ảnh không được để trống.',
    });
  }

  // Giới hạn độ dài prompt tránh URL quá dài
  if (prompt.length > 1500) {
    return res.status(400).json({
      error: 'Prompt quá dài (tối đa 1500 ký tự). Vui lòng rút ngắn mô tả.',
    });
  }

  // Whitelist aspectRatio — mặc định về '1:1' nếu không hợp lệ
  const validRatios   = ['1:1', '16:9', '9:16'];
  const selectedRatio = validRatios.includes(aspectRatio) ? aspectRatio : '1:1';

  const userId = req.user.id;

  try {
    // ── BƯỚC 2: Trừ Credits Atomic — chống Race Condition ────────────
    // UPDATE credits - 2 WHERE id = userId AND credits >= 2
    // Nếu affectedRows = 0 → không đủ xu, DB đã chặn ngay tại đây
    const [affectedRows] = await User.update(
      { credits: sequelize.literal('credits - 2') },
      {
        where: {
          id:      userId,
          credits: { [Op.gte]: 2 },
        },
      }
    );

    if (affectedRows === 0) {
      return res.status(400).json({
        error: 'Tài khoản không đủ credits (Cần tối thiểu 2 credits để tạo ảnh AI).',
      });
    }

    // Reload thông tin user để lấy dữ liệu mới nhất
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng.' });
    }

    // ── BƯỚC 3: Ghi log Transaction chi phí ─────────────────────────
    const transactionId =
      'TRX-IMG-' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900);

    await Transaction.create({
      id:            transactionId,
      userId:        user.id,
      package_name:  'Tạo Ảnh AI',
      amount:        0,
      credits_added: -2,
      status:        'success',
      type:          'Trừ phí dịch vụ',
    });

    // ── BƯỚC 4: Tạo ImageJob với trạng thái Pending ──────────────────
    const job = await ImageJob.create({
      userId:       user.id,
      prompt,
      aspectRatio:  selectedRatio,
      status:       'Pending',
      progress:     0,
      credits_used: 2,
    });

    // ── BƯỚC 5: Trả 200 OK ngay cho Frontend ─────────────────────────
    res.status(200).json({
      success: true,
      message: 'Yêu cầu tạo ảnh đang được xử lý ngầm.',
      jobId:   job.id,
      status:  'Pending',
    });

    // ── BƯỚC 6: Kích hoạt Worker ngầm ────────────────────────────────
    _runGeminiWorker({ job, user, prompt, selectedRatio })
      .catch((unexpectedErr) => {
        console.error(
          `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
          'Lỗi không mong đợi thoát ra ngoài worker:',
          unexpectedErr.message
        );
      });

  } catch (error) {
    console.error(
      `[IMAGE CONTROLLER] [UserID:${userId}] Lỗi hệ thống khi khởi tạo job:`,
      error.message
    );
    return res.status(500).json({
      error: 'Đã xảy ra lỗi hệ thống khi gửi yêu cầu tạo ảnh.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// WORKER: Gọi API Gemini (gemini-2.5-flash-image)
// ─────────────────────────────────────────────────────────────────────
async function _runGeminiWorker({ job, user, prompt, selectedRatio }) {
  console.log(
    `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
    `Bắt đầu | Provider: Gemini 2.5 Flash Image | AspectRatio: ${selectedRatio} | ` +
    `Prompt: "${prompt.substring(0, 60)}..."`
  );

  try {
    // ── A: Cập nhật trạng thái → Rendering ───────────────────────────
    job.status   = 'Rendering';
    job.progress = 10;
    await job.save();
    console.log(`[IMAGE WORKER] [JobID:${job.id}] Trạng thái → Rendering`);

    // ── B: Lấy API Key từ Database ───────────────────────────
    const dbRecord = await SystemConfig.findOne({ where: { key: 'gemini_api_key' } });
    const apiKey = dbRecord?.value || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('Không tìm thấy Gemini API Key trong hệ thống. Vui lòng cấu hình ở trang Admin.');
    }

    // ── C: Gọi API Gemini ───────────────────────────
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: selectedRatio
        }
      }
    };

    console.log(`[IMAGE WORKER] [JobID:${job.id}] Đang gửi yêu cầu tới Gemini API...`);

    const response = await axios.post(geminiUrl, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000 // 60s
    });

    const parts = response.data?.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'));

    if (!imagePart || !imagePart.inlineData?.data) {
      const errorMsg = response.data?.error?.message || 'Không tìm thấy dữ liệu ảnh trả về từ Gemini API.';
      throw new Error(errorMsg);
    }

    const base64Data = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType;
    const imageBuffer = Buffer.from(base64Data, 'base64');

    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] ` +
      `✅ Nhận được ảnh từ Gemini | type: ${mimeType} | size: ${imageBuffer.length} bytes`
    );

    // ── D: Ghi file ảnh xuống disk (async, non-blocking) ─────────────
    const dir = path.join(__dirname, '../../uploads/images');
    await fsPromises.mkdir(dir, { recursive: true });

    // Lấy extension động từ content-type: "image/jpeg" → "jpeg", "image/png" → "png"
    const ext      = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
    const filename = `AI_Image_Job${job.id}_${Date.now()}.${ext}`;
    const filePath = path.join(dir, filename);

    await fsPromises.writeFile(filePath, imageBuffer);
    const outputUrl = `/uploads/images/${filename}`;

    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] ✅ Đã ghi file: ${outputUrl} (${imageBuffer.length} bytes)`
    );

    // ── E: Cập nhật ImageJob → Completed ─────────────────────────────
    job.status     = 'Completed';
    job.progress   = 100;
    job.output_url = outputUrl;
    await job.save();

    console.log(`[IMAGE WORKER] [JobID:${job.id}] ✅ Trạng thái → Completed`);

    // ── F: Tạo Notification thành công & Emit SSE ─────────────────────
    const successNotif = await Notification.create({
      userId:  user.id,
      title:   'Tạo ảnh hoàn tất ✓',
      message: `Hình ảnh "${prompt.substring(0, 40)}..." đã được vẽ thành công bằng Gemini!`,
      type:    'info',
      is_read: false,
    });

    notificationEmitter.emit('send_notification', successNotif);

    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
      `✅ Hoàn tất toàn bộ luồng tạo ảnh.`
    );

  } catch (err) {
    // ─────────────────────────────────────────────────────────────────
    // XỬ LÝ LỖI: Cập nhật Job → Failed, Hoàn Credits, Ghi Log, Notify
    // ─────────────────────────────────────────────────────────────────
    console.error(
      `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ❌ Worker thất bại:`,
      err.response?.data ? JSON.stringify(err.response.data) : err.message
    );

    // ── 1. Cập nhật Job → Failed (bọc try/catch riêng tránh crash kép) ──
    try {
      job.status   = 'Failed';
      job.progress = 0;
      await job.save();
      console.log(`[IMAGE WORKER] [JobID:${job.id}] Trạng thái → Failed`);
    } catch (saveErr) {
      console.error(
        `[IMAGE WORKER] [JobID:${job.id}] ⚠️ Không thể lưu trạng thái Failed:`,
        saveErr.message
      );
    }

    // ── 2. Hoàn trả 2 Credits cho User (atomic) ──────────────────────
    try {
      await User.increment('credits', {
        by:    2,
        where: { id: user.id },
      });
      console.log(
        `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
        '✅ Đã hoàn trả 2 credits.'
      );
    } catch (refundErr) {
      console.error(
        `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
        '🚨 CRITICAL: Hoàn credits thất bại! Kiểm tra thủ công ngay!',
        refundErr.message
      );
    }

    // ── 3. Ghi log Transaction hoàn phí ──────────────────────────────
    try {
      const refundTxId =
        'TRX-REFUND-' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900);

      await Transaction.create({
        id:            refundTxId,
        userId:        user.id,
        package_name:  'Tạo Ảnh AI',
        amount:        0,
        credits_added: 2,              // Dương — đây là hoàn tiền vào ví
        status:        'success',
        type:          'Hoàn phí dịch vụ',
      });

      console.log(`[IMAGE WORKER] [JobID:${job.id}] ✅ Đã ghi log Transaction hoàn phí.`);
    } catch (txErr) {
      console.error(
        `[IMAGE WORKER] [JobID:${job.id}] ⚠️ Không thể ghi Transaction hoàn phí:`,
        txErr.message
      );
    }

    // ── 4. Tạo Notification thất bại & Emit SSE ───────────────────────
    try {
      const apiErrorMsg = err.response?.data?.error?.message || err.message || 'Lỗi không xác định';
      const failNotif = await Notification.create({
        userId:  user.id,
        title:   'Tạo ảnh thất bại ✗',
        message: `Yêu cầu vẽ ảnh thất bại: ${apiErrorMsg}. ` +
                 'Đã hoàn trả 2 credits vào tài khoản.',
        type:    'error',
        is_read: false,
      });

      notificationEmitter.emit('send_notification', failNotif);
    } catch (notifErr) {
      console.error(
        `[IMAGE WORKER] [JobID:${job.id}] ⚠️ Không thể gửi Notification thất bại:`,
        notifErr.message
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Lấy lịch sử tạo ảnh của User hiện tại
// ─────────────────────────────────────────────────────────────────────
const getImageHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const jobs   = await ImageJob.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json({ success: true, data: jobs });
  } catch (err) {
    console.error(
      `[IMAGE CONTROLLER] [UserID:${req.user.id}] Lỗi tải lịch sử ảnh:`,
      err.message
    );
    return res.status(500).json({
      error: 'Đã xảy ra lỗi hệ thống khi tải lịch sử tạo ảnh.',
    });
  }
};

// ─────────────────────────────────────────────────────────────────────
// Xóa một ImageJob theo ID (chỉ xóa job của chính user đó)
// ─────────────────────────────────────────────────────────────────────
const deleteImageJob = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await ImageJob.findOne({
      where: { id, userId: req.user.id },
    });

    if (!job) {
      return res.status(404).json({ message: 'Không tìm thấy tác vụ tạo ảnh.' });
    }

    await job.destroy();
    return res.status(200).json({
      success: true,
      message: 'Xoá tác vụ tạo ảnh thành công.',
    });
  } catch (err) {
    console.error(
      `[IMAGE CONTROLLER] [UserID:${req.user.id}] Lỗi xoá ImageJob #${id}:`,
      err.message
    );
    return res.status(500).json({
      message: 'Lỗi hệ thống khi xoá tác vụ tạo ảnh.',
    });
  }
};

module.exports = {
  generateImage,
  getImageHistory,
  deleteImageJob,
};