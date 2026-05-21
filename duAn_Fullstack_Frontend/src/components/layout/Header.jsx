import React from 'react';
import { Bell } from 'lucide-react';

export default function Header({ credits = 140, onOpenModal }) {
    return (
        <header 
            className="h-16 w-full bg-[#0f0f13] border-b border-zinc-850 px-6 flex items-center justify-between z-30 relative select-none"
            style={{ height: '64px', backgroundColor: '#0f0f13', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
            {/* GÓC TRÁI: LOGO ĐỘC LẬP */}
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f59e0b] flex items-center justify-center font-black text-black text-sm shadow-md shadow-amber-500/10">
                    AS
                </div>
                <span className="text-sm font-black uppercase tracking-wider text-white">
                    AI Studio
                </span>
            </div>

            {/* GÓC PHẢI: TIỀN TỆ + THÔNG BÁO + PROFILE */}
            <div className="flex items-center gap-4">
                {/* Chỉ số Credits tài khoản */}
                <div className="bg-transparent border border-[#f59e0b] px-3.5 py-1.5 rounded-full flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border border-[#f59e0b] text-[#f59e0b] flex items-center justify-center text-[10px] font-black font-sans leading-none">
                        $
                    </span>
                    <span className="text-xs font-bold text-[#f59e0b]">
                        {credits} Credits
                    </span>
                </div>

                {/* Button Nạp */}
                <button 
                    onClick={() => onOpenModal && onOpenModal('recharge')} 
                    className="border border-zinc-800 bg-[#161616]/40 hover:bg-[#1c1c22] text-zinc-400 hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:border-zinc-700 transition-all cursor-pointer"
                >
                    + Nạp
                </button>

                {/* Chuông báo tin nhắn */}
                <div className="p-2 hover:bg-zinc-900/60 rounded-full text-zinc-400 hover:text-white cursor-pointer relative transition-all">
                    <Bell size={16} />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                </div>

                {/* Profile TD initials bubble */}
                <div 
                    onClick={() => onOpenModal && onOpenModal('profile')}
                    className="w-8 h-8 rounded-full bg-[#854d0e] text-white flex items-center justify-center font-bold text-xs cursor-pointer shadow-md shadow-amber-500/10 hover:ring-1 hover:ring-[#f59e0b]/30 transition-all"
                >
                    TD
                </div>
            </div>
        </header>
    );
}