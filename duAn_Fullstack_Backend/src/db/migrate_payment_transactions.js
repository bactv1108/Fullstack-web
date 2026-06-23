/**
 * Migration: Tạo bảng `payment_transactions` để lưu trữ lịch sử nạp tiền qua PayOS.
 * Chạy lệnh: node src/db/migrate_payment_transactions.js
 */
const db = require('../config/db');

const migrate = async () => {
  try {
    console.log('🔄 Bắt đầu chạy di trú tạo bảng payment_transactions...');
    
    const query = `
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        order_code BIGINT UNIQUE NOT NULL,
        amount INT NOT NULL,
        credits_added INT NOT NULL,
        status ENUM('PENDING', 'SUCCESS', 'CANCELLED') DEFAULT 'PENDING' NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;

    await db.execute(query);
    console.log('✅ [OK] Tạo bảng "payment_transactions" thành công hoặc bảng đã tồn tại.');
    process.exit(0);
  } catch (err) {
    console.error('❌ [MIGRATION ERROR] Lỗi khi tạo bảng:', err.message);
    process.exit(1);
  }
};

migrate();
