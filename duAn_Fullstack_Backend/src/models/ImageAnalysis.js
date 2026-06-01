const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ImageAnalysis = sequelize.define('ImageAnalysis', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Khóa chính tự động tăng'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'ID người dùng thực hiện phân tích'
    },
    image_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Tên gốc của file ảnh khi upload lên'
    },
    image_path: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Đường dẫn tương đối của file ảnh trên server'
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Định dạng file ảnh (image/png, image/jpeg...)'
    },
    file_size: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: 'Dung lượng file ảnh tính bằng bytes'
    },
    prompt_output: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      comment: 'Kịch bản/Prompt chi tiết dạng Markdown do Gemini trả về'
    },
    status: {
      type: DataTypes.ENUM('processing', 'success', 'failed'),
      defaultValue: 'processing',
      allowNull: false,
      comment: 'Trạng thái xử lý tác vụ'
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Chi tiết thông báo lỗi nếu xử lý thất bại'
    },
    input_tokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Số lượng tokens đầu vào tiêu tốn'
    },
    output_tokens: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Số lượng tokens đầu ra tiêu tốn'
    }
  }, {
    tableName: 'image_analyses',
    underscored: true,
    timestamps: true, // Sẽ tự động quản lý created_at và updated_at
  });

  return ImageAnalysis;
};
