/**
 * EyeSelectionModal.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Modal popup để người dùng chọn lịch sử phân tích từ Mắt Thần AI,
 * sau đó đồng bộ Ảnh & Prompt sang các ô nhập liệu ở Video AI Studio.
 *
 * Props:
 *   isOpen         {boolean}  — trạng thái mở/đóng modal
 *   onClose        {function} — đóng modal (không đồng bộ)
 *   onConfirmSync  {function} — callback trả object log đã chọn về Main View
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Eye, Clock, CheckCircle2, Loader2, ImageIcon, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import axiosClient from '../../services/axiosClient';

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Chuyển đường dẫn tương đối từ backend thành URL đầy đủ để hiển thị ảnh.
 * Ưu tiên biến ENV VITE_API_BASE_URL, fallback về localhost:3000.
 */
const getFullImageUrl = (imagePath) => {
  if (!imagePath) return '';
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
      : '') ||
    'http://localhost:3000';
  return `${baseUrl}${imagePath}`;
};

/**
 * Định dạng thời gian tương đối (vd: "5 phút trước", "2 giờ trước").
 */
const timeAgo = (dateStr) => {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'Vừa xong';
  if (mins < 60)  return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  if (h < 24)     return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 30)     return `${d} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

/**
 * Trích xuất đoạn prompt tiếng Anh ngắn gọn từ prompt_output của Mắt Thần AI
 * để hiển thị tooltip / preview trong card.
 * Regex khớp với cấu trúc SUPER_PROMPT của backend.
 */
const extractEnglishPrompt = (rawOutput) => {
  if (!rawOutput) return '';
  // Cố gắng trích section "PROMPT SINH VIDEO...TIẾNG ANH"
  const match = rawOutput.match(
    /PROMPT\s+SINH\s+VIDEO\s+CHO\s+AI\s+B[ẰA]NG\s+TI[ÊE]NG\s+ANH[^\n]*\n+([\s\S]+?)(?:\n{2,}|---|$)/i
  );
  if (match && match[1]) return match[1].trim();
  // Fallback: lấy đoạn đầu tiên đủ dài
  const alt = rawOutput.match(/(?:PROMPT|VIDEO PROMPT)[^\n]*\n+([\s\S]{20,400})/i);
  if (alt && alt[1]) return alt[1].trim();
  return rawOutput.slice(0, 300).trim();
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENT: LogCard
// ══════════════════════════════════════════════════════════════════════════════

const LogCard = ({ log, isSelected, onSelect, index }) => {
  const imgUrl       = getFullImageUrl(log.image_path);
  const prompt       = extractEnglishPrompt(log.prompt_output);
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(log)}
      title={log.image_name || `Log #${log.id}`}
      className={`
        group relative flex flex-col rounded-2xl overflow-hidden text-left
        border-2 transition-all duration-250 cursor-pointer
        focus:outline-none focus-visible:ring-2 focus-visible:ring-[#deff9a]/50
        ${isSelected
          ? 'border-[#deff9a] shadow-lg shadow-[#deff9a]/15 scale-[1.025]'
          : 'border-[#2a2a2a] hover:border-[#deff9a]/40 hover:scale-[1.015]'
        }
      `}
      style={{
        animationDelay: `${index * 40}ms`,
      }}
    >
      {/* ── Thumbnail ── */}
      <div className="relative w-full aspect-square bg-[#111] overflow-hidden">
        {imgUrl && !imgError ? (
          <img
            src={imgUrl}
            alt={log.image_name || `Log #${log.id}`}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <ImageIcon className="w-8 h-8 text-[#333]" />
          </div>
        )}

        {/* Overlay gradient khi hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Selected badge */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#deff9a] flex items-center justify-center shadow-md shadow-[#deff9a]/30">
            <CheckCircle2 className="w-4 h-4 text-black" />
          </div>
        )}

        {/* Log ID overlay (bottom-left) */}
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <p className="text-[10px] text-white/90 font-mono leading-tight line-clamp-2">
            {prompt ? prompt.slice(0, 70) + '…' : ''}
          </p>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        className={`
          px-2.5 py-2 transition-colors duration-200
          ${isSelected ? 'bg-[#deff9a]/8' : 'bg-[#141414] group-hover:bg-[#1c1c1c]'}
        `}
      >
        <p
          className={`!p-1 text-[11px] font-bold leading-tight truncate
            ${isSelected ? 'text-[#deff9a]' : 'text-slate-200'}`}
        >
          Video #{log.id}
        </p>
        <div className="!p-1 flex items-center gap-1 mt-0.5">
          <Clock className={`w-2.5 h-2.5 flex-shrink-0 ${isSelected ? 'text-[#deff9a]/70' : 'text-slate-600'}`} />
          <span className={`text-[9px] leading-none ${isSelected ? 'text-[#deff9a]/70' : 'text-slate-600'}`}>
            {timeAgo(log.created_at || log.createdAt)}
          </span>
        </div>
      </div>
    </button>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: EyeSelectionModal
