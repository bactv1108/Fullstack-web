const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');
const imageController = require('../controllers/image.controller');

router.post('/generate', authenticateJWT, imageController.generateImage);
router.get('/history', authenticateJWT, imageController.getImageHistory);
router.delete('/:id', authenticateJWT, imageController.deleteImageJob);

module.exports = router;

