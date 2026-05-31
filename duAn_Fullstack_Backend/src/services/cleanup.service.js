const { Job, QueueJob } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs-extra');
const path = require('path');

class CleanupService {
  /**
   * Execute the daily retention and cleanup policy:
   * 1. Delete physical voice files of jobs older than 7 days and set output_url to null.
   * 2. Set is_expired flag inside Job.meta_data without overwriting other attributes.
   * 3. Purge completed/failed queue_jobs database logs older than 7 days.
   */
  async executeDailyCleanup() {
    console.log('[CLEANUP SERVICE] Starting daily retention cleanup job...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      // 1. Query the Job model for Voice tasks older than 7 days that haven't been expired yet
      const expiredJobs = await Job.findAll({
        where: {
          type: 'Voice',
          created_at: {
            [Op.lt]: sevenDaysAgo
          },
          [Op.or]: [
            { output_url: { [Op.ne]: null } },
            { meta_data: { [Op.notLike]: '%"is_expired":true%' } }
          ]
        }
      });

      console.log(`[CLEANUP SERVICE] Found ${expiredJobs.length} expired voice jobs.`);

      // 2. Iterate and delete physical files non-blockingly
      for (const job of expiredJobs) {
        const filename = `AI_Studio_Voice_ID_${job.id}.mp3`;
        const absoluteFilePath = path.join(__dirname, '../../uploads/voices', filename);

        // Verify file existence using fs.existsSync
        if (fs.existsSync(absoluteFilePath)) {
          try {
            // Delete file using asynchronous fs.unlink from fs-extra
            await fs.unlink(absoluteFilePath);
            console.log(`[CLEANUP SERVICE] Deleted file for job #${job.id}: ${absoluteFilePath}`);
          } catch (fileErr) {
            console.error(`[CLEANUP SERVICE] Error unlinking file for job #${job.id}:`, fileErr.message);
          }
        }

        // Safe JSON meta_data update: preserve all existing keys and append is_expired safely
        let meta = job.meta_data;
        if (typeof meta === 'string') {
          try {
            meta = JSON.parse(meta);
          } catch (e) {
            console.error(`[CLEANUP SERVICE] Failed to parse meta_data for job #${job.id}:`, e.message);
            meta = {};
          }
        }
        const updatedMetadata = meta ? { ...meta } : {};
        updatedMetadata.is_expired = true;
        
        job.meta_data = updatedMetadata;
        job.output_url = null;
        await job.save();
      }

      // 3. Query QueueJob to find completed or failed rows older than 7 days
      const deletedQueueJobs = await QueueJob.destroy({
        where: {
          status: ['completed', 'failed'],
          created_at: {
            [Op.lt]: sevenDaysAgo
          }
        }
      });

      console.log(`[CLEANUP SERVICE] Purged ${deletedQueueJobs} historical QueueJob log entries.`);
      console.log('[CLEANUP SERVICE] Daily retention cleanup finished successfully.');

    } catch (error) {
      console.error('[CLEANUP SERVICE] Exception occurred during daily cleanup:', error.message);
      throw error;
    }
  }
}

module.exports = new CleanupService();
