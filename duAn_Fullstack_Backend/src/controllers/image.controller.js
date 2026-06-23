// =====================================================================
// src/controllers/image.controller.js
// Provider: Fal.ai (Flux Schnell)
// Chiến thuật dịch prompt: GIÁP HAI LỚP
//   Lớp 1 (Ưu tiên): OpenRouter → Llama 3 8B (free tier)
//   Lớp 2 (Phao cứu sinh): google-translate-api-x (dịch thô + magic tail)
// Các fix production hiện có:
//   ✅ Atomic credit deduction chống Race Condition (Op.gte)
//   ✅ Status 'Rendering' (đúng ENUM) trước khi gọi API
//   ✅ Ghi file async (fsPromises — không blocking Event Loop)
//   ✅ Worker tách hàm riêng + .catch() tầng ngoài cùng
//   ✅ Hoàn trả credits + ghi Transaction khi thất bại
//   ✅ job.save() trong catch được bọc try/catch riêng
//   ✅ Log đầy đủ Job ID + User ID + từng bước
//   ✅ [BUGFIX] Gọi Fal.ai trực tiếp, đúng endpoint + header "Key ..."
//   ✅ [NEW] Giáp Hai Lớp: OpenRouter Llama 3 → google-translate-api-x
//   ✅ [NEW] Magic Tail tự động gắn vào prompt lớp 2 / tiếng Anh thuần
// =====================================================================

const axios      = require('axios');
const fsPromises = require('fs').promises;
const path       = require('path');
const { Op }     = require('sequelize');

// Thư viện dịch free (Lớp 2 — phao cứu sinh)
// google-translate-api-x hỗ trợ cú pháp ES Module nhưng cũng có CJS wrapper
const translate  = require('google-translate-api-x');

const {
  User,
  ImageJob,
  Transaction,
  Notification,
  SystemConfig,
  sequelize,
} = require('../models');

const notificationEmitter = require('../utils/notificationEmitter');

// ─── Magic Tail: cộng thêm vào prompt dịch thô (Lớp 2) để cải thiện chất lượng ──
const MAGIC_TAIL = ', professional photography, hyper-realistic, highly detailed 8k, cinematic lighting, masterpiece';

// ─── Detector: kiểm tra prompt có ký tự tiếng Việt không ────────────────────
function containsVietnamese(text) {
  // Regex khớp các ký tự Unicode đặc trưng của tiếng Việt có dấu
  return /[àáảãạăắặẵẳặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẶẴẲẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]/u.test(text);
}

