import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/auth.service';
import axiosClient from '../services/axiosClient';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

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

          // Silent profile validation check
          // Nếu token hết hạn, request này sẽ được axiosClient Response Interceptor tự động refresh
          const profile = await axiosClient.get('/user/profile');
          setUser({ id: profile.id, name: profile.name, email: profile.email, role: profile.role, avatar: profile.avatar });
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
          
          const profile = await axiosClient.get('/user/profile');
          setUser({ id: profile.id, name: profile.name, email: profile.email, role: profile.role, avatar: profile.avatar });
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
    localStorage.setItem('Access_token', data.access_token);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('token', data.access_token); // Backup key
    if (data.refresh_token) {
      localStorage.setItem('admin_refresh_token', data.refresh_token);
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  };

  const loginWithGoogleToken = (token, refreshToken) => {
    localStorage.setItem('Access_token', token);
    localStorage.setItem('access_token', token);
    localStorage.setItem('token', token); // Backup key
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
    await authService.logout();
    localStorage.removeItem('Access_token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, loginWithGoogleToken, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
