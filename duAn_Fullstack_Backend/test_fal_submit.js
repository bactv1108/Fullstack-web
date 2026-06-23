const { fal } = require('@fal-ai/client');
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
    const falKey = rows[0].value.trim();
    fal.config({ credentials: falKey });

    console.log("Submitting to Kling v2.5 standard image-to-video...");
    const response = await fal.queue.submit('fal-ai/kling-video/v2.5-turbo/standard/image-to-video', {
      input: {
        prompt: "A beautiful sunset over the sea, 4k",
        image_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80"
      }
    });
    console.log("Submit response:", response);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
main();
