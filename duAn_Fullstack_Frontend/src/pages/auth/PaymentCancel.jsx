import React from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function PaymentCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background neon blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f0f13] border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl shadow-red-500/5 backdrop-blur-md relative z-10">
        
        {/* Animated warning circle */}
        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-400 relative">
          <XCircle size={36} />
        </div>

        {/* Title */}
        <div className="space-y-2 mb-6">
          <div className="inline-flex items-center gap-1.5 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
            <AlertTriangle size={10} /> Đã hủy bỏ
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-wider">
            Giao Dịch Bị Hủy!
          </h1>
          <p className="text-xs text-zinc-400 font-semibold leading-relaxed max-w-sm mx-auto">
            Yêu cầu thanh toán của bạn đã bị hủy bỏ bởi người dùng hoặc đã hết hạn. Bạn không bị trừ bất kỳ khoản tiền nào từ tài khoản ngân hàng.
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 mb-8 space-y-3 text-left">
          <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2.5">
            <span className="text-zinc-500 font-semibold">Cổng thanh toán</span>
            <span className="text-white font-bold">PayOS (VietQR)</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-semibold">Trạng thái</span>
            <span className="text-red-400 font-bold uppercase tracking-wider">Giao dịch bị hủy</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/dashboard/settings#billing-section')}
          className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border-none shadow-lg active:scale-[0.98]"
        >
          <ArrowLeft size={14} />
          <span>Quay lại Cài đặt gói cước</span>
        </button>

      </div>
    </div>
  );
}
