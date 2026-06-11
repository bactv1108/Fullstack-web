module.exports = (sequelize, DataTypes) => {
    const ProductCache = sequelize.define('ProductCache', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        url: {
            type: DataTypes.TEXT, // Dùng TEXT vì link TikTok/Shopee kèm token tracking rất dài, STRING(255) sẽ bị lỗi sập DB
            allowNull: false,
        },
        platform: {
            type: DataTypes.STRING(50), // Để phân biệt: 'tiktok', 'shopee', 'lazada'
            allowNull: false,
        },
        rawData: {
            type: DataTypes.JSON, // Lưu trọn bộ Object cấu trúc sản phẩm (màu sắc, biến thể, giá, feedback)
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE, // Mốc thời gian hết hạn của bộ nhớ đệm
            allowNull: false,
        }
    }, {
        tableName: 'product_caches',
        timestamps: true, // Tự động sinh ra createdAt và updatedAt
        indexes: [
            {
                // Tạo index cho URL để khi User ném link vào, DB truy vấn quét tìm bài cũ trong 1 mili-giây
                fields: [{ name: 'url', length: 191 }]
            }
        ]
    });

    return ProductCache;
};