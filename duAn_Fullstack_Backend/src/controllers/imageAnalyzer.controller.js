const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { ImageAnalysis, SystemConfig, User } = require('../models');

const analyzeProductImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Vui lòng cung cấp file ảnh sản phẩm (productImage).' });
  }

  const userId = req.user ? req.user.id : null;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
  }

  const user = await User.findByPk(userId);
  if (!user || user.credits < 20) {
    return res.status(400).json({ success: false, message: 'Tài khoản của bạn không đủ credit (Cần tối thiểu 20 credits) để kích hoạt Mắt Thần AI. Vui lòng nạp thêm!' });
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

    // 2. Lấy OpenRouter API Key từ ENV
    const openrouterApiKey = process.env.OPENROUTER_API_KEY;

    console.log("👉 [OPENROUTER API KEY CHECK]:", openrouterApiKey ? openrouterApiKey.substring(0, 10) + "..." : "NO KEY");

    if (!openrouterApiKey) {
      throw new Error('OpenRouter API Key chưa được cấu hình trong OPENROUTER_API_KEY!');
    }

    // 3. Đọc ảnh chuyển Base64
    const imageFilePath = req.file.path;
    if (!fs.existsSync(imageFilePath)) {
      throw new Error('Không tìm thấy file ảnh vật lý trên máy chủ.');
    }
    const imageBuffer = fs.readFileSync(imageFilePath);
    const base64Data = imageBuffer.toString('base64');

    // 4. System Prompt với các quy tắc văn bản thuần túy không chứa markdown
    const systemPrompt =
      `Bạn là một Chuyên gia Phân tích Hình ảnh Sản phẩm và Biên kịch Kịch bản Quảng cáo Video hàng đầu.
Hãy bóc tách hình ảnh sản phẩm được cung cấp để tạo ra một kịch bản/prompt quay video quảng cáo chi tiết bằng Tiếng Việt.

Cấu trúc kịch bản phân tích gồm 3 phần chính:
1. PHÂN TÍCH SẢN PHẨM VÀ CHẤT LIỆU
2. KỊCH BẢN QUAY PHIM CHI TIẾT (Storyboard 3-4 phân cảnh góc quay Cinematic 4K, khung dọc 9:16, bối cảnh gọn gàng sàn gỗ/thảm, phong cách clean-lifestyle, nam tính nhẹ nhàng)
3. PROMPT SINH VIDEO BẰNG TIẾNG ANH (60-80 từ) CHO RUNWAY/SORA

⚠️ QUY TẮC ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (STRICT TEXT FORMATTING):
1. TUYỆT ĐỐI KHÔNG SỬ DỤNG KÝ TỰ MARKDOWN:
- Cấm tuyệt đối xuất hiện các ký tự * hoặc ** ở bất kỳ đâu trong văn bản (kể cả bôi đậm tiêu đề hay nhấn mạnh từ khóa).
- Cấm tuyệt đối sử dụng các dấu #, ##, ### để phân cấp tiêu đề đoạn.
- Cấm tuyệt đối dùng dấu gạch đầu dòng dạng - hoặc * cho các danh sách liệt kê.

2. CƠ CHẾ THAY THẾ BẰNG VĂN BẢN THUẦN (PLAIN TEXT ONLY):
- Thay vì viết ## 1. Phân tích Sản phẩm, hãy VIẾT HOA TOÀN BỘ TIÊU ĐỀ: 1. PHÂN TÍCH SẢN PHẨM VÀ CHẤT LIỆU.
- Sử dụng hai dấu xuống dòng liên tiếp (\n\n) để phân tách rõ ràng, rành mạch giữa các đoạn văn và tiêu đề lớn.
- Thay vì viết **Chất liệu:** Vải thun mỏng, hãy viết theo dạng văn bản thuần có dấu hai chấm bình thường: Chất liệu: Vải thun mỏng.
- Thay vì dùng dấu chấm tròn bullet point rác, hãy sử dụng số thứ tự thuần túy (1., 2., 3.) hoặc viết thành các câu văn liền mạch.

3. MỤC TIÊU ĐẦU RA: Nội dung trả về phải là một chuỗi ký tự sạch sẽ 100%, mượt mà, sẵn sàng để người dùng bấm nút "SAO CHÉP TOÀN BỘ KỊCH BẢN" và dán ăn ngay vào các ứng dụng khác như CapCut hay Facebook mà không cần chỉnh sửa bất kỳ cái gì.`;

    // 5. Gọi OpenRouter API sử dụng Gemini Flash 1.5 qua chuẩn OpenAI Vision
    const url = 'https://openrouter.ai/api/v1/chat/completions';
    
    const requestBody = {
      model: 'google/gemini-flash-1.5',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: systemPrompt + '\n\nHãy phân tích hình ảnh này thật chi tiết.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ]
        }
      ]
    };

    console.log(`[MAT THAN AI] Đang bắn request tới OpenRouter API (google/gemini-flash-1.5)...`);
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${openrouterApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('Không nhận được kết quả hợp lệ từ OpenRouter API.');
    }

    const promptText = response.data.choices[0].message.content;
    const inputTokensCount = response.data.usage?.prompt_tokens || null;
    const outputTokensCount = response.data.usage?.completion_tokens || null;

    await user.decrement('credits', { by: 20 });

    // 6. Cập nhật DB thành công
    await analysisRecord.update({
      status: 'success',
      prompt_output: promptText,
      input_tokens: inputTokensCount,
      output_tokens: outputTokensCount
    });

    // Fetch full record with owner info để gửi via Socket.io
    const updatedRecord = await ImageAnalysis.findByPk(analysisRecord.id, {
      include: [{
        model: User,
        as: 'owner',
        attributes: ['id', 'name', 'email']
      }]
    });

    // Emit real-time update via Socket.io
    const io = req.io;
    if (io) {
      io.emit('image_analysis:updated', updatedRecord.toJSON());
      console.log(`[SOCKET.IO] Emitted 'image_analysis:updated' for analysis ID: ${analysisRecord.id}`);
    }

    // Explicit notification insertion on success
    try {
      const { Notification } = require('../models');
      const notificationEmitter = require('../utils/notificationEmitter');

      const mtSuccessNotif = await Notification.create({
        userId: userId,
        title: 'Mắt thần AI hoàn tất ✓',
        message: 'Tác vụ phân tích hình ảnh bằng Mắt thần AI của bạn đã hoàn thành.',
        type: 'info',
        is_read: false
      });
      // Bắn tín hiệu real-time về client của user qua SSE Gateway
      notificationEmitter.emit('send_notification', mtSuccessNotif);
      console.log('[MAT THAN SUCCESS] Đã ghi DB và phát thông báo phân tích ảnh thành công.');
    } catch (notifErr) {
      console.error('[MAT THAN SUCCESS] Explicit notification insert error:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Phân tích hình ảnh sản phẩm thành công! (Đã trừ 20 credits)',
      data: {
        id: analysisRecord.id,
        prompt_output: promptText,
        input_tokens: inputTokensCount,
        output_tokens: outputTokensCount,
        current_credits: user.credits - 20
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

      // Fetch full record with owner info để gửi via Socket.io
      const failedRecord = await ImageAnalysis.findByPk(analysisRecord.id, {
        include: [{
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email']
        }]
      });

      // Emit real-time update via Socket.io
      const io = req.io;
      if (io) {
        io.emit('image_analysis:updated', failedRecord.toJSON());
        console.log(`[SOCKET.IO] Emitted 'image_analysis:updated' (FAILED) for analysis ID: ${analysisRecord.id}`);
      }

      // Bắn thông báo lỗi real-time về Admin Dashboard
      if (req.app && req.app.emitAdminNotification) {
        const errorUser = await User.findByPk(userId, { attributes: ['id', 'name', 'email'] });
        req.app.emitAdminNotification({
          title: 'Lỗi Mắt Thần AI ✗',
          content: `Phân tích ảnh "${originalName}" của "${errorUser?.name || 'User #' + userId}" thất bại: ${error.message}`,
          type: 'error'
        });
      }
    }
    return res.status(500).json({ success: false, message: 'Có lỗi xảy ra', error: error.message });
  }
};

const getAnalysisDetail = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Người dùng chưa đăng nhập hoặc token không hợp lệ.' });
    }
    const { id } = req.params;
    const record = await ImageAnalysis.findOne({
      where: { id, user_id: userId }
    });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi phân tích ảnh.' });
    }
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    console.error('[GET ANALYSIS DETAIL ERROR]:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
  }
};

module.exports = { analyzeProductImage, getAnalysisDetail };
