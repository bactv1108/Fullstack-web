const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      comment: 'Khóa chính tự động tăng'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'user_id',
      comment: 'ID người dùng nhận thông báo (null là broadcast)'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Tiêu đề thông báo'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'Nội dung chi tiết'
    },
    type: {
      type: DataTypes.ENUM('info', 'warning', 'error'),
      defaultValue: 'info',
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
    hooks: {
      afterCreate: async (notification, options) => {
        if (global.io && notification.userId) {
          const userRoom = `user_room_${notification.userId}`;
          global.io.to(userRoom).emit('NEW_NOTIFICATION', {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            content: notification.message,
            is_read: notification.is_read || false,
            createdAt: notification.createdAt,
            type: notification.type
          });
          console.log(`[SOCKET HOOK] Sent NEW_NOTIFICATION to ${userRoom} for Notification #${notification.id}`);
        }
      }
    }
  });

  return Notification;
};
