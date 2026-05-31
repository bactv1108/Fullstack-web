const cron = require('node-cron');
const queueService = require('./queue.service');
const { QueueJob, ApiCost, CreditStat } = require('../models');
const { Op } = require('sequelize');

/**
 * Initialize all Node-Cron intervals
 */
const startScheduler = () => {
  console.log('[SCHEDULER] Scheduler service initialized.');

  // 1. Cron interval at */10 * * * * * (Every 10 seconds): Execute queueService.processWorker()
  cron.schedule('*/10 * * * * *', async () => {
    try {
      // Auto-enqueue render task to keep the admin queue progress active
      await queueService.enqueue('render_task', { timestamp: Date.now() });
      await queueService.processWorker();
    } catch (err) {
      console.error('[SCHEDULER] Error executing 10s queue worker:', err.message);
    }
  });

  // 2. Cron interval at 0 * * * * (Every hour): Delete completed or failed queue logs older than 24 hours
  cron.schedule('0 * * * *', async () => {
    console.log('[SCHEDULER] Running hourly queue cleanup...');
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deletedRows = await QueueJob.destroy({
        where: {
          status: ['completed', 'failed'],
          updatedAt: { [Op.lt]: yesterday }
        }
      });
      console.log(`[SCHEDULER] Cleaned up ${deletedRows} old queue jobs.`);
    } catch (err) {
      console.error('[SCHEDULER] Queue cleanup error:', err.message);
    }
  });

  // 3. Cron interval at 0 0 * * * (Every day at midnight): fluctuate API costs and aggregate credit statistics
  cron.schedule('0 0 * * *', async () => {
    console.log('[SCHEDULER] Running daily system stats fluctuations...');
    try {
      // Fluctuate API costs slightly
      const costs = await ApiCost.findAll();
      for (const costRecord of costs) {
        const fluctuation = (Math.random() - 0.5) * 5;
        costRecord.cost = Math.max(0.5, parseFloat(costRecord.cost) + fluctuation);
        await costRecord.save();
      }

      // Sync monthly statistics
      const currentMonthStr = new Date().toLocaleString('en-US', { month: 'short' });
      const [statRow] = await CreditStat.findOrCreate({
        where: { month: currentMonthStr },
        defaults: { creditsUsed: 1000, creditsPurchased: 2000 }
      });

      statRow.creditsUsed += Math.floor(Math.random() * 150) + 50;
      statRow.creditsPurchased += Math.floor(Math.random() * 200) + 100;
      await statRow.save();

      console.log('[SCHEDULER] Daily statistics updated.');
    } catch (err) {
      console.error('[SCHEDULER] Daily metrics update error:', err.message);
    }
  });
};

module.exports = {
  startScheduler
};
