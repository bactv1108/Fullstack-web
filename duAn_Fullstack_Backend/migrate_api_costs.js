const db = require('./src/config/db');

(async () => {
  try {
    await db.execute("ALTER TABLE api_costs MODIFY COLUMN provider ENUM('OpenAI', 'ElevenLabs', 'Runway', 'Fal', 'OpenRouter', 'Gemini') NOT NULL;");
    console.log('✅ Altered api_costs provider column successfully');
  } catch (e) {
    console.error('❌ Migration error:', e.message);
  } finally {
    process.exit(0);
  }
})();
