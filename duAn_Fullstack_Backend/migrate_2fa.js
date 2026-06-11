const db = require('./src/config/db');

(async () => {
  try {
    const [cols] = await db.execute("SHOW COLUMNS FROM users LIKE 'two_factor_secret'");
    if (cols.length === 0) {
      await db.execute('ALTER TABLE users ADD COLUMN two_factor_secret VARCHAR(255) NULL DEFAULT NULL');
      console.log('✅ Added two_factor_secret column');
    } else {
      console.log('ℹ️  two_factor_secret already exists');
    }

    const [cols2] = await db.execute("SHOW COLUMNS FROM users LIKE 'is_two_factor_enabled'");
    if (cols2.length === 0) {
      await db.execute('ALTER TABLE users ADD COLUMN is_two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0');
      console.log('✅ Added is_two_factor_enabled column');
    } else {
      console.log('ℹ️  is_two_factor_enabled already exists');
    }

    console.log('✅ DB migration complete');
  } catch (e) {
    console.error('❌ Migration error:', e.message);
  } finally {
    process.exit(0);
  }
})();
