import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';


// Áp dụng Code Splitting
const Login = lazy(() => import('../pages/auth/Login'));
const GoogleCallback = lazy(() => import('../pages/auth/GoogleCallback'));
const Dashboard = lazy(() => import('../pages/user/Dashboard'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div className="loader">Đang tải...</div>
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {/* Protected Routes cho User */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* Các sub-routes của dashboard có thể thêm ở đây */}
          </Route>
        </Route>

        {/* Protected Routes cho Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
