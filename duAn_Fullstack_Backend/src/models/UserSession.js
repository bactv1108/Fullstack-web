const { DataTypes } = require('sequelize');

/**
 * UserSession Model
 * Tracks active login sessions per user.
 * Each row represents one logged-in device/browser.
 */
module.exports = (sequelize) => {
  const UserSession = sequelize.define('UserSession', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'FK → users.id',
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: 'The refresh token that identifies this session uniquely',
    },
    device_string: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: 'Unknown Device',
      comment: 'e.g. "Chrome Browser — Windows 11 OS"',
    },
    ip_address: {
      type: DataTypes.STRING(64),
      allowNull: true,
      defaultValue: '',
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: '',
      comment: 'e.g. "Hà Nội, Việt Nam"',
    },
  }, {
    tableName: 'user_sessions',
    underscored: true,
    timestamps: true,   // adds created_at / updated_at
    indexes: [
      { fields: ['user_id'] },
    ],
  });

  return UserSession;
};
