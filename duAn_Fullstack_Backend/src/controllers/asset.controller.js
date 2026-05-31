const { Asset } = require('../models');

/**
 * GET /api/assets
 * Retrieve list of all system assets, optionally filtered by type.
 */
const getAllAssets = async (req, res) => {
  try {
    const whereClause = {};
    if (req.query.type) {
      whereClause.type = req.query.type;
    }

    const assets = await Asset.findAll({
      where: whereClause,
      order: [['id', 'DESC']]
    });
    return res.status(200).json({ success: true, assets });
  } catch (error) {
    console.error('[ASSET CONTROLLER] getAllAssets error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/assets
 * Create a new asset record
 */
const createAsset = async (req, res) => {
  const { name, type, identifier, status } = req.body;
  if (!name || !type || !identifier) {
    return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin: name, type, identifier.' });
  }

  try {
    const asset = await Asset.create({
      name,
      type,
      identifier,
      status: status || 'active'
    });
    return res.status(201).json({ success: true, asset });
  } catch (error) {
    console.error('[ASSET CONTROLLER] createAsset error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/assets/:id
 * Update an existing asset record
 */
const updateAsset = async (req, res) => {
  const { id } = req.params;
  const { name, type, identifier, status } = req.body;
  console.log('[DEBUG UPDATE] id:', id, 'body:', req.body);

  try {
    const asset = await Asset.findByPk(id);
    if (!asset) {
      console.log('[DEBUG UPDATE] Asset not found in database for id:', id);
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài nguyên.' });
    }

    await asset.update({
      name: name !== undefined ? name : asset.name,
      type: type !== undefined ? type : asset.type,
      identifier: identifier !== undefined ? identifier : asset.identifier,
      status: status !== undefined ? status : asset.status
    });

    console.log('[DEBUG UPDATE] Asset updated successfully:', asset.toJSON());
    return res.status(200).json({ success: true, asset });
  } catch (error) {
    console.error('[ASSET CONTROLLER] updateAsset error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/assets/:id
 * Delete an existing asset record
 */
const deleteAsset = async (req, res) => {
  const { id } = req.params;
  console.log('[DEBUG DELETE] id:', id);

  try {
    const asset = await Asset.findByPk(id);
    if (!asset) {
      console.log('[DEBUG DELETE] Asset not found in database for id:', id);
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài nguyên.' });
    }

    await asset.destroy();
    console.log('[DEBUG DELETE] Asset deleted successfully for id:', id);
    return res.status(200).json({ success: true, message: 'Xóa tài nguyên thành công' });
  } catch (error) {
    console.error('[ASSET CONTROLLER] deleteAsset error:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllAssets,
  createAsset,
  updateAsset,
  deleteAsset
};

