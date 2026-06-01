const express = require('express');
const router = express.Router();
const voicesController = require('../controllers/voices.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

router.get('/', authenticateJWT, voicesController.getVoices);
router.get('/elevenlabs', authenticateJWT, voicesController.getElevenLabsVoices);
router.get('/preview', voicesController.streamPreview);

module.exports = router;
