const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticateJWT } = require('../middlewares/auth.middleware');

// Apply token authentication middleware
router.use(authenticateJWT);

router.get('/profile', userController.getProfile);
router.get('/history', userController.getHistory);
router.post('/jobs', userController.createJob);
router.put('/settings', userController.updateSettings);
router.delete('/jobs/:id', userController.deleteJob);

module.exports = router;
