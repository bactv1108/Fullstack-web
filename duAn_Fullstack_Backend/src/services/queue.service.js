const { sequelize, QueueJob, Job } = require('../models');
const nodemailer = require('nodemailer');
const { Op } = require('sequelize');
const cron = require('node-cron');
const voiceService = require('./voice.service');
const cleanupService = require('./cleanup.service');
require('dotenv').config();

// SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 465,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Enqueue a job into the queue_jobs table with optional delay
 */
const enqueue = async (type, payload, delaySeconds = 0) => {
  try {
    const runAt = delaySeconds ? new Date(Date.now() + delaySeconds * 1000) : new Date();
    const job = await QueueJob.create({
      type,
      payload,
      status: 'pending',
      attempts: 0,
      runAt
    });
    console.log(`[QUEUE] Enqueued job #${job.id} type "${type}"`);
    return job;
  } catch (error) {
    console.error('[QUEUE] Enqueue error:', error.message);
    throw error;
  }
};

// Sleep helper function (active delay)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Concurrency lock to guarantee that only 1 worker process runs at a time
let isWorking = false;

/**
 * Process pending jobs sequentially (concurrency: 1) with active delay of 3000ms between them
 */
const processWorker = async () => {
  // Safe gatekeeper to prevent parallel processing loops
  if (isWorking) {
    console.log('[QUEUE] Concurrency check: Worker is already processing. Skipping this execution.');
    return;
  }
  isWorking = true;

  try {
    // Process all pending jobs sequentially in a loop
    while (true) {
      const tx = await sequelize.transaction();
      let job = null;
      try {
        const now = new Date();
        
        // Acquire exclusive row-level lock on one pending job
        job = await QueueJob.findOne({
          where: {
            status: 'pending',
            attempts: { [Op.lt]: 3 },
            [Op.or]: [
              { runAt: null },
              { runAt: { [Op.lte]: now } }
            ]
          },
          order: [['id', 'ASC']],
          lock: tx.LOCK.UPDATE, // Emits 'FOR UPDATE' in MySQL
          transaction: tx
        });

        if (!job) {
          await tx.commit();
          break; // No more pending jobs, exit the worker loop
        }

        // Immediately transition state to locked/processing and increment attempts
        job.status = 'processing';
        job.attempts += 1;
        await job.save({ transaction: tx });
        
        // Commit transaction immediately to release the row lock and proceed with processing
        await tx.commit();
      } catch (findErr) {
        await tx.rollback();
        console.error('[QUEUE] Error picking next job from database:', findErr.message);
        break;
      }

      console.log(`[QUEUE] Worker locked and processing job #${job.id} type "${job.type}"`);

      // Process job execution logic
      try {
        if (job.type === 'send_email') {
          const { to, subject, html } = job.payload;
          await transporter.sendMail({
            from: `"Fullstack App" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
          });
          console.log(`[QUEUE] SMTP Email delivered to ${to} for job #${job.id}.`);
        } else if (job.type === 'render_task') {
          // Commented out to isolate Affiliate/render_task background processing and release resources
          /*
          // Find first active pending/rendering video or voice job
          const renderJob = await Job.findOne({
            where: {
              status: ['Pending', 'Rendering']
            },
            order: [['id', 'ASC']]
          });

          if (renderJob) {
            if (renderJob.type === 'Voice') {
              try {
                // 1. Instantly transition status to Rendering and progress to 20%
                renderJob.status = 'Rendering';
                renderJob.progress = 20;
                await renderJob.save();
                console.log(`[QUEUE] Voice job #${renderJob.id} status set to Rendering (20%).`);

                // 2. Synthesize using voiceService with safe metadata parsing
                let meta = renderJob.meta_data;
                if (typeof meta === 'string') {
                  try {
                    meta = JSON.parse(meta);
                  } catch (e) {
                    console.error('[QUEUE] Failed to parse meta_data JSON string:', e.message);
                  }
                }
                const targetVoice = meta?.voiceModel || meta?.voice || 'vi-VN-NamMinhNeural';
                const speed = meta?.speed !== undefined ? meta.speed : 1.0;
                const pitch = meta?.pitch !== undefined ? meta.pitch : 0;
                console.log("[DEBUG VOICE]", targetVoice, "Speed:", speed, "Pitch:", pitch);

                const relativeFilePath = await voiceService.textToSpeech(renderJob.prompt, targetVoice, renderJob.id, speed, pitch);

                // 3. Complete job successfully with dynamic localhost link
                const port = process.env.PORT || 3000;
                renderJob.status = 'Completed';
                renderJob.progress = 100;
                renderJob.output_url = `http://localhost:${port}${relativeFilePath}`;
                await renderJob.save();
                console.log(`[QUEUE] Voice job #${renderJob.id} completed successfully. URL: ${renderJob.output_url}`);
              } catch (error) {
                console.error(`[QUEUE] Voice job #${renderJob.id} failed:`, error.message);

                // 4. Update the user's Job record to Failed
                renderJob.status = 'Failed';
                await renderJob.save();

                // 5. Update background QueueJob to failed and write error diagnostics
                job.status = 'failed';
                job.errorMessage = error.message;
                await job.save();

                // Ghi trực tiếp vào Database bảng notifications khi thất bại
                try {
                  const { Notification } = require('../models');
                  const notificationEmitter = require('../utils/notificationEmitter');

                  const failNotif = await Notification.create({
                    userId: renderJob.userId,
                    title: 'Lỗi xử lý tác vụ',
                    message: `Gặp lỗi khi tạo giọng nói AI cho tác vụ #${renderJob.id}: ${error.message}`,
                    type: 'error',
                    is_read: false
                  });
                  console.log('[DB DEBUG] Đã insert thành công 1 dòng thất bại vào bảng notifications. ID:', failNotif.id);

                  // Bắn tín hiệu real-time sang luồng SSE qua Emitter
                  notificationEmitter.emit('send_notification', failNotif);
                  console.log('[SSE DEBUG] Đã emit sự kiện send_notification thất bại cho User:', renderJob.userId);
                } catch (notifErr) {
                  console.error('[QUEUE] Explicit failure notification insert error:', notifErr.message);
                }
                
                // Active delay/sleep of 3000ms after job failures
                console.log('[QUEUE] Sleeping for 3000ms after failed render job...');
                await sleep(3000);
                continue;
              }
            } else {
              // Handle Video job simulation progress
              if (renderJob.status === 'Pending') {
                renderJob.status = 'Rendering';
                renderJob.progress = 0;
                await renderJob.save();
                console.log(`[QUEUE] Render simulation Job #${renderJob.id} started.`);
              } else {
                const increment = Math.floor(Math.random() * 20) + 15; // Increments of 15% to 35%
                renderJob.progress = Math.min(100, renderJob.progress + increment);
                
                if (renderJob.progress >= 100) {
                  renderJob.status = Math.random() < 0.1 ? 'Failed' : 'Completed';
                  renderJob.output_url = renderJob.status === 'Completed' 
                    ? `https://storage.googleapis.com/ai-studio-outputs/render_${renderJob.id}.mp4` 
                    : null;
                }
                await renderJob.save();
                console.log(`[QUEUE] Render simulation Job #${renderJob.id} progress: ${renderJob.progress}% (${renderJob.status})`);
              }
            }
          }
          */
          console.log('[QUEUE] Render simulation jobs are temporarily frozen.');
        } else {
          console.warn(`[QUEUE] Unknown job type "${job.type}"`);
        }

        // Complete job successfully
        job.status = 'completed';
        job.errorMessage = null;
        await job.save();
      } catch (jobError) {
        console.error(`[QUEUE] Job #${job.id} execution failed:`, jobError.message);
        
        job.status = job.attempts >= job.max_attempts ? 'failed' : 'pending';
        job.errorMessage = jobError.message;
        // Retry delay of 30 seconds
        job.runAt = new Date(Date.now() + 30 * 1000);
        await job.save();
      }

      // Concurrency recovery block: Active sleep/delay of 3000ms before picking the next job
      console.log('[QUEUE] Active delay: Sleeping for 3000ms to recover Gemini API rate bandwidth...');
      await sleep(3000);
    }
  } catch (error) {
    console.error('[QUEUE] processWorker error:', error.message);
  } finally {
    isWorking = false;
  }
};

// Register daily retention & file cleanup cron task every night at 2:00 AM
cron.schedule('0 2 * * *', async () => {
  try {
    await cleanupService.executeDailyCleanup();
  } catch (err) {
    console.error('[QUEUE CRON] Daily cleanup execution failed:', err.message);
  }
});

module.exports = {
  enqueue,
  processWorker
};
