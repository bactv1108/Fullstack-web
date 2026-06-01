const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoJob = sequelize.define('VideoJob', {
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
      type: DataTypes.ENUM('9:16', '16:9'),
      allowNull: false,
      field: 'aspect_ratio'
    },
    stylePreset: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'style_preset'
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Processing', 'Completed', 'Failed'),
      defaultValue: 'Pending',
      allowNull: false,
    },
    thirdPartyTaskId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'third_party_task_id'
    },
    videoUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'video_url'
    }
  }, {
    tableName: 'video_jobs',
    underscored: true,
    timestamps: true,
  });

  return VideoJob;
};
