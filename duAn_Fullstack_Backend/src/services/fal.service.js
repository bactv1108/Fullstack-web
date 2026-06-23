const { SystemConfig } = require('../models');

/**
 * Cổng gọi API Hugging Face - Sử dụng NATIVE FETCH CỦA NODEJS (Bỏ hoàn toàn Axios)
 * Thần tốc, ăn khớp 100% với WARP, giải quyết triệt để lỗi mạng ENOTFOUND bướng bỉnh trên Windows.
 *
 * Ưu tiên đọc key theo thứ tự:
 *  1. Cột `fal_api_key` trong bảng system_configs (do Admin lưu từ trang /api-resources)
 *  2. Biến môi trường FAL_KEY trong file .env
 *  3. Biến môi trường HUGGING_FACE_TOKEN trong file .env (fallback legacy)
 */
async function generateImageWithFlux(prompt, aspect_ratio = '1:1') {
  try {
    console.log(`[HF NATIVE FETCH] 🚀 Đang gửi prompt qua luồng mạng sạch: "${prompt}"`);

    // Bốc Fal API Key động từ bảng system_configs, key = 'fal_api_key'
    const falRow = await SystemConfig.findByPk('fal_api_key');
    const apiKey = (falRow ? falRow.value : null) || process.env.FAL_KEY || process.env.HUGGING_FACE_TOKEN;

    if (!apiKey) {
      throw new Error('Chưa tìm thấy Fal API Key. Vui lòng cấu hình tại trang Tài nguyên API trong Admin.');
    }

    const targetUrl = 'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0';

    // Sử dụng native fetch của hệ điều hành (Bỏ qua hoàn toàn đống lỗi socket binding của Axios)
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ inputs: prompt })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server AI trả về lỗi (${response.status}): ${errorText}`);
    }

    // Đọc dữ liệu nhị phân trực tiếp từ luồng fetch mạng
    const arrayBuffer = await response.arrayBuffer();

    // Chuyển đổi thành Buffer để trả về đúng đặc tả cho Controller ghi đĩa local (.png)
    const buffer = Buffer.from(arrayBuffer);

    console.log('[HF NATIVE FETCH] 🎉 Xuất ảnh thành công từ server AI!');
    return {
      isBuffer: true,
      buffer: buffer
    };

  } catch (error) {
    console.error('[HF NATIVE FETCH ERROR]:', error.message);
    throw new Error('Server AI đang bận hoặc lỗi kết nối: ' + error.message);
  }
}

module.exports = { generateImageWithFlux };