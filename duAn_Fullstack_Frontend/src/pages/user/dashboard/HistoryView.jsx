import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  LayoutGrid, Download, Trash2, Mic, ChevronLeft, ChevronRight,
  Image as ImageIcon, CheckCircle2, XCircle, Loader2,
} from 'lucide-react';
import axiosClient from '../../../services/axiosClient';
import { useAuth } from '../../../hooks/useAuth';
import socketService from '../../../services/socketService';

// ─── Helper: Chuẩn hóa URL ảnh — phiên bản siêu phòng thủ đa tầng + tự bù subfolder ──
const getFullImageUrl = (rawPath) => {
  if (!rawPath || typeof rawPath !== 'string') return '';

  // Bước 1: Nếu là đường dẫn tuyệt đối từ CDN/Cloudinary/S3 thì giữ nguyên để tải trực tiếp
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;

  // Bước 2: Loại bỏ chuỗi "undefined/" ở đầu nếu có do lỗi nối chuỗi từ các phiên bản cũ
  let cleanPath = rawPath.replace(/^undefined\/?/, '');

  // Bước 3: Tự động bù cấu trúc subfolder lưu trữ thực tế dựa trên dữ liệu thô
  if (!cleanPath.startsWith('uploads/') && !cleanPath.startsWith('/uploads/')) {
    // Trường hợp tên file trọc: product-xxx.png → uploads/images/product-xxx.png
    cleanPath = `uploads/images/${cleanPath}`;
  } else if (cleanPath.startsWith('uploads/') && !cleanPath.startsWith('uploads/images/')) {
    // Trường hợp thiếu thư mục con: uploads/product-xxx.png → uploads/images/product-xxx.png
    cleanPath = cleanPath.replace('uploads/', 'uploads/images/');
  }
  // Trường hợp /uploads/images/... hoặc uploads/images/... → đã đúng, giữ nguyên

  // Bước 4: Trích xuất cấu trúc URL gốc của Backend từ biến môi trường hệ thống
  const backendUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
      : '') ||
    'http://localhost:3000';

  // Bước 5: Chuẩn hóa dấu gạch chéo đầu để tránh lỗi dính liền ký tự domain
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  return `${backendUrl}${normalizedPath}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// (DeleteDialog đã được gỡ bỏ — chuyển sang Global Modal trong Dashboard.jsx)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helper: Hiển thị tên mô hình AI động cho Lịch sử ──────────────────────
const getModelBadge = (item, type = 'video') => {
  if (!item) {
    return {
      label: 'Đang tải...',
      className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    };
  }
  // YÊU CẦU 1: Nếu là Card Image, mặc định luôn hiển thị "AI-STUDIO"
  if (type === 'image' || item?.type === 'image') {
    return {
      label: 'AI-STUDIO',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
  }

  // YÊU CẦU 2: Nếu là Card Video, phân loại động theo modelName
  const modelName = item?.modelName || item?.model_name;
  
  if (modelName === 'wan_turbo') {
    return {
      label: 'Wan v2.2',
      className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
  }
  
  if (modelName === 'kling_v2_5_standard') {
    return {
      label: 'Kling v2.5',
      className: 'bg-gradient-to-r from-purple-950/40 to-amber-950/20 text-purple-300 border-purple-500/30 premium-shine',
    };
  }
  
  // Dự phòng cho trường hợp Video khác
  return {
    label: modelName || 'Wan v2.2',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Pagination Controls
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  // Tạo danh sách số trang (tối đa 5 số, có dấu "...")
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-1.5 mt-5 pt-4 border-t border-[#222226]/50">
      {/* Previous */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer border-solid"
      >
        <ChevronLeft size={14} />
      </button>

      {/* Số trang */}
      {getPageNumbers().map((page, idx) =>
        page === '...' ? (
          <span key={`ellipsis-${idx}`} className="h-8 w-8 flex items-center justify-center text-zinc-600 text-xs font-bold">
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`h-8 w-8 flex items-center justify-center rounded-lg border text-xs font-black transition-all cursor-pointer ${
              currentPage === page
                ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700 border-solid'
            }`}
          >
            {page}
          </button>
        )
      )}

      {/* Next */}
      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer border-solid"
      >
        <ChevronRight size={14} />
      </button>

      <span className="ml-2 text-[10px] text-zinc-600 font-mono">
        Trang {currentPage}/{totalPages}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT: HistoryView
// ─────────────────────────────────────────────────────────────────────────────
export default function HistoryView() {
  const dashboardState = useOutletContext();
  const {
    historySearch,
    setHistorySearch,
    historyType,
    setHistoryType,
    filteredHistory,
    handleDeleteHistory,
    triggerDeleteHistory,
    handleMouseMove,
    handleDownloadAsset,
    setPreviewJob,
    setHistoryList,
  } = dashboardState;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { user } = useAuth();
  const socket = socketService.connectSocket();

  useEffect(() => {
    if (!user?.id || !socket) return;

    // Đảm bảo client đã join vào căn phòng định danh bảo mật của mình
    socket.emit('subscribe', `user_room_${user.id}`);

    // Trạng thái 1: Nhận diện có Job mới vừa bấm nút Khởi chạy bên tab AI Studio
    const handleJobCreated = (data) => {
      console.log('[SOCKET HISTORY] Phát hiện Job mới vừa tạo ngầm:', data.job);
      if (data?.job) {
        const dbJob = data.job;
        // Chuẩn hóa cấu trúc object giống như loadHistory để giao diện hiển thị đúng
        const formattedJob = {
          ...dbJob,
          id: dbJob.id,
          title: dbJob.name || `Video #${dbJob.id}`,
          sub: dbJob.prompt,
          prompt: dbJob.prompt,
          time: new Date(dbJob.createdAt || dbJob.created_at || new Date()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(dbJob.createdAt || dbJob.created_at || new Date()).toLocaleDateString('vi-VN'),
          type: 'video',
          status: dbJob.status === 'success' ? 'Completed' : dbJob.status === 'failed' ? 'Failed' : dbJob.status === 'queueing' || dbJob.status === 'processing' ? 'Pending' : dbJob.status,
          progress: dbJob.progress || 0,
          videoUrl: dbJob.videoUrl || dbJob.video_url || dbJob.output_url || '',
          output_url: dbJob.videoUrl || dbJob.video_url || dbJob.output_url || '',
          aspectRatio: dbJob.aspectRatio || '16:9',
          createdAt: dbJob.createdAt || dbJob.created_at || new Date().toISOString(),
        };

        // 💡 Đẩy bản ghi mới vào ngay đầu mảng để giao diện lập tức xuất hiện dòng mới
        setHistoryList((prevJobs) => {
          if (prevJobs.some(item => item.id === formattedJob.id)) {
            return prevJobs;
          }
          return [formattedJob, ...prevJobs];
        });
      }
    };

    // Trạng thái 2: Fal.ai render thành công, bốc được Video URL về DB
    const handleJobFinished = (data) => {
      console.log('[SOCKET HISTORY] Tác vụ kết thúc thành công rực rỡ:', data);
      setHistoryList((prevJobs) =>
        prevJobs.map((item) =>
          item.id === data.jobId 
            ? { 
                ...item, 
                status: 'Completed', 
                videoUrl: data.videoUrl || data.video_url,
                output_url: data.videoUrl || data.video_url 
              } 
            : item
        )
      );
    };

    // Trạng thái 3: Tác vụ bị Fal.ai từ chối hoặc lỗi hệ thống ngầm
    const handleJobFailed = (data) => {
      console.log('[SOCKET HISTORY] Tác vụ bị báo lỗi thất bại:', data);
      setHistoryList((prevJobs) =>
        prevJobs.map((item) =>
          item.id === data.jobId ? { ...item, status: 'Failed' } : item
        )
      );
    };

    // Kích hoạt đăng ký cổng lắng nghe sự kiện
    socket.on('video_job_created', handleJobCreated);
    socket.on('video_finished', handleJobFinished);
    socket.on('video_failed', handleJobFailed);

    // Hàm dọn dẹp bộ nhớ (Cleanup) khi người dùng chuyển trang
    return () => {
      socket.off('video_job_created', handleJobCreated);
      socket.off('video_finished', handleJobFinished);
      socket.off('video_failed', handleJobFailed);
    };
  }, [user?.id, socket, setHistoryList]);

  // ── Back-to-top ────────────────────────────────────────────────────────────
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const fn = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // ── Delete Dialog (chuyển sang Global Modal trong Dashboard.jsx) ────────────
  // requestDelete, confirmDelete, cancelDelete đã được gỡ bỏ.
  // Button Xóa gọi thẳng triggerDeleteHistory(item) → mở Global Modal.

  // ── Đồng bộ tab từ URL param ────────────────────────────────────────────────
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['all', 'image', 'audio', 'analysis', 'video'].includes(tabParam)) {
      setHistoryType(tabParam);
    }
  }, [searchParams, setHistoryType]);

  // ── Phân tách dữ liệu theo loại ────────────────────────────────────────────
  const images   = filteredHistory.filter(i => i.type === 'image');
  const analyses = filteredHistory.filter(i => i.type === 'analysis' || i.prompt_output);
  const audios   = filteredHistory.filter(i => i.type === 'audio' || i.type === 'tts');
  const videos   = filteredHistory.filter(i => i.type === 'video' || i.type === 'Video' || i.type === 'render_task');

  // ── Pagination state (riêng biệt từng tab) ─────────────────────────────────
  const CARDS_PER_PAGE_IMG      = 6;   // Image & Analysis: 6 cards/trang
  const CARDS_PER_PAGE_ANALYSIS = 6;
  const CARDS_PER_PAGE_VIDEO    = 6;
  const ROWS_PER_PAGE_AUDIO     = 10;  // Audio: 10 rows/trang

  const [imgPage,      setImgPage]      = useState(1);
  const [analysisPage, setAnalysisPage] = useState(1);
  const [videoPage,    setVideoPage]    = useState(1);
  const [audioPage,    setAudioPage]    = useState(1);

  // Reset về trang 1 khi đổi tab hoặc search
  useEffect(() => { setImgPage(1); setAnalysisPage(1); setVideoPage(1); setAudioPage(1); }, [historyType, historySearch]);

  // Slice dữ liệu theo trang
  const pagedImages   = images.slice((imgPage - 1) * CARDS_PER_PAGE_IMG, imgPage * CARDS_PER_PAGE_IMG);
  const pagedAnalyses = analyses.slice((analysisPage - 1) * CARDS_PER_PAGE_ANALYSIS, analysisPage * CARDS_PER_PAGE_ANALYSIS);
  const pagedVideos   = videos.slice((videoPage - 1) * CARDS_PER_PAGE_VIDEO, videoPage * CARDS_PER_PAGE_VIDEO);
  const pagedAudios   = audios.slice((audioPage - 1) * ROWS_PER_PAGE_AUDIO, audioPage * ROWS_PER_PAGE_AUDIO);

  const totalImgPages      = Math.ceil(images.length / CARDS_PER_PAGE_IMG);
  const totalAnalysisPages = Math.ceil(analyses.length / CARDS_PER_PAGE_ANALYSIS);
  const totalVideoPages    = Math.ceil(videos.length / CARDS_PER_PAGE_VIDEO);
  const totalAudioPages    = Math.ceil(audios.length / ROWS_PER_PAGE_AUDIO);

  // ── Modal chi tiết ảnh AI ──────────────────────────────────────────────────
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedJob,  setSelectedJob]  = useState(null);

  const handleOpenDetail = useCallback((item) => {
    setSelectedJob(item);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedJob(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleCloseDetail(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCloseDetail]);

  // ── Handler card click ảnh ─────────────────────────────────────────────────
  const handleImageCardClick = (item) => handleOpenDetail(item);

  // ── Handler tải xuống trong modal ─────────────────────────────────────────
  const handleModalDownload = useCallback(async (item) => {
    if (item.status !== 'Completed' || !item.output_url) return;
    try {
      const resp = await fetch(getFullImageUrl(item.output_url));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `AI_Image_Job${item.id}.png`;
      a.style.display = 'none';
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
    } catch (err) { console.error('[DOWNLOAD ERROR]:', err); }
  }, []);

  // ── Helper download file (Blob) — tránh mở tab mới, xử lý CORS ──────────
  const handleDownloadFile = async (fileUrl, type, jobId) => {
    if (!fileUrl) return;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const extension = fileUrl.split('.').pop().split(/[?#]/)[0] || (type === 'video' ? 'mp4' : 'png');
      const prefix = type === 'video' ? 'AI_Studio_Video' : 'AI_Studio_Image';

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${prefix}_${jobId}.${extension}`;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(fileUrl, '_blank');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <style>{`
        @keyframes diamondShine {
          0% { left: -150%; }
          35% { left: 150%; }
          100% { left: 150%; }
        }
        .premium-shine {
          overflow: hidden;
        }
        .premium-shine::after {
          content: '';
          position: absolute;
          top: 0;
          left: -150%;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg, 
            transparent 0%, 
            rgba(255, 255, 255, 0.35) 50%, 
            transparent 100%
          );
          transform: skewX(-25deg);
          animation: diamondShine 2s infinite ease-in-out;
        }
      `}</style>

      {/* Delete Dialog đã chuyển sang Global Modal trong Dashboard.jsx */}
      <div className="!max-w-[1920px] !mx-auto !w-full !flex !flex-col !gap-6 md:!gap-8">

        {/* TIÊU ĐỀ */}
        <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10">
            <LayoutGrid size={18} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Lịch sử hoạt động</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">Quản lý và tải xuống các nội dung đã tạo</p>
          </div>
        </div>

        {/* THANH BỘ LỌC TABS & Ô TÌM KIẾM */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pb-4">
          {/* Ô tìm kiếm */}
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Tìm kiếm theo mô tả, tiêu đề..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              className="!p-2 w-full bg-[#0b0b0e] border border-[#222226] text-xs text-white rounded-xl h-[42px] pl-9 pr-4 outline-none focus:border-amber-500/50 placeholder-zinc-600 transition-all font-medium"
            />
          </div>

          {/* Tab bộ lọc */}
          <div className=" flex items-center gap-1 bg-[#0b0b0e] px-1.5 rounded-xl border border-[#222226] shrink-0 h-[42px] w-full sm:w-auto overflow-x-auto">
            {[
              { key: 'all',      label: 'Tất cả' },
              { key: 'image',    label: 'Hình ảnh' },
              { key: 'video',    label: 'Video AI' },
              { key: 'audio',    label: 'Giọng nói' },
              { key: 'analysis', label: 'Mắt Thần AI' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setHistoryType(tab.key)}
                className={`!p-2 flex-1 sm:flex-none h-8 px-3.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center whitespace-nowrap ${
                  historyType === tab.key
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/10'
                    : 'text-zinc-500 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* KHỐI DANH SÁCH */}
        <div className="bg-[#111114] border border-[#222226] rounded-2xl p-5 sm:p-6 w-full shadow-2xl">
          <div className="w-full flex flex-col gap-8">

            {/* ══════════════════════════════════════════════════════
                PHÂN KHU 1: HÌNH ẢNH AI — 6 cards/trang
            ══════════════════════════════════════════════════════ */}
            {(historyType === 'all' || historyType === 'image') && images.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest pb-1.5 border-b border-[#222226]/60">
                      Lịch sử Tạo Ảnh AI
                      <span className="ml-2 text-zinc-700 font-mono normal-case">({images.length})</span>
                    </h3>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full">
                  {pagedImages.map(item => {
                    const displayRatio = item.aspectRatio
                      ? (item.aspectRatio === '9:16' ? '9:16 Dọc'
                        : item.aspectRatio === '16:9' ? '16:9 Ngang'
                        : '1:1 Vuông')
                      : item.ratio;
                    const fullImageUrl = item.output_url ? getFullImageUrl(item.output_url) : '';
                    const badge = getModelBadge(item, 'image');

                    return (
                      <div
                        key={item.id}
                        onMouseMove={handleMouseMove}
                        onClick={() => handleImageCardClick(item)}
                        className="bg-[#111114] border border-[#222226] hover:border-amber-500/30 rounded-xl p-4 flex flex-col justify-between gap-3 relative group
                        cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                      >
                        {/* Thumbnail */}
                        <div className="w-full h-40 rounded-lg bg-[#0e0e11] border border-[#222226]/60 flex items-center justify-center relative overflow-hidden shrink-0">
                          {item.status === 'Completed' && fullImageUrl ? (
                            <>
                              <img
                                src={fullImageUrl}
                                alt={`Ảnh AI: ${item.sub || 'Generated Artwork'}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={e => { e.target.style.display = 'none'; if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex'; }}
                              />
                              <div className="w-full h-full flex-col items-center justify-center gap-1 bg-[#0e0e11]" style={{ display: 'none' }}>
                                <span className="text-zinc-600 text-[20px]">🖼</span>
                                <p className="text-[8px] text-zinc-600 font-bold">Không tải được ảnh</p>
                              </div>
                            </>
                          ) : item.status === 'Failed' ? (
                            <div className="text-center p-4">
                              <span className="text-red-500 text-[24px]">✗</span>
                              <p className="text-[9px] text-zinc-500 font-bold mt-1">Vẽ ảnh thất bại</p>
                              <p className="text-[8px] text-zinc-600 mt-0.5">Credits đã được hoàn trả</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                              <p className="text-amber-400 text-[9px] font-bold tracking-widest uppercase animate-pulse">
                                Đang vẽ... {item.progress || 0}%
                              </p>
                            </div>
                          )}
                          <span className="absolute top-2 left-2 bg-black/60 text-[8px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-zinc-800/40">
                            {displayRatio}
                          </span>
                          <span className={`absolute bottom-2 right-2 text-[8px] font-bold px-1.5 py-0.5 rounded border ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-white truncate">{item.title || 'Tạo Ảnh AI'}</p>
                            <span className="text-[9px] text-zinc-500 shrink-0">{item.time}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 line-clamp-2">{item.sub}</p>
                          <p className="text-[8px] text-amber-500/40 group-hover:text-amber-500/70 transition-colors">Nhấp để xem chi tiết →</p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t border-[#222226]/50">
                          <button
                            type="button"
                            disabled={item.status !== 'Completed'}
                            onClick={e => { e.stopPropagation(); handleDownloadFile(item?.output_url || item?.imageUrl || item?.url, 'image', item?.id); }}
                            className="!p-1 flex-1 py-2 bg-[#18181c] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none border-solid"
                          >
                            <Download size={12} /><span>Tải xuống</span>
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); triggerDeleteHistory(item); }}
                            className="!p-1 px-3 py-2 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border-solid"
                          >
                            <Trash2 size={12} /><span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Phân trang ảnh */}
                <Pagination currentPage={imgPage} totalPages={totalImgPages} onPageChange={setImgPage} />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PHÂN KHU 2: MẮT THẦN AI — 6 cards/trang
            ══════════════════════════════════════════════════════ */}
            {(historyType === 'all' || historyType === 'analysis') && analyses.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226]/60 pb-1.5">
                    Lịch sử Mắt Thần AI
                    <span className="ml-2 text-zinc-700 font-mono normal-case">({analyses.length})</span>
                  </h3>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full">
                  {pagedAnalyses.map(item => (
                    <div
                      key={item.id}
                      className="bg-[#111114] border border-[#222226] hover:border-amber-500/30 rounded-xl p-3.5 flex flex-col justify-between h-[155px] transition-all group relative hover:bg-[#151519] overflow-hidden shadow-md"
                    >
                      <div className="flex gap-3 items-start w-full min-w-0">
                        <div className="w-50 h-31 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-[#222226] flex items-center justify-center">
                          <img
                            src={getFullImageUrl(item.image_path || item.image_url || item.url)}
                            alt="Product"
                            className="w-full h-full object-cover group-hover:scale-105 transition-all"
                            onError={e => { e.target.src = 'https://placehold.co/400x400?text=No+Image'; }}
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0 flex-grow">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[8px] font-black uppercase tracking-wider">Mắt Thần</span>
                            <span className="text-[10px] text-zinc-600 font-mono">#{item.id}</span>
                          </div>
                          <p className="text-xs font-bold text-zinc-200 truncate group-hover:text-amber-400 transition-all">
                            {item.image_name || 'Phân tích hình ảnh'}
                          </p>
                          <span className="text-[10px] text-zinc-600">
                            {new Date(item.createdAt || item.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1 border-t border-[#222226]/60 pt-2.5 mt-auto">
                        <button
                          type="button"
                          onClick={() => navigate(`/dashboard/mat-than/detail/${item.id}`)}
                          className=" flex-1 py-1.5 bg-[#18181c] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-zinc-400 hover:text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer border-solid"
                        >
                          Xem kịch bản
                        </button>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); triggerDeleteHistory(item); }}
                          className="!p-2 p-1.5 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-lg transition-all cursor-pointer flex items-center justify-center border-solid"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination currentPage={analysisPage} totalPages={totalAnalysisPages} onPageChange={setAnalysisPage} />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PHÂN KHU 2B: VIDEO AI — 6 cards/trang
            ══════════════════════════════════════════════════════ */}
            {(historyType === 'all' || historyType === 'video') && videos.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226]/60 pb-1.5">
                    Lịch sử Video AI
                    <span className="ml-2 text-zinc-700 font-mono normal-case">({videos.length})</span>
                  </h3>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full">
                  {pagedVideos.map((item) => {
                    console.log("Dữ liệu Video hiện tại:", item);
                    const isProcessing = item?.status === 'processing' || item?.status === 'queueing' || item?.status === 'Pending';
                    const badge = getModelBadge(item, 'video');
                    return (
                      <div
                        key={item?.id || item?._id}
                        onClick={() => {
                          if (isProcessing) return;
                          if (typeof setPreviewJob === 'function') {
                            setPreviewJob({
                              id: item?.id,
                              title: `Tác vụ #${item?.id}`,
                              prompt: item?.prompt,
                              sub: item?.prompt || 'Video Ads',
                              type: 'video',
                              status: item?.status,
                              output_url: item?.videoUrl || item?.output_url,
                              videoUrl: item?.videoUrl || item?.output_url,
                              ratio: item?.aspectRatio || item?.ratio,
                              createdAt: item?.createdAt
                            });
                          }
                        }}
                        className={`group relative ${isProcessing ? '!cursor-not-allowed opacity-80' : '!cursor-pointer hover:border-amber-500/40 hover:bg-slate-900/90'} bg-slate-900/70 border border-[#222226] rounded-xl overflow-hidden transition-all duration-300`}
                      >
                        {/* Thumbnail */}
                        <div className="w-full h-40 rounded-lg bg-[#0e0e11] border border-[#222226]/60 flex items-center justify-center relative overflow-hidden shrink-0">
                          {item?.status === 'Completed' && (item?.videoUrl || item?.output_url) ? (
                            <video
                              src={item?.videoUrl || item?.output_url}
                              className="w-full h-full object-cover"
                              muted
                              loop
                              playsInline
                              onMouseEnter={e => e.target.play()}
                              onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
                            />
                          ) : item?.status === 'Failed' ? (
                            <div className="text-center p-4">
                              <span className="text-red-500 text-[24px]">✗</span>
                              <p className="text-[9px] text-zinc-500 font-bold mt-1">Tạo video thất bại</p>
                              <p className="text-[8px] text-zinc-600 mt-0.5">Credits đã được hoàn trả</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                              <p className="text-amber-400 text-[9px] font-bold tracking-widest uppercase animate-pulse">
                                Đang render... {item?.progress || 0}%
                              </p>
                            </div>
                          )}
                          <span className="absolute top-2 left-2 bg-black/60 text-[8px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-zinc-800/40">
                            {item?.aspectRatio || item?.ratio || '16:9'}
                          </span>
                          <span className={`absolute bottom-2 right-2 px-2 py-0.5 text-xs font-medium rounded border backdrop-blur-sm whitespace-nowrap transition-all flex items-center justify-center ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-start">
                            <p className="text-xs font-bold text-white truncate">{item?.title || `Video #${item?.id}`}</p>
                            <span className="text-[9px] text-zinc-500 shrink-0">{item?.time}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 line-clamp-2">{item?.prompt || 'Không có mô tả'}</p>
                          {!isProcessing && (
                            <p className="text-[8px] text-amber-500/40 group-hover:text-amber-500/70 transition-colors">Nhấp để xem trước →</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 pt-2 border-t border-[#222226]/50">
                          <button
                            type="button"
                            disabled={item?.status !== 'Completed'}
                            onClick={e => { e.stopPropagation(); handleDownloadFile(item?.videoUrl || item?.output_url, 'video', item?.id); }}
                            className="!p-1 flex-1 py-2 bg-[#18181c] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none border-solid"
                          >
                            <Download size={12} /><span>Tải xuống</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerDeleteHistory(item);
                            }}
                            className="!p-1 px-3 py-2 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border-solid"
                          >
                            <Trash2 size={12} /><span>Xóa</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Pagination currentPage={videoPage} totalPages={totalVideoPages} onPageChange={setVideoPage} />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                PHÂN KHU 3: GIỌNG NÓI AI — 10 rows/trang
            ══════════════════════════════════════════════════════ */}
            {(historyType === 'all' || historyType === 'audio') && audios.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <h3 className="text-xl font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226]/60 pb-1.5">
                    Lịch sử Giọng nói AI
                    <span className="ml-2 text-zinc-700 font-mono normal-case">({audios.length})</span>
                  </h3>
                )}

                <div className="flex flex-col gap-3 w-full">
                  {pagedAudios.map(item => (
                    <div
                      key={item.id}
                      onClick={() => setPreviewJob && setPreviewJob(item)}
                      className="w-full bg-[#111114] border border-[#222226] hover:border-zinc-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/15 to-zinc-950 border border-[#222226] flex items-center justify-center text-amber-400 shrink-0">
                          <Mic size={18} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs font-bold text-white truncate max-w-[200px]">{item.title}</h4>
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold px-1.5 rounded uppercase">{item.lang}</span>
                            <span className="text-[9px] text-zinc-600 font-mono">#{item.id}</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 truncate mt-0.5 max-w-[450px]">{item.sub}</p>
                          <div className="flex gap-3 text-[9px] text-zinc-600 mt-1 flex-wrap">
                            <span>Giọng: <strong className="text-zinc-400">{item.voice}</strong></span>
                            <span>•</span>
                            <span>Thời lượng: <strong className="text-zinc-400">{item.duration}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[#222226]/40 pt-3 sm:pt-0">
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded">{item.time}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleDownloadAsset(item); }}
                            className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border-none transition-all cursor-pointer"
                          >
                            <Download size={13} /><span>Tải âm thanh</span>
                          </button>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); triggerDeleteHistory(item); }}
                            className="p-1.5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg transition-all cursor-pointer border-solid"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination currentPage={audioPage} totalPages={totalAudioPages} onPageChange={setAudioPage} />
              </div>
            )}

            {/* TRẠNG THÁI TRỐNG */}
            {((historyType === 'all' && filteredHistory.length === 0) ||
              (historyType === 'image' && images.length === 0) ||
              (historyType === 'video' && videos.length === 0) ||
              (historyType === 'audio' && audios.length === 0) ||
              (historyType === 'analysis' && analyses.length === 0)) && (
              <div className="py-16 text-center">
                <p className="text-sm text-zinc-500 font-black mb-2">Không có dữ liệu</p>
                <p className="text-[10px] text-zinc-600">Chưa có nội dung nào thuộc mục này.</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL CHI TIẾT ẢNH AI — 2 cột cao cấp
          Đóng bằng: ESC, click Backdrop, hoặc nút ✕
      ════════════════════════════════════════════════════════════════════ */}
      {isDetailOpen && selectedJob && (
        <div
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(6px)' }}
          onClick={handleCloseDetail}
        >
          <div
            className="w-full max-w-5xl bg-[#111114] rounded-2xl border border-[#2a2a2e] overflow-hidden shadow-2xl relative flex flex-col"
            style={{ maxHeight: '92vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="!p-2 flex items-center justify-between px-6 py-4 border-b border-[#222226] bg-[#111114] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/10">
                  <ImageIcon size={14} />
                </div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                   Chi tiết tác phẩm{' '}
                  <span className="text-amber-400/80 font-mono font-black">#{selectedJob.id}</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a2a2e] bg-[#18181c] hover:bg-red-500/10 hover:border-red-500/30 text-zinc-500 hover:text-red-400 transition-all cursor-pointer font-black text-sm border-solid"
                title="Đóng (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Body — 2 cột */}
            <div className="grid grid-cols-12 flex-1 overflow-hidden" style={{ minHeight: 0 }}>

              {/* CỘT TRÁI (7/12) — Khung ảnh lớn */}
              <div
                className="col-span-12 md:col-span-7 bg-[#0c0c0e] flex items-center justify-center relative border-b md:border-b-0 md:border-r border-[#222226] overflow-hidden"
                style={{ maxHeight: '80vh', minHeight: '260px' }}
              >
                {selectedJob.status === 'Completed' && selectedJob.output_url ? (
                  <img
                    src={getFullImageUrl(selectedJob.output_url)}
                    alt={selectedJob.sub?.substring(0, 60) || 'AI Image'}
                    className="w-full h-full object-contain"
                    style={{ maxHeight: '80vh' }}
                    onError={e => { e.target.style.opacity = '0.2'; }}
                  />
                ) : selectedJob.status === 'Failed' ? (
                  <div className="flex flex-col items-center gap-4 p-12">
                    <XCircle size={52} className="text-red-500/50" />
                    <p className="text-sm text-red-400 font-black">Tạo ảnh thất bại</p>
                    <p className="text-[11px] text-zinc-600 text-center max-w-xs leading-relaxed">
                      Credits đã hoàn trả. Vui lòng thử lại với prompt khác.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-5 p-12">
                    <div className="relative">
                      <div className="w-14 h-14 border-2 border-amber-500/30 rounded-full" />
                      <div className="absolute inset-0 w-14 h-14 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-amber-400 text-sm font-black tracking-widest uppercase animate-pulse">
                        Đang vẽ... {selectedJob.progress || 0}%
                      </p>
                      <p className="text-zinc-600 text-[10px] mt-1">Đóng popup, ảnh vẫn render ngầm</p>
                    </div>
                  </div>
                )}

                {(selectedJob.aspectRatio || selectedJob.ratio) && (
                  <span className="absolute top-3 left-3 bg-black/70 text-zinc-300 text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-800/40">
                    {selectedJob.aspectRatio === '9:16' ? '9:16 Dọc'
                      : selectedJob.aspectRatio === '16:9' ? '16:9 Ngang'
                      : selectedJob.ratio || '1:1 Vuông'}
                  </span>
                )}
                <span className={`absolute bottom-3 right-3 text-[9px] font-black px-2 py-0.5 rounded border ${getModelBadge(selectedJob).className}`}>
                  {getModelBadge(selectedJob).label}
                </span>
              </div>

              {/* CỘT PHẢI (5/12) — Thông tin + Prompt + Hành động */}
              <div className="col-span-12 md:col-span-5 flex flex-col overflow-y-auto" style={{ maxHeight: '80vh' }}>
                <div className="p-6 flex flex-col gap-5 flex-1">

                  {/* THÔNG TIN CHI TIẾT */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest pb-2 border-b border-[#222226]/60">
                      Thông tin chi tiết
                    </h3>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600 font-bold">◽ TRẠNG THÁI</span>
                        {selectedJob.status === 'Completed' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[8px] font-black uppercase">
                            <CheckCircle2 size={9} /> Hoàn tất
                          </span>
                        ) : selectedJob.status === 'Failed' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[8px] font-black uppercase">
                            <XCircle size={9} /> Lỗi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[8px] font-black uppercase animate-pulse">
                            <Loader2 size={9} className="animate-spin" /> {selectedJob.progress || 0}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-zinc-600 font-bold flex-shrink-0">◽ THỜI GIAN</span>
                        <span className="text-[10px] text-zinc-400 font-mono text-right">{selectedJob.time}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-zinc-600 font-bold flex-shrink-0">◽ MODEL</span>
                        <span className="text-[10px] text-zinc-400 font-mono text-right">{getModelBadge(selectedJob).label}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600 font-bold">◽ CHI PHÍ</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-black">
                          ⚡ 2 Credits
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PROMPT GỐC TIẾNG VIỆT */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest pb-2 border-b border-[#222226]/60">
                       Prompt gốc
                    </h3>
                    <div className="!p-1 bg-[#0c0c0e] border border-[#222226] rounded-xl p-3">
                      <p className="text-[10px] text-zinc-400 leading-relaxed select-text">
                        {selectedJob.sub || '—'}
                      </p>
                    </div>
                  </div>

                  {/* PROMPT NÂNG CAO — chỉ hiện nếu có */}
                  {selectedJob.enhancedPrompt && (
                    <div className="flex flex-col gap-2">
                      <h3 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pb-2 border-b border-[#222226]/60">
                        🪄 Prompt nâng cao (Enhanced)
                      </h3>
                      <div className="bg-[#0c0c0e] border border-[#222226] rounded-xl p-3">
                        <p className="text-[10px] text-zinc-400 leading-relaxed select-text italic">
                          {selectedJob.enhancedPrompt}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* HÀNH ĐỘNG */}
                  <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-[#222226]/60">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">
                      ⚡ Chức năng hành động
                    </h3>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={selectedJob.status !== 'Completed' || !selectedJob.output_url}
                        onClick={() => handleModalDownload(selectedJob)}
                        className="!p-1 flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.98]"
                      >
                        <Download size={14} />
                        <span>Tải xuống ảnh gốc</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleCloseDetail(); triggerDeleteHistory(selectedJob); }}
                        className="!p-1 py-3 px-4 border border-red-500/30 hover:border-red-500/50 bg-red-500/5 hover:bg-red-500/15 text-red-400 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-solid"
                        title="Xóa ảnh"
                      >
                        <Trash2 size={14} />
                        <span>Xóa ảnh</span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Back-to-top button */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`!fixed !bottom-6 !right-6 !z-[9999] !block bg-amber-500 text-black p-3 rounded-full shadow-lg hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-all duration-200 ${
          showScrollTop ? '!h-11 !w-11 opacity-100 scale-100' : '!h-0 !w-0 opacity-0 scale-0 pointer-events-none overflow-hidden'
        }`}
        title="Cuộn về đầu trang"
      >
        ▲
      </button>
    </div>
  );
}
