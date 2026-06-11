import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

const AdminProtectedRoute = () => {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-admin-text">Đang tải...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default AdminProtectedRoute;
