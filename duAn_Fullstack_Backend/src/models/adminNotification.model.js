const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AdminNotification = sequelize.define('AdminNotification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Khóa chính tự động tăng'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Tiêu đề thông báo dành cho Admin'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Nội dung chi tiết thông báo'
    },
    type: {
      type: DataTypes.ENUM('billing', 'error', 'system'),
      defaultValue: 'system',
      allowNull: false,
      comment: 'Phân loại thông báo: billing (nạp tiền), error (lỗi AI), system (hệ thống)'
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_read',
      comment: 'Trạng thái đã đọc hay chưa'
    }
  }, {
    tableName: 'admin_notifications',
    underscored: true,
    timestamps: true,
  });

  return AdminNotification;
};
