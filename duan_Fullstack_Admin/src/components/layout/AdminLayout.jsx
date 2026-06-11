import React, { useState, useEffect, useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { AdminAuthContext } from '../../contexts/AdminAuthContext';
import { getSocket, authenticateSocket, disconnectSocket } from '../../services/socketService';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { logout } = useContext(AdminAuthContext);
  const navigate = useNavigate();

  // ── Kết nối socket & lắng nghe FORCE_LOGOUT toàn cục ──────────────────────
  useEffect(() => {
    const socket = getSocket();

    // Nếu socket đã connected thì authenticate ngay, không đợi 'connect' event
    if (socket.connected) {
      authenticateSocket();
    }

    // ── FORCE_LOGOUT: phiên này bị admin hủy từ xa ─────────────────────────
    const handleForceLogout = (data) => {
      const msg = data?.message || 'Phiên đăng nhập của bạn đã bị hủy từ xa.';
      console.warn('[SOCKET] FORCE_LOGOUT nhận được:', msg);

      // 1. Xóa sạch toàn bộ token khỏi localStorage
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_refresh_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token');
      localStorage.removeItem('Access_token');
      localStorage.removeItem('admin_avatar');

      // 2. Cập nhật context
      if (typeof logout === 'function') logout();

      // 3. Ngắt socket
      disconnectSocket();

      // 4. Hiển thị cảnh báo và chuyển hướng
      alert(`⚠️ BẢO MẬT: ${msg}\n\nBạn sẽ bị đăng xuất ngay bây giờ.`);
      window.location.href = '/login';
    };

    socket.on('FORCE_LOGOUT', handleForceLogout);

    // Cleanup khi component unmount
    return () => {
      socket.off('FORCE_LOGOUT', handleForceLogout);
    };
  }, [logout]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Backdrop overlay when sidebar is open */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-25 bg-black/50 backdrop-blur-xs transition-opacity duration-300 cursor-pointer"
        />
      )}

      {/* Sidebar */}
      <AdminSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth bg-white dark:bg-slate-950">
          <div className="max-w-[1920px] mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
