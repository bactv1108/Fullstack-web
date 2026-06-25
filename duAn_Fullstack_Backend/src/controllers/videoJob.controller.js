/**
 * videoJob.controller.js
 * =============================================================================
 * Controller xu ly toan bo nghiep vu "Tao Video AI Animation" tich hop Fal.ai.
 *
 * Endpoints phuc vu:
 *  POST /api/video-jobs/generate     -> Xep hang tac vu Fal.ai  [authMiddleware]
 *  POST /api/video-jobs/webhook      -> Nhan callback tu Fal.ai  [public]
 *  GET  /api/video-jobs/recent       -> Lay 4 video gan nhat     [authMiddleware]
 *  POST /api/video-jobs/extend       -> Mo rong video 12 giay    [authMiddleware]
 *  POST /api/video-jobs/upload-image -> Upload anh dau vao       [authMiddleware]
 *
 * Co che phong thu:
 *  [1] Cloudinary upload - Tat ca anh dau vao duoc upload len Cloudinary CDN,
 *      tra ve URL https tuyet doi, loai bo hoan toan bug 422.
 *  [2] resolvePublicImageUrl() - Van con de phong cho truong hop URL localhost
 *      tu ben ngoai (API test, Postman), chuyen sang Ngrok neu can.
 *      Neu URL da chua "cloudinary.com" -> GIU NGUYEN, bo qua hoan doi.
 *  [3] try/catch nguyen tu trong _dispatchFalJob() - Bat moi loi tu Fal.ai,
 *      cap nhat DB status=failed + emit socket video_failed dong bo.
 * =============================================================================
 */

'use strict';

const fs          = require('fs');
const path        = require('path');
const axios       = require('axios');
const cloudinary  = require('cloudinary').v2;
const { Op }      = require('sequelize');
const { VideoJob, User, SystemConfig, Transaction, Notification } = require('../models');
const videoService = require('../services/video.service');

// Cau hinh Cloudinary (de phong fallback upload truc tiep tu controller)
cloudinary.config({
  cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
  api_key    : process.env.CLOUDINARY_API_KEY,
  api_secret : process.env.CLOUDINARY_API_SECRET,
});

// URL model Fal.ai - Kling Premium Card Xanh Dương
const FAL_MODEL_URL =
  process.env.FAL_MODEL_URL ||
  'https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/standard/image-to-video';

const MODEL_BASE_PATHS = {
  'wan_turbo': 'fal-ai/wan',
  'kling_v2_5_standard': 'fal-ai/kling-video'
};

const CREDITS_EXTEND = 50;
const WAN_COST       = 50;
const KLING_V2_COST  = 500;


// Doc gia tri tu bang system_configs, ap dung .trim(), fallback ve envFallback.
const getConfigValue = async (key, envFallback = null) => {
  try {
    const row = await SystemConfig.findByPk(key);
    if (row && row.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch (err) {
    console.warn(`[VIDEO CTRL] Khong the doc key="${key}" tu DB:`, err.message);
  }
  return envFallback;
};

// Doc Fal.ai API Key (uu tien DB, fallback ENV)
const getFalApiKey = async () => {
  return getConfigValue('fal_api_key', process.env.FAL_API_KEY || '');
};

// Doc Webhook URL tai runtime (doc tai thoi diem goi de luon co gia tri moi nhat)
const getWebhookUrl = () =>
  process.env.DYNAMIC_WEBHOOK_URL ||
  process.env.FAL_WEBHOOK_URL     ||
  null;

// Phat su kien Socket.io toi phong rieng cua user
const emitToUser = (req, userId, event, payload) => {
  try {
    const io = req.app?.io || req.io;
    if (io) {
      io.to(`user_room_${userId}`).emit(event, payload);
    }
  } catch (err) {
    console.warn(`[VIDEO CTRL] Khong the emit socket: ${err.message}`);
  }
};

// Phat log tien trinh trung gian toi client qua socket
const emitStatusUpdate = (req, userId, jobId, message) => {
  emitToUser(req, userId, 'video_status_update', { jobId, message });
};

/**
 * resolvePublicImageUrl(inputImageUrl, webhookUrl)
 * =============================================================================
 * CO CHE PHONG THU 2: Dam bao URL anh luon la public URL de Fal.ai co the tai.
 *
 * Tien trinh xu ly:
 *   1. Neu URL la Cloudinary -> GIU NGUYEN (khong can chuyen doi).
 *   2. Neu URL da la public (khong phai localhost) -> GIU NGUYEN.
 *   3. Neu URL la localhost -> chuyen sang Ngrok public URL.
 *
 * @param {string|null} inputImageUrl  - URL anh dau vao
 * @param {string|null} webhookUrl     - Webhook URL (Ngrok) de trich xuat domain
 * @returns {string|null}              - URL anh public san sang gui len Fal.ai
 * =============================================================================
 */
const resolvePublicImageUrl = (inputImageUrl, webhookUrl) => {
  if (!inputImageUrl) {
    return null;
  }

  // Layer 1: URL tu Cloudinary -> giu nguyen, khong can xu ly
  if (inputImageUrl.includes('cloudinary.com')) {
    console.log('[IMAGE URL] URL tu Cloudinary CDN, giu nguyen:', inputImageUrl.substring(0, 80));
    return inputImageUrl;
  }

  // Layer 2: URL da la public -> giu nguyen
  const isLocalhost = (
    inputImageUrl.includes('localhost:3000') ||
    inputImageUrl.includes('127.0.0.1:3000')
  );

  if (!isLocalhost) {
    console.log('[IMAGE URL] URL anh da la public, khong can chuyen doi:', inputImageUrl.substring(0, 80));
    return inputImageUrl;
  }

  // Layer 3: URL localhost -> chuyen sang Ngrok
  if (!webhookUrl) {
    console.warn('[IMAGE URL] CANH BAO: URL anh la localhost nhung khong co Ngrok URL de chuyen doi.');
    console.warn('[IMAGE URL] CANH BAO: Fal.ai CO THE tra ve loi 422. Hay bat ENABLE_TUNNEL=true trong .env.');
    return inputImageUrl;
  }

  let ngrokOrigin;
  try {
    ngrokOrigin = new URL(webhookUrl).origin;
  } catch (parseErr) {
    console.error('[IMAGE URL] Khong the parse webhookUrl de trich xuat domain Ngrok:', parseErr.message);
    return inputImageUrl;
  }

  const publicImageUrl = inputImageUrl
    .replace(/^http:\/\/localhost:3000/, ngrokOrigin)
    .replace(/^http:\/\/127\.0\.0\.1:3000/, ngrokOrigin);

  console.log('[IMAGE URL] Chuyen doi URL anh tu localhost sang Ngrok public URL:');
  console.log('[IMAGE URL]    Goc (localhost) :', inputImageUrl);
  console.log('[IMAGE URL]    Sau chuyen doi  :', publicImageUrl);

  return publicImageUrl;
};

// =============================================================================
// [1] POST /api/video-jobs/generate
//     Tao ban ghi VideoJob -> goi Fal.ai Queue -> tra 201 ngay lap tuc.
// =============================================================================

const generateVideo = async (req, res) => {
  const userId = req.user.id;

  try {
    const {
      prompt,
      inputImageUrl,
      imageUrl,       // Truong phu - frontend co the gui kem
      aspectRatio = '16:9',
      analysisId  = null,
      model_name  = 'hunyuan_video',
      duration    = 5,
    } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Prompt mo ta noi dung video khong duoc de trong.',
      });
    }

    const validRatios = ['9:16', '16:9', '4:3'];
    if (!validRatios.includes(aspectRatio)) {
      return res.status(400).json({
        success: false,
        message: `Ti le khung hinh khong hop le. Chi chap nhan: ${validRatios.join(', ')}.`,
      });
    }

    const validModels = ['wan_turbo', 'kling_v2_5_standard'];
    if (!validModels.includes(model_name)) {
      return res.status(400).json({
        success: false,
        message: `Mo hinh khong hop le. Chi chap nhan: ${validModels.join(', ')}.`,
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Khong tim thay tai khoan.' });
    }

    const userCredits = user.credits || 0;
    const userPackage = user.current_package || 'free';

    // =========================================================================
    // BAO MAT 2 LOP: TINH COST DONG BACKEND — CHONG GIAN LAN PAYLOAD TU F12
    // Client khong the tu chinh gia bang cach sua request tren DevTools
    // =========================================================================
    let requiredCost = WAN_COST; // Mac dinh: Wan v2.2 Turbo = 50

    if (model_name === 'kling_v2_5_standard') {
      // Kling v2.5 Standard: 10 giay = 1000 Credits, 5 giay = 500 Credits
      requiredCost = Number(duration) === 10 ? 1000 : 500;
    }
    // wan_turbo giu nguyen WAN_COST = 50

    const isPremiumModel = model_name === 'kling_v2_5_standard';

    // Lop 1: Chan blob URL ngay tu dau — truoc khi tru credit
    if (inputImageUrl && inputImageUrl.startsWith('blob:')) {
      return res.status(400).json({
        success: false,
        message: 'Hinh anh khong hop le (blob URL). Vui long upload anh len Cloudinary truoc khi tao video.',
      });
    }

    // Lop 2: Thieu hut credit toi thieu (kiem tra so du thuc te trong DB)
    if (userCredits < requiredCost) {
      return res.status(400).json({
        success: false,
        message: `Khong du Credit de thuc hien tac vu nay! Can ${requiredCost} Credits, hien tai ban co ${userCredits} Credits.`,
      });
    }

    // Lop 3: Sai phan tang goi cuoc - chi Premium moi duoc dung kling_v1_6 hoac kling_v2_5_standard
    if (isPremiumModel && (!userPackage || userPackage.toLowerCase() !== 'premium')) {
      return res.status(403).json({
        success: false,
        message: 'Tinh nang nay chi danh cho tai khoan Premium.',
      });
    }

    // Tru credits truoc khi tao job (su dung bien requiredCost dong)
    await User.decrement({ credits: requiredCost }, { where: { id: userId } });

    if (global.io) {
      global.io.emit('NEW_TRANSACTION', { type: 'consume', amount: requiredCost, userId: userId });
    }

    const resolvedDuration = isPremiumModel ? (parseInt(duration, 10) || 5) : 5;

    const job = await VideoJob.create({
      userId,
      analysisId   : analysisId || null,
      prompt       : prompt.trim(),
      inputImageUrl: inputImageUrl || null,
      aspectRatio,
      modelName    : model_name,
      duration     : resolvedDuration,
      status       : 'queueing',
    });

    console.log(`[VIDEO CTRL] Job #${job.id} tao thanh cong -> status: queueing | model: ${model_name} | duration: ${resolvedDuration}s | cost: ${requiredCost} Credits`);

    if (global.io) {
      global.io.to(`user_room_${userId}`).emit('video_job_created', {
        success: true,
        job: job
      });
      global.io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: job.status, progress: 0 });
      global.io.to('admin_room').emit('video_job:created', job.toJSON());
    }

    res.status(201).json({
      success: true,
      jobId  : job.id,
      status : 'queueing',
      message: 'Yeu cau tao video da duoc dua vao hang doi.',
    });

    _dispatchFalJob(req, job, userId).catch(async (err) => {
      console.error(`[VIDEO CTRL] Fal.ai dispatch that bai cho job #${job.id}:`, err.message);
    });

  } catch (err) {
    console.error('[VIDEO CTRL] generateVideo error:', err);
    return res.status(500).json({ success: false, message: 'Loi he thong khi tao video.' });
  }
};

