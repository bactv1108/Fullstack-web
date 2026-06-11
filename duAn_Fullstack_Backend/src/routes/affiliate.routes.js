const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');
const affiliateController = require('../controllers/affiliate.controller');

// Tạm thời đóng băng endpoint Affiliate của Backend
// router.post('/process', authenticateJWT, affiliateController.processAffiliateLink);

module.exports = router;
