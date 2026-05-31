const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ApiCost = sequelize.define('ApiCost', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    provider: {
      type: DataTypes.ENUM('OpenAI', 'ElevenLabs', 'Runway'),
      allowNull: false,
    },
    cost: {
      type: DataTypes.FLOAT,
      defaultValue: 0.00,
      allowNull: false,
    }
  }, {
    tableName: 'api_costs',
    underscored: true,
    timestamps: true,
  });

  return ApiCost;
};