/**
 * _uploadLocalImageToCloudinary(inputImageUrl)
 * =============================================================================
 * FALLBACK CUNG: Tu dong phat hien URL localhost, upload file vat ly len
 * Cloudinary ngay tai tran, tra ve URL sach https.
 *
 * Xu ly:
 *   1. Kiem tra URL co chua localhost / 127.0.0.1 khong
 *   2. Trich xuat ten file tu duong dan URL
 *   3. Xay dung duong dan vat ly: ../../uploads/images/<fileName>
 *   4. Upload file len Cloudinary folder 'video_ads_products'
 *   5. Tra ve secure_url tu Cloudinary
 *
 * @param {string|null} inputImageUrl
 * @returns {string|null} URL Cloudinary hoac URL goc neu khong phai localhost
 * =============================================================================
 */
const _uploadLocalImageToCloudinary = async (inputImageUrl) => {
  if (!inputImageUrl) return null;

  const isLocalhost = inputImageUrl.includes('localhost') || inputImageUrl.includes('127.0.0.1');
  if (!isLocalhost) return inputImageUrl;

  // Trich xuat ten file tu URL (vd: "paste-1740000000000-123456789.png")
  const urlParts = inputImageUrl.split('/');
  const fileName = urlParts[urlParts.length - 1];
  if (!fileName) return inputImageUrl;

  // Duong dan vat ly den file tren server
  const localFilePath = path.join(__dirname, '../../uploads/images/', fileName);
  console.log('[FALLBACK CLOUDINARY] Phat hien URL localhost, dang upload file vat ly...');
  console.log('[FALLBACK CLOUDINARY]   URL goc       :', inputImageUrl);
  console.log('[FALLBACK CLOUDINARY]   File name     :', fileName);
  console.log('[FALLBACK CLOUDINARY]   Duong dan     :', localFilePath);

  // Kiem tra file co ton tai tren dia khong
  if (!fs.existsSync(localFilePath)) {
    console.warn('[FALLBACK CLOUDINARY] File khong ton tai tren dia:', localFilePath);
    console.warn('[FALLBACK CLOUDINARY] Giu nguyen URL goc, khong the upload fallback.');
    return inputImageUrl;
  }

  try {
    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      folder: 'video_ads_products',
    });

    const cloudinaryUrl = uploadResult.secure_url || uploadResult.url;
    console.log('[FALLBACK CLOUDINARY] Upload thanh cong!');
    console.log('[FALLBACK CLOUDINARY]   Cloudinary URL:', cloudinaryUrl);

    return cloudinaryUrl;
  } catch (uploadErr) {
    console.error('[FALLBACK CLOUDINARY] Upload that bai:', uploadErr.message);
    console.error('[FALLBACK CLOUDINARY] Giu nguyen URL goc, tiep tuc xu ly.');
    return inputImageUrl;
  }
};

/**
 * _preCheckImageUrl(imageUrl)
 * =============================================================================
 * PRE-CHECK URL ANH: Dung axios HEAD de kiem tra link anh co the truy cap
 * duoc tu internet hay khong truoc khi gui sang Fal.ai.
 *
 * Muc dich: Tranh mat credit oan vi Fal.ai tu choi (422 Unprocessable Entity)
 * hoac tu choi xu ly vi URL khong phai hinh anh hop le.
 *
 * @param {string|null} imageUrl
 * @returns {Promise<boolean>} true -> hop le, false -> khong hop le
 * =============================================================================
 */
