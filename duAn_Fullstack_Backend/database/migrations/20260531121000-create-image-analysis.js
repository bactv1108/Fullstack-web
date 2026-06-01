'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('image_analyses', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        comment: 'Khóa chính tự động tăng'
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        comment: 'ID người dùng thực hiện phân tích'
      },
      image_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Tên gốc của file ảnh khi upload lên'
      },
      image_path: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Đường dẫn tương đối của ảnh lưu trên server để Frontend hiển thị'
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Kiểu định dạng của ảnh (image/png, image/jpeg...)'
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'Dung lượng file ảnh tính bằng byte để validate'
      },
      prompt_output: {
        type: Sequelize.TEXT('long'),
        allowNull: true,
        comment: 'Kết quả kịch bản/Prompt chi tiết dạng Markdown trả về từ Gemini AI'
      },
      status: {
        type: Sequelize.ENUM('processing', 'success', 'failed'),
        defaultValue: 'processing',
        allowNull: false,
        comment: 'Trạng thái xử lý của tiến trình: processing, success, failed'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Lưu chi tiết lỗi hệ thống hoặc lỗi API khi thất bại'
      },
      input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Số lượng tokens đầu vào tiêu tốn phục vụ thống kê chi phí'
      },
      output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Số lượng tokens đầu ra tiêu tốn phục vụ thống kê chi phí'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Thời gian tạo bản ghi'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment: 'Thời gian cập nhật bản ghi gần nhất'
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('image_analyses');
  }
};
