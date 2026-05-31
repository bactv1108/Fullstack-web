const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const QueueJob = sequelize.define('QueueJob', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM('send_email', 'render_task'),
      allowNull: false,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    max_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
      field: 'max_attempts',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    runAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'run_at',
    }
  }, {
    tableName: 'queue_jobs',
    underscored: true,
    timestamps: true,
  });

  return QueueJob;
};
