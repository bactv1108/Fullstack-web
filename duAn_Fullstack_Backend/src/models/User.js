const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'password_hash',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    avatar: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
    },
    role: {
      type: DataTypes.ENUM('User', 'Admin', 'Super Admin'),
      defaultValue: 'User',
      allowNull: false,
    },
    credits: {
      type: DataTypes.INTEGER,
      defaultValue: 140,
      allowNull: false,
    },
    credits_balance: {
      type: DataTypes.INTEGER,
      defaultValue: 60,
      allowNull: false,
      field: 'credits_balance',
    },
    status: {
      type: DataTypes.ENUM('Active', 'Banned'),
      defaultValue: 'Active',
      allowNull: false,
    },
    refresh_token: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    verification_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    google_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
      field: 'google_id',
    },
    two_factor_secret: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    is_two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    theme_preference: {
      type: DataTypes.STRING(10),
      allowNull: true,
      defaultValue: 'dark',
    },
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
  });

  return User;
};
