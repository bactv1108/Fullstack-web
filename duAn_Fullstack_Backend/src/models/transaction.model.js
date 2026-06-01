const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.STRING(100),
      primaryKey: true,
      allowNull: false,
      comment: 'Mã đơn hàng giao dịch nạp tiền (Ví dụ: TRX123456)'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      comment: 'Mã người dùng thực hiện nạp tiền'
    },
    package_name: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'package_name',
      comment: 'Tên gói cước tại thời điểm mua (Ví dụ: Basic Plan)'
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Số tiền VNĐ thực tế người dùng cần thanh toán'
    },
    credits_added: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'credits_added',
      comment: 'Số lượng tín dụng được cộng'
    },
    status: {
      type: DataTypes.ENUM('pending', 'success', 'failed'),
      defaultValue: 'pending',
      allowNull: false,
      comment: 'Trạng thái giao dịch nạp tiền'
    }
  }, {
    tableName: 'transactions',
    underscored: true,
    timestamps: true,
  });

  return Transaction;
};
