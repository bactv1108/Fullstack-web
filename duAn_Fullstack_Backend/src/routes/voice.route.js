const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voices.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

router.get('/', authenticateJWT, voiceController.getVoices);
router.get('/elevenlabs', authenticateJWT, voiceController.getElevenLabsVoices);
router.get('/preview', voiceController.streamPreview);

module.exports = router;
