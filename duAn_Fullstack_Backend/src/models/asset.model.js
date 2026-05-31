const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('voice', 'style'),
      allowNull: false,
      defaultValue: 'voice',
    },
    language: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'vi',
    },
    identifier: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    previewUrl: {
      type: DataTypes.STRING(255),
      field: 'preview_url',
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active',
      allowNull: false,
    }
  }, {
    tableName: 'assets',
    underscored: true,
    timestamps: true,
  });

  return Asset;
};
