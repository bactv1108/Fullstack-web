'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 0. Disable foreign key checks to safely drop and recreate tables
    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');

    // 1. Drop existing tables if any
    await queryInterface.dropTable('queue_jobs').catch(() => {});
    await queryInterface.dropTable('credit_stats').catch(() => {});
    await queryInterface.dropTable('api_costs').catch(() => {});
    await queryInterface.dropTable('system_configs').catch(() => {});
    await queryInterface.dropTable('jobs').catch(() => {});
    await queryInterface.dropTable('users').catch(() => {});

    await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // 2. Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      avatar: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM('User', 'Admin', 'Super Admin'),
        defaultValue: 'User',
        allowNull: false,
      },
      credits: {
        type: Sequelize.INTEGER,
        defaultValue: 140,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('Active', 'Banned'),
        defaultValue: 'Active',
        allowNull: false,
      },
      refresh_token: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      is_verified: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      verification_token: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      google_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });

    // 3. Create jobs table
    await queryInterface.createTable('jobs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('Video', 'Voice'),
        defaultValue: 'Video',
        allowNull: false,
      },
      prompt: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      meta_data: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('Pending', 'Rendering', 'Failed', 'Completed'),
        defaultValue: 'Pending',
        allowNull: false,
      },
      progress: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      output_url: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      credits_used: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });

    // 4. Create system_configs table
    await queryInterface.createTable('system_configs', {
      key: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        unique: true,
        allowNull: false,
      },
      value: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });

    // 5. Create api_costs table
    await queryInterface.createTable('api_costs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      provider: {
        type: Sequelize.ENUM('OpenAI', 'ElevenLabs', 'Runway'),
        allowNull: false,
      },
      cost: {
        type: Sequelize.FLOAT,
        defaultValue: 0.00,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });

    // 6. Create credit_stats table
    await queryInterface.createTable('credit_stats', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      month: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      credits_used: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      credits_purchased: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });

    // 7. Create queue_jobs table
    await queryInterface.createTable('queue_jobs', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      type: {
        type: Sequelize.ENUM('send_email', 'render_task'),
        allowNull: false,
      },
      payload: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        allowNull: false,
      },
      max_attempts: {
        type: Sequelize.INTEGER,
        defaultValue: 3,
        allowNull: false,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      run_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('queue_jobs');
    await queryInterface.dropTable('credit_stats');
    await queryInterface.dropTable('api_costs');
    await queryInterface.dropTable('system_configs');
    await queryInterface.dropTable('jobs');
    await queryInterface.dropTable('users');
  }
};
