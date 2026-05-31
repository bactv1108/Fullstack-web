const express = require('express');
const router = express.Router();
const assetController = require('../controllers/asset.controller');
const { authenticateJWT, isAdmin } = require('../middlewares/auth.middleware');

// Log all incoming requests to asset routes
router.use((req, res, next) => {
  console.log(`[DEBUG ROUTER] Request: ${req.method} ${req.originalUrl || req.url}`);
  next();
});

// Change router paths exactly as instructed
router.get('/', assetController.getAllAssets);
router.post('/', authenticateJWT, isAdmin, assetController.createAsset);
router.put('/:id', authenticateJWT, isAdmin, assetController.updateAsset);
router.delete('/:id', authenticateJWT, isAdmin, assetController.deleteAsset);

module.exports = router;

