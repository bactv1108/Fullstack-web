const { SystemConfig } = require('../models');

const getConfigs = async (req, res) => {
  try {
    const huggingfaceRow = await SystemConfig.findByPk('huggingface_token');
    const elevenlabsRow = await SystemConfig.findByPk('elevenlabs_key');
    const geminiRow = await SystemConfig.findByPk('gemini_api_key');

    return res.status(200).json({
      success: true,
      data: {
        huggingface_token: huggingfaceRow ? huggingfaceRow.value : '',
        elevenlabs_api_key: elevenlabsRow ? elevenlabsRow.value : '',
        gemini_api_key: geminiRow ? geminiRow.value : ''
      }
    });
  } catch (error) {
    console.error('[SYSTEM CONFIG CONTROLLER] getConfigs error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi hệ thống khi tải cấu hình API Keys.' 
    });
  }
};

const updateConfigs = async (req, res) => {
  try {
    const { huggingface_token, elevenlabs_api_key, gemini_api_key } = req.body;

    if (huggingface_token !== undefined) {
      await SystemConfig.upsert({ key: 'huggingface_token', value: huggingface_token });
    }
    if (elevenlabs_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'elevenlabs_key', value: elevenlabs_api_key });
    }
    if (gemini_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'gemini_api_key', value: gemini_api_key });
    }

    return res.status(200).json({
      success: true,
      message: "Configs updated successfully"
    });
  } catch (error) {
    console.error('[SYSTEM CONFIG CONTROLLER] updateConfigs error:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi hệ thống khi cập nhật API Keys.' 
    });
  }
};

module.exports = {
  getConfigs,
  updateConfigs
};
