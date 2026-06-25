import axios from 'axios';

const getBaseURL = () => {
  const rawUrl = import.meta.env.VITE_API_URL || 'https://api.matthanai.cloud';
  let base = rawUrl.replace(/\/+$/, '');
  if (!base.endsWith('/api') && !base.includes('/api/')) {
    base = `${base}/api`;
  }
  return base.endsWith('/admin') ? base : `${base}/admin`;
};

const axiosAdminClient = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
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

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const isUnauthorized = error.response?.status === 401 || error.response?.status === 403;

    if (isUnauthorized && !originalRequest.url?.includes('/auth/login')) {
      
      // Nếu request này đã thử retry rồi mà vẫn bị 401/403 -> Force Logout
      if (originalRequest._retry) {
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

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
      if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
        isRefreshing = false;
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_refresh_token');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const baseURL = getBaseURL();
        const refreshURL = baseURL.replace(/\/admin\/?$/, '/auth/refresh');

        const response = await axios.post(refreshURL, { refresh_token: refreshToken });
        const { access_token, accessToken, refresh_token, refreshToken: newRefreshToken } = response.data;
        const newAccessToken = access_token || accessToken;

        const isValidToken = (tk) => {
          return tk && typeof tk === 'string' && tk.trim() !== '' && tk !== 'undefined' && tk !== 'null';
        };

        if (!isValidToken(newAccessToken)) {
          throw new Error('Corrupt access token returned from rotation');
        }

        localStorage.setItem('admin_access_token', newAccessToken);
        const resolvedRefreshToken = refresh_token || newRefreshToken;
        if (isValidToken(resolvedRefreshToken)) {
          localStorage.setItem('admin_refresh_token', resolvedRefreshToken);
        }

        axiosAdminClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);
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

    return Promise.reject(error);
  }
);

export default axiosAdminClient;
