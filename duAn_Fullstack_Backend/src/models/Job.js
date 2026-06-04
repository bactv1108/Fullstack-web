const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Job = sequelize.define('Job', {
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('Video', 'Voice', 'Image'),
      defaultValue: 'Video',
      allowNull: false,
    },
    prompt: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    meta_data: {
      type: DataTypes.JSON,
      allowNull: true,
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
    },
    credits_used: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
      allowNull: false,
    }
  }, {
    tableName: 'jobs',
    underscored: true,
    timestamps: true,
  });

  return Job;
};
