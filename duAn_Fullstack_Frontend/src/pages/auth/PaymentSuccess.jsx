import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import axiosClient from '../../services/axiosClient';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderCode = searchParams.get('orderCode') || searchParams.get('order_code') || searchParams.get('search');
  const [amount, setAmount] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Kích hoạt pháo hoa chúc mừng
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#a855f7', '#f59e0b', '#10b981']
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#a855f7', '#f59e0b', '#10b981']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    
    frame();
  }, []);

  useEffect(() => {
    console.log("orderCode from URL:", orderCode);
    if (orderCode) {
      setLoading(true);
      axiosClient.get(`/user/payment/detail/${orderCode}`)
        .then(res => {
          console.log("Payment data response:", res);
          if (res && res.success && res.data) {
            setAmount(res.data.amount);
            setCreatedAt(res.data.createdAt || res.data.created_at);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Lỗi khi lấy chi tiết thanh toán:', err);
          setLoading(false);
        });
    }
  }, [orderCode]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '...';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '...';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background neon blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0f0f13] border border-emerald-500/30 rounded-3xl p-8 text-center shadow-2xl shadow-emerald-500/5 backdrop-blur-md relative z-10">
        
        {/* Animated tick circle */}
        <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-400 relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-ping" />
          <CheckCircle2 size={18} className="relative z-10" />
        </div>

        {/* Title */}
        <div className="space-y-2 mb-6 text-center" style={{ textAlign: 'center' }}>
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mx-auto">
            <Sparkles size={10} /> Đã xác nhận
          </div>
          <h1 className="!p-2 text-xl md:text-3xl font-black text-white uppercase tracking-wider text-center" style={{ textAlign: 'center' }}>
            Nạp Tiền Thành Công!
          </h1>
          <p className="!p-2 text-xs text-zinc-400 font-semibold leading-relaxed max-w-sm mx-auto text-center" style={{ textAlign: 'center', display: 'block', margin: '0 auto' }}>
            Cảm ơn bạn! Giao dịch nạp gói cước qua cổng PayOS đã hoàn tất. Số dư Credits mới đã được cộng vào tài khoản của bạn.
          </p>
        </div>

        {/* Details Card */}
        <div className="!p-2 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 mb-8 space-y-3 text-left">
          <div className="!p-2 flex justify-between items-center text-xs border-b border-zinc-850 pb-2.5">
            <span className="text-zinc-500 font-semibold">Cổng thanh toán</span>
            <span className="text-white font-bold">PayOS (VietQR)</span>
          </div>
          <div className="!p-2 flex justify-between items-center text-xs border-b border-zinc-850 pb-2.5">
            <span className="text-zinc-500 font-semibold">Mã giao dịch</span>
            <span className="text-white font-bold select-text">{orderCode || 'N/A'}</span>
          </div>
          <div className="!p-2 flex justify-between items-center text-xs border-b border-zinc-850 pb-2.5">
            <span className="text-zinc-500 font-semibold">Giao dịch thành công - số tiền</span>
            <span className="text-emerald-400 font-bold">
              {loading ? 'Đang tải...' : amount ? `${Number(amount).toLocaleString('vi-VN')} đ` : '... đ'}
            </span>
          </div>
          <div className="!p-2 flex justify-between items-center text-xs border-b border-zinc-850 pb-2.5">
            <span className="text-zinc-500 font-semibold">Thời gian giao dịch</span>
            <span className="text-white font-semibold">
              {loading ? 'Đang tải...' : createdAt ? formatDate(createdAt) : '...'}
            </span>
          </div>
          <div className="!p-2 flex justify-between items-center text-xs">
            <span className="text-zinc-500 font-semibold">Trạng thái giao dịch</span>
            <span className="text-emerald-400 font-black uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Thành công</span>
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="!p-2 !mt-1 w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-black uppercase text-xs tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 border-none shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
        >
          <span>Vào Dashboard của tôi</span>
          <ArrowRight size={14} />
        </button>

      </div>
    </div>
  );
}
