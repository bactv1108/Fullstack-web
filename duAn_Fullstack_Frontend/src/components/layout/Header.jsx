import React, { useState, useEffect } from 'react';
import { Bell, Menu, AlertTriangle, Trash2, X, Check } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../../services/axiosClient';
import socketService from '../../services/socketService';
import { useAuth } from '../../hooks/useAuth';

const formatTime = (dateString) => {
    if (!dateString) return 'vừa xong';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHr < 24) return `${diffHr} giờ trước`;
    return `${diffDay} ngày trước`;
};

const getAvatarUrl = (avatarPath) => {
    if (!avatarPath) return '';
    if (avatarPath.startsWith('data:') || avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
        return avatarPath;
    }
    const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const serverRoot = rawUrl.replace(/\/+$/, '').replace(/\/api\/?$/, '');
    return `${serverRoot}${avatarPath.startsWith('/') ? '' : '/'}${avatarPath}`;
};

export default function Header({
    credits = 140,
    setCredits,
    toggleSidebar,
    avatar,
    name,
    setPreviewJob,
    loadHistory,
    unreadCount: externalUnreadCount,
    setUnreadCount: externalSetUnreadCount,
    toast
}) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);

    const [localUnreadCount, setLocalUnreadCount] = useState(0);
    const unreadCount = externalUnreadCount !== undefined ? externalUnreadCount : localUnreadCount;
    const setUnreadCount = externalSetUnreadCount || setLocalUnreadCount;
    const [isNotifLoading, setIsNotifLoading] = useState(false);

    useEffect(() => {
        let isMounted = true;
        let controller = new AbortController();
        let reconnectTimeout = null;

        const connectSSE = async () => {
            if (!isMounted) return;
            try {
                const token = localStorage.getItem('access_token');
                if (!token) return;

                const rawUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const cleanApiUrl = rawUrl.replace(/\/+$/, '').endsWith('/api')
                  ? rawUrl.replace(/\/+$/, '')
                  : `${rawUrl.replace(/\/+$/, '')}/api`;
                const url = `${cleanApiUrl}/notifications/stream`;

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    signal: controller.signal
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (isMounted) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('data: ')) {
                            const dataStr = trimmed.slice(6).trim();
                            try {
                                const newNotif = JSON.parse(dataStr);
                                if (newNotif && newNotif.id !== 0) {
                                    setNotifications(prev => {
                                        if (prev.some(n => n.id === newNotif.id)) return prev;
                                        return [newNotif, ...prev].slice(0, 10);
                                    });
                                    setUnreadCount(c => c + 1);
                                    
                                    // Refresh global history and user profile when a new SSE notification is received
                                    if (typeof loadHistory === 'function') {
                                        loadHistory();
                                    }

                                    // Dispatch custom event for components listening to real-time notifications (e.g. ImageView gallery)
                                    const event = new CustomEvent('sse-notification', { detail: newNotif });
                                    window.dispatchEvent(event);
                                }
                            } catch (e) {
                                console.error('Failed to parse SSE notification:', e);
                            }
                        }
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error('SSE connection error. Reconnecting in 5 seconds...', err);
                    if (isMounted) {
                        reconnectTimeout = setTimeout(connectSSE, 5000);
                    }
                }
            }
        };

        const fetchInitialNotifications = async () => {
            try {
                const data = await axiosClient.get('/notifications');
                if (isMounted && Array.isArray(data)) {
                    setNotifications(data.slice(0, 10));
                    const unread = data.filter(n => !n.is_read).length;
                    setUnreadCount(unread);
                }
            } catch (err) {
                console.error('Failed to fetch initial notifications:', err);
            }
        };

        fetchInitialNotifications().then(() => {
            connectSSE();
        });

        return () => {
            console.log("[SSE CLEANUP] Đóng kết nối để tránh lag trình duyệt");
            isMounted = false;
            controller.abort();
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, []);

    useEffect(() => {
        const socket = socketService.connectSocket();

        const handlePipelineUpdate = (payload) => {
            console.log('[REAL-TIME BALANCE RECEIVE] Nhận dữ liệu cập nhật ví:', payload);

            // 1. 💡 NẢY SỐ VÍ TIỀN: Cập nhật ngay lập tức số dư Credits mới lên thanh trạng thái Header
            if (payload.credits !== null && typeof setCredits === 'function') {
                setCredits(payload.credits);
            }

            // 2. 🚨 NỔ SỐ CHUÔNG THÔNG BÁO USER: Thêm tin nhắn mới vào hộp thư thả xuống của User
            if (payload.notification) {
                const mockNotif = {
                    id: payload.notification.id || Date.now(),
                    title: payload.notification.title,
                    message: payload.notification.message,
                    type: payload.notification.title.includes('thành công') ? 'info' : 'error',
                    is_read: false,
                    createdAt: payload.notification.createdAt || new Date()
                };

                setNotifications(prev => {
                    if (prev.some(n => n.message === mockNotif.message && Math.abs(new Date(n.createdAt) - new Date(mockNotif.createdAt)) < 5000)) {
                        return prev;
                    }
                    return [mockNotif, ...prev].slice(0, 10);
                });
                
                if (typeof setUnreadCount === 'function') {
                    setUnreadCount(prevCount => prevCount + 1);
                }

                // Tải lại lịch sử
                if (typeof loadHistory === 'function') {
                    loadHistory();
                }
            }
        };

        const handleJobStatus = (data) => {
            console.log('[USER_JOB_STATUS RECEIVE]:', data);
            if (data.newBalance !== undefined && data.newBalance !== null && typeof setCredits === 'function') {
                setCredits(data.newBalance);
            }
            if (toast) {
                if (data.status === 'success') {
                    toast.success(data.message);
                } else {
                    toast.error(data.message);
                }
            }
            if (typeof loadHistory === 'function') {
                loadHistory();
            }
        };

        const handleNewNotification = (data) => {
            console.log('[NEW_NOTIFICATION RECEIVE]:', data);
            const formattedNotif = {
                id: data.id,
                title: data.title,
                message: data.message || data.content,
                type: data.type || 'info',
                is_read: data.is_read || false,
                createdAt: data.createdAt || new Date()
            };

            setNotifications(prev => {
                if (prev.some(n => n.id === formattedNotif.id || (n.message === formattedNotif.message && Math.abs(new Date(n.createdAt) - new Date(formattedNotif.createdAt)) < 5000))) {
                    return prev;
                }
                return [formattedNotif, ...prev].slice(0, 10);
            });

            if (typeof setUnreadCount === 'function') {
                setUnreadCount(prev => prev + 1);
            }
        };

        socket.on('USER_PIPELINE_UPDATE', handlePipelineUpdate);
        socket.on('USER_JOB_STATUS', handleJobStatus);
        socket.on('NEW_NOTIFICATION', handleNewNotification);

        return () => {
            socket.off('USER_PIPELINE_UPDATE', handlePipelineUpdate);
            socket.off('USER_JOB_STATUS', handleJobStatus);
            socket.off('NEW_NOTIFICATION', handleNewNotification);
        };
    }, [setCredits, setUnreadCount, loadHistory, toast]);

    const handleBellClick = async () => {
        const nextState = !isNotifyOpen;
        setIsNotifyOpen(nextState);
        if (nextState && unreadCount > 0) {
            try {
                await axiosClient.put('/notifications/read-all');
                setUnreadCount(0);
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            } catch (err) {
                console.error('Failed to mark notifications as read:', err);
            }
        }
    };

    const handleClearAll = async () => {
        try {
            await axiosClient.delete('/notifications/clear-all');
            setNotifications([]);
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to clear notifications:', err);
        }
    };

    const mapJobToPreview = (job) => {
        const isVideo = job.type === 'Video' || job.type === 'video' || job.type === 'render_task';
        const isAnalysis = job.type === 'analysis';
        const isImage = job.type === 'Image' || job.type === 'image';
        return {
            id: job.id,
            title: `Tác vụ #${job.id}`,
            sub: job.prompt || 'Không có prompt',
            time: job.createdAt,
            type: isVideo ? 'video' : isAnalysis ? 'analysis' : isImage ? 'image' : 'tts',
            status: job.status,
            progress: job.progress,
            output_url: job.videoUrl || job.output_url,
            image_path: job.image_path,
            image_name: job.image_name,
            prompt_output: job.prompt_output,
            createdAt: job.createdAt || job.created_at,
            ratio: isVideo
                ? (job.aspectRatio || job.ratio || '16:9')
                : isImage
                ? (job.aspectRatio === '9:16' || job.aspect_ratio === '9:16' ? '9:16 Dọc' :
                   job.aspectRatio === '16:9' || job.aspect_ratio === '16:9' ? '16:9 Ngang' : '1:1 Vuông')
                : (job.meta_data?.aspectRatio === '916' ? '9:16 TikTok' : '16:9 Ngang'),
            lang: job.meta_data?.lang === 'vi' ? 'Tiếng Việt' : job.meta_data?.lang === 'en' ? 'Tiếng Anh' : 'Tiếng Nhật',
            voice: job.meta_data?.voice === 'vi-VN-NamMinhNeural' || job.meta_data?.voice === 'vi-male-1' ? 'Adam (Nam)' :
                   job.meta_data?.voice === 'vi-VN-HoaiMyNeural' || job.meta_data?.voice === 'vi-female-1' ? 'Bella (Nữ)' :
                   job.meta_data?.voice || 'Mặc định',
            duration: '10 giây'
        };
    };

    const handleNotificationClick = async (notif) => {
        setIsNotifyOpen(false);

        // ① Đánh dấu thông báo này đã đọc (chỉ thông báo này, không phải tất cả)
        if (!notif.is_read) {
            try {
                // Thử mark riêng, fallback sang mark-all nếu backend chưa có endpoint /read/:id
                await axiosClient.put('/notifications/read-all');
                setUnreadCount(prev => Math.max(0, prev - 1));
                setNotifications(prev =>
                    prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
                );
            } catch (err) {
                console.error('[NOTIF CLICK] Failed to mark as read:', err);
            }
        }

        const titleLower  = (notif.title   || '').toLowerCase();
        const messageLower = (notif.message || '').toLowerCase();

        // ② Trích xuất Job ID từ nội dung thông báo (ví dụ: "#123" hoặc "id: 123")
        const idMatch  = (notif.message + ' ' + notif.title).match(/#(\d+)/);
        const entityId = idMatch ? parseInt(idMatch[1], 10) : (notif.job_id || null);

        console.log('[NOTIF CLICK] id=%s title=%s entityId=%s', notif.id, notif.title, entityId);

        // ══════════════════════════════════════════════════
        // CASE 1: Mắt Thần AI (image-analyzer) -> /dashboard/history with tab 'analysis'
        // ══════════════════════════════════════════════════
        const isMatThan = titleLower.includes('mắt thần') || messageLower.includes('mắt thần') ||
                          titleLower.includes('image analyzer') || messageLower.includes('image analyzer') ||
                          titleLower.includes('phân tích') || messageLower.includes('phân tích');
        if (isMatThan) {
            navigate('/dashboard/history', { state: { openJobId: entityId, targetTab: 'analysis' } });
            return;
        }

        // ══════════════════════════════════════════════════
        // CASE 2: Video AI -> /dashboard/history with tab 'video'
        // ══════════════════════════════════════════════════
        const isVideo = titleLower.includes('video') || messageLower.includes('video');
        if (isVideo) {
            navigate('/dashboard/history', { state: { openJobId: entityId, targetTab: 'video' } });
            return;
        }

        // ══════════════════════════════════════════════════
        // CASE 3: Âm thanh / Giọng nói / TTS -> /dashboard/history with tab 'audio'
        // ══════════════════════════════════════════════════
        const isAudio = titleLower.includes('âm thanh')  || messageLower.includes('âm thanh')  ||
                        titleLower.includes('giọng nói')  || messageLower.includes('giọng nói')  ||
                        titleLower.includes('voice')      || messageLower.includes('voice')      ||
                        titleLower.includes('audio')      || messageLower.includes('audio')      ||
                        titleLower.includes('tts')        || messageLower.includes('tts');
        if (isAudio) {
            navigate('/dashboard/history', { state: { openJobId: entityId, targetTab: 'audio' } });
            return;
        }

        // ══════════════════════════════════════════════════
        // CASE 4: Tạo Ảnh AI -> /dashboard/history with tab 'image'
        // ══════════════════════════════════════════════════
        const isImage = titleLower.includes('ảnh')  || messageLower.includes('ảnh')  ||
                        titleLower.includes('image') || messageLower.includes('image') ||
                        titleLower.includes('vẽ')    || messageLower.includes('vẽ');
        if (isImage) {
            navigate('/dashboard/history', { state: { openJobId: entityId, targetTab: 'image' } });
            return;
        }

        // ══════════════════════════════════════════════════
        // CASE 5: Nạp tiền / Thanh toán / Credits → /dashboard/settings#billing
        // ══════════════════════════════════════════════════
        const isRecharge = titleLower.includes('nạp tiền')   || messageLower.includes('nạp tiền')   ||
                           titleLower.includes('nap tien')   || messageLower.includes('nap tien')   ||
                           titleLower.includes('deposit')    || messageLower.includes('deposit')    ||
                           titleLower.includes('credits')    || messageLower.includes('credits')    ||
                           titleLower.includes('recharge')   || messageLower.includes('recharge')   ||
                           titleLower.includes('thanh toán') || messageLower.includes('thanh toán') ||
                           titleLower.includes('thành công') || messageLower.includes('ví');
        if (isRecharge) {
            navigate('/dashboard/settings#billing-section');
            return;
        }

        // ══════════════════════════════════════════════════
        // CASE 6: Fallback — điều hướng đến trang settings nếu không rõ loại
        // ══════════════════════════════════════════════════
        navigate('/dashboard/settings');
    };
    
    return (
        <header 
            className="h-16 w-full bg-[#0f0f13] border-b border-zinc-850 px-4 sm:px-6 flex items-center justify-between z-30 relative select-none animate-fade-in"
            style={{ height: '64px', backgroundColor: '#0f0f13', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
            {/* GÓC TRÁI: LOGO ĐỘC LẬP & HAMBURGER */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={toggleSidebar}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-zinc-900/60 flex items-center justify-center border-none bg-transparent"
                >
                    <Menu size={18} />
                </button>
                
                <Link to="/dashboard/image-generator" className="flex items-center gap-2 cursor-pointer select-none">
                    <img src="/favicon.svg" alt="AI Studio Logo" className="w-7 h-7 object-contain" />
                    <span className="text-white font-bold tracking-wider text-lg">STUDIO</span>
                </Link>
            </div>

            {/* GÓC PHẢI: TIỀN TỆ + THÔNG BÁO + PROFILE */}
            <div className="flex items-center gap-2.5 sm:gap-4">
                {/* Chỉ số Credits tài khoản */}
                <div className="bg-transparent !p-1 border border-[#f59e0b] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2">
                    <span className="w-4 h-4 rounded-full border border-[#f59e0b] text-[#f59e0b] flex items-center justify-center text-[10px] font-black font-sans leading-none">
                        $
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-[#f59e0b] whitespace-nowrap">
                        {user?.credits !== undefined ? user.credits : credits} Credits
                    </span>
                </div>

                {/* Button Nạp */}
                <button 
                    onClick={() => navigate('/dashboard/settings#billing-section')} 
                    className="!p-1 border border-zinc-800 bg-[#161616]/40 hover:bg-[#1c1c22] text-zinc-400 hover:text-white px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer border-solid"
                >
                    + Nạp
                </button>


                {/* Chuông báo tin nhắn */}
                <div className="relative">
                    <button 
                        onClick={handleBellClick}
                        className="p-2 hover:bg-zinc-900/60 rounded-full text-zinc-400 hover:text-white cursor-pointer relative transition-all bg-transparent border-none flex items-center justify-center focus:outline-none"
                    >
                        <Bell size={22} />
                        {unreadCount > 0 && (
                            <span className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 w-4 h-4 min-w-[16px] bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center leading-none">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {isNotifyOpen && (
                        <div className="!p-3 absolute right-0 mt-3 w-80 bg-[#18181c] border border-zinc-800/60 rounded-xl shadow-2xl shadow-black/80 z-50 text-left overflow-hidden select-none">
                            <div className="!p-3 flex items-center justify-between p-4 border-b border-zinc-800/80">
                                <span className="text-xs font-black tracking-widest text-zinc-400 uppercase">THÔNG BÁO HỆ THỐNG</span>
                                <div className=" flex items-center gap-2">
                                    <button 
                                        onClick={handleClearAll}
                                        className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer p-1 hover:bg-zinc-800 rounded-lg bg-transparent border-none flex items-center justify-center"
                                        title="Xóa tất cả"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setIsNotifyOpen(false)}
                                        className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer p-1 hover:bg-zinc-800 rounded-lg bg-transparent border-none flex items-center justify-center"
                                        title="Đóng"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="max-h-[360px] overflow-y-auto divide-y divide-zinc-800/40">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-zinc-500 text-[11px] font-bold tracking-wider uppercase select-none">
                                        Không có thông báo mới
                                    </div>
                                ) : (
                                    notifications.map((notif) => (
                                        <div key={notif.id} onClick={() => handleNotificationClick(notif)} className="flex gap-2.5 p-3 items-start hover:bg-zinc-800/30 transition-all cursor-pointer">
                                            {notif.type === 'info' && (
                                                <div className="w-6 h-6 min-w-[24px] rounded-md bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                                                    <Check size={14} />
                                                </div>
                                            )}
                                            {notif.type === 'warning' && (
                                                <div className="w-6 h-6 min-w-[24px] rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                                                    <AlertTriangle size={14} />
                                                </div>
                                            )}
                                            {notif.type === 'error' && (
                                                <div className="w-6 h-6 min-w-[24px] rounded-md bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                                    <X size={14} />
                                                </div>
                                            )}
                                            
                                            <div className="!p-2  flex-1 flex flex-col gap-1">
                                                <p className="text-[12px] text-zinc-200 font-medium leading-normal">{notif.message}</p>
                                                <span className="text-[10px] text-zinc-500 font-normal leading-none mt-0.5">{formatTime(notif.createdAt)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <button 
                                onClick={() => {
                                    setIsNotifyOpen(false);
                                    navigate('/dashboard/settings');
                                }}
                                className="w-full text-center py-3 text-[11px] font-bold text-zinc-400 hover:text-[#f59e0b] border-t border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 transition-all tracking-wider uppercase rounded-b-xl border-none cursor-pointer"
                            >
                                XEM TẤT CẢ THÔNG BÁO
                            </button>
                        </div>
                    )}
                </div>

                {/* Profile Avatar bubble */}
                <div 
                    onClick={() => navigate('/dashboard/settings#profile-section')}
                    className="w-8 h-8 rounded-full border border-zinc-850 overflow-hidden cursor-pointer shadow-md hover:ring-1 hover:ring-[#f59e0b]/30 transition-all shrink-0 flex items-center justify-center bg-zinc-900"
                >
                    {avatar ? (
                        <img 
                            src={getAvatarUrl(avatar)} 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                        />
                    ) : (
                        <span className="text-white font-bold text-xs">
                            {name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'TD'}
                        </span>
                    )}
                </div>
            </div>
        </header>
    );
}