// ─────────────────────────────────────────────────────────────────────────────
// HÀM DỊCH + TỐI ƯU PROMPT: GIÁP HAI LỚP
// Trả về: { finalPrompt: string, layer: 1 | 2 | 0 }
//   layer 1 = OpenRouter thành công
//   layer 2 = google-translate-api-x (fallback)
//   layer 0 = prompt đã là tiếng Anh, không cần dịch
// ─────────────────────────────────────────────────────────────────────────────
async function _translatePromptTwoLayer(rawPrompt, jobId) {

  // Nếu prompt đã là tiếng Anh thuần → không cần dịch
  // Vẫn cộng Magic Tail để cải thiện chất lượng ảnh
  if (!containsVietnamese(rawPrompt)) {
    const finalPrompt = rawPrompt + MAGIC_TAIL;
    console.log(
      `[TRANSLATE] [JobID:${jobId}] Prompt tiếng Anh thuần. ` +
      `Magic Tail đã gắn. Final: "${finalPrompt.substring(0, 80)}..."`
    );
    return { finalPrompt, layer: 0 };
  }

  // ── LỚP 1: OpenRouter → Llama 3 8B Instruct (free tier) ──────────────────
  try {
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (!openrouterKey || !openrouterKey.trim()) {
      throw new Error('OPENROUTER_API_KEY chưa được cấu hình trong .env');
    }

    console.log(`[TRANSLATE] [JobID:${jobId}] Lớp 1 → Gọi OpenRouter Llama 3 8B...`);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-studio.app',
        'X-Title': 'AI Studio Image Generator',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert prompt engineer for Flux AI specializing in photorealistic, cinematic photography. ' +
              "Your job is to translate the user's Vietnamese prompt into English and enhance it to look like a REAL, authentic photograph. " +
              "Always incorporate keywords like: 'RAW photo, photo-realistic, captured on 35mm lens, natural lighting, highly detailed skin textures, award-winning photography, realistic imperfections'. " +
              'Strictly avoid any 3D render, digital illustration, anime, or cinematic fantasy style. ' +
              'Return ONLY the final English prompt string, no explanations, no markdown block.',
          },
          {
            role: 'user',
            content: rawPrompt,
          },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(18000),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(unreadable)');
      throw new Error(`OpenRouter HTTP ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    const translatedText = data?.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('OpenRouter trả về content rỗng.');
    }

    console.log(
      `[TRANSLATE] [JobID:${jobId}] ✅ Lớp 1 OpenRouter thành công. ` +
      `Prompt: "${translatedText.substring(0, 80)}..."`
    );

    // Ghi nhận hóa đơn chi phí (ApiCost)
    try {
      const { ApiCost } = require('../models');
      await ApiCost.create({
        provider: 'OpenRouter',
        cost: 0.02,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`[API LOG COST] Đã lưu vết chi phí: OpenRouter | $0.02 cho translation Job #${jobId}`);
    } catch (databaseError) {
      console.error('[TRANSLATE] ⚠️ Lỗi khi ghi nhận ApiCost OpenRouter:', databaseError.message);
    }

    return { finalPrompt: translatedText, layer: 1 };

  } catch (layer1Err) {
    console.warn(
      `⚠️ [TRANSLATE] [JobID:${jobId}] Lớp 1 OpenRouter thất bại (${layer1Err.message}). ` +
      `Kích hoạt Lớp 2 → google-translate-api-x...`
    );

    // ── LỚP 2: google-translate-api-x (phao cứu sinh) ─────────────────────
    try {
      const result = await translate(rawPrompt, { from: 'vi', to: 'en' });
      const roughTranslation = (result?.text || rawPrompt).trim();

      // Cộng Magic Tail vào cuối prompt dịch thô để tăng chất lượng
      const finalPrompt = roughTranslation + MAGIC_TAIL;

      console.log(
        `[TRANSLATE] [JobID:${jobId}] ✅ Lớp 2 google-translate thành công. ` +
        `Prompt + Magic Tail: "${finalPrompt.substring(0, 100)}..."`
      );

      return { finalPrompt, layer: 2 };

    } catch (layer2Err) {
      // Cả 2 lớp đều sập → dùng prompt gốc tiếng Việt + Magic Tail
      console.error(
        `❌ [TRANSLATE] [JobID:${jobId}] Cả hai lớp dịch đều thất bại! ` +
        `Layer2 error: ${layer2Err.message}. ` +
        `Sử dụng prompt gốc tiếng Việt + Magic Tail.`
      );
      const finalPrompt = rawPrompt + MAGIC_TAIL;
      return { finalPrompt, layer: 2 };
    }
  }
}

// 💡 TRẠM GÁC CHẶN 18+: Danh sách từ khóa nhạy cảm lọc nhanh bằng Regex
// 💡 THẦN CHÚ 1: Hàm xóa dấu tiếng Việt chuẩn hóa văn bản để ép User đấu thô với bộ lọc
const removeVietnameseTones = (str) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
};

