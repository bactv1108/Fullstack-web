const { SystemConfig } = require('../models');

// ─── Danh sách các key bắt buộc phải tồn tại trong DB ────────────────────────
const REQUIRED_KEYS = [
  'openai_api_key',
  'elevenlabs_key',
  'gemini_api_key',
  'fal_api_key',
  'openrouter_api_key',
];

/**
 * Auto-migration: Đảm bảo tất cả key bắt buộc tồn tại trong bảng system_configs.
 * Nếu chưa có, tự động INSERT dòng mới với value rỗng.
 * Gọi hàm này một lần khi server khởi động hoặc khi load trang config lần đầu.
 */
const ensureRequiredRows = async () => {
  for (const key of REQUIRED_KEYS) {
    const existing = await SystemConfig.findByPk(key);
    if (!existing) {
      await SystemConfig.create({ key, value: '' });
      console.log(`[SYSTEM CONFIG] 🟢 Đã tự động tạo dòng mới trong DB: key="${key}"`);
    }
  }
};

// ─── GET /system-configs ──────────────────────────────────────────────────────
const getConfigs = async (req, res) => {
  try {
    // Đảm bảo các dòng key bắt buộc đã tồn tại trước khi đọc
    await ensureRequiredRows();

    const openaiRow        = await SystemConfig.findByPk('openai_api_key');
    const elevenlabsRow    = await SystemConfig.findByPk('elevenlabs_key');
    const geminiRow        = await SystemConfig.findByPk('gemini_api_key');
    const falRow           = await SystemConfig.findByPk('fal_api_key');
    const openrouterRow    = await SystemConfig.findByPk('openrouter_api_key');

    return res.status(200).json({
      success: true,
      data: {
        openai_api_key:      openaiRow        ? openaiRow.value        : '',
        elevenlabs_api_key:  elevenlabsRow    ? elevenlabsRow.value    : '',
        gemini_api_key:      geminiRow        ? geminiRow.value        : '',
        fal_api_key:         falRow           ? falRow.value           : '',
        openrouter_api_key:  openrouterRow    ? openrouterRow.value    : '',
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

// ─── PUT /system-configs ──────────────────────────────────────────────────────
const updateConfigs = async (req, res) => {
  try {
    const {
      openai_api_key,
      elevenlabs_api_key,
      gemini_api_key,
      fal_api_key,
      openrouter_api_key,
    } = req.body;

    // Đảm bảo các dòng key bắt buộc đã tồn tại trước khi upsert
    await ensureRequiredRows();

    if (openai_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'openai_api_key', value: openai_api_key });
      console.log('[SYSTEM CONFIG] ✅ Đã lưu openai_api_key vào DB.');
    }
    if (elevenlabs_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'elevenlabs_key', value: elevenlabs_api_key });
      console.log('[SYSTEM CONFIG] ✅ Đã lưu elevenlabs_key vào DB.');
    }
    if (gemini_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'gemini_api_key', value: gemini_api_key });
      console.log('[SYSTEM CONFIG] ✅ Đã lưu gemini_api_key vào DB.');
    }
    if (fal_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'fal_api_key', value: fal_api_key });
      console.log('[SYSTEM CONFIG] ✅ Đã lưu fal_api_key vào DB.');
    }
    if (openrouter_api_key !== undefined) {
      await SystemConfig.upsert({ key: 'openrouter_api_key', value: openrouter_api_key });
      console.log('[SYSTEM CONFIG] ✅ Đã lưu openrouter_api_key vào DB.');
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật API Keys thành công!'
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
  updateConfigs,
};
