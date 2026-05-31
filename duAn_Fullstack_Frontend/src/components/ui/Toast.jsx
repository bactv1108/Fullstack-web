import React, { useEffect } from 'react';
import { Sparkles, X, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export default function Toast({ show, message, type = 'success', onClose }) {
    useEffect(() => {
        if (show && onClose) {
            const timer = setTimeout(onClose, 3000);
            return () => clearTimeout(timer);
        }
    }, [show, onClose]);

    if (!show) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <Sparkles size={16} className="text-[#f59e0b] shrink-0" />;
            case 'error':
                return <AlertCircle size={16} className="text-red-500 shrink-0" />;
            case 'info':
            default:
                return <Info size={16} className="text-blue-400 shrink-0" />;
        }
    };

    const getBorderColor = () => {
        switch (type) {
            case 'success':
                return 'border-[#f59e0b]/30 shadow-amber-500/5';
            case 'error':
                return 'border-red-500/30 shadow-red-500/5';
            case 'info':
            default:
                return 'border-blue-500/30 shadow-blue-500/5';
        }
    };

    return (
        <div className={`fixed bottom-6 right-6 bg-[#121212] border-2 ${getBorderColor()} rounded-xl px-4 py-3 shadow-2xl z-[9999] flex items-center gap-2.5 max-w-sm animate-slide-up`}>
            {getIcon()}
            <p className="text-xs font-bold text-zinc-100">{message}</p>
            {onClose && (
                <button
                    onClick={onClose}
                    className="ml-2 text-zinc-500 hover:text-white transition-all cursor-pointer focus:outline-none"
                    aria-label="Đóng"
                >
                    <X size={12} />
                </button>
            )}
        </div>
    );
}
