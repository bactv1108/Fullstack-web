import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { LogOut, Bell, UserCircle, X, Trash2, Info, CheckCircle, AlertTriangle, AlertOctagon, Menu, TrendingUp, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosAdminClient from '../../services/axiosAdminClient';

const AdminHeader = ({ toggleSidebar }) => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState(localStorage.getItem('admin_avatar') || '');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [recentCreditEvent, setRecentCreditEvent] = useState(null); // tracks latest user:credit_updated event
  const [socket, setSocket] = useState(null);
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
      console.log("[SSE CLEANUP] Đóng kết nối để tránh lag trình duyệt");
      eventSource.close();
    };
  }, []);

  // Set up Socket.io connection for real-time credit balance & notification updates
  useEffect(() => {
    const socketInstance = io('http://localhost:3000', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });

    // Listen for REAL credit update events (fired from backend after nap tien / admin adjust)
    socketInstance.on('user:credit_updated', (data) => {
      console.log('[SOCKET.IO] Received user:credit_updated:', data);
      setRecentCreditEvent({
        userId: data.userId,
        credits: data.credits,
        creditsAdded: data.creditsAdded,
        timestamp: new Date(data.timestamp)
      });
      // Add a notification to the bell panel
      const creditNotif = {
        id: Date.now(),
        type: 'success',
        title: 'Cập nhật số dư',
        message: `User #${data.userId} vừa được ${data.creditsAdded > 0 ? '+' : ''}${data.creditsAdded} Credits. Số dư mới: ${(data.credits || 0).toLocaleString()} credits.`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      };
      setNotifications(prev => [creditNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    socketInstance.on('image_analysis:updated', (data) => {
      console.log('[SOCKET.IO] Received image_analysis:updated:', data);
      // Add notification about image analysis completion
      if (data.status === 'success') {
        const analysisNotif = {
          id: Date.now(),
          type: 'success',
          title: 'Mắt Thần AI hoàn thành',
          message: `Phân tích ảnh "${data.image_name}" của ${data.owner?.name || 'người dùng'} đã hoàn tất.`,
          time: 'Vừa xong'
        };
        setNotifications(prev => [analysisNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
      } else if (data.status === 'failed') {
        const failNotif = {
          id: Date.now(),
          type: 'danger',
          title: 'Mắt Thần AI thất bại',
          message: `Phân tích ảnh "${data.image_name}" của ${data.owner?.name || 'người dùng'} đã thất bại.`,
          time: 'Vừa xong'
        };
        setNotifications(prev => [failNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    });

    socketInstance.on('transaction:created', (data) => {
      console.log('[SOCKET.IO] Received transaction:created:', data);
      const transactionNotif = {
        id: Date.now(),
        type: 'info',
        title: 'Giao dịch nạp tiền mới',
        message: `${data.user?.name || 'Người dùng'} vừa tạo đơn nạp tiền ${data.amount}đ.`,
        time: 'Vừa xong'
      };
      setNotifications(prev => [transactionNotif, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    socketInstance.on('transaction:updated', (data) => {
      console.log('[SOCKET.IO] Received transaction:updated:', data);
      if (data.status === 'success') {
        const approveNotif = {
          id: Date.now(),
          type: 'success',
          title: 'Giao dịch được duyệt',
          message: `Giao dịch của ${data.user?.name || 'người dùng'} đã được duyệt thành công.`,
          time: 'Vừa xong'
        };
        setNotifications(prev => [approveNotif, ...prev]);
        setUnreadCount(prev => prev + 1);
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('[SOCKET.IO] Disconnected from server');
    });

    socketInstance.on('connect', () => {
      console.log('[SOCKET.IO] Connected to server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
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
        {/* Credit Event Real-time Display */}
        {recentCreditEvent && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-admin-primary/10 border border-admin-primary/30 animate-pulse">
            <Zap size={16} className="text-yellow-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-admin-text-muted font-semibold uppercase tracking-wider">User #{recentCreditEvent.userId}</span>
              <span className="text-sm font-bold text-yellow-400">
                {recentCreditEvent.creditsAdded > 0 ? '+' : ''}{recentCreditEvent.creditsAdded} → {(recentCreditEvent.credits || 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}

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
                Real-time Active (SSE + WebSocket)
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
