import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../hooks/useAuth';

// Áp dụng Code Splitting
// const Login = lazy(() => import('../pages/auth/Login'));
const Login = lazy(() => import('../pages/auth/Login'));
const GoogleCallback = lazy(() => import('../pages/auth/GoogleCallback'));
const Dashboard = lazy(() => import('../pages/user/Dashboard'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const ApiLogsView = lazy(() => import('../pages/admin/ApiLogsView'));
const ResetPassword = lazy(() => import('../pages/auth/ResetPassword'));
const VerifyEmail = lazy(() => import('../components/auth/VerifyEmail'));
const MatThanDetailView = lazy(() => import('../pages/user/dashboard/MatThanDetailView'));

// Sub-views under User Dashboard
const ImageView = lazy(() => import('../pages/user/dashboard/ImageView'));
const TtsView = lazy(() => import('../pages/user/dashboard/TtsView'));
const ImageAnalyzerView = lazy(() => import('../pages/user/dashboard/ImageAnalyzerView'));
const HistoryView = lazy(() => import('../pages/user/dashboard/HistoryView'));
const SettingsView = lazy(() => import('../pages/user/dashboard/SettingsView'));
const ImageViewerPage = lazy(() => import('../pages/user/dashboard/ImageViewerPage'));
const VideoStudioView = lazy(() => import('../pages/user/dashboard/VideoStudioView'));
// const AffiliateAssistant = lazy(() => import('../pages/user/dashboard/AffiliateAssistant'));

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <div className="loader">Đang tải...</div>
  </div>
);

const RootRouteHandler = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#09090b', color: '#f59e0b' }}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<RootRouteHandler />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        {/* Protected Routes cho User */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<Navigate to="image-generator" replace />} />
              <Route path="image-generator" element={<ImageView />} />
              <Route path="tts" element={<TtsView />} />
              <Route path="image-analyzer" element={<ImageAnalyzerView />} />
              <Route path="mat-than" element={<Navigate to="/dashboard/image-analyzer" replace />} />
              <Route path="history" element={<HistoryView />} />
              <Route path="settings" element={<SettingsView />} />
              {/* Trang chi tiết ảnh AI — truy cập qua /dashboard/image-viewer?jobId=... */}
              <Route path="image-viewer" element={<ImageViewerPage />} />
              {/* Studio Tạo Video AI Animation */}
              <Route path="video-studio" element={<VideoStudioView />} />
              {/* Tạm thời đóng băng tuyến đường Affiliate Assistant */}
              {/* <Route path="affiliate" element={<AffiliateAssistant />} /> */}
            </Route>
            <Route path="/dashboard/mat-than/detail/:id" element={<MatThanDetailView />} />
          </Route>
        </Route>

        {/* Protected Routes cho Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<MainLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/logs" element={<ApiLogsView />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
