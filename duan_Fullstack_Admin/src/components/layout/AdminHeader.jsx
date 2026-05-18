import React from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { LogOut, Bell, UserCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminHeader = () => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-[#13161c] border-b border-admin-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="text-admin-text-muted font-medium">
        Overview
      </div>

      <div className="flex items-center gap-6">
        <button className="text-admin-text-muted hover:text-white transition-colors relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-admin-danger rounded-full"></span>
        </button>

        <div className="flex items-center gap-3 border-l border-admin-border pl-6">
          <UserCircle size={28} className="text-admin-text-muted" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-admin-text">{admin?.name || 'Admin'}</span>
            <span className="text-xs text-admin-primary">{admin?.role || 'System Administrator'}</span>
          </div>
          <button 
            onClick={handleLogout}
            className="ml-4 text-admin-text-muted hover:text-admin-danger transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
