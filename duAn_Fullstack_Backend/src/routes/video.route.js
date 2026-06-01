const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');
const videoController = require('../controllers/video.controller');

// Generate route secured by authenticateJWT
router.post('/generate', authenticateJWT, videoController.generateVideo);

// Public webhook route
router.post('/webhook', videoController.handleWebhook);

module.exports = router;