const _preCheckImageUrl = async (imageUrl) => {
  if (!imageUrl) return true; // Khong co anh -> text-to-video -> bo qua

  // Chan blob URL (lay phong)
  if (imageUrl.startsWith('blob:')) {
    console.error('[PRE-CHECK URL] Phat hien blob URL:', imageUrl.substring(0, 80));
    return false;
  }

  // Chan localhost / 127.0.0.1 (lay phong — tranh request noi bo mat hang)
  if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
    console.error('[PRE-CHECK URL] Phat hien localhost URL, khong the kiem tra tu internet:', imageUrl.substring(0, 80));
    return false;
  }

  try {
    const response = await axios.head(imageUrl, {
      timeout: 5000, // 5 giay timeout — tranh block lau
      validateStatus: () => true, // Khong nem loi voi status >= 400
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideoAI-Bot/1.0)',
      },
    });

    const status = response.status;
    const contentType = response.headers['content-type'] || '';

    console.log(`[PRE-CHECK URL] HEAD ${imageUrl.substring(0, 80)} -> status=${status}, content-type=${contentType}`);

    // Status phai la 200
    if (status !== 200) {
      console.error(`[PRE-CHECK URL] Status khong phai 200 (=${status}):`, imageUrl.substring(0, 80));
      return false;
    }

    // Content-type phai bat dau bang "image/"
    if (!contentType.startsWith('image/')) {
      console.error(`[PRE-CHECK URL] Content-type khong phai hinh anh (=${contentType}):`, imageUrl.substring(0, 80));
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[PRE-CHECK URL] Khong the HEAD URL: ${err.message}`, imageUrl.substring(0, 80));
    return false;
  }
};

// =============================================================================
// PRIVATE: Gui job len Fal.ai Queue API
//
// Ham nay chua 4 co che phong thu:
//  [CO CHE 1] Fallback upload Cloudinary - Tu dong day file localhost len CDN.
//  [CO CHE 2] _preCheckImageUrl - Kiem tra URL anh bang HEAD request truoc khi
//             gui sang Fal.ai -> chan blob/localhost/403/404/khong phai image.
//  [CO CHE 3] resolvePublicImageUrl - Giu nguyen Cloudinary URL, chuyen doi
//             localhost -> Ngrok neu can.
//  [CO CHE 4] try/catch nguyen tu - Bat loi tu Fal.ai, cap nhat DB status=failed
//             + emit socket video_failed dong bo.
// =============================================================================

/**
 * processJobResult
 * =============================================================================
 * Tự động ghi nhận Lịch sử giao dịch (Transaction), hoàn trả tín dụng (Credits) khi lỗi,
 * và tạo thông báo (Notification) + phát socket thời gian thực.
 * =============================================================================
 */
const processJobResult = async (req, userId, jobId, status, modelName, duration, errorMsg = '') => {
  try {
    const creditsSpent = duration === 12 ? 50 : (modelName === 'kling_v2_5_standard' ? (Number(duration) === 10 ? 1000 : 500) : 50);
    const transactionModelName = modelName === 'wan_turbo' ? 'Tạo Video Wan' : 'Tạo Video Kling';

    if (status === 'success') {
      // 1. Ghi nhận lịch sử giao dịch tiêu tốn tín dụng (Mô hình trừ tiền thực tế)
      const transactionId = 'TRX-VID-' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900);
      await Transaction.create({
        id: transactionId,
        userId: userId,
        package_name: transactionModelName,
        amount: 0,
        credits_added: -Number(creditsSpent), // Ghi dòng tiền âm (-)
        status: 'success',
        type: 'Trừ phí dịch vụ'
      });

      // 2. Tạo thông báo thành công cho User
      await Notification.create({
        userId: userId,
        title: 'Tạo video thành công 🎉',
        message: `Video AI Studio của bạn (Mã Job #${jobId}) đã hoàn tất render thành công. Hãy vào màn hình xem trước!`,
        type: 'info',
        is_read: false
      });

    } else if (status === 'failed') {
      // 3. 🚨 THIÊN LA ĐỊA VÕNG HOÀN TIỀN: Cộng trả lại Credits vào ví cho User do lỗi hệ thống
      await User.increment('credits', { by: Number(creditsSpent), where: { id: userId } });

      // 4. Ghi nhận lịch sử giao dịch HOÀN TIỀN
      const refundTxId = 'TRX-REFUND-' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900);
      await Transaction.create({
        id: refundTxId,
        userId: userId,
        package_name: transactionModelName,
        amount: 0,
        credits_added: Number(creditsSpent), // Ghi dòng tiền dương (+) hoàn trả
        status: 'success',
        type: 'Hoàn tín dụng lỗi'
      });

      // 5. Tạo thông báo thất bại kèm lý do lỗi cho User
      const displayError = errorMsg ? `: ${errorMsg}` : '';
      await Notification.create({
        userId: userId,
        title: 'Tạo video thất bại ⚠️',
        message: `Tác vụ dựng phim AI của bạn gặp sự cố ngoại vi${displayError}. Hệ thống đã tự động hoàn lại ${creditsSpent} Credits vào tài khoản của bạn.`,
        type: 'error',
        is_read: false
      });
    }

    // 6. 📡 PHÁT SÓNG REAL-TIME VỀ TRÌNH DUYỆT CỦA ĐÚNG USER ĐÓ
    const io = req.app?.io || req.io || global.io;
    if (io) {
      const updatedUser = await User.findByPk(userId);
      
      io.to(`user_room_${userId}`).emit('USER_PIPELINE_UPDATE', {
        credits: updatedUser ? updatedUser.credits : null, // Số dư mới tinh để Frontend nảy số
        notification: {
          title: status === 'success' ? 'Tạo video thành công 🎉' : 'Tạo video thất bại ⚠️',
          message: status === 'success' ? 'Video AI đã hoàn tất render.' : 'Hệ thống đã hoàn lại Credits.',
          createdAt: new Date()
        }
      });
      
      io.to(`user_room_${userId}`).emit('USER_JOB_STATUS', {
        status: status, // 'success' hoặc 'failed'
        type: 'video',
        message: status === 'success' ? 'Tạo video thành công!' : 'Tạo video thất bại, đã hoàn lại credit.',
        newBalance: updatedUser ? updatedUser.credits : null
      });

      console.log(`[USER REAL-TIME CALIBRATION] Đã đồng bộ số dư và thông báo về máy User #${userId}`);
    }
  } catch (err) {
    console.error('[PROCESS JOB RESULT ERROR]:', err);
  }
};

