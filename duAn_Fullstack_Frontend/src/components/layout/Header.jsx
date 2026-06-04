import React, { useState, useEffect } from 'react';
import { Bell, Menu, AlertTriangle, Trash2, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../services/axiosClient';

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

export default function Header({ credits = 140, toggleSidebar, avatar, name, setPreviewJob }) {
    const navigate = useNavigate();
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
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

                const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const url = `${baseURL}/notifications/stream`;

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
            isMounted = false;
            controller.abort();
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, []);

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
        return {
            id: job.id,
            title: isAnalysis ? job.image_name : job.name,
            sub: isAnalysis ? job.prompt_output : job.prompt,
            time: new Date(job.createdAt || job.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(job.createdAt || job.created_at).toLocaleDateString('vi-VN'),
            type: isVideo ? 'video' : isAnalysis ? 'analysis' : 'tts',
            status: job.status,
            progress: job.progress,
            output_url: job.output_url,
            image_path: job.image_path,
            image_name: job.image_name,
            prompt_output: job.prompt_output,
            createdAt: job.createdAt || job.created_at,
            ratio: job.meta_data?.aspectRatio === '916' ? '9:16 TikTok' : '16:9 Ngang',
            lang: job.meta_data?.lang === 'vi' ? 'Tiếng Việt' : job.meta_data?.lang === 'en' ? 'Tiếng Anh' : 'Tiếng Nhật',
            voice: job.meta_data?.voice === 'vi-VN-NamMinhNeural' || job.meta_data?.voice === 'vi-male-1' ? 'Adam (Nam)' :
                   job.meta_data?.voice === 'vi-VN-HoaiMyNeural' || job.meta_data?.voice === 'vi-female-1' ? 'Bella (Nữ)' :
                   job.meta_data?.voice || 'Mặc định',
            duration: '10 giây'
        };
    };

    const handleNotificationClick = async (notif) => {
        setIsNotifyOpen(false);

        // Mark all as read if we clicked a notification
        if (!notif.is_read) {
            try {
                await axiosClient.put('/notifications/read-all');
                setUnreadCount(0);
                setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            } catch (err) {
                console.error('Failed to mark notifications as read on click:', err);
            }
        }

        const titleLower = (notif.title || '').toLowerCase();
        const messageLower = (notif.message || '').toLowerCase();

        // Extract ID (e.g., from "#123")
        const match = notif.message.match(/#(\d+)/) || notif.title.match(/#(\d+)/);
        const entityId = match ? parseInt(match[1], 10) : null;

        // Case 1: Mắt Thần AI (Thành công/Thất bại)
        const isMatThan = titleLower.includes('mắt thần') || messageLower.includes('mắt thần');
        if (isMatThan) {
            if (entityId) {
                navigate(`/dashboard/mat-than/detail/${entityId}`);
            } else {
                setIsNotifLoading(true);
                try {
                    const data = await axiosClient.get('/user/history');
                    if (Array.isArray(data)) {
                        const analysisJobs = data.filter(job => job.type === 'analysis');
                        if (analysisJobs.length > 0) {
                            analysisJobs.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
                            navigate(`/dashboard/mat-than/detail/${analysisJobs[0].id}`);
                        } else {
                            navigate('/dashboard/mat-than');
                        }
                    } else {
                        navigate('/dashboard/mat-than');
                    }
                } catch (err) {
                    console.error('Failed to fetch history for Mắt Thần routing:', err);
                    navigate('/dashboard/mat-than');
                } finally {
                    setIsNotifLoading(false);
                }
            }
            return;
        }

        // Case 2: Video AI
        const isVideo = titleLower.includes('video') || messageLower.includes('video');
        if (isVideo) {
            setIsNotifLoading(true);
            try {
                const data = await axiosClient.get('/user/history');
                if (Array.isArray(data)) {
                    let job = null;
                    if (entityId) {
                        job = data.find(j => j.id === entityId);
                    }
                    if (!job) {
                        // Fallback to latest video job
                        const videoJobs = data.filter(j => j.type === 'Video' || j.type === 'video' || j.type === 'render_task');
                        if (videoJobs.length > 0) {
                            videoJobs.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
                            job = videoJobs[0];
                        }
                    }
                    if (job && typeof setPreviewJob === 'function') {
                        setPreviewJob(mapJobToPreview(job));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch history for video preview:', err);
            } finally {
                setIsNotifLoading(false);
            }
            return;
        }

        // Case 3: Giọng Nói/Âm Thanh AI
        const isAudio = titleLower.includes('âm thanh') || messageLower.includes('âm thanh') ||
                        titleLower.includes('giọng nói') || messageLower.includes('giọng nói') ||
                        titleLower.includes('voice') || messageLower.includes('voice') ||
                        titleLower.includes('audio') || messageLower.includes('audio');
        if (isAudio) {
            setIsNotifLoading(true);
            try {
                const data = await axiosClient.get('/user/history');
                if (Array.isArray(data)) {
                    let job = null;
                    if (entityId) {
                        job = data.find(j => j.id === entityId);
                    }
                    if (!job) {
                        // Fallback to latest audio job
                        const audioJobs = data.filter(j => j.type !== 'Video' && j.type !== 'video' && j.type !== 'render_task' && j.type !== 'analysis');
                        if (audioJobs.length > 0) {
                            audioJobs.sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
                            job = audioJobs[0];
                        }
                    }
                    if (job && typeof setPreviewJob === 'function') {
                        setPreviewJob(mapJobToPreview(job));
                    }
                }
            } catch (err) {
                console.error('Failed to fetch history for audio preview:', err);
            } finally {
                setIsNotifLoading(false);
            }
            return;
        }

        // Case 4: Recharge / Wallet / Khác
        const isRecharge = titleLower.includes('nạp tiền') || messageLower.includes('nạp tiền') ||
                           titleLower.includes('credits') || messageLower.includes('credits') ||
                           titleLower.includes('recharge') || messageLower.includes('recharge') ||
                           titleLower.includes('thanh toán') || messageLower.includes('ví');
        if (isRecharge) {
            navigate('/dashboard/settings#billing-section');
            return;
        }
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
                
                <div className="flex items-center gap-2 select-none">
                    <span className="bg-[#3b82f6] !text-white !px-1.5 !py-0.5 !rounded-md !text-[12px] !sm:text-[11px] !font-black !tracking-wider !leading-none shrink-0">
            AI
          </span>
                    <span className="text-sm font-black uppercase tracking-wider text-white whitespace-nowrap">
                         Studio
                    </span>
                </div>
            </div>

            {/* GÓC PHẢI: TIỀN TỆ + THÔNG BÁO + PROFILE */}
            <div className="flex items-center gap-2.5 sm:gap-4">
                {/* Chỉ số Credits tài khoản */}
                <div className="bg-transparent border border-[#f59e0b] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full flex items-center gap-1.5 sm:gap-2">
                    <span className="w-4 h-4 rounded-full border border-[#f59e0b] text-[#f59e0b] flex items-center justify-center text-[10px] font-black font-sans leading-none">
                        $
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-[#f59e0b] whitespace-nowrap">
                        {credits} Credits
                    </span>
                </div>

                {/* Button Nạp */}
                <button 
                    onClick={() => navigate('/dashboard/settings#billing-section')} 
                    className="border border-zinc-800 bg-[#161616]/40 hover:bg-[#1c1c22] text-zinc-400 hover:text-white px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold transition-all cursor-pointer border-solid"
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
                            src={avatar.startsWith('data:') ? avatar : avatar} 
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