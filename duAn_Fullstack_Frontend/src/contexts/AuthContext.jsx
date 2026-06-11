import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth.service';
import axiosClient from '../services/axiosClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Khôi phục session từ token khi tải trang (xử lý validation và silent refresh)
  useEffect(() => {
    const checkAuth = async () => {
      // Clear corrupt literal string values like "undefined" or "null"
      ['Access_token', 'access_token', 'token', 'admin_refresh_token', 'refresh_token'].forEach(key => {
        const val = localStorage.getItem(key);
        if (val === 'undefined' || val === 'null') {
          localStorage.removeItem(key);
        }
      });

      const token = localStorage.getItem('Access_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
      const refreshToken = localStorage.getItem('admin_refresh_token') || localStorage.getItem('refresh_token');
      
      if (token) {
        try {
          // Decode sơ bộ thông tin từ payload để hiển thị nhanh
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: payload.id, email: payload.email, role: payload.role, name: payload.email.split('@')[0] });
          setIsAuthenticated(true);

          // Nạp token vào cấu hình header của Axios trước khi gọi API để tránh lỗi 401 khi F5
          axiosClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Silent profile validation check
          // Nếu token hết hạn, request này sẽ được axiosClient Response Interceptor tự động refresh
          const profile = await axiosClient.get('/user/profile');
          const userData = profile?.user || profile?.data || profile;
          setUser({
            id: userData?.id || payload.id,
            name: userData?.name || userData?.fullname || payload.name || payload.email.split('@')[0],
            email: userData?.email || payload.email,
            role: userData?.role || payload.role,
            avatar: userData?.avatar || userData?.data?.avatar || userData?.user?.avatar || profile?.avatar || profile?.data?.avatar || profile?.user?.avatar || '',
            credits: userData?.credits !== undefined ? userData.credits : 0
          });
          setIsAuthenticated(true);
        } catch (e) {
          console.warn('[AUTH BOOT] Silent token check failed, checking fallback:', e.message);
          const hasToken = localStorage.getItem('Access_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
          if (!hasToken) {
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else if (refreshToken) {
        // Có refresh token nhưng mất access token (ví dụ do xoá/hết hạn sớm)
        // Gọi trực tiếp refresh token api
        try {
          const res = await axiosClient.post('/auth/refresh-token', { refreshToken, refresh_token: refreshToken });
          const newAccessToken = res.access_token || res.accessToken;
          const payload = JSON.parse(atob(newAccessToken.split('.')[1]));
          setUser({ id: payload.id, email: payload.email, role: payload.role, name: payload.email.split('@')[0] });
          setIsAuthenticated(true);
          
          // Nạp token vào cấu hình header của Axios trước khi gọi API để tránh lỗi 401 khi F5
          axiosClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

          const profile = await axiosClient.get('/user/profile');
          const userData = profile?.user || profile?.data || profile;
          setUser({
            id: userData?.id || payload.id,
            name: userData?.name || userData?.fullname || payload.name || payload.email.split('@')[0],
            email: userData?.email || payload.email,
            role: userData?.role || payload.role,
            avatar: userData?.avatar || userData?.data?.avatar || userData?.user?.avatar || profile?.avatar || profile?.data?.avatar || profile?.user?.avatar || '',
            credits: userData?.credits !== undefined ? userData.credits : 0
          });
          setIsAuthenticated(true);
        } catch (e) {
          console.error('[AUTH BOOT] Direct refresh failed:', e.message);
          localStorage.removeItem('Access_token');
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('admin_refresh_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);

    // Check if 2FA is required
    if (data.require2FA === true) {
      return { require2FA: true, userId: data.userId };
    }

    const tokenVal = data.access_token || data.accessToken || data.token;
    
    const res = {
      data: {
        token: tokenVal
      }
    };

    // Bước A: Ghi ngay token mới vào bộ nhớ
    localStorage.setItem('access_token', res.data.token);
    localStorage.setItem('Access_token', res.data.token);
    localStorage.setItem('token', res.data.token); // Backup key

    // Bước B: Đút trực tiếp Token mới vào cấu hình Header của Axios
    axiosClient.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;

    if (data.refresh_token) {
      localStorage.setItem('admin_refresh_token', data.refresh_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    setUser(data.user);
    setIsAuthenticated(true);

    // Bước C: Điều hướng người dùng vào trang /dashboard bằng navigate
    navigate('/dashboard');

    return data;
  };

  const verify2FALogin = async (userId, otpToken) => {
    const data = await authService.verifyLogin2FA(userId, otpToken);
    const tokenVal = data.access_token || data.accessToken || data.token;

    localStorage.setItem('access_token', tokenVal);
    localStorage.setItem('Access_token', tokenVal);
    localStorage.setItem('token', tokenVal);

    axiosClient.defaults.headers.common['Authorization'] = `Bearer ${tokenVal}`;

    if (data.refresh_token) {
      localStorage.setItem('admin_refresh_token', data.refresh_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    setUser(data.user);
    setIsAuthenticated(true);

    navigate('/dashboard');

    return data;
  };

  const loginWithGoogleToken = (token, refreshToken) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('Access_token', token);
    localStorage.setItem('token', token); // Backup key
    
    axiosClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    if (refreshToken) {
      localStorage.setItem('admin_refresh_token', refreshToken);
      localStorage.setItem('refresh_token', refreshToken);
    }
    
    try {
      // Decode JWT token directly in frontend (cơ bản)
      const payload = JSON.parse(atob(token.split('.')[1]));
      setUser({ id: payload.id, email: payload.email, role: payload.role, name: payload.email.split('@')[0] });
    } catch (e) {
      setUser({ name: 'User' }); // fallback
    }
    
    setIsAuthenticated(true);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error('Logout error:', e);
    }
    localStorage.removeItem('access_token'); // Xóa sạch token cũ
    localStorage.removeItem('Access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('refresh_token');
    delete axiosClient.defaults.headers.common['Authorization']; // Xóa header của thực thể axios hiện tại
    setUser(null);
    setIsAuthenticated(false);
    
    // Điều hướng ép tải lại trang bằng navigate
    navigate('/login');
  };

  const updateUserState = (newUserData) => {
    setUser((prevUser) => {
      if (!prevUser) return null;
      return { ...prevUser, ...newUserData };
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, loginWithGoogleToken, logout, updateUserState, verify2FALogin }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