async function _dispatchFalJob(req, job, userId) {
  const io = req.app?.io || req.io;

  emitStatusUpdate(req, userId, job.id, 'Dang ket noi dich vu Fal.ai...');

  const falKey = await getFalApiKey();
  const resolvedWebhookUrl = getWebhookUrl();

  const validModelNames = ['wan_turbo', 'kling_v2_5_standard'];
  const modelName = validModelNames.includes(job.modelName) ? job.modelName : 'wan_turbo';

  // =============================================================================
  // CO CHE PHONG THU 1: FALLBACK UPLOAD LOCALHOST -> CLOUDINARY
  // Phat hien URL localhost, tu dong upload file vat ly len Cloudinary,
  // cap nhat DB bang URL moi, roi dung URL nay cho toan bo phan xu ly phia sau.
  // =============================================================================
  let resolvedImageUrl = job.inputImageUrl;
  if (job.inputImageUrl && (job.inputImageUrl.includes('localhost') || job.inputImageUrl.includes('127.0.0.1'))) {
    emitStatusUpdate(req, userId, job.id, 'Phat hien URL localhost, dang upload len Cloudinary...');

    const cloudinaryUrl = await _uploadLocalImageToCloudinary(job.inputImageUrl);

    // Neu upload thanh cong -> cap nhat DB + dung URL moi
    if (cloudinaryUrl && cloudinaryUrl !== job.inputImageUrl) {
      resolvedImageUrl = cloudinaryUrl;

      // Cap nhat input_image_url trong DB de dong bo du lieu ve sau
      try {
        await job.update({ inputImageUrl: cloudinaryUrl });
        console.log('[FALLBACK CLOUDINARY] Da cap nhat DB: job #' + job.id + ' -> input_image_url =', cloudinaryUrl);
      } catch (dbErr) {
        console.warn('[FALLBACK CLOUDINARY] Khong the cap nhat DB:', dbErr.message);
      }
    }
  }

  // =============================================================================
  // CO CHE PHONG THU 2: DAM BAO URL ANH LA PUBLIC (Cloudinary / Ngrok)
  // URL tu Cloudinary se duoc resolvePublicImageUrl giu nguyen (bo qua Layer 3).
  // URL localhost (neu van con sot) se duoc chuyen sang Ngrok.
  // =============================================================================
  const publicImageUrl = resolvePublicImageUrl(resolvedImageUrl, resolvedWebhookUrl);

  // DEBUG LOG
  const DBG = '='.repeat(60);
  console.log('\n' + DBG);
  console.log('[FAL DEBUG] REQUEST INSPECTION - Job #' + job.id);
  console.log(DBG);
  console.log('[FAL DEBUG] Model            :', modelName);
  console.log('[FAL DEBUG] falKey length    :', falKey ? falKey.length : 0);
  console.log('[FAL DEBUG] falKey preview   :', falKey ? falKey.substring(0, 12) + '...' + falKey.slice(-4) : 'EMPTY');
  console.log('[FAL DEBUG] image_url goc    :', job.inputImageUrl ? job.inputImageUrl.substring(0, 80) : 'null');
  console.log('[FAL DEBUG] image_url public :', publicImageUrl ? publicImageUrl.substring(0, 80) : 'null');
  console.log('[FAL DEBUG] webhook_url      :', resolvedWebhookUrl || 'Khong co - se dung che do polling');
  console.log(DBG + '\n');

  // ===========================================================================
  // CO CHE PHONG THU 3: PRE-CHECK URL ANH TRUOC KHI GUI SANG FAL.AI
  // Dung axios HEAD de dam bao URL anh co the truy cap tu internet, co status
  // 200 va content-type la image/*. Neu khong hop le -> set job failed + return.
  // ===========================================================================
  if (publicImageUrl) {
    const isImageValid = await _preCheckImageUrl(publicImageUrl);
    if (!isImageValid) {
      console.error(`[VIDEO CTRL] Job #${job.id} bi chan: URL anh khong hop le (${publicImageUrl.substring(0, 80)})`);

      try {
        await job.update({
          status  : 'failed',
          errorLog: 'URL anh khong hop le hoac khong the truy cap cong khai.',
        });
      } catch (dbErr) {
        console.warn('[VIDEO CTRL] Khong the cap nhat DB sau khi chan URL:', dbErr.message);
      }

      await processJobResult(req, userId, job.id, 'failed', job.modelName, job.duration, 'URL ảnh không hợp lệ hoặc không thể truy cập công khai.');

      if (io) {
        io.to(`user_room_${userId}`).emit('video_failed', {
          jobId  : job.id,
          status : 'failed',
          reason : 'URL anh khong hop le hoac khong the truy cap cong khai.',
          message: 'Hinh anh khong hop le hoac khong the truy cap cong khai.',
        });
      }

      return;
    }
  }

  try {
    const duration = job.duration || 5;

    const result = await videoService.generateVideo({
      jobId: job.id,
      modelName,
      prompt: job.prompt,
      imageUrl: publicImageUrl,
      aspectRatio: job.aspectRatio,
      duration,
      webhookUrl: resolvedWebhookUrl,
    });

    const { requestId } = result;

    if (!requestId) {
      throw new Error('Fal.ai khong tra ve request_id.');
    }

    await job.update({
      thirdPartyTaskId: requestId,
      status          : 'processing',
    });

    if (global.io) {
      global.io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: 'processing', progress: 10 });
      global.io.to('admin_room').emit('video_job:updated', job.toJSON());
    }
    emitStatusUpdate(req, userId, job.id, `Fal.ai da nhan yeu cau - request_id: ${requestId}`);
    console.log(`[VIDEO CTRL] Job #${job.id} -> Fal.ai request_id: ${requestId}`);

    if (!resolvedWebhookUrl) {
      const basePath = MODEL_BASE_PATHS[modelName] || 'fal-ai/wan';
      const statusUrl = `https://queue.fal.run/${basePath}/requests/${requestId}/status`;
      const resultUrl = `https://queue.fal.run/${basePath}/requests/${requestId}`;
      console.log(`[VIDEO CTRL] Bat dau Polling | model: ${modelName} | statusUrl: ${statusUrl} | resultUrl: ${resultUrl}`);

      _pollFalStatus(req, job, statusUrl, resultUrl, userId, 0);
    }

  } catch (falError) {
    console.error('');
    console.error('[FAL AI SUBMIT FAILED] ==========================================');
    console.error('[FAL AI SUBMIT FAILED] Job ID  :', job.id);
    console.error('[FAL AI SUBMIT FAILED] User ID :', userId);
    console.error('[FAL AI SUBMIT FAILED] Loi     :', falError.message);
    console.error('[FAL AI SUBMIT FAILED] ==========================================');
    console.error('');

    try {
      await job.update({
        status  : 'failed',
        errorLog: falError.message,
      });
      console.log(`[FAL AI ERROR] Da cap nhat DB: job #${job.id} -> status='failed', errorLog ghi nhan.`);
      if (global.io) {
        global.io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: 'failed', progress: 0 });
        global.io.to('admin_room').emit('video_job:updated', job.toJSON());
      }
    } catch (dbUpdateError) {
      console.error('[FAL AI ERROR] Khong the cap nhat DB sau khi Fal.ai that bai:', dbUpdateError.message);
    }

    await processJobResult(req, userId, job.id, 'failed', job.modelName, job.duration, falError.message);

    if (io) {
      io.to(`user_room_${userId}`).emit('video_failed', {
        jobId  : job.id,
        status : 'failed',
        reason : `Loi tu Fal.ai: ${falError.message}`,
        message: `Tao video that bai: ${falError.message}`,
      });
      console.log(`[FAL AI ERROR] Da emit 'video_failed' -> user_room_${userId}`);
    } else {
      console.warn('[FAL AI ERROR] Khong tim thay io instance - bo qua emit socket.');
    }

    throw falError;
  }
}

