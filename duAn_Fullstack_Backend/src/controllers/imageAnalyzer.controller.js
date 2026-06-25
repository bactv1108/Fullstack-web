const fs     = require('fs');
const path   = require('path');
const sharp  = require('sharp');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { ImageAnalysis, SystemConfig, User, AdminNotification } = require('../models');



// ═════════════════════════════════════════════════════════════════════════════
//  HELPERS: Lấy API Keys động từ DB (bảng system_configs - Row Key-Value)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Đọc giá trị một key bất kỳ từ bảng system_configs.
 * Fallback về biến ENV nếu DB không có hoặc lỗi.
 */
const getConfigValue = async (key, envFallback = null) => {
  try {
    const row = await SystemConfig.findByPk(key);
    if (row && row.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch (err) {
    console.warn(`[SYSTEM CONFIG] Không thể đọc key="${key}" từ DB:`, err.message);
  }
  return envFallback;
};

// ═════════════════════════════════════════════════════════════════════════════
//  SUPER PROMPT — Song ngữ Anh-Việt (Gemini Native + OpenRouter Vision)
//  Ép AI kết xuất 100% plain text, nghiêm cấm mọi ký tự Markdown
// ═════════════════════════════════════════════════════════════════════════════
const SUPER_PROMPT = `You are a professional E-commerce Fashion Analyzer specializing in apparel, resort wear, and beachwear. 

CRITICAL MODERATION RULE:
1. ALLOWED: You CAN analyze standard swimwear, bikinis, and beach outfits IF they are presented in a normal fashion or vacation context (e.g., on a beach, by a pool) and DO NOT expose explicit sexual body parts.
2. FORBIDDEN (NSFW): If the image contains actual nudity, exposed genitals, fully exposed female breasts/nipples, or explicit pornographic/sexual poses, you MUST IMMEDIATELY STOP your analysis.

If the image falls under category 2 (FORBIDDEN), you must immediately refuse by outputting exactly this single phrase: "CRITICAL_ERROR_SAFETY_VIOLATION". Do not output any other text or explanations.

You are also an elite Product Image Analysis Expert, Senior Product Analyst, and Top Video Ad Scriptwriter specialized in TikTok Affiliate marketing and AI Video Engineering (Fal.ai, Runway, Sora).
Analyze the attached clothing product image carefully to extract every detail of style, material, and branding, then generate a highly professional, high-converting marketing script.

STRICT OUTPUT STRUCTURE (MUST BE 100% CLEAN PLAIN TEXT):

1. PHÂN TÍCH SẢN PHẨM VÀ CHẤT LIỆU
(Viết bằng Tiếng Việt. Liệt kê chính xác tên thương hiệu nếu có logo xuất hiện trên ảnh, bảng màu sắc, chất liệu vải chi tiết như cotton nỉ bông, khaki thô, lụa, jean denim, độ dày dặn, độ co giãn. Phân tích sâu về kiểu dáng và form dáng của sản phẩm như oversize, regular, slimfit, các chi tiết cúc áo, đường kim mũi chỉ, khóa kéo, cổ áo và phong cách cốt lõi mà trang phục này hướng tới).

2. PROMPT SINH VIDEO CHO AI BẰNG TIẾNG ANH (CONSOLIDATED AI VIDEO PROMPT)
(CRITICAL: Viết một đoạn văn dài, giàu tính mô tả kỹ thuật từ 120-180 từ HOÀN TOÀN BẰNG TIẾNG ANH. TUYỆT ĐỐI KHÔNG trộn từ giải thích Tiếng Việt vào mục này để người dùng có thể copy-paste dùng ngay 100%. Bắt buộc phải chèn trực tiếp các mốc thời gian [0-3s], [3-6s], [6-9s], [9-12s] vào ngay đầu mỗi câu mô tả phân cảnh tương ứng để ép AI tạo video chạy đúng timeline. 
Cấu trúc kịch bản lồng ghép trong prompt Tiếng Anh phải tuân thủ:
- [0-3s]: Cảnh mở đầu, góc quay cinematic 4K toàn cảnh sản phẩm trải phẳng không nếp nhăn (premium flat lay) trên nền sàn gỗ luxury hoặc thảm/cát sạch sẽ, ánh sáng studio dịu nhẹ.
- [3-6s]: Cảnh quay macro cận cảnh di chuyển mượt mà tập trung vào chi tiết đắt giá nhất (logo nhãn hiệu, đường may nẹp cúc, kết cấu thớ vải).
- [6-9s]: Cảnh camera lia máy mượt mà (smooth panning), kết hợp hiệu ứng vật lý vải 3D (3D clothing physics) thể hiện độ co giãn, mềm mại của chất liệu dưới tác động ngoại cảnh như gió thổi nhẹ.
- [9-12s]: Cảnh kết thúc tĩnh lặng điện ảnh, làm nổi bật toàn bộ trang phục ở vị trí trung tâm khung hình với hiệu ứng mờ hậu cảnh bokeh chuyên nghiệp).

3. TỪ KHÓA PHỦ ĐỊNH SONG NGỮ (NEGATIVE PROMPT)
(Cung cấp danh sách các từ khóa phủ định chặn lỗi bằng Tiếng Anh kèm giải nghĩa Tiếng Việt trong ngoặc đơn để người dùng dễ kiểm soát: text errors (lỗi chữ), garbled logo (logo méo), deformed clothing (áo biến dạng), low quality (chất lượng thấp), blurry (mờ), extra limbs (thừa chi), distorted proportions (tỉ lệ méo)).

⚠️ STYLISTIC RULES (STRICTLY ENFORCED):
1. Never use asterisks (* or **) anywhere. Do not use them for bolding, titles, emphasis, or bullet points.
2. Never use hashtags (#, ##, ###) for headers or section titles.
3. Never use dashes (-) or bullet points for lists. Use normal numbers (1., 2., 3.) or write in continuous, fluent sentences.
4. Section titles must be in ALL CAPS. Use exactly double newlines (\\n\\n) to separate sections and main headers cleanly.
5. Output must be 100% clean, raw plain text, perfectly formatted without any markdown symbols, ready for the user to copy-paste directly into third-party apps like CapCut, Fal.ai, or Runway without any formatting clean-up.`;

// ═════════════════════════════════════════════════════════════════════════════
//  HELPER: Phát hiện lỗi Quota / Rate-Limit từ Gemini API
//  Trả về true khi lỗi là 429 / RESOURCE_EXHAUSTED → trigger Fal fallback
//  Trả về false khi lỗi khác (key sai, mạng, nội dung bị chặn...) → throw
// ═════════════════════════════════════════════════════════════════════════════
const isGeminiQuotaError = (err) => {
  const msg    = (err.message || '').toUpperCase();
  const status = err.status || err.httpStatus || err.code || 0;
  return (
    status === 429 ||
    String(status) === '429' ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QUOTA') ||
    msg.includes('RATE_LIMIT') ||
    msg.includes('TOO_MANY_REQUESTS')
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  TẦNG 1: GOOGLE GEMINI 2.0 FLASH — Model ưu tiên, phân tích ảnh bằng Vision
//  Ảnh gửi dưới dạng base64 inlineData — không cần upload CDN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Phân tích ảnh sản phẩm bằng Gemini 2.0 Flash Vision.
 * Ảnh được nén bằng Sharp rồi encode base64 gửi thẳng — tiết kiệm bandwidth.
 * @param {string} geminiKey  - API Key đọc từ DB (gemini_api_key)
 * @param {Buffer} imageBuffer - Buffer ảnh gốc đọc từ disk
 * @returns {Promise<string>}  - Văn bản phân tích sạch từ Gemini
 */
const analyzeWithGemini = async (geminiKey, imageBuffer) => {
  // ─ Bước 1: Nén ảnh bằng Sharp → buffer tối ưu ───────────────────────────
  const optimizedBuffer = await sharp(imageBuffer)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  console.log(`[SHARP/GEMINI] Ảnh sau nén: ${(optimizedBuffer.length / 1024).toFixed(1)}KB → gửi base64 cho Gemini`);

  // ─ Bước 2: Encode base64 và gọi Gemini Vision ────────────────────────────
  const base64Image = optimizedBuffer.toString('base64');

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent([
    { text: SUPER_PROMPT },
    { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
  ]);

  const text = result.response.text();
  if (!text || !text.trim()) {
    throw new Error('[Gemini] Trả về kết quả rỗng.');
  }

  // Tự động ghi sổ hóa đơn chi phí API Google Gemini
  try {
    const { ApiCost } = require('../models');
    const usageMetadata = result.response.usageMetadata;
    const promptTokenCount = usageMetadata ? usageMetadata.promptTokenCount : 0;
    const candidatesTokenCount = usageMetadata ? usageMetadata.candidatesTokenCount : 0;
    // Đơn giá gemini-2.0-flash: $0.075 / 1M input tokens, $0.3 / 1M output tokens
    const calculatedCost = (promptTokenCount * 0.000000075) + (candidatesTokenCount * 0.0000003);
    await ApiCost.create({
      provider: 'Gemini',
      cost: Number(calculatedCost.toFixed(8))
    });
    console.log(`[GEMINI] ✅ Ghi nhận chi phí Gemini: ${calculatedCost} USD cho ${promptTokenCount} input / ${candidatesTokenCount} output tokens`);
  } catch (databaseError) {
    console.error('[GEMINI] ⚠️ Lỗi khi ghi sổ ApiCost Gemini:', databaseError.message);
  }

  return text.trim();
};

// ═════════════════════════════════════════════════════════════════════════════
//  HELPER: Phát hiện lỗi Quota / Rate-Limit từ OpenRouter API
//  Trả về true khi lỗi 429 / RATE_LIMIT / hết credit → trigger OpenRouter fallback
// ═════════════════════════════════════════════════════════════════════════════
const isOpenRouterQuotaError = (err) => {
  const msg    = (err.message || '').toUpperCase();
  const status = err.status || err.httpStatus || err.code || 0;
  return (
    status === 429 ||
    status === 404 ||              // Model bị xóa / không còn endpoint → fallback
    status === 400 ||              // Invalid model ID → fallback thay vì crash
    String(status) === '429' ||
    String(status) === '404' ||
    String(status) === '400' ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.includes('400') ||
    msg.includes('RATE_LIMIT') ||
    msg.includes('QUOTA') ||
    msg.includes('TOO_MANY_REQUESTS') ||
    msg.includes('INSUFFICIENT_CREDITS') ||
    msg.includes('NO_PROVIDER') ||
    msg.includes('NO ENDPOINTS') ||
    msg.includes('NOT FOUND') ||
    msg.includes('NOT A VALID MODEL') ||
    msg.includes('INVALID MODEL')
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  TẦNG 2: OPENROUTER VISION — Fallback thứ nhất khi Gemini hết quota
//  Gọi qua /api/v1/chat/completions — Base64 inline, KHÔNG cần CDN upload
//  Mặc định: google/gemini-2.0-flash-exp:free (pool quota KHÁC Gemini gốc)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Phân tích ảnh sản phẩm bằng OpenRouter Vision (Base64 inline).
 * Không cần upload CDN — gửi ảnh nén thẳng qua body JSON giống Gemini native.
 * Model mặc định: google/gemini-2.0-flash-exp:free — FREE, chất lượng cao.
 * @param {string} openrouterKey  - API Key đọc từ DB (openrouter_api_key)
 * @param {Buffer} imageBuffer    - Buffer ảnh gốc đọc từ disk
 * @returns {Promise<string>}     - Văn bản phân tích sạch từ OpenRouter
 */
const analyzeWithOpenRouter = async (openrouterKey, imageBuffer, modelName = 'google/gemini-2.0-flash') => {
  // ─ Bước 1: Nén ảnh bằng Sharp → buffer tối ưu ───────────────────────────
  const optimizedBuffer = await sharp(imageBuffer)
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  console.log(`[SHARP/OPENROUTER] Ảnh sau nén: ${(optimizedBuffer.length / 1024).toFixed(1)}KB → gửi base64 cho OpenRouter Vision`);

  // ─ Bước 2: Encode base64 và gọi OpenRouter Vision ────────────────────────
  const base64Image = optimizedBuffer.toString('base64');

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openrouterKey}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'https://aistudio.vn',
      'X-Title':       'Mat Than AI - Product Image Analyzer',
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text',      text: SUPER_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    // Ném lỗi kèm HTTP status code để isOpenRouterQuotaError() phân loại được
    const err = new Error(`[OpenRouter] HTTP ${response.status}: ${errText}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text || !text.trim()) {
    throw new Error('[OpenRouter] Trả về kết quả rỗng.');
  }

  console.log(`[OPENROUTER] ✅ Phân tích hoàn tất — ${text.trim().length} ký tự (model: ${modelName} via OpenRouter)`);

  // Tự động ghi sổ hóa đơn chi phí API OpenRouter
  try {
    const { ApiCost } = require('../models');
    let openRouterCost = 0.00001000; // Giá trị chi phí mặc định tối thiểu làm dự phòng
    if (data.usage) {
      if (data.usage.total_cost !== undefined) {
        openRouterCost = parseFloat(data.usage.total_cost);
      } else if (data.usage.cost !== undefined) {
        openRouterCost = parseFloat(data.usage.cost);
      } else {
        const totalTokens = data.usage.total_tokens || 0;
        openRouterCost = totalTokens * 0.000002; // đơn giá dự phòng cấu hình ($0.002 / 1K tokens)
      }
    }
    await ApiCost.create({
      provider: 'OpenRouter',
      cost: Number(openRouterCost.toFixed(8))
    });
    console.log(`[OPENROUTER] ✅ Ghi nhận chi phí OpenRouter: ${openRouterCost} USD`);
  } catch (databaseError) {
    console.error('[OPENROUTER] ⚠️ Lỗi khi ghi sổ ApiCost OpenRouter:', databaseError.message);
  }

  return text.trim();
};



// ═════════════════════════════════════════════════════════════════════════════
//  runAIAnalysis — Bộ điều phối 2 tầng AI
//  Tầng 1: Gemini 2.0 Flash Native (nhanh, không tốn CDN bandwidth)
//  Tầng 2: OpenRouter Vision (fallback khi Gemini báo 429 / hết quota)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Điều phối phân tích ảnh qua 2 tầng AI tuần tự.
 * Gemini chạy trước, OpenRouter là fallback khi Gemini hết quota.
 * Nếu cả 2 đều thất bại → throw lỗi lên caller.
 * @returns {{ promptText, inputTokens, outputTokens, provider }}
 */
const runAIAnalysis = async (geminiKey, openrouterKey, imageBuffer, mimeType, analysisId) => {
  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║  TẦNG 1: Gemini 2.0 Flash Native — Model ưu tiên số 1                  ║
  // ║  Base64 inline → không upload CDN, không tốn thêm chi phí              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  if (geminiKey) {
    try {
      console.log(`[MAT THAN AI] 🤖 [Tầng 1 - Gemini 2.0 Flash] Đang phân tích ảnh #${analysisId}...`);
      const promptText = await analyzeWithGemini(geminiKey, imageBuffer);
      console.log(`[MAT THAN AI] ✅ [Gemini 2.0 Flash] Thành công — ${promptText.length} ký tự`);
      return { promptText, inputTokens: null, outputTokens: null, provider: 'google/gemini-2.0-flash' };
    } catch (geminiErr) {
      if (isGeminiQuotaError(geminiErr)) {
        // Quota / rate-limit → chuyển sang OpenRouter (Tầng 2)
        console.warn(`[MAT THAN AI] ⚠️  [Gemini] Hết quota / rate-limit → Kích hoạt OpenRouter fallback (Tầng 2)...`);
        console.warn(`[MAT THAN AI] Gemini error: ${geminiErr.message}`);
      } else {
        // Lỗi thật (key sai, bị chặn nội dung, network...) → throw ngay
        console.error(`[MAT THAN AI] ❌ [Gemini] Lỗi không phải quota — throw thẳng.`);
        console.error(`[MAT THAN AI] Gemini error: ${geminiErr.message}`);
        throw geminiErr;
      }
    }
  } else {
    console.warn(`[MAT THAN AI] ⚠️  Không có gemini_api_key trong DB → bỏ qua Tầng 1, thử OpenRouter (Tầng 2).`);
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
// ║  TẦNG 2: OpenRouter Vision — Fallback thứ nhất (Sử dụng gói trả phí)   ║
// ║  Dùng google/gemini-2.0-flash — Đã nạp tiền, cam kết không lỗi 404       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
  if (openrouterKey) {
    try {
      console.log(`[MAT THAN AI] 🌐 [Tầng 2 - OpenRouter Vision] Đang phân tích ảnh #${analysisId}...`);

      // google/gemini-3.1-flash-lite: model Google Vision mới nhất đang live trên OpenRouter
      // Rẻ nhất ($0.00000025/token), hỗ trợ image+text, 1M context
      const modelName = 'google/gemini-3.1-flash-lite';
      const promptText = await analyzeWithOpenRouter(openrouterKey, imageBuffer, modelName);

      console.log(`[MAT THAN AI] ✅ [OpenRouter Vision - Gemini 3.1 Flash Lite] Thành công — ${promptText.length} ký tự`);
      return { promptText, inputTokens: null, outputTokens: null, provider: 'openrouter/google/gemini-3.1-flash-lite' };
    } catch (openrouterErr) {
      if (isOpenRouterQuotaError(openrouterErr)) {
        console.warn(`[MAT THAN AI] ⚠️  [OpenRouter] Hết quota / rate-limit — không còn tầng fallback nào.`);
        console.warn(`[MAT THAN AI] OpenRouter error: ${openrouterErr.message}`);
      } else {
        console.error(`[MAT THAN AI] ❌ [OpenRouter] Lỗi không phải quota — throw thẳng.`);
        console.error(`[MAT THAN AI] OpenRouter error: ${openrouterErr.message}`);
        throw openrouterErr;
      }
    }
  } else {
    console.warn(`[MAT THAN AI] ⚠️  Không có openrouter_api_key trong DB → bỏ qua Tầng 2.`);
  }

  // Cả 2 tầng (Gemini + OpenRouter) đều thất bại hoặc không có key
  throw new Error(
    '[MAT THAN AI] Cả 2 tầng AI (Gemini + OpenRouter) đều thất bại hoặc chưa được cấu hình. ' +
    'Vui lòng kiểm tra gemini_api_key và openrouter_api_key trong trang Admin.'
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  HELPER: Dọn sạch file ảnh tạm sau khi xử lý xong (bảo vệ tài nguyên server)
// ═════════════════════════════════════════════════════════════════════════════
/**
 * Xóa file ảnh tạm khỏi thư mục upload.
 * Chạy trong finally block — không throw nếu xóa lỗi (file đã tự xóa, v.v.).
 * @param {string} filePath - Đường dẫn tuyệt đối đến file cần xóa
 */
const cleanupUploadedFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
    console.log(`[MAT THAN CLEANUP] 🗑️  Đã xóa file tạm: ${filePath}`);
  } catch (unlinkErr) {
    // Không crash server nếu file đã tự xóa hoặc không tồn tại
    if (unlinkErr.code !== 'ENOENT') {
      console.warn(`[MAT THAN CLEANUP] Không thể xóa file tạm "${filePath}": ${unlinkErr.message}`);
    }
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  analyzeProductImage — POST /api/image-analyzer/analyze
// ═════════════════════════════════════════════════════════════════════════════
const analyzeProductImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file ảnh sản phẩm (productImage).' });
  }

  const userId = req.user ? req.user.id : null;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
  }

  // Đảm bảo cột banned_until tồn tại trong DB (chạy alter table phòng thủ)
  try {
    await User.sequelize.query('ALTER TABLE users ADD COLUMN banned_until DATETIME NULL');
  } catch (err) {
    // Cột đã tồn tại hoặc bỏ qua lỗi
  }

  const user = await User.findByPk(userId);

  if (user && user.banned_until && new Date() < new Date(user.banned_until)) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản của bạn đang trong thời gian bị hạn chế do gửi ảnh vi phạm.',
        banned_until: user.banned_until ? new Date(user.banned_until).toISOString() : null,
        mutedUntil: user.banned_until ? new Date(user.banned_until).toISOString() : null
      });
  }

  if (!user || user.credits < 20) {
    return res.status(400).json({
      success: false,
      message: 'Tài khoản của bạn không đủ credit (Cần tối thiểu 20 credits) để kích hoạt Mắt Thần AI. Vui lòng nạp thêm!',
    });
  }

  const originalName      = req.file.originalname;
  const fileSize          = req.file.size;
  const mimeType          = req.file.mimetype;
  const imageRelativePath = `/uploads/images/${req.file.filename}`;
  let   analysisRecord    = null;

  // Lưu đường dẫn file tạm ngay từ đầu để finally block có thể dọn dẹp
  const imageFilePath = req.file.path;

  try {
    // ── BƯỚC 1: Tạo bản ghi ban đầu trong DB (Phòng thủ crash) ────────────────
    try {
      analysisRecord = await ImageAnalysis.create({
        user_id:    userId,
        image_name: originalName,
        image_path: imageRelativePath,
        mime_type:  mimeType,
        file_size:  fileSize,
        status:     'processing',
      });
    } catch (dbError) {
      console.error('[MAT THAN DB ERROR] Không thể tạo bản ghi ImageAnalysis:', dbError.message);
      // Tạo bản ghi giả lập có phương thức update để các bước sau không bị crash
      analysisRecord = {
        id: Date.now(),
        user_id:    userId,
        image_name: originalName,
        image_path: imageRelativePath,
        mime_type:  mimeType,
        file_size:  fileSize,
        status:     'processing',
        update: async function(fields) {
          console.warn('[MAT THAN DB WARNING] Thực hiện update giả lập do DB lỗi:', fields);
          Object.assign(this, fields);
          return this;
        }
      };
    }

    // ── BƯỚC 2: Đọc file ảnh vật lý → Buffer ──────────────────────────────────
    if (!fs.existsSync(imageFilePath)) {
      throw new Error('Không tìm thấy file ảnh vật lý trên máy chủ.');
    }
    const imageBuffer = fs.readFileSync(imageFilePath);

    // ── BƯỚC 3: Đọc API Keys từ DB — 2 tầng AI tuần tự ─────────────────────
    //   • gemini_api_key      → Tầng 1: Gemini 2.0 Flash Vision (ưu tiên cao nhất)
    //   • openrouter_api_key  → Tầng 2: OpenRouter Vision (fallback, Base64 inline)
    const [geminiKey, openrouterKey] = await Promise.all([
      getConfigValue('gemini_api_key',     null),
      getConfigValue('openrouter_api_key', null),
    ]);

    console.log(`[MAT THAN AI] 🔑 geminiKey     (DB): ${geminiKey     ? geminiKey.substring(0, 12)     + '...' : 'KHÔNG CÓ'}`);
    console.log(`[MAT THAN AI] 🔑 openrouterKey (DB): ${openrouterKey ? openrouterKey.substring(0, 12) + '...' : 'KHÔNG CÓ'}`);
    console.log(`[MAT THAN AI] 📡 Tầng 1: Gemini Native | Tầng 2: OpenRouter Vision (google/gemini-3.1-flash-lite)`);
    console.log(`[MAT THAN AI] 📝 SUPER_PROMPT: ${SUPER_PROMPT.length} ký tự`);

    // ── BƯỚC 4: GỌI AI — Điều phối tự động 2 tầng ────────────────────────────
    //  Gemini → nếu 429/quota → OpenRouter → nếu lỗi → throw
    //  Nếu cả 2 đều thất bại → throw lên catch toàn cục → status=failed.
    let aiResult;
    try {
      aiResult = await runAIAnalysis(geminiKey, openrouterKey, imageBuffer, mimeType, analysisRecord.id);
    } catch (aiErr) {
      // ╔══════════════════════════════════════════════════════════════════════╗
      // ║  CẢ 2 TẦNG AI ĐỀU THẤT BẠI → status=failed, HTTP 500              ║
      // ║  KHÔNG đưa lỗi kỹ thuật vào hàng đợi pending của Admin             ║
      // ╚══════════════════════════════════════════════════════════════════════╝
      console.error(`[MAT THAN AI] 💀 Cả Gemini và OpenRouter đều thất bại hoàn toàn cho ảnh #${analysisRecord.id}.`);
      console.error(`[MAT THAN AI] Chi tiết lỗi: ${aiErr.message}`);

      await analysisRecord.update({
        status:        'failed',
        error_message: `[AI TOTAL FAILURE] Cả 2 tầng AI (Gemini + OpenRouter) đều thất bại. Không có kết quả.\n${aiErr.message}`,
      }).catch(() => {});

      const io = req.io;
      if (io) {
        // Báo lỗi real-time về đúng room user
        const userRoom = `user_room_${userId}`;
        io.to(userRoom).emit('image_analysis_result', {
          itemId: analysisRecord.id,
          status: 'failed',
          resultData: {
            id:            analysisRecord.id,
            prompt_output: null,
            input_tokens:  null,
            output_tokens: null,
            status:        'failed',
            error_message: 'Hệ thống AI tạm thời không khả dụng. Vui lòng thử lại sau.',
          },
          message: 'Phan tich anh that bai. Vui long thu lai sau.',
        });
        console.log(`[SOCKET.IO] Emitted 'image_analysis_result' (ai-total-failed) -> ${userRoom}`);
      }

      return res.status(500).json({
        success: false,
        message: 'Hệ thống AI tạm thời không khả dụng. Vui lòng thử lại sau vài phút.',
        error:   aiErr.message,
      });
    }

    // ── BƯỚC 5: Giải nén kết quả AI ───────────────────────────────────────────
    const { promptText, inputTokens, outputTokens, provider } = aiResult;

    // ── BƯỚC 5.5: KIỂM TRA TỪ CHỐI DỊCH VỤ BẢO MẬT (AI REFUSAL GATE) ──────────
    // Đặt điều kiện bẫy nhận diện AI từ chối dịch vụ bảo mật
    const isAiRefusal = promptText.includes('unable to fulfill') || 
                        promptText.includes('safety guidelines') || 
                        promptText.includes('prohibit') || 
                        promptText.includes('violates') ||
                        promptText.includes('CRITICAL_ERROR_SAFETY_VIOLATION');

    if (isAiRefusal) {
      console.warn(`[MAT THAN SECURITY] 🚨 AI từ chối phân tích (vi phạm chính sách an toàn/NSFW) từ ${provider}.`);

      // Kích hoạt luồng hoàn trả 20 Credits cho người dùng ngay tại đây
      // (Nếu lỡ trừ trước khi gọi API, ta cộng trả lại ngay lập tức để đồng bộ lại state hiển thị cho người dùng)
      // user.credits = user.credits + 20;
      // await user.save();

      // Phạt khóa tính năng Mắt Thần của user này trong 15 phút để bảo vệ ví tiền của Admin
      const BAN_DURATION = 15 * 60 * 1000; 
      const bannedUntilDate = new Date(Date.now() + BAN_DURATION);

      // Cập nhật xuống Database (cột chuẩn banned_until)
      try {
        if (user) {
          user.banned_until = bannedUntilDate;
          await user.save();
        }
      } catch (userSaveErr) {
        console.error("[CRITICAL DB ERROR] Không thể lưu thông tin khóa User:", userSaveErr.message);
      }

      // Xác định trạng thái lưu dựa trên bộ lọc admin (đã xác định là 'pending')
      const moderationStatus = 'pending'; 
      let record = analysisRecord;

      // Lưu bản ghi vi phạm (Trạng thái status phải khớp với điều kiện lọc để hiển thị lên trang Admin)
      try {
        if (record && typeof record.update === 'function') {
          // Cập nhật bản ghi có sẵn từ Bước 1
          await record.update({
            user_id:       userId,
            image_name:    originalName,
            image_path:    imageRelativePath,
            mime_type:     mimeType,
            file_size:     fileSize,
            status:        moderationStatus,
            prompt_output: 'CRITICAL_ERROR_SAFETY_VIOLATION',
            error_message: '[MẮT THẦN SECURITY] Hình ảnh vi phạm bộ lọc an toàn của AI (CRITICAL_ERROR_SAFETY_VIOLATION).'
          });
        } else {
          // Tạo mới nếu chưa có bản ghi (ví dụ: Bước 1 bị lỗi DB)
          record = await ImageAnalysis.create({
            user_id:       userId,
            image_name:    originalName,
            image_path:    imageRelativePath,
            mime_type:     mimeType,
            file_size:     fileSize,
            status:        moderationStatus,
            prompt_output: 'CRITICAL_ERROR_SAFETY_VIOLATION',
            error_message: '[MẮT THẦN SECURITY] Hình ảnh vi phạm bộ lọc an toàn của AI (CRITICAL_ERROR_SAFETY_VIOLATION).'
          });
        }
        console.log("[DATABASE SUCCESS]: Ghi nhận ca vi phạm thành công, ID:", record.id);
      } catch (dbError) {
        console.error("[CRITICAL DB ERROR]: Luồng lưu vi phạm/bắn socket bị lỗi!", dbError);
        // Tạo một object giả lập chứa ID ngẫu nhiên để các luồng Socket và luồng trả về Client phía dưới KHÔNG BỊ CHẾT ĐỨNG
        if (!record) {
          record = { id: Date.now() };
        }
        record.status = moderationStatus;
      }

      // KIỂM KÍCH HOẠT LOA PHÁT REAL-TIME ĐỂ TỰ ĐỘNG BẮN LÊN TRANG ADMIN
      if (global.io) {
        global.io.emit('NEW_MODERATION_ITEM', { id: record.id, status: moderationStatus });
        global.io.emit('NEW_MODERATION_JOB', { id: record.id, status: moderationStatus });
      }

      // Bắn socket về admin_room để Admin thấy real-time
      const io = req.io || global.io;
      if (io) {
        const pendingRecord = await ImageAnalysis.findByPk(record.id, {
          include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
        }).catch(() => null);
        if (pendingRecord) {
          io.to('admin_room').emit('image_analysis:updated', pendingRecord.toJSON());
          io.to('admin_room').emit('UPDATE_MAT_THAN_JOB', { id: pendingRecord.id, status: pendingRecord.status });
        } else {
          // Fallback if DB query fails: emit using analysisRecord local object
          io.to('admin_room').emit('UPDATE_MAT_THAN_JOB', { id: record.id, status: moderationStatus });
        }
      }

      if (io) {
        const notiTitle   = 'Phát hiện ảnh vi phạm 🚨';
        const notiMessage = 'Hệ thống Mắt Thần vừa chặn một hình ảnh hở hang/NSFW vi phạm chính sách từ người dùng!';
        const redirectUrl = '/admin/moderation';

        // Lưu thông báo vĩnh viễn vào bảng admin_notifications
        let savedNoti = null;
        try {
          savedNoti = await AdminNotification.create({
            title:   notiTitle,
            content: notiMessage,
            type:    'moderation',
            is_read: false,
          });
        } catch (notiErr) {
          console.warn('[REAL-TIME] Không thể lưu AdminNotification vào DB:', notiErr.message);
        }

        // Nhánh A: Đẩy thông báo chuông lên Header Admin
        io.to('admin_room').emit('NEW_ADMIN_NOTIFICATION', {
          id:          savedNoti?.id || `MOD-${Date.now()}`,
          title:       notiTitle,
          message:     notiMessage,
          type:        'moderation',
          redirectUrl: redirectUrl,
          isRead:      false,
          createdAt:   new Date()
        });

        // Reload record với quan hệ owner để Grid có đầy đủ thông tin
        const fullRecord = await ImageAnalysis.findByPk(record.id, {
          include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email', 'avatar'] }],
        }).catch(() => null);

        // Nhánh B: Đẩy object ảnh thô thẳng xuống Grid kiểm duyệt
        io.to('admin_room').emit('NEW_MODERATION_ITEM', {
          id:           record.id,
          image_name:   record.image_name || originalName,
          image_path:   record.image_path || imageRelativePath,
          mime_type:    record.mime_type || mimeType,
          file_size:    record.file_size || fileSize,
          status:       moderationStatus,
          error_message: '[MẮT THẦN SECURITY] Hình ảnh vi phạm bộ lọc an toàn của AI (CRITICAL_ERROR_SAFETY_VIOLATION).',
          created_at:   record.createdAt || new Date(),
          user: fullRecord?.owner ? {
            id:     fullRecord.owner.id,
            name:   fullRecord.owner.name,
            email:  fullRecord.owner.email,
            avatar: fullRecord.owner.avatar,
          } : null,
        });

        console.log(`[REAL-TIME PIPELINE] ✅ Phát sóng đôi NEW_ADMIN_NOTIFICATION + NEW_MODERATION_ITEM cho Log #${record.id}`);
      }

      // Trả về trạng thái lỗi 400 Bad Request kèm thông báo cho Frontend hiển thị
      return res.status(400).json({
        success: false,
        code: 'CRITICAL_ERROR_SAFETY_VIOLATION',
        message: 'Phân tích thất bại! Hình ảnh bạn tải lên đã vi phạm Tiêu chuẩn cộng đồng của hệ thống. Vì lý do bảo mật, tính năng Mắt Thần AI của bạn sẽ tạm thời bị đóng băng trong vòng 15 phút. Cảm ơn bạn đã sử dụng dịch vụ!',
        mutedUntil: bannedUntilDate ? new Date(bannedUntilDate).toISOString() : null,
        banned_until: bannedUntilDate ? new Date(bannedUntilDate).toISOString() : null
      });
    }

    // ── BƯỚC 6: KIỂM TRA CỜ AN TOÀN — Mắt Thần Security Gate ─────────────────
    //  Nếu model AI gắn cờ nội dung nhạy cảm/phản động/hở hang trong output,
    //  hoàn bộ chuỗi kết quả sẽ chứa mã hiệu: '⚠️ VI_PHAM_NHA_CAM ⚠️'
    //  Hoặc chứa các từ khóa nhạy cảm / từ chối của AI: 'không chứa trang phục', 'khỏa thân', 'không thể thực hiện phân tích', 'vi phạm chính sách'
    const unsafeKeywords = [
      'không chứa trang phục',
      'khỏa thân',
      'không thể thực hiện phân tích',
      'vi phạm chính sách'
    ];
    const hasUnsafeKeyword = unsafeKeywords.some(keyword => 
      promptText.toLowerCase().includes(keyword.toLowerCase())
    );

    const isUnsafe = promptText.includes('⚠️ VI_PHAM_NHA_CAM ⚠️') || hasUnsafeKeyword;
    console.log(`[MAT THAN SECURITY] 🔍 Kiểm tra cờ an toàn ảnh #${analysisRecord.id}: isUnsafe=${isUnsafe} (phát hiện từ khóa vi phạm: ${hasUnsafeKeyword})`);

    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║  TRƯỜNG HỢP 1: ẢNH NGHI VẤN NHẠY CẢM → Đẩy vào hàng đợi Admin       ║
    // ╚══════════════════════════════════════════════════════════════════════════╝
    if (isUnsafe) {
      console.log(`[MAT THAN SECURITY] 🚨 Ảnh #${analysisRecord.id} bị gắn cờ VI PHẠM bởi ${provider} — status=pending, credit KHÔNG bị trừ.`);

      try {
        await analysisRecord.update({
          status:        'pending',
          user_id:       userId,
          image_name:    originalName,
          image_path:    imageRelativePath,
          mime_type:     mimeType,
          file_size:     fileSize,
          prompt_output: promptText,      // Lưu toàn bộ nội dung cảnh báo của AI
          input_tokens:  inputTokens,
          output_tokens: outputTokens,
          error_message: '[MẮT THẦN SECURITY] Ảnh chứa nội dung nghi vấn nhạy cảm (khiêu dâm/hở hang/phản động). Chờ Admin duyệt tay.',
        });
        console.log("[DATABASE SUCCESS]: Đã lưu bản ghi kiểm duyệt thành công! ID:", analysisRecord.id);
      } catch (dbUpdateErr) {
        console.error("[CRITICAL DATABASE ERROR]: Không thể lưu bản ghi kiểm duyệt vào DB!", dbUpdateErr);
        // Cập nhật thuộc tính cục bộ để tránh đứt đoạn mạch dữ liệu
        analysisRecord.status = 'pending';
      }

      if (global.io) {
        global.io.emit('NEW_MODERATION_ITEM', { id: analysisRecord.id, status: 'pending' });
        global.io.emit('NEW_MODERATION_JOB', { id: analysisRecord.id, status: 'pending' });
      }

      // Bắn socket về admin_room để Admin thấy real-time
      const io = req.io;
      if (io) {
        const pendingRecord = await ImageAnalysis.findByPk(analysisRecord.id, {
          include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email', 'avatar'] }],
        }).catch(() => null);
        if (pendingRecord) {
          io.to('admin_room').emit('image_analysis:updated', pendingRecord.toJSON());
          io.to('admin_room').emit('UPDATE_MAT_THAN_JOB', { id: pendingRecord.id, status: pendingRecord.status });
          console.log(`[SOCKET.IO] Emitted 'image_analysis:updated' (unsafe-pending) -> admin_room | analysisId: ${analysisRecord.id}`);
        } else {
          // Fallback if DB query fails: emit using analysisRecord local object
          io.to('admin_room').emit('UPDATE_MAT_THAN_JOB', { id: analysisRecord.id, status: 'pending' });
        }

        // ── PHÁT SÓNG ĐÔI real-time: chuông Admin + Grid kiểm duyệt ─────────
        const notiTitle   = 'Phát hiện ảnh nghi vấn 🚨';
        const notiMessage = 'Hệ thống Mắt Thần vừa phát hiện hình ảnh nghi vấn nhạy cảm (khiêu dâm/hở hang/phản động). Cần Admin duyệt tay!';
        const redirectUrl = '/admin/moderation';

        // Lưu thông báo vào DB admin_notifications
        let savedNoti = null;
        try {
          savedNoti = await AdminNotification.create({
            title:   notiTitle,
            content: notiMessage,
            type:    'moderation',
            is_read: false,
          });
        } catch (notiErr) {
          console.warn('[REAL-TIME] Không thể lưu AdminNotification vào DB (isUnsafe):', notiErr.message);
        }

        // Nhánh A: Đẩy thông báo lên Quả chuông Header
        io.to('admin_room').emit('NEW_ADMIN_NOTIFICATION', {
          id:          savedNoti?.id || `MOD-${Date.now()}`,
          title:       notiTitle,
          message:     notiMessage,
          type:        'moderation',
          redirectUrl: redirectUrl,
          isRead:      false,
          createdAt:   new Date()
        });

        // Nhánh B: Đẩy object ảnh thô thẳng vào Grid kiểm duyệt
        io.to('admin_room').emit('NEW_MODERATION_ITEM', {
          id:            analysisRecord.id,
          image_name:    analysisRecord.image_name,
          image_path:    analysisRecord.image_path,
          mime_type:     analysisRecord.mime_type,
          file_size:     analysisRecord.file_size,
          status:        'pending',
          error_message: '[MẮT THẦN SECURITY] Ảnh chứa nội dung nghi vấn nhạy cảm. Chờ Admin duyệt tay.',
          created_at:    analysisRecord.createdAt || new Date(),
          user: pendingRecord?.owner ? {
            id:     pendingRecord.owner.id,
            name:   pendingRecord.owner.name,
            email:  pendingRecord.owner.email,
            avatar: pendingRecord.owner.avatar,
          } : null,
        });

        console.log(`[REAL-TIME PIPELINE] ✅ Phát sóng đôi NEW_ADMIN_NOTIFICATION + NEW_MODERATION_ITEM (isUnsafe) cho Log #${analysisRecord.id}`);
      }

      return res.status(200).json({
        success: true,
        message: 'Hình ảnh của bạn đang được đưa vào hàng đợi kiểm duyệt thủ công do nghi vấn chứa nội dung không phù hợp với tiêu chuẩn cộng đồng.',
        data: { id: analysisRecord.id, status: 'pending' },
      });
    }

    // ╔══════════════════════════════════════════════════════════════════════════╗
    // ║  TRƯỜNG HỢP 2: ẢNH SẠCH AN TOÀN → Trừ credit + Lưu success            ║
    // ╚══════════════════════════════════════════════════════════════════════════╝
    console.log(`[MAT THAN SECURITY] ✅ Ảnh #${analysisRecord.id} AN TOÀN (phân tích bởi ${provider}) — tiến hành trừ 20 credits.`);

    // ── BƯỚC 7: Trừ credits và cập nhật DB success ────────────────────────────
    await user.decrement('credits', { by: 20 });

    await analysisRecord.update({
      status:        'success',
      prompt_output: promptText,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
    });

    const updatedRecord = await ImageAnalysis.findByPk(analysisRecord.id, {
      include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
    }).catch(() => null);

    // ── BƯỚC 8: Emit Socket.io — Admin panel + đúng room User ──────────────────
    const io = req.io;
    if (io) {
      // Broadcast cho Admin panel theo dõi tổng quan
      if (updatedRecord) {
        io.to('admin_room').emit('image_analysis:updated', updatedRecord.toJSON());
        io.to('admin_room').emit('UPDATE_MAT_THAN_JOB', { id: updatedRecord.id, status: updatedRecord.status });
      }

      // Targeted event về đúng room User → Frontend tự cập nhật real-time
      const userRoom = `user_room_${userId}`;
      const socketPayload = {
        itemId: analysisRecord.id,
        status: 'success',
        resultData: {
          id:            analysisRecord.id,
          prompt_output: promptText,
          input_tokens:  inputTokens,
          output_tokens: outputTokens,
          status:        'success',
          error_message: null,
        },
        message: 'Ket qua phan tich Mat Than (OpenRouter Vision) da san sang!',
      };
      io.to(userRoom).emit('image_analysis_result', socketPayload);
      console.log(`[SOCKET.IO] Emitted 'image_analysis_result' (success) -> ${userRoom} | analysisId: ${analysisRecord.id}`);
    }

    // ── BƯỚC 9: Ghi thông báo hoàn tất cho User ───────────────────────────────
    try {
      const { Notification } = require('../models');
      const notificationEmitter   = require('../utils/notificationEmitter');
      const mtSuccessNotif = await Notification.create({
        userId:  userId,
        title:   'Mắt thần AI hoàn tất ✓',
        message: `Tác vụ phân tích hình ảnh bằng Mắt thần AI của bạn đã hoàn thành (bởi ${provider}).`,
        type:    'info',
        is_read: false,
      });
      notificationEmitter.emit('send_notification', mtSuccessNotif);
      console.log(`[MAT THAN SUCCESS] Đã ghi DB và phát thông báo hoàn tất cho user #${userId}.`);
    } catch (notifErr) {
      console.error('[MAT THAN SUCCESS] Notification insert error:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Phân tích hình ảnh sản phẩm thành công! (Đã trừ 20 credits — phân tích bởi ${provider})`,
      data: {
        id:              analysisRecord.id,
        prompt_output:   promptText,
        input_tokens:    inputTokens,
        output_tokens:   outputTokens,
        current_credits: user.credits - 20,
        ai_provider:     provider,
      },
    });

  } catch (error) {
    // ── Catch toàn cục: lỗi hệ thống nằm ngoài mọi fallback flow ─────────────
    console.error('[MAT THAN AI ERROR] Lỗi hệ thống nằm ngoài mọi fallback flow:', error.message);

    if (analysisRecord) {
      await analysisRecord.update({
        status:        'failed',
        error_message: error.message,
      }).catch(() => {});

      const failedRecord = await ImageAnalysis.findByPk(analysisRecord.id, {
        include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }],
      }).catch(() => null);

      const io = req.io;
      if (io) {
        if (failedRecord) {
          io.to('admin_room').emit('image_analysis:updated', failedRecord.toJSON());
          io.to('admin_room').emit('UPDATE_MAT_THAN_JOB', { id: failedRecord.id, status: failedRecord.status });
        }

        if (userId) {
          const userRoom = `user_room_${userId}`;
          io.to(userRoom).emit('image_analysis_result', {
            itemId: analysisRecord.id,
            status: 'failed',
            resultData: {
              id:            analysisRecord.id,
              prompt_output: null,
              input_tokens:  null,
              output_tokens: null,
              status:        'failed',
              error_message: error.message,
            },
            message: 'Phan tich anh that bai. Vui long thu lai sau.',
          });
          console.log(`[SOCKET.IO] Emitted 'image_analysis_result' (system-error) -> user_room_${userId}`);
        }
      }

      if (req.app && req.app.emitAdminNotification) {
        const errorUser = await User.findByPk(userId, { attributes: ['id', 'name', 'email'] }).catch(() => null);
        req.app.emitAdminNotification({
          title:   'Loi Mat Than AI x',
          content: `Phan tich anh "${originalName}" cua "${errorUser?.name || 'User #' + userId}" that bai: ${error.message}`,
          type:    'error',
        });
      }
    }

    return res.status(500).json({ success: false, message: 'Có lỗi xảy ra khi phân tích ảnh.', error: error.message });

  } finally {
    // ── BƯỚC CUỐI: GIỮ LẠI FILE ẢNH VẬT LÝ PHỤC VỤ TRUY XUẤT TĨNH ────────────
    // KHÔNG gọi cleanupUploadedFile tại đây — file phải tồn tại trong
    // uploads/images/ để Express static có thể serve cho Frontend sau này.
    // Việc xóa file vật lý khi DB đã lưu image_path trỏ vào file đó
    // chính là nguyên nhân gốc rễ gây lỗi 404 trên tab Network.
    console.log(`[MAT THAN] Đã giữ lại file ảnh vật lý phục vụ truy xuất tĩnh: ${imageFilePath}`);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  getAnalysisDetail — GET /api/image-analyzer/:id
// ═════════════════════════════════════════════════════════════════════════════
const getAnalysisDetail = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
    }
    const { id } = req.params;
    const record = await ImageAnalysis.findOne({ where: { id, user_id: userId } });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi phân tích ảnh.' });
    }
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('[GET ANALYSIS DETAIL ERROR]:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};


/**
 * DELETE /api/image-analyzer/:id
 * Xóa bản ghi phân tích ảnh (ImageAnalysis) của người dùng
 */
const deleteAnalysis = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
    }
    const { id } = req.params;
    const record = await ImageAnalysis.findOne({ where: { id, user_id: userId } });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi phân tích ảnh.' });
    }
    await record.destroy();
    return res.status(200).json({ success: true, message: 'Đã xóa bản ghi phân tích ảnh thành công.' });
  } catch (error) {
    console.error('[DELETE ANALYSIS ERROR]:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xóa bản ghi.', error: error.message });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  getMatThanLogs — GET /api/image-analyzer/mat-than-logs
//  Trả về tối đa 16 bản phân tích ảnh thành công gần nhất của user
//  để hiển thị trong EyeSelectionModal ở Video AI Studio.
//  Chỉ trả về các bản có status = 'success' và prompt_output != null
// ═════════════════════════════════════════════════════════════════════════════
const { Op } = require('sequelize');

const getMatThanLogs = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
    }

    const logs = await ImageAnalysis.findAll({
      where: {
        user_id: userId,
        status: 'success',
        prompt_output: {
          [Op.not]: null,
        },
      },
      order: [['created_at', 'DESC']],
      limit: 16,
      attributes: ['id', 'image_name', 'image_path', 'prompt_output', 'created_at', 'updated_at'],
    });

    return res.status(200).json({ success: true, logs });
  } catch (error) {
    console.error('[GET MAT THAN LOGS ERROR]:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi tải lịch sử Mắt Thần AI.', error: error.message });
  }
};

module.exports = { analyzeProductImage, getAnalysisDetail, deleteAnalysis, getMatThanLogs };
