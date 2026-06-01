const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Khóa chính tự động tăng'
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      comment: 'ID người dùng nhận thông báo'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Tiêu đề thông báo'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Nội dung thông báo'
    },
    type: {
      type: DataTypes.STRING(50),
      defaultValue: 'system',
      allowNull: false,
      comment: 'Phân loại thông báo'
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: 'is_read',
      comment: 'Trạng thái đã đọc hay chưa'
    }
  }, {
    tableName: 'notifications',
    underscored: true,
    timestamps: true,
  });

  return Notification;
};
