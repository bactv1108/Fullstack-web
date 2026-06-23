const { Sequelize } = require('sequelize');
const config = require('../config/sequelize-cli-config');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  dialect: dbConfig.dialect,
  logging: dbConfig.logging,
  define: {
    underscored: true,
    timestamps: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.User = require('./User')(sequelize);
db.Job = require('./Job')(sequelize);
db.ImageJob = require('./imageJob.model')(sequelize);
db.VideoJob = require('./VideoJob')(sequelize);
db.SystemConfig = require('./SystemConfig')(sequelize);
db.ApiCost = require('./ApiCost')(sequelize);
db.CreditStat = require('./CreditStat')(sequelize);
db.QueueJob = require('./QueueJob')(sequelize);
db.Asset = require('./asset.model')(sequelize);
db.ImageAnalysis = require('./ImageAnalysis')(sequelize);
db.Package = require('./package.model')(sequelize);
db.Transaction = require('./transaction.model')(sequelize);
db.Notification = require('./notification.model')(sequelize);
db.ProductCache = require('./productCache')(sequelize, Sequelize.DataTypes);
db.UserSession = require('./UserSession')(sequelize);
db.AdminNotification = require('./adminNotification.model')(sequelize);

// Define associations exactly as specified:
// User.hasMany(Job, { foreignKey: 'userId', as: 'renderJobs' })
// Job.belongsTo(User, { foreignKey: 'userId', as: 'owner' })
db.User.hasMany(db.Job, { foreignKey: 'userId', as: 'renderJobs' });
db.Job.belongsTo(db.User, { foreignKey: 'userId', as: 'owner' });

db.User.hasMany(db.ImageJob, { foreignKey: 'userId', as: 'imageJobs' });
db.ImageJob.belongsTo(db.User, { foreignKey: 'userId', as: 'owner' });

db.User.hasMany(db.VideoJob, { foreignKey: 'userId', as: 'videoJobs' });
db.VideoJob.belongsTo(db.User, { foreignKey: 'userId', as: 'owner' });

// VideoJob ↔ ImageAnalysis (Mắt Thần)
// Một analysis có thể sinh ra nhiều VideoJob; mỗi VideoJob tuỳ chọn thuộc về 1 analysis
db.ImageAnalysis.hasMany(db.VideoJob, {
  foreignKey: { name: 'analysisId', field: 'analysis_id' },
  as: 'videoJobs',
});
db.VideoJob.belongsTo(db.ImageAnalysis, {
  foreignKey: { name: 'analysisId', field: 'analysis_id' },
  as: 'analysis',
  constraints: false,   // Không ép FK constraint cứng — analysis_id là tuỳ chọn (NULL)
});

db.User.hasMany(db.ImageAnalysis, { foreignKey: 'user_id', as: 'imageAnalyses' });
db.ImageAnalysis.belongsTo(db.User, { foreignKey: 'user_id', as: 'owner' });

// Associations for User & Transaction (Billing Recharge feature)
db.User.hasMany(db.Transaction, { foreignKey: 'userId', as: 'transactions' });
db.Transaction.belongsTo(db.User, { foreignKey: 'userId', as: 'user' });

// Notifications
db.User.hasMany(db.Notification, { foreignKey: 'user_id', as: 'notifications' });
db.Notification.belongsTo(db.User, { foreignKey: 'user_id', as: 'user' });

// Associations for User & UserSession (Session Management feature)
db.User.hasMany(db.UserSession, { foreignKey: 'user_id', as: 'sessions' });
db.UserSession.belongsTo(db.User, { foreignKey: 'user_id', as: 'owner' });

module.exports = db;
