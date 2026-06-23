const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ApiCost = sequelize.define('ApiCost', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    provider: {
      type: DataTypes.ENUM('OpenAI', 'ElevenLabs', 'Runway', 'Fal', 'OpenRouter', 'Gemini'),
      allowNull: false,
    },
    cost: {
      type: DataTypes.DECIMAL(16, 8),
      defaultValue: 0.00000000,
      allowNull: false,
    }
  }, {
    tableName: 'api_costs',
    underscored: true,
    timestamps: true,
  });

  return ApiCost;
};
