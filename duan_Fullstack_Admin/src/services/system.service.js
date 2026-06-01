import axiosAdminClient from './axiosAdminClient';

export const systemService = {
  getQueueStatus: async () => {
    return axiosAdminClient.get('/system/queue');
  },
  getApiCosts: async () => {
    return axiosAdminClient.get('/system/costs');
  },
  getCreditStats: async () => {
    return axiosAdminClient.get('/system/credits');
  },
  getBillingPlans: async (token) => {
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('admin_access_token' || 'token') || localStorage.getItem('token')}` };
    return axiosAdminClient.get('/billing/plans', { headers });
  },
  updateBillingPlans: async (plans, token) => {
    const headers = { Authorization: `Bearer ${token || localStorage.getItem('admin_access_token' || 'token') || localStorage.getItem('token')}` };
    return axiosAdminClient.put('/billing/plans', { plans }, { headers });
  },
  getBillingTransactions: async (page = 1, limit = 10) => {
    return axiosAdminClient.get(`/transactions?page=${page}&limit=${limit}`);
  }
};
