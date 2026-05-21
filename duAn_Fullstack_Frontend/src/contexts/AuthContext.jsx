import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/auth.service';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Khôi phục session từ token khi tải trang (có thể cần gọi API /me)
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUser({ id: payload.id, email: payload.email, role: payload.role, name: payload.email.split('@')[0] });
        } catch (e) {
          setUser({ name: 'User' });
        }
        setIsAuthenticated(true);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (credentials) => {
    const data = await authService.login(credentials);
    localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    setUser(data.user);
    setIsAuthenticated(true);
    return data;
  };

  const loginWithGoogleToken = (token) => {
    localStorage.setItem('access_token', token);
    
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
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, loginWithGoogleToken, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
