const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CreditStat = sequelize.define('CreditStat', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    month: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    creditsUsed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'credits_used',
    },
    creditsPurchased: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'credits_purchased',
    }
  }, {
    tableName: 'credit_stats',
    underscored: true,
    timestamps: true,
  });

  return CreditStat;
};
