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
db.VideoJob = require('./VideoJob')(sequelize);
db.SystemConfig = require('./SystemConfig')(sequelize);
db.ApiCost = require('./ApiCost')(sequelize);
db.CreditStat = require('./CreditStat')(sequelize);
db.QueueJob = require('./QueueJob')(sequelize);
db.Asset = require('./asset.model')(sequelize);

// Define associations exactly as specified:
// User.hasMany(Job, { foreignKey: 'userId', as: 'renderJobs' })
// Job.belongsTo(User, { foreignKey: 'userId', as: 'owner' })
db.User.hasMany(db.Job, { foreignKey: 'userId', as: 'renderJobs' });
db.Job.belongsTo(db.User, { foreignKey: 'userId', as: 'owner' });

db.User.hasMany(db.VideoJob, { foreignKey: 'userId', as: 'videoJobs' });
db.VideoJob.belongsTo(db.User, { foreignKey: 'userId', as: 'owner' });

module.exports = db;
