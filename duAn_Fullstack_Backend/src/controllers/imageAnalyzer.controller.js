const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ImageAnalysis, SystemConfig } = require('../models');

const analyzeProductImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file ảnh sản phẩm (productImage).' });
  }

  const userId = req.user ? req.user.id : null;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
  }

  const originalName = req.file.originalname;
  const fileSize = req.file.size;
  const mimeType = req.file.mimetype;
  const imageRelativePath = `/uploads/images/${req.file.filename}`;
  let analysisRecord = null;

  try {
    // 1. Tạo bản ghi ban đầu chuẩn snake_case
    analysisRecord = await ImageAnalysis.create({
      user_id: userId,
      image_name: originalName,
      image_path: imageRelativePath,
      mime_type: mimeType,
      file_size: fileSize,
      status: 'processing'
    });

    // 2. Lấy API Key động từ DB
    const dbRecord = await SystemConfig.findByPk('gemini_api_key');
    const apiKey = (dbRecord && dbRecord.value) ? dbRecord.value : process.env.GEMINI_API_KEY;

    console.log("👉 [CHECK KEY ACTUALLY USED]:", apiKey ? apiKey.substring(0, 10) + "..." : "NO KEY");

    if (!apiKey) {
      throw new Error('Gemini API Key chưa được cấu hình!');
    }

    // 3. Đọc ảnh chuyển Base64
    const imageFilePath = req.file.path;
    if (!fs.existsSync(imageFilePath)) {
      throw new Error('Không tìm thấy file ảnh vật lý trên máy chủ.');
    }
    const imageBuffer = fs.readFileSync(imageFilePath);
    const base64Data = imageBuffer.toString('base64');

    // 4. System Prompt chuẩn Vibe hệ thống
    const systemPrompt = `Bạn là một Chuyên gia Phân tích Hình ảnh Sản phẩm và Biên kịch Kịch bản Quảng cáo Video hàng đầu. Hãy bóc tách hình ảnh sản phẩm được cung cấp để tạo ra một kịch bản/prompt quay video quảng cáo chi tiết bằng Tiếng Việt định dạng Markdown: 1. Phân tích Sản phẩm & Chất liệu. 2. Kịch bản Quay Phim Chi Tiết (Storyboard 3-4 phân cảnh góc quay Cinematic 4K, khung dọc 9:16, bối cảnh gọn gàng sàn gỗ/thảm, phong cách clean-lifestyle, nam tính nhẹ nhàng). 3. Prompt sinh Video bằng tiếng Anh (60-80 từ) cho Runway/Sora.`;

    // 5. Gọi REST API thuần túy - CƯỠNG CHẾ CỔNG /v1/ và sử dụng model gemini-2.0-flash có sẵn trong hệ thống
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [
          { text: systemPrompt },
          { inlineData: { mimeType: mimeType, data: base64Data } }
        ]
      }]
    };

    console.log(`[MAT THAN AI] Đang bắn REST API cổng v1 chuẩn...`);
    const response = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });

    if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
      throw new Error('Không nhận được kết quả hợp lệ từ Gemini API.');
    }

    const promptText = response.data.candidates[0].content.parts[0].text;
    const inputTokensCount = response.data.usageMetadata?.promptTokenCount || null;
    const outputTokensCount = response.data.usageMetadata?.candidatesTokenCount || null;

    // 6. Cập nhật DB thành công
    await analysisRecord.update({
      status: 'success',
      prompt_output: promptText,
      input_tokens: inputTokensCount,
      output_tokens: outputTokensCount
    });

    return res.status(200).json({
      success: true,
      message: 'Phân tích hình ảnh sản phẩm thành công!',
      data: {
        id: analysisRecord.id,
        prompt_output: promptText
      }
    });

  } catch (error) {
    console.error('[MAT THAN AI ERROR]:', error.response?.data || error.message);
    const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
    
    if (analysisRecord) {
      await analysisRecord.update({
        status: 'failed',
        error_message: errorDetail
      });
    }
    return res.status(500).json({ success: false, message: 'Có lỗi xảy ra', error: error.message });
  }
};

module.exports = { analyzeProductImage };
