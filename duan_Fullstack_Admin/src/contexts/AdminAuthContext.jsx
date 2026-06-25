import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_access_token');
      if (token) {
        try {
          const base64Url = token.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
              return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));
          const payload = JSON.parse(jsonPayload);
          const normalizedRole = payload.role?.toLowerCase();
          
          if (normalizedRole === 'admin' || normalizedRole === 'super admin') {
            setAdmin({ name: payload.email || 'Admin', role: payload.role });
            setIsAuthenticated(true);
          } else {
            throw new Error('Not an admin');
          }
        } catch (e) {
          console.error('[ADMIN AUTH] Session restore failed:', e.message);
          localStorage.removeItem('admin_access_token');
          localStorage.removeItem('admin_refresh_token');
          setAdmin(null);
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin';
      const cleanApiUrl = apiUrl.replace(/\/+$/, '').replace(/\/admin\/?$/, '');
      const apiBase = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;
      const authUrl = `${apiBase}/auth/login`;
      
      const response = await axios.post(authUrl, credentials);
      const data = response.data; // { user, access_token, refresh_token }

      // Handle 2FA challenge
      if (data.require2FA === true) {
        return { require2FA: true, userId: data.userId };
      }

      const normalizedRole = data.user?.role?.toLowerCase();
      
      if (!data.access_token || !data.user || (normalizedRole !== 'admin' && normalizedRole !== 'super admin')) {
        throw new Error('Bạn không có quyền truy cập trang quản trị.');
      }
      
      localStorage.setItem('admin_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('admin_refresh_token', data.refresh_token);
      }
      
      setAdmin(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      console.error('[ADMIN AUTH] Login failed:', err.message);
      const errMsg = err.response?.data?.message || err.message || 'Đăng nhập Admin thất bại.';
      throw new Error(errMsg);
    }
  };

  const verify2FALogin = async (userId, otpToken) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin';
      const cleanApiUrl = apiUrl.replace(/\/+$/, '').replace(/\/admin\/?$/, '');
      const apiBase = cleanApiUrl.endsWith('/api') ? cleanApiUrl : `${cleanApiUrl}/api`;
      const response = await axios.post(`${apiBase}/auth/2fa/verify-login`, { userId, token: otpToken });
      const data = response.data;
      const normalizedRole = data.user?.role?.toLowerCase();

      if (!data.access_token || !data.user || (normalizedRole !== 'admin' && normalizedRole !== 'super admin')) {
        throw new Error('Bạn không có quyền truy cập trang quản trị.');
      }

      localStorage.setItem('admin_access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('admin_refresh_token', data.refresh_token);
      }
      setAdmin(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (err) {
      console.error('[ADMIN AUTH] 2FA verify failed:', err.message);
      const errMsg = err.response?.data?.message || err.message || 'Mã xác thực 2FA không chính xác.';
      throw new Error(errMsg);
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_refresh_token');
    setAdmin(null);
    setIsAuthenticated(false);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isAuthenticated, loading, login, logout, verify2FALogin }}>
      {!loading && children}
    </AdminAuthContext.Provider>
  );
};
