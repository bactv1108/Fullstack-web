const { VideoJob } = require('../models');
const videoService = require('../services/video.service');

const generateVideo = async (req, res) => {
  try {
    const { prompt, aspectRatio, stylePreset } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Kịch bản/Mô tả prompt cho video không được để trống.' });
    }

    const userId = req.user.id;

    // Create initial job in Pending state
    const job = await VideoJob.create({
      userId,
      prompt,
      aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
      stylePreset: stylePreset || 'realistic',
      status: 'Pending'
    });

    // Trigger async video generation without awaiting
    videoService.triggerThirdPartyVideoGeneration(job.id).catch(err => {
      console.error(`[VIDEO CONTROLLER] Background trigger error for job #${job.id}:`, err.message);
    });

    // Instantly return 201
    return res.status(201).json({
      success: true,
      jobId: job.id,
      status: 'Pending'
    });

  } catch (error) {
    console.error('[VIDEO CONTROLLER] generateVideo error:', error.message);
    return res.status(500).json({ error: 'Đã xảy ra lỗi hệ thống khi gửi yêu cầu tạo video.' });
  }
};

const handleWebhook = async (req, res) => {
  try {
    const { task_id, task_status, video_url } = req.body;

    if (!task_id) {
      return res.status(400).json({ error: 'Thiếu tham số task_id.' });
    }

    // Look up the job matching thirdPartyTaskId
    const job = await VideoJob.findOne({
      where: {
        thirdPartyTaskId: task_id
      }
    });

    if (!job) {
      console.warn(`[WEBHOOK VIDEO WARNING] Job with thirdPartyTaskId "${task_id}" not found.`);
      return res.status(404).json({ error: 'Không tìm thấy tác vụ tương ứng.' });
    }

    // Update status
    if (task_status === 'SUCCEEDED') {
      job.status = 'Completed';
      job.videoUrl = video_url;
    } else {
      job.status = 'Failed';
    }

    await job.save();

    // Print clear terminal log
    console.log("[WEBHOOK VIDEO UPDATE]", job.id, job.status);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('[VIDEO CONTROLLER] Webhook handler error:', error.message);
    return res.status(500).json({ error: 'Lỗi xử lý webhook.' });
  }
};

module.exports = {
  generateVideo,
  handleWebhook
};
