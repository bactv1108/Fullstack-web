// system.service.js
export const systemService = {
  getQueueStatus: async () => {
    return [
      { id: 1, video: 'Promo 2026', status: 'Rendering', progress: 45 },
      { id: 2, video: 'Avatar Gen', status: 'Pending', progress: 0 },
      { id: 3, video: 'Voice Clone', status: 'Failed', progress: 12 },
    ];
  },
  getApiCosts: async () => {
    return {
      total: 450.25,
      providers: [
        { name: 'OpenAI', cost: 150.0 },
        { name: 'ElevenLabs', cost: 200.25 },
        { name: 'Runway', cost: 100.0 },
      ]
    };
  },
  getCreditStats: async () => {
    return [
      { name: 'Jan', creditsUsed: 4000, creditsPurchased: 2400 },
      { name: 'Feb', creditsUsed: 3000, creditsPurchased: 1398 },
      { name: 'Mar', creditsUsed: 2000, creditsPurchased: 9800 },
      { name: 'Apr', creditsUsed: 2780, creditsPurchased: 3908 },
      { name: 'May', creditsUsed: 1890, creditsPurchased: 4800 },
      { name: 'Jun', creditsUsed: 2390, creditsPurchased: 3800 },
    ];
  }
};
