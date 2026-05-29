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
  getBillingPlans: async () => {
    return axiosAdminClient.get('/billing/plans');
  },
  updateBillingPlans: async (plans) => {
    return axiosAdminClient.put('/billing/plans', { plans });
  },
  getBillingTransactions: async (page = 1, limit = 10) => {
    return axiosAdminClient.get(`/billing/transactions?page=${page}&limit=${limit}`);
  }
};
