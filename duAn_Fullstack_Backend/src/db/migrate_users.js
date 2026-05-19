/**
 * Migration: Add traditional auth columns to `users` table.
 * Run once: node src/db/migrate_users.js
 */
const db = require('../config/db');

const migrate = async () => {
  const columns = [
    { name: 'password_hash',       sql: 'ADD COLUMN password_hash VARCHAR(255) NULL' },
    { name: 'is_verified',         sql: 'ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0' },
    { name: 'verification_token',  sql: 'ADD COLUMN verification_token VARCHAR(255) NULL' },
    { name: 'reset_token',         sql: 'ADD COLUMN reset_token VARCHAR(255) NULL' },
    { name: 'reset_token_expires', sql: 'ADD COLUMN reset_token_expires DATETIME NULL' },
  ];

  try {
    // Check existing columns to avoid duplicate errors
    const [existing] = await db.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    const existingNames = existing.map(r => r.COLUMN_NAME);

    for (const col of columns) {
      if (existingNames.includes(col.name)) {
        console.log(`[SKIP] Column '${col.name}' already exists.`);
      } else {
        await db.execute(`ALTER TABLE users ${col.sql}`);
        console.log(`[OK]   Column '${col.name}' added successfully.`);
      }
    }

    console.log('\nMigration completed.');
    process.exit(0);
  } catch (err) {
    console.error('[MIGRATION ERROR]', err.message);
    process.exit(1);
  }
};

migrate();