// 💡 THẦN CHÚ 2: Ma trận bẫy cụm từ và từ lóng lách luật (Quét cả có dấu và không dấu)
const checkStrictNsfwPrompt = (rawPrompt) => {
  if (!rawPrompt) return false;

  // 1. Chuẩn hóa text: ép về chữ thường và xóa sạch dấu
  const cleanPrompt = removeVietnameseTones(rawPrompt);

  // 2. Danh sách từ khóa nguy hiểm cố định (Cả Anh lẫn Việt)
  const strictBlacklist = [
    'khoa than', 'nudity', 'nude', 'naked', 'porn', 'sex', 'pussy', 'dick', 'boobs', 
    'dam dang', 'khong che', 'tran truong', 'lo the', 'nguc tran', 'lam tinh', 'quan he tinh duc',
    'hentai', 'ecchi', 'khieu dam', '18+', 'nsfw', 'topless', 'bottomless', 'no clothes',
    'bu liem', 'ho hang', 'coi do', 'lot do'
  ];

  // Check nhanh từ khóa cố định
  const hasBlacklistWord = strictBlacklist.some(word => cleanPrompt.includes(word));
  if (hasBlacklistWord) return true;

  // 3. 🚨 MA TRẬN REGEX COMBO: Bẫy cấu trúc ngữ cảnh miêu tả trạng thái lách luật
  const nsfwPatterns = [
    /khong\s*(co\s*)?(quan\s*ao|do|vai|xiem\s*y)/g,     // Bắt: khong co quan ao, khong quan ao, khong co do, khong do...
    /khong\s*mac\s*(gi|do|quan|ao)?/g,                 // Bắt: khong mac gi, khong mac do, khong mac ao...
    /(coi|lot|boc|thao)\s*(do|quan|ao|vay|ao\s*lot)/g, // Bắt: coi do, lot quan ao, lot vay, coi ao lot...
    /tran\s*nhu\s*nhong/g,                             // Bắt: tran nhu nhong
    /thieu\s*vai/g,                                    // Bắt: thieu vai
    /xuyen\s*thau/g,                                   // Bắt: xuyen thau (tránh tạo ảnh nhìn xuyên quần áo)
    /lo\s*(hang|nguc|num|buom|cu)/g                    // Bắt: lo hang, lo nguc, lo num...
  ];

  // Quét qua mảng Regex để tìm vết tích lách luật
  const hasPatternMatch = nsfwPatterns.some(pattern => {
    // Reset regex lastIndex because of 'g' flag
    pattern.lastIndex = 0;
    return pattern.test(cleanPrompt);
  });
  if (hasPatternMatch) return true;

  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// HÀM CHÍNH: Tiếp nhận request, xác thực, trừ xu, tạo job, trả 200 OK ngay
// ─────────────────────────────────────────────────────────────────────────────
const generateImage = async (req, res) => {

  // ── BƯỚC 1: Xác thực & làm sạch đầu vào ──────────────────────────────────
  const rawPrompt = req.body.prompt;
  const { aspectRatio } = req.body;

  const prompt = typeof rawPrompt === 'string' ? rawPrompt.trim() : '';

  if (!prompt) {
    return res.status(400).json({
      error: 'Kịch bản/Mô tả prompt cho ảnh không được để trống.',
    });
  }

  if (prompt.length > 1500) {
    return res.status(400).json({
      error: 'Prompt quá dài (tối đa 1500 ký tự). Vui lòng rút ngắn mô tả.',
    });
  }

  const userId = req.user.id;

  // 🚨 KÍCH HOẠT TẤM KHIÊN MA TRẬN NGỮ CẢNH:
  if (checkStrictNsfwPrompt(prompt)) {
    console.warn(`[DIỆT LÁCH LUẬT ĐỒNG BỘ] Chặn đứng User #${userId} cố tình dùng cụm từ nhạy cảm: "${prompt}"`);
    return res.status(400).json({
      success: false,
      error: 'Yêu cầu bị hệ thống từ chối! Prompt của bạn chứa các cụm từ miêu tả trạng thái nhạy cảm hoặc vi phạm chính sách nội dung 18+ của AI Studio. Vui lòng điều chỉnh lại văn bản hợp lệ.',
      message: 'Yêu cầu bị hệ thống từ chối! Prompt của bạn chứa các cụm từ miêu tả trạng thái nhạy cảm hoặc vi phạm chính sách nội dung 18+ của AI Studio. Vui lòng điều chỉnh lại văn bản hợp lệ.'
    });
  }

  const validRatios   = ['1:1', '16:9', '9:16'];
  const selectedRatio = validRatios.includes(aspectRatio) ? aspectRatio : '1:1';

  try {
    // ── BƯỚC 2: Trừ Credits Atomic — chống Race Condition ─────────────────
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

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng.' });
    }

    // ── BƯỚC 3: Ghi log Transaction chi phí ──────────────────────────────
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

    // ── BƯỚC 4: Tạo ImageJob với trạng thái Pending ───────────────────────
    const job = await ImageJob.create({
      userId:       user.id,
      prompt,
      aspectRatio:  selectedRatio,
      status:       'Pending',
      progress:     0,
      credits_used: 2,
    });

    // ── BƯỚC 5: Trả 200 OK ngay cho Frontend ─────────────────────────────
    res.status(200).json({
      success: true,
      message: 'Yêu cầu tạo ảnh đang được xử lý ngầm.',
      jobId:   job.id,
      status:  'Pending',
    });

    // ── BƯỚC 6: Kích hoạt Worker ngầm ────────────────────────────────────
    const appRef = req.app;
    const quantity = Number(req.body.num_images || req.body.quantity || 1);
    const modelName = req.body.model || 'flux-schnell';
    _runFalWorker({ job, user, prompt, selectedRatio, appRef, quantity, modelName })
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

// ─────────────────────────────────────────────────────────────────────────────
// WORKER: Gọi API Fal.ai (Flux Schnell) — Tích hợp Giáp Hai Lớp dịch prompt
// ─────────────────────────────────────────────────────────────────────────────
async function _runFalWorker({ job, user, prompt, selectedRatio, appRef, quantity = 1, modelName = 'flux-schnell' }) {
  console.log(
    `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ` +
    `Bắt đầu | Provider: Fal.ai Flux Schnell | AspectRatio: ${selectedRatio} | ` +
    `Prompt gốc: "${prompt.substring(0, 60)}..."`
  );

  try {
    // ── A: Cập nhật trạng thái → Rendering ────────────────────────────────
    job.status   = 'Rendering';
    job.progress = 10;
    await job.save();
    console.log(`[IMAGE WORKER] [JobID:${job.id}] Trạng thái → Rendering`);

    // ── B: GIÁP HAI LỚP — Dịch & tối ưu prompt ───────────────────────────
    //
    // Lớp 1: OpenRouter → Llama 3 8B Instruct (free, smart translation)
    // Lớp 2: google-translate-api-x (fallback thô, có Magic Tail)
    // Layer 0: Prompt tiếng Anh thuần (không cần dịch, chỉ gắn Magic Tail)
    //
    // MỤC TIÊU: Tuyệt đối KHÔNG để prompt tiếng Việt thô lọt sang Fal.ai
    // ─────────────────────────────────────────────────────────────────────
    const { finalPrompt, layer } = await _translatePromptTwoLayer(prompt, job.id);

    const layerLabel = layer === 1 ? 'OpenRouter Llama 3'
                     : layer === 2 ? 'google-translate + Magic Tail'
                     : 'EN thuần + Magic Tail';

    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] Dịch hoàn tất (${layerLabel}). ` +
      `Final prompt: "${finalPrompt.substring(0, 100)}..."`
    );

    job.progress = 30;
    await job.save();

    // ── C: Lấy Fal API Key từ DB ──────────────────────────────────────────
    const falRow    = await SystemConfig.findByPk('fal_api_key');
    const falApiKey = (falRow ? falRow.value : null) || process.env.FAL_KEY;

    if (!falApiKey || !falApiKey.trim()) {
      throw new Error(
        'Fal API Key chưa được cấu hình. Vào trang Tài nguyên API → nhập Fal API Key.'
      );
    }

    // ── D: Mapping tỷ lệ → Flux Schnell image_size ────────────────────────
    //
    // '1:1'  → 'square_hd'
    // '16:9' → 'landscape_16_9'
    // '9:16' → 'portrait_16_9'
    const imageSizeMap = {
      '1:1':  'square_hd',
      '16:9': 'landscape_16_9',
      '9:16': 'portrait_16_9',
    };
    const imageSize = imageSizeMap[selectedRatio] || 'square_hd';

    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] Gọi Fal.ai Flux Schnell | ` +
      `image_size: ${imageSize} | prompt: "${finalPrompt.substring(0, 80)}..."`
    );

    // ── E: Gọi Fal.ai Flux Schnell (endpoint đồng bộ) ────────────────────
    let falResponseData;
    try {
      const falResponse = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falApiKey.trim()}`,  // Fal.ai dùng "Key", KHÔNG dùng "Bearer"
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt:                finalPrompt,
          image_size:            imageSize,
          num_images:            1,
          enable_safety_checker: true, // Bật bộ lọc an toàn của Fal.ai
        }),
        signal: AbortSignal.timeout(60000), // 60s timeout
      });

      if (!falResponse.ok) {
        let errorBody = '(không đọc được body lỗi)';
        try { errorBody = await falResponse.text(); } catch (_) {}
        console.error(
          `❌ [IMAGE WORKER] [JobID:${job.id}] Fal.ai API Error: ` +
          `HTTP ${falResponse.status} — ${errorBody}`
        );
        throw new Error(`Fal.ai trả về lỗi HTTP ${falResponse.status}: ${errorBody}`);
      }

      falResponseData = await falResponse.json();

    } catch (falFetchErr) {
      const isNetworkErr =
        falFetchErr.message?.toLowerCase().includes('fetch failed') ||
        falFetchErr.message?.toLowerCase().includes('enotfound') ||
        falFetchErr.message?.toLowerCase().includes('econnreset') ||
        falFetchErr.message?.toLowerCase().includes('network') ||
        falFetchErr.name === 'TimeoutError';

      console.error(
        `❌ [IMAGE WORKER] [JobID:${job.id}] Fal.ai ${isNetworkErr ? 'Network' : 'API'} Error: ${falFetchErr.message}`
      );
      throw falFetchErr;
    }

    // ── F: Trích xuất URL ảnh & kiểm tra an toàn đầu ra ───────────────────
    //
    // 💡 CHẶN LỖI/LÁCH LUẬT: Kiểm tra xem ảnh có bị dính bộ lọc NSFW (đen xì/NSFW concept) của Fal.ai không
    const isSafetyTriggered = 
      falResponseData?.has_nsfw_concept?.[0] === true || 
      falResponseData?.has_nsfw_concept === true ||
      falResponseData?.data?.has_nsfw_concept === true ||
      (falResponseData?.images?.[0] && (falResponseData.images[0].has_nsfw_concept === true || falResponseData.images[0].nsfw === true));

    if (isSafetyTriggered) {
      console.warn(`[SAFETY TRIGGERED] Phát hiện ảnh vi phạm chính sách an toàn đầu ra (NSFW) cho Job #${job.id}`);
      
      // Cập nhật trạng thái bản ghi thành 'failed_violation'
      job.status   = 'failed_violation';
      job.progress = 0;
      await job.save();

      // Cập nhật log ảnh lỗi vi phạm chính sách trong ImageAnalysis (nếu có)
      try {
        const { ImageAnalysis } = require('../models');
        await ImageAnalysis.update(
          { status: 'confirmed_violation' },
          { where: { id: job.id } }
        ).catch(() => {});
      } catch (err) {}

      // Báo lỗi về màn hình, KHÔNG chạy lệnh cộng/hoàn tiền Credits
      const failNotif = await Notification.create({
        userId:  user.id,
        title:   'Hình ảnh bị hủy bỏ ⚠️',
        message: 'Hình ảnh bị huỷ bỏ do vi phạm bộ lọc an toàn đầu ra của nhà cung cấp API ngoại vi. Tín dụng không được hoàn lại cho các hành vi lách luật.',
        type:    'error',
        is_read: false,
      });

      notificationEmitter.emit('send_notification', {
        ...failNotif.toJSON(),
        jobDetails: {
          id:          job.id,
          prompt,
          aspectRatio: selectedRatio,
          status:      'failed_violation',
          progress:    0,
          output_url:  null,
          createdAt:   job.createdAt || new Date(),
        },
      });

      if (appRef && appRef.emitAdminNotification) {
        appRef.emitAdminNotification({
          title:   'Tạo Ảnh Vi Phạm Chính Sách ⚠️',
          content: `User "${user.name || 'User #' + user.id}" cố tình lách luật tạo ảnh nhạy cảm (Job #${job.id})`,
          type:    'warning',
        });
      }
      return; // Dừng luồng xử lý tại đây để TUYỆT ĐỐI không hoàn credits!
    }

    // Flux Schnell trả về: { images: [{ url: "https://..." }], ... }
    const imageUrl = falResponseData?.images?.[0]?.url;
    if (!imageUrl) {
      console.error(
        `❌ [IMAGE WORKER] [JobID:${job.id}] Fal.ai response không chứa URL ảnh. ` +
        `Body: ${JSON.stringify(falResponseData)}`
      );
      throw new Error('Fal.ai không trả về URL ảnh trong response.');
    }

    // ── Ghi nhận hóa đơn chi phí (ApiCost) ──
    try {
      const { ApiCost } = require('../models');
      let provider = 'Fal';
      let unitCost = 0.02000000;

      const lowerModel = modelName.toLowerCase();
      if (lowerModel.includes('dall-e') || lowerModel.includes('openai') || lowerModel.includes('openrouter')) {
        provider = lowerModel.includes('openrouter') ? 'OpenRouter' : 'OpenAI';
        unitCost = 0.04000000;
      }

      const count = Number(quantity) || 1;
      const totalCost = Number((unitCost * count).toFixed(8));

      await ApiCost.create({
        provider: provider,
        cost: totalCost,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`[IMAGE WORKER] [JobID:${job.id}] ✅ Ghi nhận ApiCost thành công: ${provider} | Cost: ${totalCost}`);
    } catch (databaseError) {
      console.error('[IMAGE WORKER] ⚠️ Lỗi khi ghi nhận ApiCost tạo ảnh:', databaseError.message);
    }

    job.progress = 60;
    await job.save();

    // ── G: Tải ảnh từ Fal.ai CDN về server cục bộ ─────────────────────────
    console.log(`[IMAGE WORKER] [JobID:${job.id}] Đang tải ảnh từ Fal.ai CDN: ${imageUrl}`);
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const imageBuffer = Buffer.from(imageResponse.data);

    // ── H: Ghi file ảnh xuống disk (async, non-blocking) ──────────────────
    const dir      = path.join(__dirname, '../../uploads/images');
    await fsPromises.mkdir(dir, { recursive: true });

    const filename  = `AI_Image_Job${job.id}_${Date.now()}.png`;
    const filePath  = path.join(dir, filename);
    await fsPromises.writeFile(filePath, imageBuffer);

    const outputUrl = `/uploads/images/${filename}`;
    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] ✅ Đã ghi file: ${outputUrl} (${imageBuffer.length} bytes)`
    );

    // ── I: Cập nhật ImageJob → Completed ──────────────────────────────────
    job.status     = 'Completed';
    job.progress   = 100;
    job.output_url = outputUrl;
    await job.save();
    console.log(`[IMAGE WORKER] [JobID:${job.id}] ✅ Trạng thái → Completed`);

    // ── J: Tạo Notification thành công & Emit SSE ──────────────────────────
    const successNotif = await Notification.create({
      userId:  user.id,
      title:   'Tạo ảnh hoàn tất ✓',
      message: `Hình ảnh "${prompt.substring(0, 40)}..." đã được vẽ thành công bằng Fal.ai Flux! (Dịch qua: ${layerLabel})`,
      type:    'info',
      is_read: false,
    });

    const ssePayload = {
      ...successNotif.toJSON(),
      jobDetails: {
        id:          job.id,
        prompt:      prompt,
        aspectRatio: selectedRatio,
        status:      'Completed',
        progress:    100,
        output_url:  outputUrl,
        createdAt:   job.createdAt || new Date(),
      },
    };

    notificationEmitter.emit('send_notification', ssePayload);
    console.log(
      `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ✅ Hoàn tất toàn bộ luồng.`
    );

  } catch (err) {
    // ── XỬ LÝ LỖI: Cập nhật Job → Failed, Hoàn Credits, Notify ──────────
    console.error(
      `[IMAGE WORKER] [JobID:${job.id}] [UserID:${user.id}] ❌ Worker thất bại:`,
      err.response?.data ? JSON.stringify(err.response.data) : err.message
    );

    // 1. Cập nhật Job → Failed
    try {
      job.status   = 'Failed';
      job.progress = 0;
      await job.save();
      console.log(`[IMAGE WORKER] [JobID:${job.id}] Trạng thái → Failed`);
    } catch (saveErr) {
      console.error(`[IMAGE WORKER] [JobID:${job.id}] ⚠️ Không thể lưu trạng thái Failed:`, saveErr.message);
    }

    // 2. Hoàn trả 2 Credits (atomic)
    try {
      await User.increment('credits', { by: 2, where: { id: user.id } });
      console.log(`[IMAGE WORKER] [JobID:${job.id}] ✅ Đã hoàn trả 2 credits cho UserID:${user.id}`);
    } catch (refundErr) {
      console.error(
        `[IMAGE WORKER] [JobID:${job.id}] 🚨 CRITICAL: Hoàn credits thất bại!`,
        refundErr.message
      );
    }

    // 3. Ghi log Transaction hoàn phí
    try {
      const refundTxId = 'TRX-REFUND-' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900);
      await Transaction.create({
        id:            refundTxId,
        userId:        user.id,
        package_name:  'Tạo Ảnh AI',
        amount:        0,
        credits_added: 2,
        status:        'success',
        type:          'Hoàn phí dịch vụ',
      });
    } catch (txErr) {
      console.error(`[IMAGE WORKER] [JobID:${job.id}] ⚠️ Ghi Transaction hoàn phí thất bại:`, txErr.message);
    }

    // 4. Notification thất bại & Emit SSE
    try {
      const apiErrorMsg = err.response?.data?.error?.message || err.message || 'Lỗi không xác định';
      const failNotif = await Notification.create({
        userId:  user.id,
        title:   'Tạo ảnh thất bại ✗',
        message: `Vẽ ảnh thất bại: ${apiErrorMsg}. Đã hoàn trả 2 credits vào tài khoản. 💡 Gợi ý: Thử lại sau vài giây.`,
        type:    'error',
        is_read: false,
      });

      notificationEmitter.emit('send_notification', {
        ...failNotif.toJSON(),
        jobDetails: {
          id:          job.id,
          prompt,
          aspectRatio: selectedRatio,
          status:      'Failed',
          progress:    0,
          output_url:  null,
          createdAt:   job.createdAt || new Date(),
        },
      });

      if (appRef && appRef.emitAdminNotification) {
        appRef.emitAdminNotification({
          title:   'Lỗi Tạo Ảnh AI ✗',
          content: `Tạo ảnh cho "${user.name || 'User #' + user.id}" thất bại: ${apiErrorMsg}`,
          type:    'error',
        });
      }
    } catch (notifErr) {
      console.error(`[IMAGE WORKER] [JobID:${job.id}] ⚠️ Gửi Notification thất bại:`, notifErr.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lấy lịch sử tạo ảnh của User hiện tại
// ─────────────────────────────────────────────────────────────────────────────
const getImageHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const jobs   = await ImageJob.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
    return res.status(200).json({ success: true, data: jobs });
  } catch (err) {
    console.error(`[IMAGE CONTROLLER] [UserID:${req.user.id}] Lỗi tải lịch sử ảnh:`, err.message);
    return res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống khi tải lịch sử tạo ảnh.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Xóa một ImageJob theo ID (chỉ xóa job của chính user đó)
// ─────────────────────────────────────────────────────────────────────────────
const deleteImageJob = async (req, res) => {
  const { id } = req.params;
  try {
    const job = await ImageJob.findOne({ where: { id, userId: req.user.id } });
    if (!job) {
      return res.status(404).json({ message: 'Không tìm thấy tác vụ tạo ảnh.' });
    }
    await job.destroy();
    return res.status(200).json({ success: true, message: 'Xoá tác vụ tạo ảnh thành công.' });
  } catch (err) {
    console.error(`[IMAGE CONTROLLER] [UserID:${req.user.id}] Lỗi xoá ImageJob #${id}:`, err.message);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xoá tác vụ tạo ảnh.' });
  }
};

module.exports = {
  generateImage,
  getImageHistory,
  deleteImageJob,
};