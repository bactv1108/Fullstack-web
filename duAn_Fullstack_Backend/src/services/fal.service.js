const { SystemConfig } = require('../models');

/**
 * Cổng gọi API Hugging Face - Sử dụng NATIVE FETCH CỦA NODEJS (Bỏ hoàn toàn Axios)
 * Thần tốc, ăn khớp 100% với WARP, giải quyết triệt để lỗi mạng ENOTFOUND bướng bỉnh trên Windows.
 */
async function generateImageWithFlux(prompt, aspect_ratio = '1:1') {
  try {
    console.log(`[HF NATIVE FETCH] 🚀 Đang gửi prompt qua luồng mạng sạch: "${prompt}"`);

    // Bốc Key động từ cấu hình hệ thống Admin xịn mịn của bro
    const huggingfaceRow = await SystemConfig.findByPk('huggingface_token');
    const apiKey = (huggingfaceRow ? huggingfaceRow.value : null) || process.env.HUGGING_FACE_TOKEN || process.env.FAL_KEY;
    
    if (!apiKey) {
      throw new Error("Chưa tìm thấy API Key Hugging Face trong cấu hình Admin");
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
    throw new Error("Server AI đang bận hoặc lỗi kết nối: " + error.message);
  }
}

module.exports = { generateImageWithFlux };