async function _pollFalStatus(req, job, statusUrl, resultUrl, userId, attempts = 0) {
  const io = req.app?.io || req.io || global.io;
  try {
    if (!statusUrl) {
      throw new Error("Tham số statusUrl bị trống, không thể quét trạng thái.");
    }

    // 1. PHÁ CACHE TUYỆT ĐỐI: Thêm timestamp query param để ép buộc Gateway/Proxy trả về data real-time
    const cacheBuster = `_t=${Date.now()}&attempts=${attempts}`;
    const freshStatusUrl = statusUrl.includes('?') ? `${statusUrl}&${cacheBuster}` : `${statusUrl}?${cacheBuster}`;

    console.log(`[VIDEO SERVICE] Poll Lần ${attempts + 1} - Quét Trạng Thái Qua URL: ${freshStatusUrl}`);
    const apiKey = process.env.FAL_KEY || process.env.FAL_API_KEY || await getFalApiKey();
    
    // Thêm các header chống cache nghiêm ngặt
    const res = await axios.get(freshStatusUrl, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const data = res.data;
    console.log(`[VIDEO SERVICE] Tác vụ #${job.id} có trạng thái từ Fal.ai: ${data.status}`);

    // 2. CHIẾN LƯỢC ĐÁNH CHẶN KÉP (DUAL-PATH): 
    // Nếu trạng thái vẫn là IN_PROGRESS hoặc IN_QUEUE nhưng video thực tế đã render xong trên web,
    // ta chủ động kiểm tra thẳng vào resultUrl (mỗi 2 lượt poll một lần để tránh spam)
    let videoUrl = null;
    
    if ((data.status === 'IN_PROGRESS' || data.status === 'IN_QUEUE') && resultUrl && (attempts % 2 === 0)) {
      console.log(`[VIDEO SERVICE] Hệ thống kiểm tra chéo dữ liệu tại resultUrl để tránh kẹt trạng thái...`);
      try {
        const freshResultUrl = resultUrl.includes('?') ? `${resultUrl}&_t=${Date.now()}` : `${resultUrl}?_t=${Date.now()}`;
        const resultRes = await axios.get(freshResultUrl, {
          headers: { 'Authorization': `Key ${apiKey}`, 'Cache-Control': 'no-cache' }
        });
        const rData = resultRes.data;
        videoUrl = rData.payload?.video?.url || rData.video?.url || (rData.payload?.outputs && rData.payload.outputs[0]?.file?.url) || rData.output?.video?.url || rData.output?.video_url;
        
        if (videoUrl) {
          console.log(`[VIDEO SERVICE] 🎉 ĐÁNH CHẶN THÀNH CÔNG! Tìm thấy Video tại resultUrl dù status vẫn báo IN_PROGRESS.`);
          data.status = 'COMPLETED'; // Ghi đè trạng thái ảo để nhảy vào luồng success bên dưới
        }
      } catch (resultErr) {
        // Âm thầm bỏ qua lỗi vì có thể Fal.ai chưa tạo xong file kết quả thật
      }
    }

    // 3. XỬ LÝ KẾT QUẢ NGHIỆM THU
    if (data.status === 'COMPLETED' || data.status === 'OK') {
      if (!videoUrl) {
        videoUrl = data.payload?.video?.url || data.video?.url || (data.payload?.outputs && data.payload.outputs[0]?.file?.url);
      }
      
      if (!videoUrl && resultUrl) {
        try {
          const freshResultUrl = resultUrl.includes('?') ? `${resultUrl}&_t=${Date.now()}` : `${resultUrl}?_t=${Date.now()}`;
          const resultRes = await axios.get(freshResultUrl, { headers: { 'Authorization': `Key ${apiKey}`, 'Cache-Control': 'no-cache' } });
          const rData = resultRes.data;
          videoUrl = rData.payload?.video?.url || rData.video?.url || (rData.payload?.outputs && rData.payload.outputs[0]?.file?.url) || rData.output?.video?.url || rData.output?.video_url;
        } catch (err) {}
      }

      // 💡 CHẶN LỖI: Kiểm tra xem có thực sự có URL thành phẩm hay không, hoặc có chứa object error không
      if (!videoUrl || data.error) {
        const errorDetail = data.error ? (typeof data.error === 'object' ? JSON.stringify(data.error) : data.error) : 'Không tìm thấy URL video trong gói tin thành công từ Fal.ai.';
        console.error(`[POLL DETECT FAILED] Phát hiện lỗi Client Error ẩn trong gói tin của Job #${job.id}:`, errorDetail);

        // Đổi trạng thái luồng sang thất bại để kích hoạt cơ chế HOÀN TIỀN (Refund) cho User
        await job.update({ status: 'failed', errorLog: `Lỗi Fal.ai ẩn: ${errorDetail}` });
        
        if (io) {
          io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: 'failed', progress: 0 });
          io.to('admin_room').emit('video_job:updated', job.toJSON());
        }

        await processJobResult(req, userId, job.id, 'failed', job.modelName, job.duration, `Lỗi Fal.ai: ${errorDetail}`);

        if (io) {
          io.to(`user_room_${userId}`).emit('video_failed', {
            jobId: job.id,
            status: 'failed',
            message: `Tạo video AI thất bại: ${errorDetail}`
          });
        }
        return;
      }

      console.log(`[VIDEO SERVICE] 🎉 THÀNH CÔNG THU THẬP VIDEO! URL: ${videoUrl}`);
      await job.update({ status: 'success', videoUrl: videoUrl });

      if (io) {
        io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: 'success', progress: 100 });
        io.to('admin_room').emit('video_job:updated', job.toJSON());
      }

      // Tự động ghi sổ hóa đơn chi phí API Fal.ai
      try {
        const { ApiCost } = require('../models');
        let calculatedCost = 0.05;
        if (job.modelName === 'kling_v2_5_standard') {
          calculatedCost = 0.10;
        } else if (job.modelName === 'wan_turbo') {
          calculatedCost = 0.05;
        }
        await ApiCost.create({
          provider: 'Fal',
          cost: Number(calculatedCost.toFixed(8))
        });
        console.log(`[VIDEO SERVICE] ✅ Ghi nhận chi phí Fal: ${calculatedCost} USD cho model ${job.modelName}`);
      } catch (databaseError) {
        console.error('[VIDEO SERVICE] ⚠️ Lỗi khi ghi sổ ApiCost Fal.ai:', databaseError.message);
      }

      await processJobResult(req, userId, job.id, 'success', job.modelName, job.duration);
      
      if (io) {
        io.to(`user_room_${userId}`).emit('video_finished', {
          jobId: job.id,
          videoUrl: videoUrl,
          status: 'success',
          message: 'Video của ông đã được dệt thành công!'
        });
      }
      return;
    }

    if (data.status === 'FAILED') {
      console.error(`[VIDEO SERVICE] Tác vụ #${job.id} bị Fal.ai báo render thất bại.`);
      await job.update({ status: 'failed', errorLog: 'Render video thất bại trên server Fal.ai.' });

      if (io) {
        io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: 'failed', progress: 0 });
        io.to('admin_room').emit('video_job:updated', job.toJSON());
      }
      
      await processJobResult(req, userId, job.id, 'failed', job.modelName, job.duration, 'Render video thất bại trên server Fal.ai.');

      if (io) {
        io.to(`user_room_${userId}`).emit('video_failed', {
          jobId: job.id,
          status: 'failed',
          message: 'Quá trình render video trên server Fal.ai gặp sự cố.'
        });
      }
      return;
    }

    // Tiếp tục vòng lặp quét trạng thái real-time sau 8 giây
    setTimeout(() => _pollFalStatus(req, job, statusUrl, resultUrl, userId, attempts + 1), 8000);

  } catch (err) {
    console.warn(`[POLL ERROR] Lượt quét thứ ${attempts + 1} bị nghẽn: ${err.message}`);
    if (attempts < 50) {
      setTimeout(() => _pollFalStatus(req, job, statusUrl, resultUrl, userId, attempts + 1), 8000);
    } else {
      console.error(`[VIDEO SERVICE] Đã thử quét trạng thái quá nhiều lần thất bại cho job #${job.id}`);
      try {
        await job.update({ status: 'failed', errorLog: `Quá giới hạn 50 lần quét trạng thái: ${err.message}` });
        
        if (io) {
          io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: job.id, status: 'failed', progress: 0 });
          io.to('admin_room').emit('video_job:updated', job.toJSON());
        }

        await processJobResult(req, userId, job.id, 'failed', job.modelName, job.duration, `Quá giới hạn 50 lần quét trạng thái: ${err.message}`);

        if (io) {
          io.to(`user_room_${userId}`).emit('video_failed', {
            jobId: job.id,
            status: 'failed',
            message: 'Quá giới hạn quét trạng thái từ Fal.ai, tác vụ bị hủy.'
          });
        }
      } catch (dbErr) {
        console.error('[VIDEO SERVICE] Không thể cập nhật trạng thái failed:', dbErr.message);
      }
    }
  }
}

