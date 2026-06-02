import axios from 'axios';

// Đường dẫn API cơ sở của Backend
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Tạo instance axiosClient dùng cho toàn bộ ứng dụng
const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Biến cờ đánh dấu hệ thống đang thực hiện refresh token ngầm
let isRefreshing = false;

// Hàng đợi lưu các request bị lỗi 401 khi đang đợi refresh token mới
let failedQueue = [];

// Hàm xử lý hàng đợi: Thực thi lại các request đã xếp hàng khi có token mới hoặc reject khi thất bại
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

// ── REQUEST INTERCEPTOR: Tự động đính kèm Access Token vào Header ──
axiosClient.interceptors.request.use(
  (config) => {
    // Đọc bất kỳ biến Access token nào có sẵn từ Local Storage
    const token = localStorage.getItem('Access_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
    
    // Nếu token tồn tại và hợp lệ, đính kèm vào Authorization Header dưới dạng Bearer
    if (token && token !== 'undefined' && token !== 'null') {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Dọn sạch nếu token bị lỗi chuỗi đại diện
      ['Access_token', 'access_token', 'token'].forEach(k => localStorage.removeItem(k));
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ── RESPONSE INTERCEPTOR: Tự động xử lý Refresh Token khi gặp lỗi 401/403 ──
axiosClient.interceptors.response.use(
  (response) => {
    // Trả về trực tiếp dữ liệu data nếu request thành công
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Phòng chống lỗi rỗng cấu hình
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Xác định xem có phải là lỗi hết hạn token (401) hoặc từ chối quyền (403) hay không
    const isUnauthorized = error.response?.status === 401 || error.response?.status === 403;

    // Nếu gặp lỗi và đây không phải là request đăng nhập
    if (isUnauthorized && !originalRequest.url?.includes('/auth/login')) {
      
      const isPublicPage = ['/login', '/register', '/reset-password', '/forgot-password', '/auth/google/callback'].some(
        (path) => window.location.pathname.startsWith(path)
      );

      // Nếu request này đã được đánh dấu thử lại (_retry = true) nhưng vẫn lỗi -> Đăng nhập lại
      if (originalRequest._retry) {
        ['Access_token', 'access_token', 'token', 'admin_refresh_token', 'refresh_token'].forEach(k => localStorage.removeItem(k));
        if (!isPublicPage) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Nếu đang có một tiến trình refresh token ngầm khác chạy song song
      if (isRefreshing) {
        // Đóng băng request này lại và đẩy vào failedQueue để chờ có token mới sẽ chạy lại
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      // Đánh dấu request này đang tiến hành thử lại để tránh lặp vô hạn
      originalRequest._retry = true;
      isRefreshing = true;

      // Đọc admin_refresh_token hoặc refresh_token từ Local Storage
      const refreshToken = localStorage.getItem('admin_refresh_token') || localStorage.getItem('refresh_token');
      
      // Nếu không có Refresh Token -> Thực hiện logout
      if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
        isRefreshing = false;
        ['Access_token', 'access_token', 'token', 'admin_refresh_token', 'refresh_token'].forEach(k => localStorage.removeItem(k));
        if (!isPublicPage) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        // Sử dụng instance axios gốc (vanilla axios) để gửi request lấy token mới
        // Tránh dùng axiosClient vì sẽ bị dính interceptor gắn token cũ gây lặp vô hạn
        const res = await axios.post(`${baseURL}/auth/refresh-token`, {
          refreshToken,
          refresh_token: refreshToken
        });

        // Lấy token mới trả về từ Backend (hỗ trợ cả camelCase và snake_case)
        const newAccessToken = res.data.access_token || res.data.accessToken;
        const newRefreshToken = res.data.refresh_token || res.data.refreshToken;

        const isValidToken = (tk) => {
          return tk && typeof tk === 'string' && tk.trim() !== '' && tk !== 'undefined' && tk !== 'null';
        };

        // Nếu backend trả về token trống hoặc không hợp lệ -> Ném lỗi ra block catch
        if (!isValidToken(newAccessToken)) {
          throw new Error('Mã access token mới không hợp lệ.');
        }

        // Lưu trữ lại Access_token mới vào Local Storage
        localStorage.setItem('Access_token', newAccessToken);
        localStorage.setItem('access_token', newAccessToken);
        localStorage.setItem('token', newAccessToken);
        
        // Nếu có refresh token mới xoay vòng, cập nhật lại vào Local Storage
        if (isValidToken(newRefreshToken)) {
          localStorage.setItem('admin_refresh_token', newRefreshToken);
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        // Cập nhật lại header mặc định cho các request tiếp theo
        axiosClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Kích hoạt chạy lại toàn bộ hàng đợi request đang chờ với token mới
        processQueue(null, newAccessToken);
        isRefreshing = false;

        // Thực thi lại request gốc ban đầu bị lỗi
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Giải phóng hàng đợi với lỗi
        processQueue(refreshError, null);
        isRefreshing = false;

        // Xóa sạch bộ nhớ cục bộ và điều hướng về trang đăng nhập
        ['Access_token', 'access_token', 'token', 'admin_refresh_token', 'refresh_token'].forEach(k => localStorage.removeItem(k));
        if (!isPublicPage) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
