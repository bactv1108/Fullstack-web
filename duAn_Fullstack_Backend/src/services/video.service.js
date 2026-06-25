const { fal } = require('@fal-ai/client');
const { VideoJob, SystemConfig } = require('../models');

const getConfigValue = async (key, envFallback = null) => {
  try {
    const row = await SystemConfig.findByPk(key);
    if (row && row.value && row.value.trim()) {
      return row.value.trim();
    }
  } catch (err) {
    console.warn(`[VIDEO SERVICE] Khong the doc key="${key}" tu DB:`, err.message);
  }
  return envFallback;
};

const getFalApiKey = async () => {
  return getConfigValue('fal_api_key', process.env.FAL_API_KEY || '');
};

class VideoService {

  async generateVideo({ jobId, modelName, prompt, imageUrl, aspectRatio, duration, webhookUrl }) {
    const falKey = await getFalApiKey();
    if (!falKey) {
      throw new Error('Fal.ai API key khong duoc cau hinh.');
    }

    fal.config({ credentials: falKey });

    // 💡 BỦA BỌC THÉP: Chuyển đổi aspect_ratio sang định dạng Fal.ai chấp nhận
    let finalAspectRatio = '16:9';
    const inputRatio = aspectRatio || '16:9';

    if (['16:9', '9:16', '1:1', 'auto'].includes(inputRatio)) {
      finalAspectRatio = inputRatio;
    } else if (inputRatio === '4:3') {
      // Nếu người dùng chọn chuẩn 4:3, ép về 'auto' để mô hình Wan không bị nổ lỗi Client Error
      finalAspectRatio = 'auto'; 
    }

    // =========================================================================
    // RE NHANH ENDPOINT CHUAN FAL.AI
    // =========================================================================
    let falEndpoint = '';
    let falPayload  = {};

    if (modelName === 'kling_v2_5_standard') {
      falEndpoint = 'fal-ai/kling-video/v2.5-turbo/standard/image-to-video';
      falPayload = {
        image_url   : imageUrl,
        prompt      : prompt,
        aspect_ratio: finalAspectRatio,
        duration    : Number(duration || 5),
        mode        : 'std',
      };

    } else if (modelName === 'wan_turbo') {
      falEndpoint = 'fal-ai/wan/v2.2-a14b/image-to-video/turbo';
      falPayload = {
        image_url   : imageUrl,
        prompt      : prompt,
        aspect_ratio: finalAspectRatio,
      };

    } else {
      // Fallback về wan_turbo nếu model không xác định
      falEndpoint = 'fal-ai/wan/v2.2-a14b/image-to-video/turbo';
      falPayload = {
        image_url   : imageUrl,
        prompt      : prompt,
        aspect_ratio: finalAspectRatio,
      };
    }

    const submitOptions = { input: falPayload };

    if (webhookUrl) {
      submitOptions.webhookUrl = webhookUrl;
      console.log(`[VIDEO SERVICE] Webhook URL duoc gan cho job #${jobId}: ${webhookUrl}`);
    }

    console.log(`[VIDEO SERVICE] Gui yeu cau queue den endpoint: ${falEndpoint} cho job #${jobId}`);
    console.log(`[VIDEO SERVICE] Payload gui len Fal.ai:`, JSON.stringify(falPayload).substring(0, 300));

    const response = await fal.queue.submit(falEndpoint, submitOptions);

    console.log(`[VIDEO SERVICE] Fal.ai queue submit response cho job #${jobId}:`, JSON.stringify(response).substring(0, 200));

    const requestId = response.request_id;

    if (!requestId) {
      throw new Error('Fal.ai khong tra ve request_id sau khi queue.submit.');
    }



    // Tra ve falEndpoint cung voi requestId de controller build URL polling chinh xac
    // Tranh loi 404 do dung basePath rut gon thay vi full endpoint path
    return { requestId, falEndpoint, videoUrl: null };
  }
}

module.exports = new VideoService();

const { Notification } = require('../models');
const notificationEmitter = require('../utils/notificationEmitter');

VideoJob.afterUpdate('notifyVideoJobStatusChange', async (job, options) => {
  if (job.changed('status')) {
    if (job.status === 'success') {
      try {
        const successNotif = await Notification.create({
          userId: job.userId,
          title: 'Tac vu hoan tat',
          message: `Tao video AI thanh cong cho tac vu #${job.id}`,
          type: 'info',
          is_read: false
        });
        notificationEmitter.emit('send_notification', successNotif);
        console.log(`[VIDEO JOB HOOK] Sent success notification for VideoJob #${job.id}`);
      } catch (err) {
        console.error('[VIDEO JOB HOOK] Error sending success notification:', err.message);
      }
    } else if (job.status === 'failed') {
      try {
        const failNotif = await Notification.create({
          userId: job.userId,
          title: 'Loi xu ly tac vu',
          message: `Gap loi khi tao video AI cho tac vu #${job.id}`,
          type: 'error',
          is_read: false
        });
        notificationEmitter.emit('send_notification', failNotif);
        console.log(`[VIDEO JOB HOOK] Sent fail notification for VideoJob #${job.id}`);
      } catch (err) {
        console.error('[VIDEO JOB HOOK] Error sending fail notification:', err.message);
      }
    }
  }
});
