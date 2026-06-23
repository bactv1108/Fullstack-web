import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { LogOut, Bell, UserCircle, X, Trash2, Info, CheckCircle, AlertTriangle, AlertOctagon, Menu, TrendingUp, Zap, CreditCard, ServerCrash, Settings2, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axiosAdminClient from '../../services/axiosAdminClient';
import { getSocket } from '../../services/socketService';

// ─── Notification Sound Helper ───────────────────────────────────────
const playNotificationSound = () => {
  try {
    // Tạo âm thanh "ting" bằng Web Audio API (không cần file mp3 bên ngoài)
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
    oscillator.frequency.setValueAtTime(1600, audioCtx.currentTime + 0.08);
    oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.15);

    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.4);
  } catch (e) {
    console.warn('[SOUND] Không thể phát âm thanh thông báo:', e.message);
  }
};

// ─── Toast Component ─────────────────────────────────────────────────
const ToastNotification = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const typeConfig = {
    billing: { icon: <CreditCard size={16} />, color: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/40', iconColor: 'text-emerald-400' },
    error:   { icon: <ServerCrash size={16} />, color: 'from-red-500/20 to-red-600/5 border-red-500/40', iconColor: 'text-red-400' },
    system:  { icon: <Settings2 size={16} />, color: 'from-blue-500/20 to-blue-600/5 border-blue-500/40', iconColor: 'text-blue-400' },
  };

  const config = typeConfig[toast.type] || typeConfig.system;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border bg-gradient-to-r ${config.color} backdrop-blur-xl shadow-2xl shadow-black/30 animate-slide-in-right min-w-[340px] max-w-[420px]`}>
      <span className={`mt-0.5 ${config.iconColor}`}>{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold text-white/90 truncate">{toast.title}</p>
        <p className="text-[10px] text-white/60 mt-0.5 line-clamp-2 leading-relaxed">{toast.content}</p>
      </div>
      <button onClick={() => onDismiss(toast.id)} className="text-white/30 hover:text-white/70 transition-colors mt-0.5 cursor-pointer">
        <X size={14} />
      </button>
    </div>
  );
};

// ─── AdminHeader Component ───────────────────────────────────────────
const AdminHeader = ({ toggleSidebar }) => {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState(localStorage.getItem('admin_avatar') || '');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [recentCreditEvent, setRecentCreditEvent] = useState(null);
  const [toasts, setToasts] = useState([]);
  const dialogRef = useRef(null);
  const toastIdRef = useRef(0);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ─── Sync avatar ───────────────────────────────────────────────────
  useEffect(() => {
    const handleAvatarChange = () => {
      setAvatar(localStorage.getItem('admin_avatar') || '');
    };
    window.addEventListener('admin-avatar-changed', handleAvatarChange);
    return () => window.removeEventListener('admin-avatar-changed', handleAvatarChange);
  }, []);

  // ─── Toast helpers ─────────────────────────────────────────────────
  const addToast = useCallback((notification) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { ...notification, id }].slice(-4)); // Max 4 toasts
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ─── Fetch initial notifications from DB ───────────────────────────
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axiosAdminClient.get('../v1/auth/notifications');
        if (res?.success || res?.data) {
          setNotifications(res.data || []);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        console.error('[ADMIN HEADER] Lỗi khi tải thông báo:', err.message || err);
      }
    };
    fetchNotifications();
  }, []);

  // ─── Socket.io: join admin_room + listen NEW_ADMIN_NOTIFICATION ────
  useEffect(() => {
    const socket = getSocket();

    // Lắng nghe sự kiện NEW_ADMIN_NOTIFICATION từ admin_room
    const handleNewAdminNotification = (data) => {
      console.log('[SOCKET.IO] 🔔 Received NEW_ADMIN_NOTIFICATION:', data);

      // Thêm vào đầu danh sách
      setNotifications(prev => [data, ...prev]);

      // Tăng badge
      setUnreadCount(prev => prev + 1);

      // Hiện Toast popup
      addToast(data);

      // Phát âm thanh "ting"
      playNotificationSound();
    };

    socket.on('NEW_ADMIN_NOTIFICATION', handleNewAdminNotification);

    // Giữ lại listener credit + transaction hiện có
    socket.on('user:credit_updated', (data) => {
      console.log('[SOCKET.IO] Received user:credit_updated:', data);
      setRecentCreditEvent({
        userId: data.userId,
        credits: data.credits,
        creditsAdded: data.creditsAdded,
        timestamp: new Date(data.timestamp)
      });
    });

    return () => {
      socket.off('NEW_ADMIN_NOTIFICATION', handleNewAdminNotification);
      socket.off('user:credit_updated');
    };
  }, [addToast]);

  // ─── Click outside to close dropdown ───────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotifOpen]);

  // ─── Handlers ──────────────────────────────────────────────────────
  const handleOpenNotif = () => {
    setIsNotifOpen(!isNotifOpen);
  };

  const handleMarkAsRead = async (notifId) => {
    try {
      await axiosAdminClient.put(`../v1/auth/notifications/${notifId}/read`);
      setNotifications(prev =>
        prev.map(n => (n.id === notifId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('[ADMIN HEADER] Lỗi đánh dấu đã đọc:', err.message || err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axiosAdminClient.put('../v1/auth/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[ADMIN HEADER] Lỗi đánh dấu đọc tất cả:', err.message || err);
    }
  };

  const handleClearAll = async () => {
    try {
      await axiosAdminClient.delete('../v1/auth/notifications/clear-all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('[ADMIN HEADER] Lỗi xóa thông báo:', err.message || err);
    }
  };

  const handleItemClick = async (item) => {
    try {
      if (!item.is_read) {
        await handleMarkAsRead(item.id);
      }

      if (item.redirectUrl) {
        navigate(item.redirectUrl);
      } else {
        const content = item.content || item.message || '';
        let txCode = item.transactionCode;
        if (!txCode) {
          // Match standard formats like "Mã GD: 2210008723988", "Mã GD 2210008723988", "Mã: 2210008723988", "Mã GD:2210008723988"
          const match = content.match(/(?:Mã\s*GD|Mã|Mã\s*GD\s*:|Mã\s*:)\s*:?\s*([A-Za-z0-9_-]+)/i);
          if (match && match[1]) {
            txCode = match[1];
          } else {
            // Fallback: look for any 10 to 15 digit sequence representing PayOS order code
            const numMatch = content.match(/\b\d{10,15}\b/);
            if (numMatch) {
              txCode = numMatch[0];
            }
          }
        }

        if (txCode) {
          navigate(`/admin/deposits?search=${txCode}`);
        } else {
          navigate('/admin/deposits');
        }
      }
      setIsNotifOpen(false);
    } catch (err) {
      console.error("Lỗi xử lý click thông báo:", err);
    }
  };

  // ─── Icon & Color helpers ──────────────────────────────────────────
  const getNotifIcon = (type) => {
    switch (type) {
      case 'billing': return <CreditCard className="text-emerald-400 shrink-0" size={16} />;
      case 'error':   return <AlertOctagon className="text-red-400 shrink-0" size={16} />;
      case 'system':  return <Settings2 className="text-blue-400 shrink-0" size={16} />;
      case 'success': return <CheckCircle className="text-green-500 shrink-0" size={16} />;
      case 'warning': return <AlertTriangle className="text-amber-500 shrink-0" size={16} />;
      case 'danger':  return <AlertOctagon className="text-red-500 shrink-0" size={16} />;
      default:        return <Info className="text-blue-400 shrink-0" size={16} />;
    }
  };

  const getNotifColor = (type, isRead) => {
    const opacity = isRead ? 'opacity-50' : '';
    switch (type) {
      case 'billing': return `border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 ${opacity}`;
      case 'error':   return `border-red-500/20 bg-red-500/5 hover:bg-red-500/10 ${opacity}`;
      case 'system':  return `border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 ${opacity}`;
      case 'success': return `border-green-500/20 bg-green-500/5 hover:bg-green-500/10 ${opacity}`;
      case 'warning': return `border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 ${opacity}`;
      case 'danger':  return `border-red-500/20 bg-red-500/5 hover:bg-red-500/10 ${opacity}`;
      default:        return `border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 ${opacity}`;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'billing': return 'NẠP TIỀN';
      case 'error':   return 'LỖI HỆ THỐNG';
      case 'system':  return 'HỆ THỐNG';
      default:        return 'THÔNG BÁO';
    }
  };

  return (
    <>
      <header className="h-16 bg-white dark:bg-[#13161c] border-b border-slate-200 dark:border-admin-border flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="text-slate-500 dark:text-admin-text-muted hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-admin-card flex items-center justify-center border-none"
          >
            <Menu size={20} />
          </button>
          <Link to="/dashboard" className="flex items-center gap-2 cursor-pointer select-none">
            <img src="/favicon.svg" alt="AI Studio Admin Logo" className="w-7 h-7 object-contain" />
            <span className="text-slate-900 dark:text-white font-bold tracking-wider text-lg">STUDIO ADMIN</span>
          </Link>
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
            id="admin-notification-bell"
            onClick={handleOpenNotif}
            className="text-slate-500 dark:text-admin-text-muted hover:text-slate-700 dark:hover:text-white transition-all relative cursor-pointer p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-admin-card group"
          >
            <Bell size={20} className={unreadCount > 0 ? 'animate-[wiggle_0.5s_ease-in-out]' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-red-500 to-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-[#13161c] shadow-lg shadow-red-500/30">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Real-time Notification Dropdown */}
          {isNotifOpen && (
            <div
              ref={dialogRef}
              className="absolute right-0 top-14 w-[400px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden backdrop-blur-xl"
              style={{ animation: 'slideDown 0.2s ease-out' }}
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-admin-primary/15 flex items-center justify-center">
                    <Bell size={15} className="text-admin-primary" />
                  </div>
                  <div>
                    <h3 className="text-xs text-slate-900 dark:text-white font-bold uppercase tracking-wider">Thông báo Admin</h3>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">{unreadCount} chưa đọc</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      title="Đánh dấu đọc tất cả"
                      className="text-admin-text-muted hover:text-emerald-400 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-admin-card"
                    >
                      <Check size={14} />
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      title="Xóa tất cả"
                      className="text-admin-text-muted hover:text-red-400 transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-admin-card"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotifOpen(false)}
                    className="text-admin-text-muted hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-admin-card"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/60 custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-admin-card flex items-center justify-center">
                      <Bell size={22} className="text-zinc-600" />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Chưa có thông báo nào</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Đang lắng nghe sự kiện từ hệ thống...</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`p-3.5 border-l-[3px] flex gap-3 !transition-all !cursor-pointer hover:!bg-zinc-800/50 ${getNotifColor(item.type, item.is_read)}`}
                    >
                      <div className="mt-0.5">{getNotifIcon(item.type)}</div>
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[11px] text-slate-800 dark:text-slate-200 font-semibold truncate">{item.title}</span>
                            {!item.is_read && (
                              <span className="w-1.5 h-1.5 bg-admin-primary rounded-full shrink-0 animate-pulse" />
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                              {getTypeLabel(item.type)}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">
                          {item.content || item.message}
                        </p>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {formatTime(item.created_at || item.createdAt)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-center">
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping" />
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full absolute" />
                  Real-time Active (Socket.io → admin_room)
                </span>
              </div>
            </div>
          )}

          <div
            onClick={() => navigate('/profile')}
            className="flex items-center gap-3 border-l border-slate-200 dark:border-admin-border pl-6 cursor-pointer hover:opacity-85 transition-opacity"
          >
            {avatar ? (
              <img src={avatar} alt="Admin Avatar" className="w-7 h-7 rounded-full object-cover border border-amber-500/40 shrink-0" />
            ) : (
              <UserCircle size={28} className="text-admin-text-muted shrink-0" />
            )}
            <div className="flex flex-col text-left">
              <span className="text-sm font-medium text-slate-900 dark:text-admin-text">{admin?.name || 'Admin'}</span>
              <span className="text-xs text-admin-primary">{admin?.role || 'System Administrator'}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="ml-4 text-slate-500 dark:text-admin-text-muted hover:text-red-500 dark:hover:text-admin-danger transition-colors cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Toast Container - Fixed Top Right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastNotification toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Inject keyframe animations */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(14deg); }
          30% { transform: rotate(-12deg); }
          45% { transform: rotate(8deg); }
          60% { transform: rotate(-6deg); }
          75% { transform: rotate(3deg); }
        }
        .animate-slide-in-right {
          animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>
    </>
  );
};

export default AdminHeader;
