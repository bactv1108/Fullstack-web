// =====================================================================
// src/controllers/image.controller.js
// Provider: Fal.ai (Flux Schnell) with Gemini Prompt Enhancer
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

const { generateImageWithFlux } = require('../services/fal.service');
const notificationEmitter = require('../utils/notificationEmitter');

/**
 * Helper to remove Vietnamese tones/diacritics and return a clean unaccented string.
 */
function removeVietnameseTones(str) {
  if (!str) return '';
  let result = str;
  result = result.toLowerCase();
  result = result.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  result = result.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  result = result.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  result = result.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  result = result.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  result = result.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  result = result.replace(/đ/g, "d");
  // Normalize NFD combined characters
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  result = result.replace(/đ/g, "d");
  result = result.replace(/Đ/g, "D");
  return result.replace(/[^a-zA-Z0-9\s]/g, "").trim();
}

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
    const appRef = req.app;
    _runFalWorker({ job, user, prompt, selectedRatio, appRef })
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
// WORKER: Gọi API Fal.ai (Flux Schnell)
// ─────────────────────────────────────────────────────────────────────
async function _runFalWorker({ job, user, prompt, selectedRatio, appRef }) {
  console.log(
    `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
    `Bắt đầu | Provider: Fal.ai Flux Schnell | AspectRatio: ${selectedRatio} | ` +
    `Prompt: "${prompt.substring(0, 60)}..."`
  );

  try {
    // ── A: Cập nhật trạng thái → Rendering ───────────────────────────
    job.status   = 'Rendering';
    job.progress = 10;
    await job.save();
    console.log(`[IMAGE WORKER] [JobID:${job.id}] Trạng thái → Rendering`);

    // ── B: Tích hợp Gemini Translator & Enhancer ngầm ─────────────────
    let enhancedPrompt = prompt;
    try {
      const dbRecord = await SystemConfig.findOne({ where: { key: 'gemini_api_key' } });
      const geminiApiKey = dbRecord?.value || process.env.GEMINI_API_KEY;
      if (geminiApiKey) {
        console.log(`[IMAGE WORKER] [JobID:${job.id}] Đang dịch và tối ưu prompt qua Gemini 2.0 Flash...`);
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;
        const systemInstruction = 
          "You are a professional Prompt Engineer for Flux Image Generation. Your job is to translate the user's input into English (if it's in Vietnamese) and enhance it into a detailed, photorealistic studio product or cinematic photography prompt. \n" +
          "CRITICAL: Output ONLY the final enhanced English text. Do NOT include any markdown, do NOT include quotation marks, do NOT include conversational filler like 'Here is your prompt:'. Your entire response will be fed directly into an image generator API.";
        
        const geminiResponse = await axios.post(geminiUrl, {
          contents: [
            {
              parts: [
                { text: `${systemInstruction}\n\nUser Prompt: ${prompt}` }
              ]
            }
          ]
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 20000
        });

        const candidates = geminiResponse.data?.candidates;
        if (candidates && candidates.length > 0) {
          const text = candidates[0]?.content?.parts?.[0]?.text;
          if (text && text.trim()) {
            enhancedPrompt = text.trim();
          } else {
            throw new Error('Gemini returned empty or invalid response text.');
          }
        } else {
          throw new Error('No response candidates from Gemini.');
        }
        console.log(`[IMAGE WORKER] [JobID:${job.id}] Enhanced prompt: "${enhancedPrompt}"`);
      } else {
        throw new Error('Gemini API key is not configured.');
      }
    } catch (geminiErr) {
      console.warn(
        `[IMAGE WORKER] [JobID:${job.id}] Gemini prompt enhancer failed, ` +
        `falling back to clean un-accented Vietnamese: ${geminiErr.message}`
      );
      // Fallback: Convert original prompt to clean un-accented Vietnamese to prevent drawing error / 404 pathing
      enhancedPrompt = removeVietnameseTones(prompt);
      console.log(`[IMAGE WORKER] [JobID:${job.id}] Fallback clean prompt: "${enhancedPrompt}"`);
    }

    // ── C: Gọi Fal.ai để tạo ảnh đồng bộ bằng Flux Schnell ──────────────────────
    const falResult = await generateImageWithFlux(enhancedPrompt, selectedRatio);

    job.progress = 60;
    await job.save();

    let imageBuffer;
    if (falResult && falResult.isBuffer) {
      console.log(`[IMAGE WORKER] [JobID:${job.id}] Nhận dữ liệu ảnh nhị phân trực tiếp từ mock service.`);
      imageBuffer = Buffer.from(falResult.buffer);
    } else {
      // ── D: Tải ảnh từ Fal.ai CDN về máy chủ cục bộ ───────────────────────────
      console.log(`[IMAGE WORKER] [JobID:${job.id}] Đang tải ảnh từ Fal.ai CDN: ${falResult.url}`);
      const imageResponse = await axios.get(falResult.url, {
        responseType: 'arraybuffer',
        timeout: 15000
      });
      imageBuffer = Buffer.from(imageResponse.data);
    }

    // ── E: Ghi file ảnh xuống disk (async, non-blocking) ─────────────
    const dir = path.join(__dirname, '../../uploads/images');
    await fsPromises.mkdir(dir, { recursive: true });

    const filename = `AI_Image_Job${job.id}_${Date.now()}.png`;
    const filePath = path.join(dir, filename);

    await fsPromises.writeFile(filePath, imageBuffer);
    const outputUrl = `/uploads/images/${filename}`;

    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] ✅ Đã ghi file: ${outputUrl} (${imageBuffer.length} bytes)`
    );

    // ── F: Cập nhật ImageJob → Completed ─────────────────────────────
    job.status     = 'Completed';
    job.progress   = 100;
    job.output_url = outputUrl;
    await job.save();

    console.log(`[IMAGE WORKER] [JobID:${job.id}] ✅ Trạng thái → Completed`);

    // ── G: Tạo Notification thành công & Emit SSE ─────────────────────
    const successNotif = await Notification.create({
      userId:  user.id,
      title:   'Tạo ảnh hoàn tất ✓',
      message: `Hình ảnh "${prompt.substring(0, 40)}..." đã được vẽ thành công bằng Fal.ai Flux!`,
      type:    'info',
      is_read: false,
    });

    const notifJSON = successNotif.toJSON();
    const ssePayload = {
      ...notifJSON,
      jobDetails: {
        id: job.id,
        prompt: prompt,
        aspectRatio: selectedRatio,
        status: 'Completed',
        progress: 100,
        output_url: outputUrl,
        createdAt: job.createdAt || new Date()
      }
    };

    notificationEmitter.emit('send_notification', ssePayload);

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

      const failJSON = failNotif.toJSON();
      const sseFailPayload = {
        ...failJSON,
        jobDetails: {
          id: job.id,
          prompt: prompt,
          aspectRatio: selectedRatio,
          status: 'Failed',
          progress: 0,
          output_url: null,
          createdAt: job.createdAt || new Date()
        }
      };

      notificationEmitter.emit('send_notification', sseFailPayload);

      // Bắn thông báo lỗi real-time về Admin Dashboard
      if (appRef && appRef.emitAdminNotification) {
        appRef.emitAdminNotification({
          title: 'Lỗi Tạo Ảnh AI ✗',
          content: `Tạo ảnh AI cho "${user.name || 'User #' + user.id}" thất bại: ${apiErrorMsg}`,
          type: 'error'
        });
      }
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