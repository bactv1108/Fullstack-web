import React from 'react';
import { Video, Mic, Clock, Settings } from 'lucide-react';

export default function Sidebar({ currentMenu = 'video', setCurrentMenu, onOpenModal }) {
    const menus = [
        { id: 'video', label: 'Tạo Video', icon: Video },
        { id: 'tts', label: 'Tạo Giọng Nói', icon: Mic },
        { id: 'history', label: 'Lịch sử', icon: Clock },
        { id: 'settings', label: 'Cài đặt', icon: Settings },
    ];

    return (
        <aside style={{ width: '200px', backgroundColor: '#0f0f13', borderRight: '1px solid rgba(255,255,255,0.06)' }} className="h-full p-4 flex flex-col justify-between shrink-0">
            <div className="flex flex-col gap-1 w-full">
                {menus.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentMenu === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => {
                                if (item.id === 'settings') {
                                    if (onOpenModal) onOpenModal('settings');
                                } else if (setCurrentMenu) {
                                    setCurrentMenu(item.id);
                                }
                            }}
                            style={{
                                backgroundColor: isActive ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                                color: isActive ? '#f59e0b' : '#8a8a93'
                            }}
                            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left border-none cursor-pointer hover:bg-zinc-900/60 hover:text-white"
                        >
                            <Icon size={14} className={isActive ? "text-[#f59e0b]" : "text-zinc-400"} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </div>
            
            {/* Empty footer area to align with the screenshot */}
            <div></div>
        </aside>
    );
}