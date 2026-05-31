const db = require('./src/config/db');
const bcrypt = require('bcrypt');

async function run() {
  try {
    const passwordHash = await bcrypt.hash('admin', 12);
    const [existing] = await db.execute("SELECT id FROM users WHERE email = 'admin@system.com'");
    if (existing.length === 0) {
      await db.execute(
        "INSERT INTO users (email, name, password_hash, role, is_verified, credits, status) VALUES ('admin@system.com', 'System Admin', ?, 'admin', 1, 9999, 'Active')",
        [passwordHash]
      );
      console.log('Successfully inserted admin@system.com user.');
    } else {
      console.log('admin@system.com already exists.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
