import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminProtectedRoute from './AdminProtectedRoute';
import AdminLayout from '../components/layout/AdminLayout';

// Pages
const AdminLogin = lazy(() => import('../pages/AdminLogin'));
const AdminDashboard = lazy(() => import('../pages/AdminDashboard'));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-admin-bg text-admin-text">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-admin-primary"></div>
  </div>
);

const AdminRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        
        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            {/* AdminDashboard will handle the sub-tabs based on URL search params or nested routes.
                We'll use a single Dashboard page for simplicity with tabs inside it for now. */}
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/billing" element={<AdminDashboard tab="billing" />} />
            <Route path="/api-resources" element={<AdminDashboard tab="api" />} />
            <Route path="/moderation" element={<AdminDashboard tab="moderation" />} />
            <Route path="/users" element={<AdminDashboard tab="users" />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AdminRoutes;
