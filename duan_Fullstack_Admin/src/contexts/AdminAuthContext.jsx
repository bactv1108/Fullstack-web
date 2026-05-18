import React, { createContext, useState, useEffect } from 'react';
import axiosAdminClient from '../services/axiosAdminClient';

export const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('admin_access_token');
      if (token) {
        // Tạm thời set admin, thực tế sẽ call API verify token
        setAdmin({ name: 'Super Admin', role: 'admin' });
        setIsAuthenticated(true);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials) => {
    // Gọi API login thực tế ở đây
    // const response = await axiosAdminClient.post('/auth/login', credentials);
    // Mô phỏng:
    if (credentials.email === 'admin@system.com' && credentials.password === 'admin123') {
      const data = { token: 'mock_admin_token', user: { name: 'Super Admin', role: 'admin' } };
      localStorage.setItem('admin_access_token', data.token);
      setAdmin(data.user);
      setIsAuthenticated(true);
      return data;
    }
    throw new Error('Sai thông tin đăng nhập Admin');
  };

  const logout = () => {
    localStorage.removeItem('admin_access_token');
    setAdmin(null);
    setIsAuthenticated(false);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isAuthenticated, loading, login, logout }}>
      {!loading && children}
    </AdminAuthContext.Provider>
  );
};
