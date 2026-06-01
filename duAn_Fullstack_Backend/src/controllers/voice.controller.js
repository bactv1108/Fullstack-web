const { Asset } = require('../models');

const getVoices = async (req, res) => {
  try {
    const { lang } = req.query;
    console.log(`[VOICES CONTROLLER] Retrieving local voice assets from database... Filter language: ${lang || 'ALL'}`);
    
    // Set query conditions
    const whereClause = {
      type: 'voice',
      status: 'active'
    };
    if (lang) {
      whereClause.language = lang;
    }

    // Query active voice assets from assets database table
    const assets = await Asset.findAll({
      where: whereClause,
      order: [['id', 'DESC']]
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Format array output to expose: id, name, voice_id (identifier), preview_url, and language
    const formattedVoices = assets.map(asset => {
      const voice_id = asset.identifier;
      
      let preview_url = null;
      if (asset.previewUrl) {
        if (asset.previewUrl.startsWith('http')) {
          preview_url = asset.previewUrl;
        } else {
          // Prepend server base URL to relative path
          preview_url = `${baseUrl}${asset.previewUrl}`;
        }
      }

      return {
        id: asset.id,
        name: asset.name,
        voice_id: voice_id,
        preview_url: preview_url,
        language: asset.language
      };
    });

    return res.status(200).json(formattedVoices);
  } catch (error) {
    console.error("[VOICES CONTROLLER] Failed to fetch assets voices:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi tải danh sách giọng nói từ cơ sở dữ liệu."
    });
  }
};

const getElevenLabsVoices = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: [],
    voices: []
  });
};

const streamPreview = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "ElevenLabs preview proxy is disabled."
  });
};

module.exports = {
  getVoices,
  getElevenLabsVoices,
  streamPreview
};