// ══════════════════════════════════════════════════════════════════════════════

export default function EyeSelectionModal({ isOpen, onClose, onConfirmSync }) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [logs,          setLogs]          = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [isSyncing,     setIsSyncing]     = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const overlayRef = useRef(null);

  // ── Fetch lịch sử khi modal mở ────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/image-analyzer/mat-than-logs');
      if (res?.success) {
        setLogs(res.logs || []);
      } else {
        setError('Không thể tải lịch sử phân tích. Vui lòng thử lại.');
      }
    } catch (err) {
      console.error('[EyeSelectionModal] fetchLogs error:', err?.message);
      setError('Lỗi kết nối tới server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setSelectedLogId(null);
      setError('');
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // ── Đóng khi bấm Escape ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ── Khóa scroll trang nền khi modal mở ───────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectLog = useCallback((log) => {
    setSelectedLogId(prev => prev === log.id ? null : log.id);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!selectedLogId) return;
    const selectedLog = logs.find(l => l.id === selectedLogId);
    if (!selectedLog) return;

    setIsSyncing(true);
    // Giả lập độ trễ nhỏ để hiệu ứng trông mượt mà hơn
    await new Promise(r => setTimeout(r, 400));
    onConfirmSync(selectedLog);
    setIsSyncing(false);
  }, [selectedLogId, logs, onConfirmSync]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedLog = logs.find(l => l.id === selectedLogId);

  // ── Không render gì khi đóng ──────────────────────────────────────────────
  if (!isOpen) return null;

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.88)' }}
    >
      {/* Hiệu ứng backdrop blur */}
      <div className="absolute inset-0 backdrop-blur-[3px] pointer-events-none" />

      {/* ── Modal Box ─────────────────────────────────────────────────────── */}
      <div
        className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col
                   rounded-2xl border border-[#333] overflow-hidden
                   shadow-2xl shadow-black/60"
        style={{ backgroundColor: '#1a1a1a' }}
      >

        {/* ═══ HEADER ════════════════════════════════════════════════════ */}
        <div className="!p-2 flex-shrink-0 flex items-start justify-between gap-4
                        px-6 py-4 border-b border-[#2a2a2a]"
             style={{ backgroundColor: '#161616' }}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Icon Mắt Thần */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl
                            bg-gradient-to-br from-[#deff9a]/20 to-emerald-500/10
                            border border-[#deff9a]/25
                            flex items-center justify-center
                            shadow-inner shadow-[#deff9a]/5">
              <Eye className="w-5 h-5 text-[#deff9a]" />
            </div>

            <div className="min-w-0">
              <h2 className="text-[15px] font-black text-white leading-tight tracking-tight">
                Chọn Lịch sử Phân tích từ Mắt Thần AI
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                Bấm vào một bản phân tích thành công để tự động nạp&nbsp;
                <span className="text-[#deff9a]/80 font-semibold">Ảnh</span>
                &nbsp;&amp;&nbsp;
                <span className="text-[#deff9a]/80 font-semibold">Prompt</span>
                &nbsp;vào Studio
              </p>
            </div>
          </div>

          {/* Nút đóng [X] */}
          <button
            type="button"
            onClick={onClose}
            title="Đóng (Esc)"
            className="flex-shrink-0 w-8 h-8 rounded-xl
                       bg-[#252525] border border-[#333]
                       text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/40
                       flex items-center justify-center
                       transition-all duration-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ═══ BODY — Grid Lịch Sử ═══════════════════════════════════════ */}
        <div className="!p-2 flex-1 overflow-y-auto px-6 py-5 min-h-0
                        scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">

          {/* State: Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none"
                    stroke="url(#eyeGrad)" strokeWidth="3"
                    strokeDasharray="120 56" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="eyeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#deff9a" />
                      <stop offset="100%" stopColor="#86efac" />
                    </linearGradient>
                  </defs>
                </svg>
                <Eye className="w-6 h-6 text-[#deff9a]" />
              </div>
              <p className="text-sm text-slate-400 font-medium">Đang tải lịch sử phân tích...</p>
            </div>
          )}

          {/* State: Lỗi */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25
                              flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-red-300">Không thể tải dữ liệu</p>
                <p className="text-xs text-slate-500 mt-1">{error}</p>
              </div>
              <button
                type="button"
                onClick={fetchLogs}
                className="flex items-center gap-2 px-4 py-2 rounded-xl
                           bg-[#252525] border border-[#333] text-slate-300
                           hover:border-[#deff9a]/40 hover:text-[#deff9a]
                           text-xs font-semibold transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Thử lại
              </button>
            </div>
          )}

          {/* State: Không có dữ liệu */}
          {!loading && !error && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#252525] border border-[#333]
                              flex items-center justify-center">
                <Eye className="w-8 h-8 text-[#333]" />
              </div>
              <div className="text-center max-w-xs">
                <p className="text-sm font-bold text-slate-400">Chưa có lịch sử phân tích</p>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  Bạn chưa có bản phân tích ảnh thành công nào từ Mắt Thần AI. Hãy thử phân tích một sản phẩm trước!
                </p>
              </div>
            </div>
          )}

          {/* State: Có dữ liệu — Grid 4 cột */}
          {!loading && !error && logs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {logs.map((log, i) => (
                <LogCard
                  key={log.id}
                  log={log}
                  index={i}
                  isSelected={selectedLogId === log.id}
                  onSelect={handleSelectLog}
                />
              ))}
            </div>
          )}
        </div>

        {/* ═══ FOOTER — Preview + Nút hành động ═════════════════════════ */}
        <div className="flex-shrink-0 border-t border-[#2a2a2a]"
             style={{ backgroundColor: '#161616' }}>

          {/* Preview dải thông tin bản log đang chọn */}
          {selectedLog && (
            <div className="!p-2 flex items-center gap-3 px-6 py-3 border-b border-[#222]">
              {/* Thumbnail mini */}
              <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-[#deff9a]/30 bg-[#111]">
                {selectedLog.image_path ? (
                  <img
                    src={getFullImageUrl(selectedLog.image_path)}
                    alt={selectedLog.image_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-[#333]" />
                  </div>
                )}
              </div>

              {/* Thông tin */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-[#deff9a] truncate">
                   Đã chọn: Video #{selectedLog.id} — {selectedLog.image_name || 'Ảnh không tên'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {extractEnglishPrompt(selectedLog.prompt_output)?.slice(0, 90) || '—'}…
                </p>
              </div>

              {/* Badge */}
              <div className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5
                              rounded-full bg-[#deff9a]/10 border border-[#deff9a]/25">
                <Zap className="w-2.5 h-2.5 text-[#deff9a]" />
                <span className="text-[9px] font-bold text-[#deff9a]">SẴN SÀNG</span>
              </div>
            </div>
          )}

          {/* Nút hành động */}
          <div className="!p-2 flex items-center justify-between gap-3 px-6 py-4">
            {/* Nút refresh nhỏ bên trái */}
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              title="Làm mới danh sách"
              className="!p-1 flex items-center gap-1.5 px-3 py-2 rounded-xl
                         bg-[#252525] border border-[#333] text-slate-500
                         hover:text-slate-300 hover:border-[#444]
                         text-[11px] font-medium transition-all duration-200
                         disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Làm mới
            </button>

            {/* Nhóm nút chính bên phải */}
            <div className="flex items-center gap-3">
              {/* Hủy bỏ */}
              <button
                type="button"
                onClick={onClose}
                className="!p-1 px-5 py-2.5 rounded-xl
                           bg-[#252525] border border-[#333]
                           text-slate-300 hover:text-white hover:border-[#444]
                           text-sm font-semibold transition-all duration-200 cursor-pointer"
              >
                Hủy bỏ
              </button>

              {/* Kích hoạt đồng bộ */}
              <button
                type="button"
                id="btn-activate-sync"
                onClick={handleConfirm}
                disabled={!selectedLogId || isSyncing}
                className={`
                  !p-1 flex items-center gap-2 px-6 py-2.5 rounded-xl
                  text-sm font-black transition-all duration-300
                  ${selectedLogId && !isSyncing
                    ? 'bg-[#deff9a] hover:bg-[#e8ffb0] text-black shadow-lg shadow-[#deff9a]/25 hover:shadow-[#deff9a]/40 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-[#2a2a2a] text-slate-600 cursor-not-allowed border border-[#333]'
                  }
                `}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Đang đồng bộ...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Kích hoạt đồng bộ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
