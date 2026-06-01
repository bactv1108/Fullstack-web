const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('./src/models');

async function testImageAnalyzer() {
  try {
    console.log("=== BẮT ĐẦU KIỂM THỬ ENDPOINT MẮT THẦN AI ===");

    // 1. Kết nối cơ sở dữ liệu
    await db.sequelize.authenticate();
    console.log("✅ Kết nối Database thành công.");

    // 2. Lấy một User có sẵn trong DB để giả lập token
    const user = await db.User.findOne();
    if (!user) {
      console.log("❌ Không tìm thấy người dùng nào trong DB để test!");
      return;
    }
    console.log(`✅ Lấy thành công User test: ${user.name} (Email: ${user.email}, ID: ${user.id})`);

    // 3. Ký JWT Token test
    const tokenPayload = { id: user.id, role: user.role };
    const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
    const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '1h' });
    console.log("✅ Khởi tạo JWT Token thành công.");

    // 4. Chuẩn bị file ảnh test
    const testImagePath = 'D:/Fullstack-web/duAn_Fullstack_Frontend/src/assets/hero.png';
    if (!fs.existsSync(testImagePath)) {
      console.log("❌ Không tìm thấy file ảnh test tại D:/Fullstack-web/duAn_Fullstack_Frontend/src/assets/hero.png");
      return;
    }
    console.log("✅ Tìm thấy file ảnh test.");

    // 5. Chuẩn bị Request Body dạng FormData sử dụng API nguyên bản của Node.js (v22)
    const fileBuffer = fs.readFileSync(testImagePath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
    
    const formData = new FormData();
    formData.append('productImage', fileBlob, 'hero.png');

    console.log("🚀 Đang gửi request POST tới http://localhost:3000/api/image-analyzer/analyze-image...");

    // 6. Gửi request qua fetch API
    const response = await fetch('http://localhost:3000/api/image-analyzer/analyze-image', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const result = await response.json();
    console.log(`Status Code: ${response.status}`);
    console.log("Kết quả phản hồi từ API:", JSON.stringify(result, null, 2));

    // 7. Truy vấn lại DB để kiểm chứng trạng thái bản ghi
    if (result.success && result.data && result.data.id) {
      console.log("\n🔍 Đang đối chiếu trạng thái trong cơ sở dữ liệu...");
      const record = await db.ImageAnalysis.findByPk(result.data.id);
      console.log("Bản ghi trong MySQL:");
      console.log({
        id: record.id,
        user_id: record.user_id,
        image_name: record.image_name,
        status: record.status,
        input_tokens: record.input_tokens,
        output_tokens: record.output_tokens,
        error_message: record.error_message
      });
      
      if (record.status === 'success') {
        console.log("\n🎉 KẾT QUẢ: KIỂM THỬ THÀNH CÔNG 100%!");
      } else {
        console.log("\n❌ KẾT QUẢ: Bản ghi trong DB thất bại!");
      }
    } else {
      console.log("\n❌ KẾT QUẢ: Gọi API thất bại!");
    }

  } catch (error) {
    console.error("❌ Đã xảy ra lỗi trong quá trình kiểm thử:", error);
  } finally {
    await db.sequelize.close();
    console.log("=== KẾT THÚC KIỂM THỬ ===");
  }
}

testImageAnalyzer();