// =============================================================================
// [2] POST /api/video-jobs/webhook
//     Nhan callback tu Fal.ai khi render hoan tat hoac loi. [public endpoint]
//
//  Fal.ai Kling v1.6 Pro co the gui ve cac schema khac nhau:
//   Schema A: { request_id, status: "OK", video: { url: "..." } }
//   Schema B: { request_id, status: "OK", outputs: [{ file: { url: "..." } }] }
//   Schema C: { request_id, status: "OK", output: { video: { url: "..." } } }
//   Schema D: boc trong payload: { payload: { request_id, output: {...} } }
//  -> Code duoi day xu ly phong thu cho tat ca cac dang tren.
// =============================================================================

const handleWebhook = async (req, res) => {
  // Tra 200 ngay lap tuc de Fal.ai khong retry (timeout = 30s phia Fal.ai)
  res.status(200).json({ success: true, received: true });

  try {
    // =========================================================================
    // BUOC 1: LOG TOAN BO GOI TIN NHAN DUOC (rat quan trong de debug)
    // In ra console TOAN BO body de xem chinh xac Fal.ai gui gi
    // =========================================================================
    console.log('');
    console.log('[FAL AI WEBHOOK RECEIVE BODY]:', JSON.stringify(req.body, null, 2));
    console.log('');

    // =========================================================================
    // BUOC 2: TRICH XUAT request_id VA video_url TU GOI TIN FAL.AI
    //
    // request_id: Ma dinh danh khop voi third_party_task_id trong DB cua ta.
    //   Fal.ai gui trong: req.body.request_id hoac falPayload.request_id
    //
    // video_url: Duong dan video ket qua - Fal.ai co nhieu cach boc khat nhau:
    //   Schema A (pho bien nhat) : req.body.video.url
    //   Schema B (outputs array) : req.body.outputs[0].file.url
    //   Schema C (output object) : req.body.output.video.url
    //   Schema D (output object) : req.body.output.video_url
    //   Schema E (top-level)     : req.body.video_url
    //   Schema F (boc trong payload): req.body.payload.output.video.url
    // =========================================================================

    // Boc tach cac truong chinh tu body
    const {
      request_id,
      status,
      output,          // Schema C/D: output.video.url | output.video_url
      outputs,         // Schema B: outputs[0].file.url | outputs[0].video.url
      error,
      payload: falPayload, // Schema F: Fal.ai boc ket qua trong 'payload'
    } = req.body;

    // Trich xuat request_id theo thu tu uu tien (phong thu nhieu field)
    const requestId =
      request_id                 ||  // Truong chuan cua Fal.ai
      req.body.task_id           ||  // Mot so version dung task_id
      req.body.id                ||  // Truong du phong
      falPayload?.request_id     ||  // Boc trong payload
      null;

    // Trich xuat video_url theo chuoi uu tien bao phu tat ca schema Fal.ai
    // (theo thu tu tu pho bien nhat den hiem gap nhat)
    const videoUrl =
      req.body.video?.url               ||  // Schema A: { video: { url } }
      (outputs && outputs[0]?.file?.url) ||  // Schema B: outputs[0].file.url
      (outputs && outputs[0]?.video?.url)||  // Schema B alt: outputs[0].video.url
      output?.video?.url                ||  // Schema C: output.video.url
      output?.video_url                 ||  // Schema D: output.video_url
      req.body.video_url                ||  // Schema E: top-level video_url
      falPayload?.output?.video?.url    ||  // Schema F: payload.output.video.url
      falPayload?.video?.url            ||  // Schema F alt
      null;

    // Log chi tiet cac gia tri vua trich xuat de kiem tra
    console.log('[WEBHOOK VIDEO] requestId trich xuat   :', requestId);
    console.log('[WEBHOOK VIDEO] videoUrl trich xuat    :', videoUrl);
    console.log('[WEBHOOK VIDEO] status Fal.ai          :', status);

    // =========================================================================
    // BUOC 3: PHAN LOAI TRANG THAI FAL.AI
    // Fal.ai dung nhieu gia tri status khac nhau tuy phien ban
    // =========================================================================
    const isSuccess =
      status === 'OK'         ||  // Kling v1.6 Pro dung 'OK'
      status === 'COMPLETED'  ||  // Mot so model dung 'COMPLETED'
      status === 'completed'  ||  // Viet thuong
      status === 'success';       // Mot so SDK wrapper dung 'success'

    const isFailed =
      status === 'ERROR'   ||
      status === 'FAILED'  ||
      status === 'failed';

    // Lay Socket.io instance tu app (duoc gan trong server.js middleware)
    const io = req.app?.io || req.io || global.io;

    // =========================================================================
    // BUOC 4: XU LY THEO TRANG THAI
    // =========================================================================

    if (isSuccess) {
      // 💡 CHẶN LỖI: Kiểm tra xem có thực sự có URL thành phẩm hay không, hoặc có chứa object error không
      if (!videoUrl || error || falPayload?.error) {
        const errorDetail = error || falPayload?.error || 'Không tìm thấy URL video trong gói tin thành công từ Fal.ai.';
        console.error(`[WEBHOOK DETECT FAILED] Phát hiện lỗi Client Error ẩn trong gói tin webhook của requestId ${requestId}:`, errorDetail);

        if (!requestId) {
          console.error('[WEBHOOK VIDEO] Webhook thất bại nhưng THIẾU request_id. Không thể cập nhật DB.');
          return;
        }

        // Đổi trạng thái luồng sang thất bại để kích hoạt cơ chế HOÀN TIỀN (Refund) cho User
        const [failedRows] = await VideoJob.update(
          {
            status  : 'failed',
            errorLog: `Lỗi Fal.ai ẩn: ${typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail}`,
          },
          {
            where: { thirdPartyTaskId: requestId },
          }
        );

        if (failedRows === 0) {
          console.warn('[WEBHOOK VIDEO] CANH BAO: Không tìm thấy bản ghi nào khớp với third_party_task_id:', requestId);
          return;
        }

        const failedJobRecord = await VideoJob.findOne({
          where: { thirdPartyTaskId: requestId },
        });

        if (failedJobRecord) {
          await processJobResult(req, failedJobRecord.userId, failedJobRecord.id, 'failed', failedJobRecord.modelName, failedJobRecord.duration, typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail);

          if (io) {
            const failRoom = `user_room_${failedJobRecord.userId}`;
            io.to(failRoom).emit('video_failed', {
              jobId  : failedJobRecord.id,
              status : 'failed',
              reason : typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail,
              message: `Tạo video AI thất bại: ${typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail}`,
            });
            console.log(`[WEBHOOK VIDEO] Đã emit 'video_failed' -> room: ${failRoom}`);

            io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: failedJobRecord.id, status: 'failed', progress: 0 });
            io.to('admin_room').emit('video_job:updated', failedJobRecord.toJSON());
          }
        }
        return;
      }

      // -----------------------------------------------------------------------
      // THANH CONG: Cap nhat DB + Emit Socket.io
      // -----------------------------------------------------------------------

      // Kiem tra co du thong tin can thiet de luu khong
      if (!requestId) {
        console.error('[WEBHOOK VIDEO] Webhook thanh cong nhung THIEU request_id. Khong the cap nhat DB.');
        return;
      }

      if (!videoUrl) {
        console.warn('[WEBHOOK VIDEO] Webhook thanh cong nhung khong lay duoc video_url.');
        console.warn('[WEBHOOK VIDEO] Body day du:', JSON.stringify(req.body, null, 2));
      }

      // Buoc 4A: Cap nhat co so du lieu bang VideoJob.update() theo third_party_task_id
      // Dung update() thay vi findOne() roi save() de dam bao atomic va chinh xac
      const [updatedRows] = await VideoJob.update(
        {
          status  : 'success',
          videoUrl: videoUrl,   // Field JS camelCase - Sequelize map sang video_url trong DB
        },
        {
          where: { thirdPartyTaskId: requestId }, // Loc theo third_party_task_id
        }
      );

      if (updatedRows === 0) {
        console.warn('[WEBHOOK VIDEO] CANH BAO: Khong tim thay ban ghi nao khop voi third_party_task_id:', requestId);
        console.warn('[WEBHOOK VIDEO] Co the job chua duoc tao hoac requestId bi sai.');
        return;
      }

      console.log(`[WEBHOOK VIDEO] Cap nhat DB thanh cong: ${updatedRows} ban ghi -> status='success', videoUrl ghi nhan.`);
      console.log(`[WEBHOOK VIDEO] requestId: ${requestId} | videoUrl: ${videoUrl}`);

      // Buoc 4B: Lay lai thong tin job (can userId de emit Socket.io dung phong)
      const jobRecord = await VideoJob.findOne({
        where: { thirdPartyTaskId: requestId },
      });

      if (jobRecord) {
        const userRoom = `user_room_${jobRecord.userId}`;
        console.log(`[WEBHOOK VIDEO] Khop Job #${jobRecord.id} | userId: ${jobRecord.userId} | room: ${userRoom}`);

        await processJobResult(req, jobRecord.userId, jobRecord.id, 'success', jobRecord.modelName, jobRecord.duration);

        // Buoc 4C: Emit Socket.io ve phong rieng cua user de Frontend dung spinner
        if (io) {
          io.to(userRoom).emit('video_status_update', {
            jobId    : jobRecord.id,
            status   : 'success',
            video_url: videoUrl,
            message  : 'Video Ads da duoc det thanh cong tu Fal.ai!',
          });
          // Emit them su kien 'video_finished' de Frontend co the bat ca hai
          io.to(userRoom).emit('video_finished', {
            jobId   : jobRecord.id,
            videoUrl: videoUrl,
            status  : 'success',
            message : 'Video Ads da duoc det thanh cong tu Fal.ai!',
          });
          console.log(`[WEBHOOK VIDEO] Da emit 'video_status_update' + 'video_finished' -> room: ${userRoom}`);

          io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: jobRecord.id, status: 'success', progress: 100 });
          io.to('admin_room').emit('video_job:updated', jobRecord.toJSON());
        } else {
          console.warn('[WEBHOOK VIDEO] Khong tim thay io instance - bo qua emit socket.');
        }
      } else {
        console.warn('[WEBHOOK VIDEO] Sau khi update, khong tim lai duoc jobRecord (bat thuong).');
      }

    } else if (isFailed) {
      // -----------------------------------------------------------------------
      // THAT BAI: Cap nhat DB + Emit Socket.io
      // -----------------------------------------------------------------------

      if (!requestId) {
        console.error('[WEBHOOK VIDEO] Webhook that bai nhung THIEU request_id. Khong the cap nhat DB.');
        return;
      }

      const errorReason = error || req.body.error_message || 'Fal.ai xu ly that bai.';

      // Cap nhat trang thai 'failed' vao DB
      const [failedRows] = await VideoJob.update(
        {
          status  : 'failed',
          errorLog: errorReason,
        },
        {
          where: { thirdPartyTaskId: requestId },
        }
      );

      if (failedRows === 0) {
        console.warn('[WEBHOOK VIDEO] CANH BAO: Khong tim thay ban ghi nao khop voi third_party_task_id:', requestId);
        return;
      }

      console.warn(`[WEBHOOK VIDEO] Cap nhat DB: ${failedRows} ban ghi -> status='failed' | ly do: ${errorReason}`);

      // Tim jobRecord de lay userId emit socket
      const failedJobRecord = await VideoJob.findOne({
        where: { thirdPartyTaskId: requestId },
      });

      if (failedJobRecord) {
        await processJobResult(req, failedJobRecord.userId, failedJobRecord.id, 'failed', failedJobRecord.modelName, failedJobRecord.duration, errorReason);

        if (io) {
          const failRoom = `user_room_${failedJobRecord.userId}`;
          io.to(failRoom).emit('video_failed', {
            jobId  : failedJobRecord.id,
            status : 'failed',
            reason : errorReason,
            message: `Tao video that bai: ${errorReason}`,
          });
          console.log(`[WEBHOOK VIDEO] Da emit 'video_failed' -> room: ${failRoom}`);

          io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: failedJobRecord.id, status: 'failed', progress: 0 });
          io.to('admin_room').emit('video_job:updated', failedJobRecord.toJSON());
        }
      }

    } else {
      // -----------------------------------------------------------------------
      // TRANG THAI TRUNG GIAN: IN_QUEUE, IN_PROGRESS, PROCESSING...
      // Khong can cap nhat DB, chi emit socket thong bao tien trinh
      // -----------------------------------------------------------------------
      console.log(`[WEBHOOK VIDEO] Nhan trang thai trung gian: "${status}" cho requestId: ${requestId}`);

      if (requestId && io) {
        // Tim job de lay userId
        const midJobRecord = await VideoJob.findOne({
          where: { thirdPartyTaskId: requestId },
        });

        if (midJobRecord) {
          const midRoom = `user_room_${midJobRecord.userId}`;
          io.to(midRoom).emit('video_status_update', {
            jobId  : midJobRecord.id,
            status : status,
            message: `Fal.ai cap nhat trang thai: ${status}`,
          });
          console.log(`[WEBHOOK VIDEO] Da emit 'video_status_update' (${status}) -> room: ${midRoom}`);

          let progressVal = 10;
          let mappedStatus = 'processing';
          if (status === 'IN_QUEUE' || status === 'queueing' || status === 'queued') {
            progressVal = 0;
            mappedStatus = 'queueing';
          }
          io.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: midJobRecord.id, status: mappedStatus, progress: progressVal });
        }
      }
    }

  } catch (err) {
    // Da tra 200 roi -> chi log loi, khong anh huong den co che retry cua Fal.ai
    console.error('[WEBHOOK VIDEO] Loi xu ly noi bo webhook:', err.message);
    console.error(err.stack);
  }
};

