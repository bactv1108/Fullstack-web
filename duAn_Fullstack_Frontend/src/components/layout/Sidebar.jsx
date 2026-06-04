import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Mic, Eye, Clock, Settings, X } from 'lucide-react';

export default function Sidebar({ 
    currentMenu = 'video', 
    setCurrentMenu, 
    isOpen, 
    setIsOpen,
    historyList = []
}) {
    const navigate = useNavigate();

    const menus = [
        { id: 'image-generator', label: 'Tạo Ảnh AI', icon: Image, path: '/dashboard/image-generator' },
        { id: 'tts', label: 'Tạo Giọng Nói', icon: Mic, path: '/dashboard/tts' },
        { id: 'image-analyzer', label: 'Mắt Thần AI', icon: Eye, path: '/dashboard/image-analyzer' },
        { id: 'history', label: 'Lịch sử', icon: Clock, path: '/dashboard/history' },
        { id: 'settings', label: 'Cài đặt', icon: Settings, path: '/dashboard/settings' },
    ];

    return (
        <aside 
            className={`fixed inset-y-0 left-0 w-56 bg-[#0f0f13] border-r border-zinc-850 flex flex-col justify-between h-full z-40 transition-transform duration-300 transform ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            } shrink-0 p-4`}
            style={{ backgroundColor: '#0f0f13', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
            <div className="!p-2 flex flex-col gap-1 w-full flex-1 min-h-0">
                {/* Mobile close button in sidebar */}
                <div className="flex items-center justify-between pb-4 border-b border-zinc-800/40 mb-2 px-1">
                    <span className="text-[18px] font-black uppercase text-zinc-500 tracking-widest">Menu</span>
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer border-none bg-transparent"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-1">
                    {menus.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentMenu === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (setCurrentMenu) {
                                        setCurrentMenu(item.id);
                                    }
                                    navigate(item.path);
                                    if (setIsOpen) setIsOpen(false); // Auto close sidebar
                                }}
                                style={{
                                    backgroundColor: isActive ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                    color: isActive ? '#f59e0b' : '#8a8a93'
                                }}
                                className="!p-4 w-full flex items-center gap-3.5 px-5 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 text-left border-none cursor-pointer hover:bg-zinc-900/60 hover:text-[#f59e0b] hover:translate-x-1"
                            >
                                <Icon size={14} className={isActive ? "text-[#f59e0b]" : "text-zinc-400"} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </div>

            </div>
            
            {/* Empty footer area */}
            <div></div>
        </aside>
    );
}