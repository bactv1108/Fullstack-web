import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Sparkles, Image as ImageIcon, Download, Trash2, Loader2,
  ExternalLink, CheckCircle2, XCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

// ─── Helper: full URL ─────────────────────────────────────────────────────────
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '') ||
  'http://localhost:3000';

const getFullImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE_URL}${path}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Pagination Controls (Amber active state)
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const getPages = () => {
    const pages = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else if (currentPage <= 3) pages.push(1, 2, 3, 4, '...', totalPages);
    else if (currentPage >= totalPages - 2) pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    else pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
    return pages;
  };
  return (
    <div className="flex items-center justify-center gap-1.5 mt-4 pt-4 border-t border-[#222226]/50">
      <button type="button" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer border-solid">
        <ChevronLeft size={14} />
      </button>
      {getPages().map((page, idx) =>
        page === '...' ? (
          <span key={`e-${idx}`} className="h-8 w-8 flex items-center justify-center text-zinc-600 text-xs">…</span>
        ) : (
          <button key={page} type="button" onClick={() => onPageChange(page)}
            className={`h-8 w-8 flex items-center justify-center rounded-lg border text-xs font-black transition-all cursor-pointer ${
              currentPage === page
                ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700 border-solid'
            }`}>{page}</button>
        )
      )}
      <button type="button" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}
        className="h-8 w-8 flex items-center justify-center rounded-lg border border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer border-solid">
        <ChevronRight size={14} />
      </button>
      <span className="ml-2 text-[9px] text-zinc-600 font-mono">Trang {currentPage}/{totalPages}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT: Status Badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status, progress }) {
  if (status === 'Completed') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-[8px] font-black uppercase tracking-wider">
      <CheckCircle2 size={9} /> Hoàn tất
    </span>
  );
  if (status === 'Failed') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded text-[8px] font-black uppercase tracking-wider">
      <XCircle size={9} /> Lỗi
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
      <Loader2 size={9} className="animate-spin" /> {progress || 0}%
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN: ImageView
// ─────────────────────────────────────────────────────────────────────────────
export default function ImageView() {
  // ── Context từ Dashboard (Outlet) ─────────────────────────────────────────
  // triggerDeleteHistory: mở Global Delete Dialog của Dashboard
  const { credits, setCredits, loadHistory, toast, triggerDeleteHistory } = useOutletContext();
  const navigate    = useNavigate();
  const textareaRef = useRef(null);

  // ── Ref đến container cuộn chính ──────────────────────────────────────────
  // Container cuộn là thẻ bọc nội dung của page này (overflow-y-auto / h-screen layout)
  // Chúng ta sẽ bắt sự kiện scroll trên chính div root của component và document.documentElement
  const scrollContainerRef = useRef(null);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [promptText, setPromptText] = useState('');
  const [localRatio, setLocalRatio] = useState('1:1');
  const [isRendering, setIsRendering] = useState(false);

  // ── History & Preview ─────────────────────────────────────────────────────
  const [imageHistory, setImageHistory]         = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [previewJob, setPreviewJob]             = useState(null);   // 100% DB-driven, no localStorage
  const [isDetailOpen, setIsDetailOpen]         = useState(false);
  const [selectedJob, setSelectedJob]           = useState(null);

  // ── Pagination — 10 cards/page (2 hàng × 5 cột desktop) ─────────────────
  const CARDS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [imageHistory.length]);
  const totalPages  = Math.ceil(imageHistory.length / CARDS_PER_PAGE);
  const pagedImages = imageHistory.slice((currentPage - 1) * CARDS_PER_PAGE, currentPage * CARDS_PER_PAGE);

  // ── Back-to-top ───────────────────────────────────────────────────────────
  // FIX: Bắt sự kiện cuộn trên cả document.documentElement lẫn div container của component
  // vì layout Dashboard dùng h-screen + overflow-y-auto trên div nội dung, không phải window
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    // Hàm kiểm tra vị trí cuộn — kiểm tra cả window lẫn documentElement
    const handleScroll = () => {
      const scrollY =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      // Cũng kiểm tra container cuộn nội dung (nếu có)
      const containerScroll = scrollContainerRef.current?.scrollTop || 0;
      setShowScrollTop(scrollY > 300 || containerScroll > 300);
    };

    // Gắn vào window, document và document.documentElement
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.documentElement.addEventListener('scroll', handleScroll, { passive: true });

    // Tìm và gắn vào container cuộn của layout (phần tử cha có overflow-y-auto)
    // Dashboard thường có div với class chứa "overflow-y-auto" hoặc "overflow-auto"
    let layoutContainer = null;
    const findScrollContainer = () => {
      let el = scrollContainerRef.current?.parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        if (
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          style.overflow === 'auto' ||
          style.overflow === 'scroll'
        ) {
          layoutContainer = el;
          el.addEventListener('scroll', handleScroll, { passive: true });
          break;
        }
        el = el.parentElement;
      }
    };
    findScrollContainer();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      document.documentElement.removeEventListener('scroll', handleScroll);
      if (layoutContainer) {
        layoutContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // ── Auto-resize textarea ──────────────────────────────────────────────────
  useEffect(() => {
    const tx = textareaRef.current;
    if (tx) { tx.style.height = 'auto'; tx.style.height = `${tx.scrollHeight}px`; }
  }, [promptText]);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch history from DB
  // LƯU Ý: axiosClient interceptor trả về response.data thẳng → res = {success, data}
  // ─────────────────────────────────────────────────────────────────────────
  const fetchImageHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const res = await axiosClient.get('/image/history');
      if (res?.success) {
        const mapped = res.data.map(job => ({
          id:          job.id,
          type:        'image',
          title:       'Tạo Ảnh AI',
          sub:         job.prompt,
          status:      job.status,
          progress:    job.progress,
          output_url:  job.output_url,
          aspectRatio: job.aspectRatio,
          ratio:
            job.aspectRatio === '9:16' ? '9:16 Dọc'
            : job.aspectRatio === '16:9' ? '16:9 Ngang'
            : '1:1 Vuông',
          time:
            new Date(job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
            ' — ' + new Date(job.createdAt).toLocaleDateString('vi-VN'),
          createdAt:      job.createdAt,
          provider:       job.provider || 'Fal.ai Flux Schnell',
          enhancedPrompt: job.enhanced_prompt || job.enhancedPrompt || null,
        }));

        setImageHistory(mapped);

        // Preview thông minh — luôn theo ĐẦU mảng (mới nhất từ DB)
        if (mapped.length > 0) {
          setPreviewJob(prev => {
            if (prev) {
              const refreshed = mapped.find(i => i.id === prev.id);
              return refreshed || mapped[0];
            }
            return mapped[0]; // F5 / lần đầu → ảnh mới nhất
          });
        }

        const hasActive = mapped.some(j => j.status === 'Pending' || j.status === 'Rendering');
        if (!hasActive) setIsRendering(false);
      }
    } catch (err) {
      console.error('[FETCH IMAGE HISTORY ERROR]:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  // Mount / F5
  useEffect(() => { fetchImageHistory(); }, [fetchImageHistory]);

  // Polling khi có job đang render
  useEffect(() => {
    const hasActive = imageHistory.some(j => j.status === 'Pending' || j.status === 'Rendering');
    if (!hasActive) return;
    const id = setInterval(fetchImageHistory, 3000);
    return () => clearInterval(id);
  }, [imageHistory, fetchImageHistory]);

  // SSE event
  useEffect(() => {
    const handler = (event) => {
      const notif = event.detail;
      if (!notif?.jobDetails) return;
      if (!/ảnh|image|vẽ/i.test((notif.title || '') + (notif.message || ''))) return;
      fetchImageHistory();
      if (notif.jobDetails.status === 'Completed' || notif.jobDetails.status === 'Failed') setIsRendering(false);
    };
    window.addEventListener('sse-notification', handler);
    return () => window.removeEventListener('sse-notification', handler);
  }, [fetchImageHistory]);

  // ─────────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!promptText.trim()) { toast?.error('Vui lòng nhập mô tả ý tưởng!'); return; }
    if ((credits || 0) < 2) { toast?.error('Số dư credits không đủ (cần tối thiểu 2 credits).'); return; }
    setIsRendering(true);
    try {
      const res = await axiosClient.post('/image/generate', { prompt: promptText, aspectRatio: localRatio });
      if (res?.success) {
        toast?.success('✅ Đã gửi yêu cầu! Hệ thống đang vẽ ngầm...');
        setPromptText('');
        if (setCredits) setCredits(prev => Math.max(0, prev - 2));
        await fetchImageHistory();
        if (loadHistory) loadHistory();
      }
    } catch (err) {
      toast?.error(err.response?.data?.error || err.message || 'Không thể gửi yêu cầu.');
      setIsRendering(false);
    }
    // KHÔNG finally setIsRendering — chờ SSE/polling mở khóa
  };

  const handleDownload = async (e, item) => {
    e.stopPropagation();
    if (item.status !== 'Completed' || !item.output_url) { toast?.error('Ảnh chưa hoàn thành!'); return; }
    toast?.info('📥 Đang chuẩn bị tải xuống...');
    try {
      const resp = await fetch(getFullImageUrl(item.output_url));
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `AI_Studio_Image_Job${item.id}.png`;
      a.style.display = 'none';
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); a.remove();
      toast?.success('Tải xuống thành công!');
    } catch (err) {
      toast?.error('Tải xuống thất bại. Vui lòng thử lại.');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE FLOW — KẾT NỐI VỚI GLOBAL DIALOG CỦA DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  // Khi người dùng nhấn nút "Xóa", gọi triggerDeleteHistory(job) từ context
  // Dashboard sẽ set jobToDelete và mở deleteModalOpen → Global Dialog hiển thị
  // confirmDeleteHistory() trong useDashboard.js sẽ gọi API xóa và cập nhật state
  //
  // Vì ImageView quản lý imageHistory riêng (fetch từ /image/history), sau khi xóa
  // chúng ta cần refresh lại. Để làm điều này, chúng ta override triggerDeleteHistory
  // bằng cách tạo một wrapper: set previewJob nếu cần, rồi gọi triggerDeleteHistory
  // với thêm callback refresh. Tuy nhiên, useDashboard không hỗ trợ callback sau xóa
  // nên chúng ta dùng cách đơn giản: lắng nghe sự thay đổi của historyList từ context
  // (hoặc dùng loadHistory). Thực tế, triggerDeleteHistory sẽ gọi confirmDeleteHistory
  // → xóa job → gọi toast, cập nhật historyList global. Với imageHistory local, ta
  // cần một cơ chế refresh. Giải pháp: thêm onAfterDelete callback vào wrapper.

  const handleRequestDelete = useCallback((item) => {
    if (!triggerDeleteHistory) return;

    // Chuẩn bị job object với type: 'image' đúng format mà Global Dialog nhận diện
    const jobForDialog = {
      id:    item.id,
      title: item.title || `Tác vụ #${item.id}`,
      type:  'image',       // ← bắt buộc để Global Dialog hiển thị đúng text
      sub:   item.sub || '',
    };

    // Gọi hàm kích hoạt Global Dialog từ Dashboard context
    triggerDeleteHistory(jobForDialog);

    // Lắng nghe sự kiện xóa thành công để refresh imageHistory cục bộ
    // Dùng custom event hoặc interval ngắn kiểm tra
    // Cách đơn giản và đồng bộ nhất: sau khi dialog đóng (dùng MutationObserver hay timeout)
    // → fetchImageHistory lại. Ta dùng một polling nhỏ 1 lần sau 2s
    const refreshTimer = setTimeout(async () => {
      await fetchImageHistory();
      if (loadHistory) loadHistory();
      // Nếu previewJob đang xem là item bị xóa, reset về đầu
      setPreviewJob(prev => {
        if (prev?.id === item.id) {
          const remaining = imageHistory.filter(j => j.id !== item.id);
          return remaining[0] || null;
        }
        return prev;
      });
    }, 2000);

    return () => clearTimeout(refreshTimer);
  }, [triggerDeleteHistory, fetchImageHistory, loadHistory, imageHistory]);

  // ── Mở / đóng Modal chi tiết ─────────────────────────────────────────────
  const handleOpenDetail = useCallback((item) => {
    setSelectedJob(item);
    setIsDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setIsDetailOpen(false);
    setSelectedJob(null);
  }, []);

  // ESC để đóng modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleCloseDetail(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCloseDetail]);

  // ── Hàm cuộn về đầu trang — hỗ trợ cả window lẫn layout container ────────
  const handleScrollToTop = useCallback(() => {
    // Cuộn window/document
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });

    // Cuộn layout container (div overflow-y-auto của Dashboard)
    let el = scrollContainerRef.current?.parentElement;
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el);
      if (
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll' ||
        style.overflow === 'auto' ||
        style.overflow === 'scroll'
      ) {
        el.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      }
      el = el.parentElement;
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={scrollContainerRef}
      className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both"
    >
      <div className="!max-w-[1920px] !mx-auto !w-full !flex !flex-col !gap-6">

        {/* TIÊU ĐỀ */}
        <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10">
            <ImageIcon size={18} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Tạo Ảnh AI </h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Vẽ ảnh siêu thực (photorealistic) với AI-STUDIO
            </p>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            KHU VỰC TRÊN: GRID 12 CỘT
            Trái (col-span-5): Cấu hình
            Phải (col-span-6): Preview TO & RÕ
        ══════════════════════════════════════════════════════════════════ */}
        <div className="!p-4 bg-[#111114] border border-[#222226] rounded-2xl p-6 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

            {/* CỘT TRÁI: Cấu hình */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest pb-2 border-b border-[#222226]/60">
                Cấu hình tạo ảnh
              </h3>

              <form onSubmit={handleGenerate} className="flex flex-col gap-5 flex-grow">
                {/* Prompt */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-zinc-400">1. Ý tưởng vẽ tranh</label>
                    <span className="text-[10px] text-zinc-600 font-bold">{promptText.length}/1000</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={promptText}
                    onChange={e => setPromptText(e.target.value)}
                    disabled={isRendering}
                    maxLength={1000}
                    placeholder="Ví dụ: Một người phụ nữ đứng giữa cánh đồng hoa anh đào, nắng chiều hắt nhẹ, chụp trên lens 35mm..."
                    className="!p-2 !w-full !h-[220px] !min-h-[160px] !max-h-[260px] !overflow-y-auto !resize-none bg-[#18181a] border border-[#222226] rounded-xl p-4 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <p className="text-[9px] text-zinc-600 font-medium">
                    💡 Hệ thống sẽ tự dịch &amp; tối ưu prompt sang tiếng Anh trước khi vẽ
                  </p>
                </div>

                {/* Tỷ lệ */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-black text-zinc-400">2. Tỷ lệ khung hình</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: '1:1',  label: '1:1',  sub: 'Vuông',  hint: 'Avatar / Post' },
                      { value: '16:9', label: '16:9', sub: 'Ngang',  hint: 'Wallpaper' },
                      { value: '9:16', label: '9:16', sub: 'Dọc',    hint: 'Story / Reels' },
                    ].map(r => (
                      <button key={r.value} type="button" disabled={isRendering} onClick={() => setLocalRatio(r.value)}
                        className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-0.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          localRatio === r.value
                            ? 'border-amber-500 bg-amber-500/5 text-amber-400 shadow-md shadow-amber-500/5'
                            : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:border-zinc-700 hover:text-white'
                        }`}>
                        <span className="text-xs font-black">{r.label}</span>
                        <span className="text-[9px] font-bold opacity-80">{r.sub}</span>
                        <span className="text-[7px] text-zinc-600">{r.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nút tạo ảnh */}
                <div className="flex flex-col gap-2 mt-auto">
                  <div className="border-t border-[#222226]/60 pt-4" />
                  <button type="submit" disabled={isRendering}
                    className={`!p-4 w-full py-4 font-black text-xs rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-all duration-300 border-none ${
                      isRendering
                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        : 'bg-amber-500 text-black cursor-pointer hover:bg-amber-400 hover:shadow-[0_0_28px_rgba(245,158,11,0.35)] active:scale-[0.98]'
                    }`}>
                    {isRendering
                      ? <><Loader2 size={16} className="animate-spin text-zinc-500" /><span>Đang vẽ ảnh, vui lòng đợi...</span></>
                      : <><Sparkles size={16} fill="black" className="animate-pulse" /><span>Vẽ ảnh ngay — 2 Credits</span></>}
                  </button>
                  <p className={`text-center text-[9px] font-medium transition-all ${isRendering ? 'text-amber-500/70 animate-pulse' : 'text-zinc-600'}`}>
                    {isRendering
                      ? '⏳ Hệ thống đang render ngầm... Nút tự mở khóa khi ảnh hoàn thành.'
                      : ''}
                  </p>
                </div>
              </form>
            </div>

            {/* Divider */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="w-px bg-[#222226] h-full mx-auto" />
            </div>

            {/* CỘT PHẢI: Preview Board TO & RÕ */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="flex justify-between items-center pb-2 border-b border-[#222226]/60">
                <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Bảng xem trước ảnh mới tạo</h3>
                {previewJob && (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={previewJob.status} progress={previewJob.progress} />
                    <span className="text-[9px] text-zinc-600 font-mono">#{previewJob.id}</span>
                  </div>
                )}
              </div>

              {/* Khung ảnh preview */}
              <div className="w-full rounded-xl bg-[#0c0c0e] border border-[#222226]/60 relative overflow-hidden flex items-center justify-center" style={{ minHeight: '420px' }}>
                {previewJob ? (
                  previewJob.status === 'Completed' && previewJob.output_url ? (
                    <img
                      src={getFullImageUrl(previewJob.output_url)}
                      alt={`AI Artwork: ${previewJob.sub?.substring(0, 50)}`}
                      className="max-w-full max-h-[520px] object-contain transition-all duration-500"
                      onError={e => { e.target.style.opacity = '0.2'; }}
                    />
                  ) : previewJob.status === 'Failed' ? (
                    <div className="flex flex-col items-center gap-3 p-12">
                      <XCircle size={40} className="text-red-500" />
                      <p className="text-sm text-red-400 font-black">Tạo ảnh thất bại</p>
                      <p className="text-xs text-zinc-600 text-center max-w-xs">Credits đã hoàn trả. Vui lòng thử lại với prompt khác.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-4 p-12">
                      <div className="relative">
                        <div className="w-14 h-14 border-2 border-amber-500/30 rounded-full" />
                        <div className="absolute inset-0 w-14 h-14 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <div className="text-center">
                        <p className="text-amber-400 text-sm font-black tracking-widest uppercase animate-pulse">
                          Đang vẽ... {previewJob.progress || 0}%
                        </p>
                        <p className="text-zinc-600 text-[10px] mt-1">Trang tự động cập nhật khi ảnh hoàn thành</p>
                      </div>
                      <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-1000"
                          style={{ width: `${previewJob.progress || 10}%` }} />
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-12">
                    <div className="w-20 h-20 rounded-2xl bg-[#18181c] border border-[#222226] flex items-center justify-center">
                      <ImageIcon size={28} className="text-zinc-700" />
                    </div>
                    <p className="text-sm text-zinc-500 font-black">Chưa có ảnh nào</p>
                    <p className="text-[10px] text-zinc-600 text-center max-w-[200px] leading-relaxed">
                      Nhập ý tưởng bên trái và nhấn "Vẽ ảnh ngay" để tạo ảnh AI đầu tiên!
                    </p>
                  </div>
                )}

                {previewJob?.ratio && (
                  <span className="absolute top-3 left-3 bg-black/70 text-zinc-300 text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-800/40">
                    {previewJob.ratio}
                  </span>
                )}
                <span className="absolute bottom-3 right-3 bg-amber-500/10 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded border border-amber-500/20">
                  AI-STUDIO
                </span>
              </div>

              {/* Prompt preview */}
              {previewJob?.sub && (
                <div className="bg-[#0c0c0e] border border-[#222226]/60 rounded-xl p-3">
                  <p className="text-[9px] text-amber-400/60 font-black uppercase tracking-wider mb-1">Prompt gốc:</p>
                  <p className="text-[10px] text-zinc-400 leading-relaxed line-clamp-2 select-text">"{previewJob.sub}"</p>
                </div>
              )}

              {/* Actions preview */}
              {previewJob && (
                <div className="flex gap-2">
                  <button type="button"
                    disabled={previewJob.status !== 'Completed' || !previewJob.output_url}
                    onClick={e => handleDownload(e, previewJob)}
                    className="!p-2 flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                    <Download size={14} /><span>Tải xuống ảnh gốc</span>
                  </button>
                  <button type="button"
                    onClick={() => handleOpenDetail(previewJob)}
                    className="!p-2 py-3 px-4 bg-[#18181c] hover:bg-amber-500/10 border border-[#222226] hover:border-amber-500/30 text-zinc-400 hover:text-amber-400 text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer border-solid"
                    title="Xem chi tiết">
                    <ExternalLink size={14} /><span className="hidden sm:inline">Chi tiết</span>
                  </button>
                  {/* Xóa → kích hoạt Global Delete Dialog của Dashboard */}
                  <button type="button"
                    onClick={() => handleRequestDelete(previewJob)}
                    className="!p-2 py-3 px-4 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-solid"
                    title="Xóa tác vụ">
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            KHU VỰC DƯỚI: THƯ VIỆN ẢNH — Toàn màn hình, phân trang 10 card
        ══════════════════════════════════════════════════════════════════ */}
        <div className="bg-[#111114] border border-[#222226] rounded-2xl p-6 shadow-2xl w-full">

          {/* Header */}
          <div className="!p-2 flex items-center justify-between w-full pb-4 border-b border-[#222226]/60 mb-5">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest"> Thư viện ảnh vừa tạo</h3>
              {isHistoryLoading && <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />}
              {imageHistory.length > 0 && (
                <span className="text-zinc-600 text-[10px] font-mono">({imageHistory.length} ảnh)</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard/history')}
              className="text-[9px] text-amber-400/80 hover:text-amber-400 font-bold transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1 hover:underline"
            >
              Xem tất cả ➔
            </button>
          </div>

          {/* Grid Card — 5 ảnh mới nhất, 1 hàng ngang */}
          {imageHistory.length > 0 ? (
            <>
              <div className="!p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full">
                {imageHistory.slice(0, 5).map(item => {
                  const isActive    = previewJob && previewJob.id === item.id;
                  const isCompleted = item.status === 'Completed';
                  const isPending   = item.status === 'Pending' || item.status === 'Rendering';
                  const imgUrl      = getFullImageUrl(item.output_url);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setPreviewJob(item)}
                      className={`group relative flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-0.5 w-full bg-[#0f0f11] ${
                        isActive
                          ? 'border-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.15)] bg-[#18181a]'
                          : 'border-[#222226] hover:border-zinc-700 hover:bg-[#18181c]'
                      }`}
                    >
                      {/* Thumbnail */}
                      <div className="w-full aspect-square bg-[#0c0c0e] relative overflow-hidden flex items-center justify-center">
                        {isCompleted && item.output_url ? (
                          <img
                            src={imgUrl}
                            alt={item.sub?.substring(0, 40) || 'AI Image'}
                            className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110"
                            onError={e => { e.target.style.opacity = '0.2'; }}
                          />
                        ) : item.status === 'Failed' ? (
                          <div className="flex flex-col items-center gap-1">
                            <XCircle size={20} className="text-red-500/60" />
                            <span className="text-[7px] text-red-400/60 font-bold">Lỗi</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-amber-400 text-[8px] font-black animate-pulse">{item.progress || 0}%</p>
                          </div>
                        )}

                        {/* Badge tỷ lệ */}
                        <span className="!p-1 absolute top-1.5 left-1.5 bg-black/70 text-[7px] text-zinc-300 font-bold px-1 py-0.5 rounded">
                          {item.aspectRatio || '1:1'}
                        </span>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleOpenDetail(item); }}
                            className="p-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg border-none cursor-pointer transition-all shadow-lg"
                            title="Xem chi tiết">
                          </button>
                        </div>

                        {/* Chấm vàng — đang xem preview */}
                        {isActive && (
                          <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.9)]" />
                        )}
                      </div>

                      {/* Info + Actions */}
                      <div className="p-2.5 flex flex-col gap-1.5">
                        <p className="text-[8px] text-zinc-500 font-medium line-clamp-2 leading-relaxed min-h-[24px]">
                          "{item.sub?.substring(0, 60)}"
                        </p>
                        <div className="flex items-center justify-between gap-1">
                          <StatusBadge status={item.status} progress={item.progress} />
                          <span className="text-[7px] text-zinc-600 font-mono">
                            {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {/* Nút chức năng */}
                        <div className="flex gap-1 pt-1.5 border-t border-[#222226]/60">
                          <button type="button"
                            disabled={!isCompleted || !item.output_url}
                            onClick={e => handleDownload(e, item)}
                            className="!p-2 flex-1 py-1.5 bg-[#18181c] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-zinc-400 hover:text-white text-[8px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed border-solid"
                            title="Tải xuống">
                            <Download size={9} /><span>Tải</span>
                          </button>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleOpenDetail(item); }}
                            className="!p-2 py-1.5 px-2 bg-[#18181c] hover:bg-amber-500/10 border border-[#222226] hover:border-amber-500/30 text-zinc-500 hover:text-amber-400 rounded-lg flex items-center justify-center transition-all cursor-pointer border-solid"
                            title="Xem chi tiết">
                            <ExternalLink size={9} />
                          </button>
                          {/* Xóa → kích hoạt Global Delete Dialog của Dashboard (dòng 59-83 Dashboard.jsx) */}
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleRequestDelete(item); }}
                            className="!p-2 py-1.5 px-2 border border-red-500/15 hover:border-red-500/40 bg-transparent hover:bg-red-500/10 text-red-500/40 hover:text-red-400 rounded-lg flex items-center justify-center transition-all cursor-pointer border-solid"
                            title="Xóa">
                            <Trash2 size={9} />
                          </button>
                        </div>
                      </div>

                      {/* Bar tiến độ đáy card */}
                      {isPending && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>

            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#222226]/50 rounded-xl bg-[#0c0c0e]/30">
              <ImageIcon size={36} className="text-zinc-700 mb-4" />
              <p className="text-sm text-zinc-500 font-black">Thư viện ảnh trống</p>
              <p className="text-[10px] text-zinc-600 mt-2 max-w-[240px] text-center leading-relaxed">
                Bạn chưa tạo ảnh nào. Sử dụng ô cấu hình phía trên để vẽ ảnh AI đầu tiên nhé!
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ════════════════════════════════════════════════════════════════════
          MODAL CHI TIẾT ẢNH — 2 cột cao cấp, đóng bằng ESC hoặc Backdrop
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

            {/* ── Modal Header ─────────────────────────────────────────── */}
            <div className="!p-2 flex items-center justify-between px-6 py-4 border-b border-[#222226] bg-[#111114] flex-shrink-0">
              <div className=" flex items-center gap-3">
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

            {/* ── Modal Body: Grid 2 cột ───────────────────────────────── */}
            <div className="grid grid-cols-12 flex-1 overflow-hidden" style={{ minHeight: 0 }}>

              {/* CỘT TRÁI (7/12) — Khung ảnh lớn */}
              <div
                className="col-span-7 bg-[#0c0c0e] flex items-center justify-center relative border-r border-[#222226] overflow-hidden"
                style={{ maxHeight: '80vh' }}
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
                  <div className="flex flex-col items-center gap-4 p-16">
                    <XCircle size={52} className="text-red-500/50" />
                    <p className="text-sm text-red-400 font-black">Tạo ảnh thất bại</p>
                    <p className="text-[11px] text-zinc-600 text-center max-w-xs leading-relaxed">
                      Credits đã hoàn trả. Vui lòng thử lại với prompt khác.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-5 p-16">
                    <div className="relative">
                      <div className="w-16 h-16 border-2 border-amber-500/30 rounded-full" />
                      <div className="absolute inset-0 w-16 h-16 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                    <div className="text-center">
                      <p className="text-amber-400 text-sm font-black tracking-widest uppercase animate-pulse">
                        Đang vẽ... {selectedJob.progress || 0}%
                      </p>
                      <p className="text-zinc-600 text-[10px] mt-1">Đóng popup, ảnh vẫn render ngầm</p>
                    </div>
                  </div>
                )}

                {/* Badge tỷ lệ */}
                {selectedJob.ratio && (
                  <span className="absolute top-3 left-3 bg-black/70 text-zinc-300 text-[9px] font-bold px-2 py-0.5 rounded border border-zinc-800/40">
                    {selectedJob.ratio}
                  </span>
                )}
                <span className="absolute bottom-3 right-3 bg-amber-500/10 text-amber-400 text-[9px] font-black px-2 py-0.5 rounded border border-amber-500/20">
                  AI-STUDIO
                </span>
              </div>

              {/* CỘT PHẢI (5/12) — Thông tin + Prompt + Hành động */}
              <div className="col-span-5 flex flex-col overflow-y-auto" style={{ maxHeight: '80vh' }}>
                <div className="p-6 flex flex-col gap-5 flex-1">

                  {/* THÔNG TIN CHI TIẾT */}
                  <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest pb-2 border-b border-[#222226]/60">
                       Thông tin chi tiết
                    </h3>
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-600 font-bold">◽ TRẠNG THÁI</span>
                        <StatusBadge status={selectedJob.status} progress={selectedJob.progress} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] text-zinc-600 font-bold flex-shrink-0">◽ THỜI GIAN</span>
                        <span className="text-[10px] text-zinc-400 font-mono text-right">{selectedJob.time}</span>
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
                       Prompt
                    </h3>
                    <div className="!p-2 bg-[#0c0c0e] border border-[#222226] rounded-xl p-3">
                      <p className="text-[10px] text-zinc-400 leading-relaxed select-text">
                        {selectedJob.sub || '—'}
                      </p>
                    </div>
                  </div>

                  {/* PROMPT NÂNG CAO (ENHANCED) — chỉ hiện nếu có */}
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
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={selectedJob.status !== 'Completed' || !selectedJob.output_url}
                        onClick={e => handleDownload(e, selectedJob)}
                        className="!p-2 flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.35)] active:scale-[0.98]"
                      >
                        <Download size={14} />
                        <span>Tải xuống</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { handleCloseDetail(); handleRequestDelete(selectedJob); }}
                        className="!p-2 py-3 px-4 border border-red-500/30 hover:border-red-500/50 bg-red-500/5 hover:bg-red-500/15 text-red-400 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border-solid"
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

      {/* ────────────────────────────────────────────────────────────────────
          Back-to-top button
          FIX: z-[9999] để không bị che bởi bất kỳ CSS nào của layout tổng
          FIX: handleScrollToTop cuộn cả window lẫn layout container overflow-y-auto
      ──────────────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleScrollToTop}
        className={`!fixed !bottom-6 !right-6 !z-[9999] !block bg-amber-500 text-black p-3 rounded-full shadow-lg hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-all duration-200 ${
          showScrollTop
            ? 'opacity-100 scale-100 pointer-events-auto'
            : 'opacity-0 scale-0 pointer-events-none'
        }`}
        title="Cuộn về đầu trang"
        aria-label="Back to top"
      >
        ▲
      </button>
    </div>
  );
}
