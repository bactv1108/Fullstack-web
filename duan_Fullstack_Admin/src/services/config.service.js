export const configService = {
  getApiKeys: async () => {
    return {
      openai: 'sk-xxxxxxxxxxxxxxxxx',
      elevenlabs: 'xxxxxxxxxxxxxxxxxxx',
    };
  },
  updateApiKeys: async (keys) => {
    return { success: true };
  },
  getBlacklist: async () => {
    return ['banned_word_1', 'illegal_content', 'nsfw_term'];
  },
  updateBlacklist: async (words) => {
    return { success: true };
  }
};
