const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Package = sequelize.define('Package', {
    id: {
      type: DataTypes.STRING(50),
      primaryKey: true,
      allowNull: false,
      comment: 'Mã định danh gói cước (free, basic, premium)'
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: 'Tên gói cước'
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: 'Giá gói cước'
    },
    credits: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'credits',
      comment: 'Số lượng credits được phân bổ'
    }
  }, {
    tableName: 'packages',
    underscored: true,
    timestamps: true,
  });

  return Package;
};
