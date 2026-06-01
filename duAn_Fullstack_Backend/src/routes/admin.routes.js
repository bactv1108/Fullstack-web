const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
// Removed systemConfigController import as it's registered in server.js
const { authenticateJWT, isAdmin } = require('../middlewares/auth.middleware');
const { adminLimiter } = require('../middlewares/rate-limiter.middleware');

// Apply common admin security middlewares to all endpoints
router.use(adminLimiter);
router.use(authenticateJWT);
router.use(isAdmin);

// Dashboard Statistics
router.get('/dashboard/stats', adminController.getDashboardStats);

// Billing Configurations (Plans & Transactions)
router.get('/billing/plans', adminController.getBillingPlans);
router.put('/billing/plans', adminController.updateBillingPlans);
router.get('/billing/transactions', adminController.getBillingTransactions);

// API Configuration Keys
router.get('/config/keys', adminController.getApiKeys);
router.put('/config/keys', adminController.updateApiKeys);
// System configs routes have been migrated to src/routes/systemConfig.route.js and registered in server.js



// Content Moderation (Blacklist)
router.get('/moderation/blacklist', adminController.getBlacklist);
router.post('/moderation/blacklist', adminController.addWordToBlacklist);
router.delete('/moderation/blacklist', adminController.removeWordFromBlacklist);

// Client User Operations
router.get('/users', adminController.getUsers);
router.put('/users/:id/credits', adminController.updateUserCredits);
router.put('/users/:id/status', adminController.updateUserStatus);

// System & Resources
router.get('/system/queue', adminController.getQueueStatus);
router.get('/system/costs', adminController.getApiCosts);
router.get('/system/credits', adminController.getCreditStats);
router.get('/image-analyses', adminController.getImageAnalyses);

module.exports = router;
