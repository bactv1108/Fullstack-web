'use strict';

/**
 * Migration: Thêm cấu hình openrouter_api_key vào bảng system_configs
 *
 * Chạy migration:   npx sequelize-cli db:migrate
 * Rollback:         npx sequelize-cli db:migrate:undo
 *
 * Hoặc chạy thủ công câu lệnh SQL trong Navicat (xem file navicat_openrouter.sql)
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Chèn dòng openrouter_api_key vào system_configs nếu chưa tồn tại
    await queryInterface.sequelize.query(`
      INSERT INTO system_configs (\`key\`, \`value\`, \`created_at\`, \`updated_at\`)
      VALUES ('openrouter_api_key', '', NOW(), NOW())
      ON DUPLICATE KEY UPDATE \`updated_at\` = \`updated_at\`;
    `);

    console.log('[MIGRATION] ✅ Đã thêm openrouter_api_key vào bảng system_configs.');
  },

  down: async (queryInterface, Sequelize) => {
    // Rollback: Xoá dòng openrouter_api_key
    await queryInterface.sequelize.query(`
      DELETE FROM system_configs WHERE \`key\` = 'openrouter_api_key';
    `);

    console.log('[MIGRATION] 🗑️ Đã xoá openrouter_api_key khỏi bảng system_configs.');
  },
};