// =============================================================================
// [3] GET /api/video-jobs/recent - Lay 4 VideoJob moi nhat cua user
// =============================================================================

const getRecentJobs = async (req, res) => {
  const userId = req.user.id;

  try {
    const jobs = await VideoJob.findAll({
      where     : { userId },
      order     : [['id', 'DESC']],
      limit     : 4,
      attributes: ['id', 'prompt', 'inputImageUrl', 'videoUrl', 'aspectRatio', 'status', 'createdAt'],
    });

    return res.status(200).json({ success: true, jobs });
  } catch (err) {
    console.error('[VIDEO CTRL] getRecentJobs error:', err);
    return res.status(500).json({ success: false, message: 'Khong the tai danh sach video gan day.' });
  }
};

// =============================================================================
// [4] POST /api/video-jobs/extend - Mo rong video len 12 giay, khau tru 50 Credits
// =============================================================================

const extendVideo = async (req, res) => {
  const userId = req.user.id;

  try {
    const { jobId } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: 'Thieu tham so jobId.' });
    }

    const job = await VideoJob.findOne({ where: { id: jobId, userId } });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Khong tim thay tac vu video.' });
    }
    if (job.status !== 'success') {
      return res.status(400).json({
        success: false,
        message: 'Chi co the mo rong video da hoan tat thanh cong.',
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Khong tim thay tai khoan.' });
    }
    if ((user.credits || 0) < CREDITS_EXTEND) {
      return res.status(402).json({
        success: false,
        message: `So Credits khong du. Can toi thieu ${CREDITS_EXTEND} Credits de mo rong video.`,
      });
    }

    await user.update({ credits: user.credits - CREDITS_EXTEND });
    console.log(`[VIDEO CTRL] User #${userId} khau tru ${CREDITS_EXTEND} Credits -> con: ${user.credits - CREDITS_EXTEND}`);

    if (global.io) {
      global.io.emit('NEW_TRANSACTION', { type: 'consume', amount: CREDITS_EXTEND, userId: userId });
    }

    const extendWebhookUrl = getWebhookUrl();
    const falKeyForExtend  = await getFalApiKey();

    // Ap dung Co che Phong thu 1 cho luong extend - ngan loi 422
    const publicImageUrlForExtend = resolvePublicImageUrl(job.inputImageUrl, extendWebhookUrl);

    const extendPayload = {
      prompt      : job.prompt,
      image_url   : publicImageUrlForExtend, // Da chuyen sang public URL
      aspect_ratio: job.aspectRatio,
      duration    : 12,                      // Ep kieu NUMBER - 12 giay
    };

    if (extendWebhookUrl) {
      extendPayload.webhook_url = extendWebhookUrl;
      console.log(`[VIDEO CTRL] Extend webhook URL: ${extendWebhookUrl}`);
    } else {
      console.log('[VIDEO CTRL] Extend: khong co webhook URL - se dung che do polling.');
    }

    res.status(200).json({
      success      : true,
      message      : `Da khau tru ${CREDITS_EXTEND} Credits. Dang mo rong video len 12 giay...`,
      newJobId     : null,
      remainCredits: user.credits - CREDITS_EXTEND,
    });

    axios.post(FAL_MODEL_URL, extendPayload, {
      headers: {
        Authorization: `Key ${falKeyForExtend}`,
        'Content-Type': 'application/json',
      },
    }).then(async (falRes) => {
      const requestId = falRes.data?.request_id || falRes.data?.id;
      const newJob = await VideoJob.create({
        userId,
        analysisId      : job.analysisId,
        prompt          : job.prompt,
        inputImageUrl   : job.inputImageUrl,
        aspectRatio     : job.aspectRatio,
        modelName       : job.modelName,
        thirdPartyTaskId: requestId || null,
        status          : 'processing',
      });
      console.log(`[VIDEO CTRL] Extend job tao -> Job #${newJob.id} | requestId: ${requestId}`);

      const ioInstance = req.app?.io || req.io || global.io;
      if (ioInstance) {
        ioInstance.to('admin_room').emit('UPDATE_VIDEO_JOB', { id: newJob.id, status: 'processing', progress: 10 });
        ioInstance.to('admin_room').emit('video_job:created', newJob.toJSON());
      }
      if (!extendWebhookUrl && requestId) {
        const basePath = MODEL_BASE_PATHS[job.modelName] || 'fal-ai/kling-video';
        const statusUrl = `https://queue.fal.run/${basePath}/requests/${requestId}/status`;
        const resultUrl = `https://queue.fal.run/${basePath}/requests/${requestId}`;
        console.log(`[VIDEO CTRL] Extend Bat dau Polling | model: ${job.modelName} | statusUrl: ${statusUrl} | resultUrl: ${resultUrl}`);

        _pollFalStatus(req, newJob, statusUrl, resultUrl, userId, 0);
      }
    }).catch(async (err) => {
      console.error('[VIDEO CTRL] Extend Fal.ai dispatch error:', err.message);
      // Refund credits
      try {
        await User.increment('credits', { by: CREDITS_EXTEND, where: { id: userId } });
        console.log(`[VIDEO CTRL] Extend dispatch error -> refunded ${CREDITS_EXTEND} credits to User #${userId}`);
        
        // Ghi transaction hoàn credits
        const refundTxId = 'TRX-REFUND-' + Date.now().toString().slice(-8) + Math.floor(100 + Math.random() * 900);
        await Transaction.create({
          id: refundTxId,
          userId: userId,
          package_name: job.modelName === 'wan_turbo' ? 'Tạo Video Wan' : 'Tạo Video Kling',
          amount: 0,
          credits_added: CREDITS_EXTEND,
          status: 'success',
          type: 'Hoàn tín dụng lỗi'
        });

        // Tạo notification
        await Notification.create({
          userId: userId,
          title: 'Tạo video thất bại ⚠️',
          message: `Không thể kết nối Fal.ai khi mở rộng video: ${err.message}. Hệ thống đã tự động hoàn lại ${CREDITS_EXTEND} Credits.`,
          type: 'error',
          is_read: false
        });

        // Emit Socket.io
        const io = req.app?.io || req.io || global.io;
        if (io) {
          const updatedUser = await User.findByPk(userId);
          io.to(`user_room_${userId}`).emit('USER_PIPELINE_UPDATE', {
            credits: updatedUser ? updatedUser.credits : null,
            notification: {
              title: 'Tạo video thất bại ⚠️',
              message: 'Hệ thống đã hoàn lại Credits.',
              createdAt: new Date()
            }
          });
        }
      } catch (refundErr) {
        console.error('[VIDEO CTRL] Refund credits failed for extend dispatch error:', refundErr.message);
      }
    });

  } catch (err) {
    console.error('[VIDEO CTRL] extendVideo error:', err);
    return res.status(500).json({ success: false, message: 'Loi he thong khi mo rong video.' });
  }
};

