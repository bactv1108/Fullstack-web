import axiosAdminClient from './axiosAdminClient';

export const configService = {
  getApiKeys: async () => {
    return axiosAdminClient.get('/config/keys');
  },
  updateApiKeys: async (keys) => {
    return axiosAdminClient.put('/config/keys', keys);
  },
  getSystemConfigs: async () => {
    return axiosAdminClient.get('/system-configs');
  },
  updateSystemConfigs: async (configs) => {
    return axiosAdminClient.put('/system-configs', configs);
  },
  getBlacklist: async () => {
    return axiosAdminClient.get('/moderation/blacklist');
  },
  addBlacklistWord: async (word) => {
    const response = await axiosAdminClient.post('/moderation/blacklist', { word });
    return response.blacklist;
  },
  removeBlacklistWord: async (word) => {
    const response = await axiosAdminClient.delete(`/moderation/blacklist?word=${encodeURIComponent(word)}`);
    return response.blacklist;
  }
};
