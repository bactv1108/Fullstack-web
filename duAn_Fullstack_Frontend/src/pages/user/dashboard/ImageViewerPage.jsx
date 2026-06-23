import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Image as ImageIcon,
  Maximize2,
  Wand2,
  Copy,
  Check,
} from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

// ─── Helper: ghép full URL ảnh từ đường dẫn tương đối ───────────────────────
const getFullImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
      : '') ||
    'http://localhost:3000';
  return `${baseUrl}${path}`;
};

// ─── Badge trạng thái job ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Completed: {
      icon: <CheckCircle2 size={12} />,
      label: 'Hoàn thành',
      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    Failed: {
      icon: <XCircle size={12} />,
      label: 'Thất bại',
      cls: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    Rendering: {
      icon: <Loader2 size={12} className="animate-spin" />,
      label: 'Đang vẽ...',
      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
    Pending: {
      icon: <Clock size={12} />,
      label: 'Chờ xử lý',
      cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    },
  };
  const cfg = map[status] || map['Pending'];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider ${cfg.cls}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Nút copy nhỏ ────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Sao chép prompt"
      className="p-1 rounded-lg text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 transition-all cursor-pointer border-none"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  );
}

export default function ImageViewerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // ── Fetch job từ API /image/history rồi lọc theo jobId ──────────────────
  const fetchJob = useCallback(async () => {
    if (!jobId) {
      setError('Không tìm thấy jobId trong URL.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/image/history');
      if (res.data && res.data.success) {
        const found = res.data.data.find((j) => String(j.id) === String(jobId));
        if (found) {
          setJob(found);
        } else {
          setError(`Không tìm thấy tác vụ #${jobId}. Có thể nó đã bị xóa.`);
        }
      } else {
        setError('Phản hồi từ server không hợp lệ.');
      }
    } catch (err) {
      console.error('[IMAGE VIEWER] Fetch failed:', err.message);
      setError(err.response?.data?.error || err.message || 'Lỗi kết nối server.');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Polling khi job vẫn đang render
  useEffect(() => {
    if (job && (job.status === 'Pending' || job.status === 'Rendering')) {
      const interval = setInterval(fetchJob, 3000);
      return () => clearInterval(interval);
    }
  }, [job, fetchJob]);

  // ── Download ảnh ─────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!job || !job.output_url) return;
    setDownloading(true);
    try {
      const fileUrl = getFullImageUrl(job.output_url);
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `AI_Image_Job${job.id}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('[DOWNLOAD ERROR]:', err.message);
      alert('Tải xuống thất bại: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ── Helpers hiển thị ─────────────────────────────────────────────────────
  const displayRatio = job
    ? job.aspectRatio === '9:16'
      ? '9:16 — Dọc (Portrait)'
      : job.aspectRatio === '16:9'
      ? '16:9 — Ngang (Landscape)'
      : '1:1 — Vuông (Square)'
    : '—';

  const createdAt = job
    ? new Date(job.createdAt).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const fullImageUrl = job?.output_url ? getFullImageUrl(job.output_url) : '';

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm font-bold">Đang tải thông tin ảnh...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
        <div className="bg-[#111114] border border-red-500/20 rounded-2xl p-8 max-w-md w-full text-center flex flex-col gap-4">
          <XCircle size={36} className="text-red-500 mx-auto" />
          <h2 className="text-white font-black text-lg">Không tải được ảnh</h2>
          <p className="text-zinc-400 text-sm">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/dashboard/history?tab=image')}
            className="mt-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl cursor-pointer border-none transition-all"
          >
            ← Quay lại lịch sử
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN UI ──────────────────────────────────────────────────────────────
  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <div className="!max-w-[1920px] !mx-auto !w-full !flex !flex-col !gap-6">

        {/* ── HEADER BAR ── */}
        <div className="flex items-center justify-between border-b border-[#222226] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard/history?tab=image')}
              className="p-2 rounded-xl bg-[#18181c] border border-[#222226] hover:border-zinc-700 text-zinc-400 hover:text-white transition-all cursor-pointer border-solid"
              title="Quay lại lịch sử"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10">
              <ImageIcon size={16} />
            </div>
            <div>
              <h1 className="text-base font-black text-white uppercase tracking-wider">
                Chi tiết ảnh AI — Tác vụ #{job?.id}
              </h1>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Xem và tải xuống hình ảnh được vẽ bởi Fal.ai Flux Schnell
              </p>
            </div>
          </div>
          <StatusBadge status={job?.status} />
        </div>

        {/* ── MAIN CONTENT: 2 CỘT ── */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 w-full">

          {/* ─────────── CỘT TRÁI: Khung ảnh lớn ─────────── */}
          <div className="w-full lg:w-[55%] flex flex-col gap-4 shrink-0">
            {/* Khung chứa ảnh */}
            <div className="bg-[#111114] border border-[#222226] rounded-2xl p-4 flex flex-col gap-4">
              <div
                className="w-full rounded-xl bg-[#0c0c0e] border border-[#222226]/60 flex items-center justify-center relative overflow-hidden"
                style={{ minHeight: '380px' }}
              >
                {job?.status === 'Completed' && fullImageUrl ? (
                  <>
                    <img
                      src={fullImageUrl}
                      alt={`AI Generated: ${job.prompt?.substring(0, 60) || 'Artwork'}`}
                      className="max-w-full max-h-[600px] object-contain rounded-lg transition-all duration-300"
                      style={{ imageRendering: 'high-quality' }}
                    />
                    {/* Nút phóng to lightbox */}
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-zinc-300 hover:text-white rounded-lg border border-zinc-700/40 transition-all cursor-pointer border-solid"
                      title="Phóng to"
                    >
                      <Maximize2 size={14} />
                    </button>
                  </>
                ) : job?.status === 'Failed' ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-12">
                    <XCircle size={40} className="text-red-500" />
                    <p className="text-red-400 text-sm font-bold">Tạo ảnh thất bại</p>
                    <p className="text-zinc-600 text-xs text-center max-w-xs">
                      Credits đã được hoàn trả vào tài khoản. Vui lòng thử lại với prompt khác.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-12">
                    <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-amber-400 text-sm font-bold animate-pulse">
                      Đang vẽ... {job?.progress || 0}%
                    </p>
                    <p className="text-zinc-600 text-xs">Trang sẽ tự cập nhật khi hoàn thành</p>
                  </div>
                )}

                {/* Badge model góc dưới trái */}
                <span className="absolute bottom-3 left-3 bg-amber-500/10 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded border border-amber-500/20">
                  Fal.ai Flux Schnell
                </span>

                {/* Badge tỷ lệ góc trên trái */}
                {job?.aspectRatio && (
                  <span className="absolute top-3 left-3 bg-black/60 text-zinc-300 text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-700/30">
                    {job.aspectRatio}
                  </span>
                )}
              </div>

              {/* Nút tải xuống lớn */}
              <button
                type="button"
                disabled={job?.status !== 'Completed' || downloading}
                onClick={handleDownload}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-sm rounded-xl flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:cursor-not-allowed border-none shadow-md hover:shadow-[0_0_25px_rgba(245,158,11,0.3)] disabled:shadow-none"
              >
                {downloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} className="text-black" />
                )}
                <span>{downloading ? 'Đang tải xuống...' : 'Tải xuống ảnh gốc (.png)'}</span>
              </button>
            </div>
          </div>

          {/* ─────────── CỘT PHẢI: Thông tin chi tiết ─────────── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

            {/* Thông tin tổng quan */}
            <div className="bg-[#111114] border border-[#222226] rounded-2xl p-5 flex flex-col gap-4">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226]/60 pb-2">
                Thông tin tác vụ
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* ID */}
                <div className="flex flex-col gap-1 bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Job ID</span>
                  <span className="text-sm font-black text-white">#{job?.id}</span>
                </div>

                {/* Trạng thái */}
                <div className="flex flex-col gap-1 bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Trạng thái</span>
                  <StatusBadge status={job?.status} />
                </div>

                {/* Model AI */}
                <div className="flex flex-col gap-1 bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Model AI</span>
                  <span className="text-xs font-bold text-amber-400">Fal.ai Flux Schnell</span>
                </div>

                {/* Tỷ lệ */}
                <div className="flex flex-col gap-1 bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Tỷ lệ khung</span>
                  <span className="text-xs font-bold text-zinc-300">{displayRatio}</span>
                </div>

                {/* Credits */}
                <div className="flex flex-col gap-1 bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Credits dùng</span>
                  <span className="text-xs font-bold text-zinc-300">{job?.credits_used ?? 2} credits</span>
                </div>

                {/* Thời gian tạo */}
                <div className="flex flex-col gap-1 bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <span className="text-[9px] text-zinc-600 font-black uppercase tracking-wider">Thời gian tạo</span>
                  <span className="text-[10px] font-bold text-zinc-300">{createdAt}</span>
                </div>
              </div>
            </div>

            {/* Prompt gốc của User */}
            <div className="bg-[#111114] border border-[#222226] rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#222226]/60 pb-2">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Prompt gốc của bạn
                </h3>
                <CopyButton text={job?.prompt} />
              </div>
              <div className="bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar">
                <p className="text-xs text-zinc-300 leading-relaxed font-medium select-text">
                  {job?.prompt || '(Không có dữ liệu)'}
                </p>
              </div>
              <p className="text-[9px] text-zinc-600 font-medium">
                💡 Gợi ý: Prompt tiếng Anh chi tiết sẽ cho chất lượng ảnh tốt nhất với Flux Schnell.
              </p>
            </div>

            {/* Nút Xóa Vật Thể / Watermark bằng AI */}
            <div className="bg-[#111114] border border-amber-500/10 rounded-2xl p-5 flex flex-col gap-3">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226]/60 pb-2">
                Công cụ nâng cao
              </h3>

              <button
                type="button"
                disabled={job?.status !== 'Completed'}
                onClick={() => alert('Tính năng Fal.ai Inpainting đang được tích hợp. Vui lòng chờ bản cập nhật tiếp theo!')}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600/20 to-amber-500/10 hover:from-violet-600/30 hover:to-amber-500/20 disabled:from-zinc-800/50 disabled:to-zinc-800/50 border border-violet-500/30 hover:border-violet-500/50 disabled:border-zinc-700/20 text-violet-300 disabled:text-zinc-600 rounded-xl flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer disabled:cursor-not-allowed group font-black text-xs"
              >
                <Wand2 size={16} className="group-hover:rotate-12 transition-transform duration-300" />
                <span>✨ Xóa Vật Thể / Watermark bằng AI</span>
              </button>

              <button
                type="button"
                disabled={job?.status !== 'Completed'}
                onClick={() => alert('Tính năng Re-generate with variations đang được phát triển!')}
                className="w-full py-3 bg-[#0c0c0e] hover:bg-[#18181c] disabled:opacity-40 border border-[#222226] hover:border-zinc-700 disabled:cursor-not-allowed text-zinc-400 hover:text-white rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer font-bold text-xs border-solid"
              >
                <Sparkles size={14} />
                <span>Tái tạo biến thể từ ảnh này</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* ── LIGHTBOX: xem ảnh toàn màn hình ── */}
      {lightboxOpen && fullImageUrl && (
        <div
          className="fixed inset-0 z-[1000] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullImageUrl}
              alt="Fullscreen AI Artwork"
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
              style={{ imageRendering: 'high-quality' }}
            />
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 p-2 bg-black/70 hover:bg-black text-zinc-300 hover:text-white rounded-xl border border-zinc-700/50 transition-all cursor-pointer text-xs font-black border-solid"
            >
              ✕ Đóng
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="absolute bottom-3 right-3 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl flex items-center gap-2 border-none cursor-pointer transition-all"
            >
              <Download size={14} />
              {downloading ? 'Đang tải...' : 'Tải xuống'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