// =============================================================================
// [5] POST /api/video-jobs/upload-image
//     Nhan file anh tu Frontend, upload len Cloudinary CDN, tra ve URL https.
//     KHUYEN MAI: URL Cloudinary luon la public, khong can chuyen doi localhost
//     qua Ngrok nua -> diet tan goc bug 422 (Fal.ai khong doc duoc anh).
// =============================================================================

const uploadImage = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Nguoi dung chua dang nhap.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui long gui kem file anh (field: image).' });
    }

    // req.file.path la URL https tu Cloudinary CDN (vd: https://res.cloudinary.com/...)
    const cloudinaryUrl = req.file.path;

    console.log(`[UPLOAD IMAGE] User #${userId} -> Cloudinary upload thanh cong`);
    console.log(`[UPLOAD IMAGE] Cloudinary URL: ${cloudinaryUrl}`);

    return res.status(200).json({
      success  : true,
      message  : 'Upload anh len Cloudinary thanh cong.',
      imageUrl : cloudinaryUrl,
      filename : req.file.filename,
      size     : req.file.size,
    });
  } catch (err) {
    console.error('[UPLOAD IMAGE] Error:', err.message);

    // Gui phan hoi loi chi tiet de Frontend co the hien thi
    const errorMessage = err.message || 'Loi he thong khi upload anh.';
    return res.status(500).json({
      success : false,
      message : errorMessage,
    });
  }
};

// =============================================================================
// [6] DELETE /api/video-jobs/:id
//     Xoa mot video job theo id (chi user so huu moi duoc xoa).
// =============================================================================

const deleteVideoJob = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const job = await VideoJob.findOne({ where: { id, userId } });
    if (!job) {
      return res.status(404).json({ success: false, message: 'Khong tim thay video job nay.' });
    }

    await job.destroy();

    return res.status(200).json({ success: true, message: 'Xoa video job thanh cong.' });
  } catch (err) {
    console.error('[VIDEO CTRL] deleteVideoJob error:', err.message);
    return res.status(500).json({ success: false, message: 'Loi he thong khi xoa video job.' });
  }
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  generateVideo,
  handleWebhook,
  getRecentJobs,
  extendVideo,
  uploadImage,
  deleteVideoJob,
};

