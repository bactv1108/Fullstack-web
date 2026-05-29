import axiosAdminClient from './axiosAdminClient';

export const userService = {
  getUsers: async (search = '', page = 1, limit = 100) => {
    const response = await axiosAdminClient.get(`/users?search=${encodeURIComponent(search)}&page=${page}&limit=${limit}`);
    // Unpack array from paginated response wrapper for compatibility
    return response && response.users ? response.users : response;
  },
  updateCredits: async (userId, amount) => {
    return axiosAdminClient.put(`/users/${userId}/credits`, { amount });
  },
  updateStatus: async (userId, status) => {
    return axiosAdminClient.put(`/users/${userId}/status`, { status });
  }
};
