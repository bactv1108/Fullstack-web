const { User, SystemConfig } = require('../models');
const { Op } = require('sequelize');

/**
 * Fetch paginated users filtered by search keyword
 */
const fetchPaginatedUsers = async (search = '', page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  const where = {};

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } }
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    attributes: ['id', 'email', 'name', 'avatar', 'role', 'credits', 'status', 'created_at'],
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [['id', 'ASC']]
  });

  return {
    total: count,
    pages: Math.ceil(count / limit),
    currentPage: parseInt(page),
    users: rows
  };
};

/**
 * Atomically adjust user credits (increases or decreases)
 */
const adjustUserCredits = async (userId, amount) => {
  const parsedAmount = parseInt(amount);
  if (isNaN(parsedAmount)) {
    throw new Error('Credit adjustment value must be an integer.');
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  if (parsedAmount >= 0) {
    await user.increment('credits', { by: parsedAmount });
  } else {
    // Prevent credit balance from dropping below 0
    const decrementBy = Math.min(user.credits, Math.abs(parsedAmount));
    await user.decrement('credits', { by: decrementBy });
  }

  await user.reload();
  return user;
};

/**
 * Update user status. Banning the user immediately nullifies their refresh token to force evict active sessions.
 */
const toggleUserStatus = async (userId, status) => {
  if (!['Active', 'Banned'].includes(status)) {
    throw new Error('Status value must be "Active" or "Banned".');
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  user.status = status;
  if (status === 'Banned') {
    user.refresh_token = null;
  }
  await user.save();
  return user;
};

/**
 * Fetch word blacklist from configurations
 */
const getBlacklistWords = async () => {
  const row = await SystemConfig.findByPk('blacklist_words');
  if (row && row.value) {
    try {
      return JSON.parse(row.value);
    } catch {
      return row.value.split(',').map(w => w.trim());
    }
  }
  return [];
};

/**
 * Add a new word to the blacklist configuration
 */
const addWordToBlacklist = async (newWord) => {
  const trimmed = newWord.trim();
  if (!trimmed) throw new Error('Word cannot be empty.');

  const words = await getBlacklistWords();
  if (!words.includes(trimmed)) {
    words.push(trimmed);
    await SystemConfig.upsert({ key: 'blacklist_words', value: JSON.stringify(words) });
  }
  return words;
};

/**
 * Remove a word from the blacklist configuration
 */
const removeWordFromBlacklist = async (word) => {
  const words = await getBlacklistWords();
  const filtered = words.filter(w => w.toLowerCase() !== word.trim().toLowerCase());
  await SystemConfig.upsert({ key: 'blacklist_words', value: JSON.stringify(filtered) });
  return filtered;
};

/**
 * Get API Keys (OpenAI & ElevenLabs) from configurations
 */
const getApiKeys = async () => {
  const openaiRow = await SystemConfig.findByPk('openai_key');
  const elevenlabsRow = await SystemConfig.findByPk('elevenlabs_key');
  const geminiRow = await SystemConfig.findByPk('gemini_api_key');
  return {
    openai: openaiRow ? openaiRow.value : '',
    elevenlabs: elevenlabsRow ? elevenlabsRow.value : '',
    gemini: geminiRow ? geminiRow.value : ''
  };
};

/**
 * Save/Update API Keys (OpenAI & ElevenLabs & Gemini)
 */
const updateApiKeys = async (openai, elevenlabs, gemini) => {
  if (openai !== undefined) {
    await SystemConfig.upsert({ key: 'openai_key', value: openai });
  }
  if (elevenlabs !== undefined) {
    await SystemConfig.upsert({ key: 'elevenlabs_key', value: elevenlabs });
  }
  if (gemini !== undefined) {
    await SystemConfig.upsert({ key: 'gemini_api_key', value: gemini });
  }
  return { openai, elevenlabs, gemini };
};

module.exports = {
  fetchPaginatedUsers,
  adjustUserCredits,
  toggleUserStatus,
  getBlacklistWords,
  addWordToBlacklist,
  removeWordFromBlacklist,
  getApiKeys,
  updateApiKeys
};

