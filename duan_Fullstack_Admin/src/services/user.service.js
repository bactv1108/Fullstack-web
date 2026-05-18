export const userService = {
  getUsers: async () => {
    return [
      { id: 1, name: 'Alice Smith', email: 'alice@example.com', credits: 150, status: 'Active' },
      { id: 2, name: 'Bob Jones', email: 'bob@example.com', credits: 0, status: 'Banned' },
      { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', credits: 500, status: 'Active' },
    ];
  },
  updateCredits: async (userId, amount) => {
    console.log(`Updated credits for ${userId} by ${amount}`);
    return { success: true };
  }
};
