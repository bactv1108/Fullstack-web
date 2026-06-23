'use strict';
const bcrypt = require('bcrypt');
require('dotenv').config();

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Dynamic credentials config from process.env with secure fallback options
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const admin123Email = process.env.SEED_ADMIN123_EMAIL ;
    const adminPass = process.env.SEED_ADMIN_PASSWORD ;
    const admin123Pass = process.env.SEED_ADMIN123_PASSWORD;
    const userPass = process.env.SEED_USER_PASSWORD ;
    if (!adminEmail || !admin123Email || !adminPass || !admin123Pass || !userPass) {
      console.error('❌ [CRITICAL] Seeder thất bại: Thiếu các biến cấu hình dữ liệu mẫu mẫu trong file .env!');
      throw new Error('Missing seed credentials in environment variables.');
    }

    // Hash passwords dynamically using bcrypt rounds = 12
    const adminPasswordHash = await bcrypt.hash(adminPass, 12);
    const admin123PasswordHash = await bcrypt.hash(admin123Pass, 12);
    const userPasswordHash = await bcrypt.hash(userPass, 12);

    await queryInterface.bulkInsert('users', [
      {
        email: adminEmail,
        password_hash: adminPasswordHash,
        name: 'System Admin',
        role: 'Admin',
        credits: 9999,
        status: 'Active',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: admin123Email,
        password_hash: admin123PasswordHash,
        name: 'AI Studio Admin',
        role: 'Admin',
        credits: 9999,
        status: 'Active',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'alice@example.com',
        password_hash: userPasswordHash,
        name: 'Alice Smith',
        role: 'User',
        credits: 150,
        status: 'Active',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'bob@example.com',
        password_hash: userPasswordHash,
        name: 'Bob Jones',
        role: 'User',
        credits: 0,
        status: 'Banned',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'charlie@example.com',
        password_hash: userPasswordHash,
        name: 'Charlie Brown',
        role: 'User',
        credits: 500,
        status: 'Active',
        is_verified: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // Retrieve user IDs to build foreign keys safely
    const [users] = await queryInterface.sequelize.query(
      `SELECT id, email FROM users`
    );

    const userMap = {};
    users.forEach(u => {
      userMap[u.email] = u.id;
    });

    // 2. Seed jobs
    await queryInterface.bulkInsert('jobs', [
      {
        user_id: userMap['alice@example.com'] || 3,
        name: 'Promo Video',
        type: 'Video',
        prompt: 'Create a dynamic promo for AI Studio',
        meta_data: JSON.stringify({ aspectRatio: '16:9', quality: '1080p' }),
        status: 'Rendering',
        progress: 45,
        output_url: null,
        credits_used: 10,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: userMap['charlie@example.com'] || 5,
        name: 'Avatar Voice',
        type: 'Voice',
        prompt: 'Speak this text in a warm tone',
        meta_data: JSON.stringify({ voiceId: '21m00Tcm4TlvDq8ikWAM', speed: 1.0 }),
        status: 'Pending',
        progress: 0,
        output_url: null,
        credits_used: 5,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        user_id: userMap['bob@example.com'] || 4,
        name: 'AI Sound Effects',
        type: 'Voice',
        prompt: 'Synthesize wind blowing sounds',
        meta_data: JSON.stringify({ voiceId: 'AZnzlk1XvdvUeBnXmlld' }),
        status: 'Failed',
        progress: 12,
        output_url: null,
        credits_used: 5,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // 3. Seed configs
    await queryInterface.bulkInsert('system_configs', [
      {
        'key': 'openai_key',
        value: 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        'key': 'elevenlabs_key',
        value: 'el-key-xxxxxxxxxxxxxxxxxxxxxxxx',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        'key': 'blacklist_words',
        value: JSON.stringify(['nsfw_term', 'illegal_content', 'banned_word_1']),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        'key': 'billing_plans',
        value: JSON.stringify({
          Free: { credits: 50, price: 0 },
          Basic: { credits: 500, price: 10 },
          Premium: { credits: 2000, price: 30 }
        }),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    // 4. Seed api costs
    await queryInterface.bulkInsert('api_costs', [
      { provider: 'OpenAI', cost: 150.00, created_at: new Date(), updated_at: new Date() },
      { provider: 'ElevenLabs', cost: 200.25, created_at: new Date(), updated_at: new Date() },
      { provider: 'Runway', cost: 100.00, created_at: new Date(), updated_at: new Date() }
    ]);

    // 5. Seed credit stats
    await queryInterface.bulkInsert('credit_stats', [
      { month: 'Jan', credits_used: 4000, credits_purchased: 2400, created_at: new Date(), updated_at: new Date() },
      { month: 'Feb', credits_used: 3000, credits_purchased: 1398, created_at: new Date(), updated_at: new Date() },
      { month: 'Mar', credits_used: 2000, credits_purchased: 9800, created_at: new Date(), updated_at: new Date() },
      { month: 'Apr', credits_used: 2780, credits_purchased: 3908, created_at: new Date(), updated_at: new Date() },
      { month: 'May', credits_used: 1890, credits_purchased: 4800, created_at: new Date(), updated_at: new Date() },
      { month: 'Jun', credits_used: 2390, credits_purchased: 3800, created_at: new Date(), updated_at: new Date() }
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign-key constrained tables (child tables) first
    await queryInterface.bulkDelete('jobs', null, {});

    // Then safely wipe parent schema tables
    await queryInterface.bulkDelete('users', null, {});
    await queryInterface.bulkDelete('system_configs', null, {});
    await queryInterface.bulkDelete('api_costs', null, {});
    await queryInterface.bulkDelete('credit_stats', null, {});
  }
};
