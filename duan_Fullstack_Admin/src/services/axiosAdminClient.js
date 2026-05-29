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

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosAdminClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosAdminClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('admin_refresh_token');
      if (refreshToken) {
        try {
          const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin';
          const refreshURL = baseURL.replace(/\/admin\/?$/, '/auth/refresh');

          const response = await axios.post(refreshURL, { refresh_token: refreshToken });
          const { access_token } = response.data;

          localStorage.setItem('admin_access_token', access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;

          processQueue(null, access_token);
          isRefreshing = false;

          return axiosAdminClient(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;

          localStorage.removeItem('admin_access_token');
          localStorage.removeItem('admin_refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default axiosAdminClient;
