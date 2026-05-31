import axiosClient from './axiosClient';

export const userService = {
  getProfile: async () => {
    return axiosClient.get('/user/profile');
  },
  getHistory: async () => {
    return axiosClient.get('/user/history');
  },
  createJob: async (jobData) => {
    // jobData = { name, type, prompt, meta_data }
    return axiosClient.post('/user/jobs', jobData);
  },
  updateSettings: async (settingsData) => {
    // settingsData = { name, email, avatar }
    return axiosClient.put('/user/settings', settingsData);
  },
  deleteJob: async (jobId) => {
    return axiosClient.delete(`/user/jobs/${jobId}`);
  }
};
