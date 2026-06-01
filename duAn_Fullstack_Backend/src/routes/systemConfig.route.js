const express = require('express');
const router = express.Router();
const { authenticateJWT, isAdmin } = require('../middlewares/auth.middleware');
const systemConfigController = require('../controllers/systemConfig.controller');

// Apply admin security authorization middlewares
router.use(authenticateJWT);
router.use(isAdmin);

router.get('/', systemConfigController.getConfigs);
router.put('/', systemConfigController.updateConfigs);

module.exports = router;
