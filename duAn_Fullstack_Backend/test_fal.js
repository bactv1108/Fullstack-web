const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_password || 'Tranbac2003@',
    database: process.env.DB_NAME || 'duan_fullstack',
  });

  try {
    const [rows] = await pool.query("SELECT * FROM system_configs WHERE `key` = 'fal_api_key'");
    console.log("FAL_API_KEY from DB:", rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
