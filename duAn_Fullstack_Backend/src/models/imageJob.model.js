const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ImageJob = sequelize.define('ImageJob', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    aspectRatio: {
      type: DataTypes.ENUM('1:1', '16:9', '9:16'),
      defaultValue: '1:1',
      allowNull: false,
      field: 'aspect_ratio'
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Rendering', 'Failed', 'Completed'),
      defaultValue: 'Pending',
      allowNull: false,
    },
    progress: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    output_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'output_url'
    },
    credits_used: {
      type: DataTypes.INTEGER,
      defaultValue: 2,
      allowNull: false,
      field: 'credits_used'
    }
  }, {
    tableName: 'image_jobs',
    underscored: true,
    timestamps: true,
  });

  return ImageJob;
};
