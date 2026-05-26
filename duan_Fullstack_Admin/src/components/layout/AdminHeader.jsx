import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { LogOut, Bell, UserCircle, X, Trash2, Info, CheckCircle, AlertTriangle, AlertOctagon, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminHeader = ({ toggleSidebar }) => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState(localStorage.getItem('admin_avatar') || '');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const dialogRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Sync avatar changes in real-time
  useEffect(() => {
    const handleAvatarChange = () => {
      setAvatar(localStorage.getItem('admin_avatar') || '');
    };
    window.addEventListener('admin-avatar-changed', handleAvatarChange);
    return () => {
      window.removeEventListener('admin-avatar-changed', handleAvatarChange);
    };
  }, []);

  // Connect to server SSE for real-time notifications
  useEffect(() => {
    const eventSource = new EventSource('http://localhost:3000/api/admin/notifications/stream');

    eventSource.onmessage = (event) => {
      try {
        const newNotif = JSON.parse(event.data);
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('EventSource failed:', err);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Close dialog on clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  const handleOpenNotif = () => {
    setIsNotifOpen(!isNotifOpen);
    setUnreadCount(0); // Mark all as read when opening the modal
  };

  const handleClearNotif = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="text-green-500 shrink-0" size={18} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500 shrink-0" size={18} />;
      case 'danger':
        return <AlertOctagon className="text-red-500 shrink-0" size={18} />;
      default:
        return <Info className="text-blue-400 shrink-0" size={18} />;
    }
  };

  const getNotifColor = (type) => {
    switch (type) {
      case 'success':
        return 'border-green-500/20 bg-green-500/5 hover:bg-green-500/10';
      case 'warning':
        return 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10';
      case 'danger':
        return 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10';
      default:
        return 'border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10';
    }
  };

  return (
    <header className="h-16 bg-[#13161c] border-b border-admin-border flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-3">
        <button 
          onClick={toggleSidebar} 
          className="text-admin-text-muted hover:text-white transition-colors cursor-pointer p-2 rounded-lg hover:bg-admin-card flex items-center justify-center border-none"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-1.5 select-none shrink-0">
          <span className="bg-admin-primary text-white px-1.5 py-0.5 rounded-md text-[9px] sm:text-[11px] font-black tracking-wider leading-none shrink-0">
            AI
          </span>
          <span className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider whitespace-nowrap">
            Studio Admin
          </span>
        </div>
      </div>

      <div className="flex items-center gap-6 relative">
        {/* Notification Bell Button */}
        <button 
          onClick={handleOpenNotif}
          className="text-admin-text-muted hover:text-white transition-colors relative cursor-pointer p-1.5 rounded-full hover:bg-admin-card"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-4 h-4 bg-admin-danger text-white text-[9px] font-black rounded-full flex items-center justify-center border border-[#13161c]">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Real-time Notification Dialog */}
        {isNotifOpen && (
          <div 
            ref={dialogRef}
            className="absolute right-0 top-12 w-96 bg-[#181b21]/95 border border-admin-border rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-admin-border flex items-center justify-between bg-[#13161c]/60">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-admin-primary" />
                <h3 className="text-xs font-bold text-admin-text uppercase tracking-wider">Thông báo hệ thống</h3>
              </div>
              <div className="flex items-center gap-3">
                {notifications.length > 0 && (
                  <button 
                    onClick={handleClearNotif}
                    title="Xóa tất cả"
                    className="text-admin-text-muted hover:text-admin-danger transition-colors cursor-pointer p-1 rounded hover:bg-admin-card"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button 
                  onClick={() => setIsNotifOpen(false)}
                  className="text-admin-text-muted hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-admin-card"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-admin-border/50">
              {notifications.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                  <Bell size={24} className="text-zinc-600 animate-pulse" />
                  <p className="text-xs text-admin-text-muted font-semibold">Hiện chưa có thông báo mới nào</p>
                  <p className="text-[10px] text-zinc-500">Đang lắng nghe cập nhật từ server...</p>
                </div>
              ) : (
                notifications.map((item) => (
                  <div 
                    key={item.id}
                    className={`p-3.5 border-l-2 flex gap-3 transition-colors text-left ${getNotifColor(item.type)}`}
                  >
                    {getNotifIcon(item.type)}
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[11px] font-bold text-admin-text truncate">{item.title}</span>
                        <span className="text-[9px] text-admin-text-muted whitespace-nowrap shrink-0">{item.time}</span>
                      </div>
                      <p className="text-[10px] text-admin-text-muted font-medium leading-relaxed">{item.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 border-t border-admin-border bg-[#13161c]/40 text-center">
              <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping"></span>
                Đang trực tuyến (SSE Real-time Active)
              </span>
            </div>
          </div>
        )}

        <div 
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 border-l border-admin-border pl-6 cursor-pointer hover:opacity-85 transition-opacity"
        >
          {avatar ? (
            <img src={avatar} alt="Admin Avatar" className="w-7 h-7 rounded-full object-cover border border-[#f59e0b]/40 shrink-0" />
          ) : (
            <UserCircle size={28} className="text-admin-text-muted shrink-0" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-sm font-medium text-admin-text">{admin?.name || 'Admin'}</span>
            <span className="text-xs text-admin-primary">{admin?.role || 'System Administrator'}</span>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="ml-4 text-admin-text-muted hover:text-admin-danger transition-colors cursor-pointer"
          title="Đăng xuất"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default AdminHeader;
