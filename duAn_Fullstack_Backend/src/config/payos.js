const { PayOS } = require('@payos/node');
require('dotenv').config();

// Kiểm tra xem các biến môi trường của PayOS có được cấu hình đầy đủ không
if (!process.env.PAYOS_CLIENT_ID || !process.env.PAYOS_API_KEY || !process.env.PAYOS_CHECKSUM_KEY) {
  console.warn('⚠️ [PAYOS CONFIG WARNING] Thiếu biến môi trường PayOS! Vui lòng kiểm tra lại PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY trong file .env');
}

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY
});

// Bọc các hàm để tương thích hoàn toàn với mã nguồn và yêu cầu của người dùng
if (typeof payos.createPaymentLink !== 'function') {
  payos.createPaymentLink = async function (paymentData) {
    return this.paymentRequests.create(paymentData);
  };
}

if (typeof payos.verifyPaymentData !== 'function') {
  payos.verifyPaymentData = function (webhookBody) {
    return this.webhooks.verify(webhookBody);
  };
}

module.exports = payos;
