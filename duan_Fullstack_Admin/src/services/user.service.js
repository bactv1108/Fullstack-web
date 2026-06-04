import axiosAdminClient from './axiosAdminClient';

export const userService = {
  getUsers: async (search = '', page = 1, limit = 10) => {
    const response = await axiosAdminClient.get(`/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    return response;
  },
  updateCredits: async (userId, amount) => {
    return axiosAdminClient.put(`/users/${userId}/credits`, { amount });
  },
  updateStatus: async (userId, status) => {
    return axiosAdminClient.put(`/users/${userId}/status`, { status });
  }
};
