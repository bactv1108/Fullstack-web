const nodemailer = require('nodemailer');
require('dotenv').config();

// Khởi tạo bộ cấu hình gửi thư sử dụng thư viện Nodemailer
const emailTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465', 10),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Tự động kiểm tra trạng thái kết nối tới máy chủ SMTP khi khởi chạy hệ thống
emailTransporter.verify((error, success) => {
  if (error) {
    console.error('[EMAIL SERVICE ERROR] Kết nối tới cổng gửi thư SMTP thất bại:', error.message);
    if (process.env.EMAIL_HOST && process.env.EMAIL_HOST.includes('gmail.com')) {
      console.warn(
        '[GMAIL SECURITY WARNING] Nếu sử dụng Gmail, vui lòng đảm bảo rằng biến EMAIL_PASS là Mật khẩu ứng dụng (Google App Password) gồm mười sáu (16) ký tự, không phải mật khẩu chính của tài khoản.'
      );
    }
  } else {
    console.log('[EMAIL SERVICE SUCCESS] Cổng kết nối gửi thư SMTP đã sẵn sàng hoạt động.');
  }
});

/**
 * Hàm bất đồng bộ gửi email xác thực tài khoản với giao diện tối (Dark Mode) chuyên nghiệp
 * @param {string} toEmail - Địa chỉ email người nhận
 * @param {string} activationUrl - Đường dẫn kích hoạt tài khoản
 * @param {string} recipientName - Tên người nhận
 */
const sendVerificationEmail = async (toEmail, activationUrl, recipientName) => {
  const mailOptions = {
    from: `"Fullstack App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Kích hoạt tài khoản của bạn',
    html: `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; padding: 40px; background-color: #0c0a09; border-radius: 16px; border: 1px solid #292524; color: #f5f5f4; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.05em; color: #f59e0b;">
            FULLSTACK APP
          </span>
        </div>
        
        <h2 style="font-size: 20px; font-weight: 600; color: #fafaf9; margin-top: 0; margin-bottom: 16px;">
          Xin chào ${recipientName || 'Bạn'},
        </h2>
        
        <p style="font-size: 15px; line-height: 1.6; color: #d6d3d1; margin-bottom: 24px;">
          Cảm ơn bạn đã lựa chọn đăng ký tài khoản trên hệ thống của chúng tôi. Để hoàn tất quy trình thiết lập tài khoản và bắt đầu trải nghiệm dịch vụ, vui lòng xác thực địa chỉ email của bạn bằng cách nhấn vào liên kết bên dưới.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${activationUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #0c0a09; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.2), 0 2px 4px -1px rgba(245, 158, 11, 0.1); transition: all 0.2s ease-in-out;">
            Xác thực tài khoản ngay
          </a>
        </div>
        
        <p style="font-size: 13px; line-height: 1.5; color: #78716c; margin-top: 32px; border-top: 1px solid #1c1917; padding-top: 20px;">
          Liên kết xác thực này sẽ có hiệu lực trong vòng <strong>hai mươi tư (24) giờ</strong> kể từ lúc email này được gửi đi. Nếu bạn không thực hiện yêu cầu đăng ký này, vui lòng an tâm bỏ qua email này.
        </p>
        
        <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #57534e;">
          © ${new Date().getFullYear()} Fullstack App. Mọi quyền được bảo lưu.
        </div>
      </div>
    `,
  };

  try {
    const sendResult = await emailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Email xác thực đã được gửi tới ${toEmail} thành công. Message ID: ${sendResult.messageId}`);
    return sendResult;
  } catch (emailServiceError) {
    console.error(`[EMAIL SERVICE ERROR] Gặp lỗi khi gửi email tới ${toEmail}:`, emailServiceError.message);
    throw emailServiceError;
  }
};

/**
 * Hàm bất đồng bộ gửi email đặt lại mật khẩu với giao diện tối (Dark Mode) chuyên nghiệp
 * @param {string} toEmail - Địa chỉ email người nhận
 * @param {string} resetUrl - Đường dẫn đặt lại mật khẩu
 * @param {string} recipientName - Tên người nhận
 */
const sendForgotPasswordEmail = async (toEmail, resetUrl, recipientName) => {
  const mailOptions = {
    from: `"Fullstack App" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Đặt lại mật khẩu của bạn',
    html: `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; padding: 40px; background-color: #0c0a09; border-radius: 16px; border: 1px solid #292524; color: #f5f5f4; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.5);">
        <div style="text-align: center; margin-bottom: 32px;">
          <span style="font-size: 24px; font-weight: 800; letter-spacing: 0.05em; color: #f59e0b;">
            FULLSTACK APP
          </span>
        </div>
        
        <h2 style="font-size: 20px; font-weight: 600; color: #fafaf9; margin-top: 0; margin-bottom: 16px;">
          Xin chào ${recipientName || 'Bạn'},
        </h2>
        
        <p style="font-size: 15px; line-height: 1.6; color: #d6d3d1; margin-bottom: 24px;">
          Bạn nhận được thư này vì đã gửi yêu cầu đặt lại mật khẩu cho tài khoản của mình trên hệ thống. Để tiếp tục thiết lập mật khẩu mới, vui lòng nhấn vào liên kết bên dưới.
        </p>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #0c0a09; font-weight: 700; font-size: 15px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.2), 0 2px 4px -1px rgba(245, 158, 11, 0.1); transition: all 0.2s ease-in-out;">
            Đặt lại mật khẩu
          </a>
        </div>
        
        <p style="font-size: 13px; line-height: 1.5; color: #78716c; margin-top: 32px; border-top: 1px solid #1c1917; padding-top: 20px;">
          Liên kết đặt lại mật khẩu này sẽ có hiệu lực trong vòng <strong>một (1) giờ</strong> kể từ lúc email này được gửi đi. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email này và mật khẩu của bạn sẽ được giữ nguyên an toàn.
        </p>
        
        <div style="text-align: center; margin-top: 24px; font-size: 12px; color: #57534e;">
          © ${new Date().getFullYear()} Fullstack App. Mọi quyền được bảo lưu.
        </div>
      </div>
    `,
  };

  try {
    const sendResult = await emailTransporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE] Email đặt lại mật khẩu đã được gửi tới ${toEmail} thành công. Message ID: ${sendResult.messageId}`);
    return sendResult;
  } catch (emailServiceError) {
    console.error(`[EMAIL SERVICE ERROR] Gặp lỗi khi gửi email đặt lại mật khẩu tới ${toEmail}:`, emailServiceError.message);
    throw emailServiceError;
  }
};

module.exports = {
  emailTransporter,
  sendVerificationEmail,
  sendForgotPasswordEmail,
};
