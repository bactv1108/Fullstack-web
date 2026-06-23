const axios = require('axios');
const { Asset, SystemConfig } = require('../models');

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
 * Lấy ElevenLabs API key từ bảng system_configs.
 * Trả về null nếu không tìm thấy hoặc DB lỗi.
 */
const getElevenLabsKey = async () => {
  try {
    const configRow = await SystemConfig.findOne({ where: { key: 'elevenlabs_key' } });
    return (configRow && configRow.value) ? configRow.value.trim() : null;
  } catch (err) {
    console.error('[ASSET CONTROLLER] Không thể đọc elevenlabs_key từ DB:', err.message);
    return null;
  }
};

/**
 * POST /api/assets
 * Create a new asset record.
 * Nếu type=voice và identifier không chứa '-' (ElevenLabs Voice ID),
 * tự động gọi ElevenLabs API để lấy preview_url trước khi lưu DB.
 */
const createAsset = async (req, res) => {
  const { name, type, identifier, status } = req.body;
  if (!name || !type || !identifier) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng điền đầy đủ các thông tin: name, type, identifier.'
    });
  }

  // ── Tự động fetch preview_url từ ElevenLabs ──────────────────────────────
  let previewUrl = null;
  const isElevenLabsVoice = (type === 'voice' && !identifier.includes('-'));

  if (isElevenLabsVoice) {
    console.log(`[ASSET CONTROLLER] Phát hiện ElevenLabs Voice ID: "${identifier}". Đang lấy preview_url...`);

    const elevenLabsKey = await getElevenLabsKey();

    if (!elevenLabsKey) {
      console.warn('[ASSET CONTROLLER] Không có elevenlabs_key → bỏ qua fetch preview_url, previewUrl sẽ là null.');
    } else {
      try {
        const elevenLabsUrl = `https://api.elevenlabs.io/v1/voices/${identifier}`;
        console.log(`[ASSET CONTROLLER] Gọi ElevenLabs API: GET ${elevenLabsUrl}`);

        const { data: voiceData } = await axios.get(elevenLabsUrl, {
          headers: { 'xi-api-key': elevenLabsKey }
        });

        // ElevenLabs trả về trường preview_url ở root của object voice
        if (voiceData && voiceData.preview_url) {
          previewUrl = voiceData.preview_url;
          console.log(`[ASSET CONTROLLER] ✅ Lấy được preview_url: ${previewUrl}`);
        } else {
          console.warn(`[ASSET CONTROLLER] ElevenLabs API trả về thành công nhưng không có trường preview_url cho Voice ID "${identifier}".`);
        }
      } catch (elevenErr) {
        // Lỗi (key sai, ID sai, mất mạng...) → ghi log nhưng KHÔNG crash
        // Asset vẫn được tạo với previewUrl = null
        const errDetail = elevenErr.response?.data?.detail?.message
          || elevenErr.response?.data?.detail
          || elevenErr.message;
        console.error(`[ASSET CONTROLLER] ❌ Lấy preview_url từ ElevenLabs thất bại (Voice ID: "${identifier}"): ${errDetail}`);
        console.error('[ASSET CONTROLLER] Asset sẽ được tạo với preview_url = null.');
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const asset = await Asset.create({
      name,
      type,
      identifier,
      status: status || 'active',
      previewUrl   // null nếu không lấy được, hoặc URL CDN từ ElevenLabs
    });

    console.log(`[ASSET CONTROLLER] Tạo Asset thành công — ID: ${asset.id}, preview_url: ${previewUrl || 'null'}`);
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

