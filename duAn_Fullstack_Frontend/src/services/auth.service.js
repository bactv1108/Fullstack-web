import axiosClient from './axiosClient';

const MOCK_API = false; // Set this to false when connecting to real backend

// Hàm mô phỏng API delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const authService = {
  login: async (credentials) => {
    if (MOCK_API) {
      await delay(1000);
      if (credentials.email === 'admin@gmail.com' && credentials.password === '123456') {
        return {
          user: { id: 1, name: 'Admin User', email: 'admin@gmail.com', role: 'admin' },
          access_token: 'mock_access_token',
          refresh_token: 'mock_refresh_token',
        };
      }
      throw new Error('Email hoặc mật khẩu không đúng');
    }
    return axiosClient.post('/auth/login', credentials);
  },

  register: async (userData) => {
    if (MOCK_API) {
      await delay(1000);
      return { message: 'Đăng ký thành công' };
    }
    return axiosClient.post('/auth/register', userData);
  },

  forgotPassword: async (email) => {
    if (MOCK_API) {
      await delay(1000);
      return { message: 'Email khôi phục đã được gửi' };
    }
    return axiosClient.post('/auth/forgot-password', { email });
  },

  resendVerification: async (email) => {
    return axiosClient.post('/auth/resend-verification', { email });
  },

  resetPassword: async (data) => {
    if (MOCK_API) {
      await delay(1000);
      return { message: 'Đặt lại mật khẩu thành công' };
    }
    return axiosClient.post('/auth/reset-password', data);
  },
  
  logout: async () => {
    if (!MOCK_API) {
       // Tùy backend, có thể cần gọi API logout để hủy token trên server
       try {
         await axiosClient.post('/auth/logout');
       } catch (error) {
         console.error('Logout failed:', error);
       }
    }
    localStorage.removeItem('Access_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('refresh_token');
  },

  // Phương thức gọi khi nhận được token từ Google
  googleLoginCallback: async (token) => {
    if (MOCK_API) {
      await delay(500);
      return {
        user: { id: 2, name: 'Google User', email: 'google@gmail.com', role: 'user' },
        access_token: 'mock_google_access_token',
        refresh_token: 'mock_google_refresh_token',
      };
    }
    return axiosClient.post('/auth/google', { token });
  },

  // ── 2FA Methods ────────────────────────────────────────────────
  generate2FA: async () => {
    return axiosClient.get('/auth/2fa/generate');
  },

  enable2FA: async (secret, token) => {
    return axiosClient.post('/auth/2fa/enable', { secret, token });
  },

  disable2FA: async (token) => {
    return axiosClient.post('/auth/2fa/disable', { token });
  },

  verifyLogin2FA: async (userId, token) => {
    return axiosClient.post('/auth/2fa/verify-login', { userId, token });
  }
};

export default authService;
