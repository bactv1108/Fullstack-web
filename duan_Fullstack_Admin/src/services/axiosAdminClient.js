import axios from 'axios';

const axiosAdminClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin',
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosAdminClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosAdminClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('admin_access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosAdminClient;
