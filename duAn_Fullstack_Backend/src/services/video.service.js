const { VideoJob } = require('../models');

class VideoService {
  /**
   * Triggers the async third-party AI Video generation API (e.g. Kling AI / Runway Gen-3)
   * @param {number} jobId - Local database job ID
   */
  async triggerThirdPartyVideoGeneration(jobId) {
    try {
      const job = await VideoJob.findByPk(jobId);
      if (!job) {
        console.error(`[VIDEO SERVICE] Job #${jobId} not found.`);
        return;
      }

      // 1. Prepare callback webhook URL
      const webhookUrl = process.env.WEBHOOK_URL || "http://localhost:3000/api/video/webhook";

      // 2. Fetch active OpenAI key from database configs dynamically
      const dbConfig = await require('../models').SystemConfig.findByPk('openai_key');
      const activeOpenaiKey = (dbConfig && dbConfig.value) ? dbConfig.value : (process.env.OPENAI_API_KEY || '');

      console.log(`[VIDEO SERVICE] Formulating third-party API payload for job #${jobId}. Key status: ${activeOpenaiKey ? 'Configured' : 'Empty'}`);
      
      // Simulate network request delay (e.g., 200ms)
      await new Promise(resolve => setTimeout(resolve, 200));

      const apiResponseTaskId = `task_kling_${Math.random().toString(36).substring(2, 15)}`;

      // 3. Update local database record: set taskId and status to 'Processing'
      job.thirdPartyTaskId = apiResponseTaskId;
      job.status = 'Processing';
      await job.save();

      console.log(`[VIDEO SERVICE] Task accepted by third-party. Task ID: ${apiResponseTaskId}. Status: Processing.`);

      // 4. AUTOMATIC CALLBACK SIMULATOR
      // To simulate the third-party webhook firing after video rendering finishes:
      const simulatedDelay = 5000 + Math.random() * 3000; // 5 to 8 seconds
      setTimeout(async () => {
        try {
          console.log(`[CALLBACK SIMULATOR] Firing webhook for task: ${apiResponseTaskId}`);
          
          // Absolute path of mock video uploads
          const mockVideoUrl = `http://localhost:3000/uploads/videos/AI_Studio_Video_ID_${jobId}.mp4`;

          // Fire local POST webhook request
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              task_id: apiResponseTaskId,
              task_status: 'SUCCEEDED',
              video_url: mockVideoUrl
            })
          });
          
          if (!response.ok) {
            console.error(`[CALLBACK SIMULATOR] Webhook request failed with status: ${response.status}`);
          }
        } catch (webhookErr) {
          console.error('[CALLBACK SIMULATOR] Error firing webhook:', webhookErr.message);
        }
      }, simulatedDelay);

    } catch (error) {
      console.error(`[VIDEO SERVICE] Error in triggerThirdPartyVideoGeneration for job #${jobId}:`, error.message);
      // Mark job as failed
      try {
        const job = await VideoJob.findByPk(jobId);
        if (job) {
          job.status = 'Failed';
          await job.save();
        }
      } catch (dbErr) {
        console.error('[VIDEO SERVICE] Failed to update job status to Failed:', dbErr.message);
      }
    }
  }
}

module.exports = new VideoService();
