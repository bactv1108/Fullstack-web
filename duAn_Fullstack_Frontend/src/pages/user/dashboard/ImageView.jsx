import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Sparkles, Image as ImageIcon, Download, Trash2 } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

export default function ImageView() {
  const dashboardState = useOutletContext();
  const {
    credits,
    setCredits,
    historyList = [],
    loadHistory,
    setPreviewJob,
    triggerDeleteHistory,
    handleMouseMove
  } = dashboardState;

  const navigate = useNavigate();
  const textareaRef = useRef(null);

  const [promptText, setPromptText] = useState('');
  const [localRatio, setLocalRatio] = useState('1:1');
  const [isGeneratingLocal, setIsGeneratingLocal] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [imageHistory, setImageHistory] = useState([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Fetch Image Jobs history from backend
  const fetchImageHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const response = await axiosClient.get('/image/history');
      if (response.data && response.data.success) {
        const mappedData = response.data.data.map(job => ({
          id: job.id,
          type: 'image',
          title: 'Tạo Ảnh AI',
          sub: job.prompt,
          status: job.status,
          progress: job.progress,
          output_url: job.output_url,
          ratio: job.aspectRatio === '9:16' ? '9:16 Dọc' :
                 job.aspectRatio === '16:9' ? '16:9 Ngang' : '1:1 Vuông',
          time: new Date(job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(job.createdAt).toLocaleDateString('vi-VN'),
          createdAt: job.createdAt
        }));
        setImageHistory(mappedData);
      }
    } catch (err) {
      console.error('[FETCH IMAGE HISTORY ERROR]:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // Load history on mount
  useEffect(() => {
    fetchImageHistory();
  }, []);

  // Sync with global historyList updates (e.g. from SSE completed notification trigger)
  useEffect(() => {
    fetchImageHistory();
  }, [historyList]);

  // Polling for active image jobs
  useEffect(() => {
    const hasActiveJobs = imageHistory.some(job => job.status === 'Pending' || job.status === 'Rendering');
    if (hasActiveJobs) {
      const interval = setInterval(() => {
        fetchImageHistory();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [imageHistory]);

  // Handle custom delete image job
  const handleDeleteImage = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tác vụ tạo ảnh #${item.id} không?`)) {
      return;
    }

    try {
      const response = await axiosClient.delete(`/image/${item.id}`);
      if (response.data && response.data.success) {
        dashboardState.toast?.success(`Xoá tác vụ #${item.id} thành công.`);
        fetchImageHistory();
        loadHistory(); // Sync globally
      }
    } catch (err) {
      console.error('[DELETE IMAGE ERROR]:', err);
      dashboardState.toast?.error(err.response?.data?.message || err.message || 'Không thể xóa tác vụ.');
    }
  };

  // Monitor scroll for scroll-to-top button
  useEffect(() => {
    const handleScroll = () => { setShowScrollTop(window.scrollY > 300); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-resize prompt textarea
  useEffect(() => {
    const tx = textareaRef.current;
    if (tx) {
      tx.style.height = 'auto';
      tx.style.height = `${tx.scrollHeight}px`;
    }
  }, [promptText]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!promptText || !promptText.trim()) {
      dashboardState.toast?.error("Vui lòng nhập mô tả ý tưởng cho bức ảnh!");
      return;
    }

    if (credits < 2) {
      dashboardState.toast?.error("Số dư tín dụng (credits) của bạn không đủ để tạo ảnh (cần 2 credits).");
      return;
    }

    setIsGeneratingLocal(true);

    try {
      const res = await axiosClient.post('/image/generate', {
        prompt: promptText,
        aspectRatio: localRatio
      });

      if (res.data && res.data.success) {
        dashboardState.toast?.success("Yêu cầu tạo ảnh đang được xử lý ngầm, vui lòng đợi chuông báo kết quả!");
        setPromptText('');
        // Deduct credits locally for immediate UX update
        if (setCredits) {
          setCredits(prev => Math.max(0, prev - 2));
        }
        // Force history reload
        loadHistory();
        fetchImageHistory();
      }
    } catch (err) {
      console.error('[IMAGE GENERATION ERROR]:', err);
      dashboardState.toast?.error(err.response?.data?.error || err.message || 'Không thể gửi yêu cầu tạo ảnh.');
    } finally {
      setIsGeneratingLocal(false);
    }
  };

  const handleDownload = async (e, item) => {
    e.stopPropagation();
    if (item.status !== 'Completed') {
      dashboardState.toast?.error("Tác vụ này chưa hoàn thành, không thể tải xuống!");
      return;
    }
    dashboardState.toast?.info("📥 Đang chuẩn bị tải xuống hình ảnh...");
    try {
      const fileUrl = `http://localhost:3000${item.output_url}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Lỗi server: ${response.status}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `AI_Studio_Image_${item.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      dashboardState.toast?.success("Tải xuống hình ảnh thành công!");
    } catch (err) {
      console.error('[DOWNLOAD IMAGE ERROR]:', err);
      dashboardState.toast?.error("Tải xuống thất bại! Vui lòng thử lại.");
    }
  };

  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <div className="!max-w-7xl !mx-auto !w-full !flex !flex-col !gap-6 md:!gap-8 !items-stretch">

        {/* TIÊU ĐỀ TRANG */}
        <div className="!flex !flex-col !gap-1 !w-full">
          <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/10">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-wider">Tạo Ảnh AI (Imagen 3)</h2>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Vẽ những bức tranh nghệ thuật đỉnh cao bằng mô hình Imagen 3.0</p>
            </div>
          </div>
        </div>

        {/* CONTAINER CHÍNH */}
        <div className="!bg-[#111114] !p-6 !border !border-[#222226] !rounded-2xl p-5 sm:p-6 md:p-8 !w-full !shadow-2xl flex flex-col lg:flex-row gap-8 relative select-none">

          {/* Cấu Hình Tạo Ảnh (Trái) */}
          <section className="w-full lg:w-[380px] flex flex-col gap-5 text-left shrink-0">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider pb-2 border-b border-[#222226]/40">Cấu hình tạo ảnh</h3>

            <form onSubmit={handleGenerate} className="flex flex-col gap-5">
              {/* Prompt Textarea */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-zinc-400">1. Ý tưởng vẽ tranh (Prompt)</label>
                  <span className="text-[10px] text-zinc-500 font-bold">{promptText.length}/1000</span>
                </div>
                <textarea
                  ref={textareaRef}
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="w-full !p-3 min-h-[120px] h-32 bg-[#0f0f11] text-white rounded-xl border border-[#222226] placeholder-zinc-500 transition-all focus:outline-none focus:border-emerald-500 resize-none font-medium text-sm shadow-inner"
                  maxLength={1000}
                  placeholder="Ví dụ: Một phi hành gia cưỡi ngựa trên sa mạc sao Hỏa, phong cách cinematic hoàng hôn đỏ rực rỡ..."
                />
              </div>

              {/* Aspect Ratio Options */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400">2. Tỷ lệ khung hình</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: '1:1', label: '1:1 Vuông', desc: 'Square' },
                    { value: '16:9', label: '16:9 Ngang', desc: 'Landscape' },
                    { value: '9:16', label: '9:16 Dọc', desc: 'Portrait' }
                  ].map((ratioOpt) => (
                    <button
                      key={ratioOpt.value}
                      type="button"
                      onClick={() => setLocalRatio(ratioOpt.value)}
                      className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        localRatio === ratioOpt.value
                          ? 'border-emerald-500 bg-emerald-500/5 text-emerald-400 shadow-md shadow-emerald-500/5'
                          : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-xs font-black">{ratioOpt.label}</span>
                      <span className="text-[9px] text-zinc-500">{ratioOpt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-2">
                <div className="!border-t !border-[#222226]/40 !my-4 !w-full"></div>
                <button
                  type="submit"
                  disabled={isGeneratingLocal}
                  className="!p-4 py-4 px-8 bg-emerald-500 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50 transition-all duration-300 border-none shadow-md hover:bg-emerald-400 hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-[1.01] active:scale-[0.98] w-full"
                >
                  <Sparkles size={16} fill="black" className="text-black animate-pulse" />
                  <span>Vẽ ảnh ngay — 2 Credits</span>
                </button>

                <div className="flex !mt-4 flex-col gap-1 text-center select-none">
                  <p className="text-[10px] text-zinc-500 font-medium">Tạo ảnh tiêu thụ 2 credits từ số dư của bạn.</p>
                  <p className="text-[10px] text-zinc-500 font-medium">Bức ảnh nghệ thuật sẽ được render ngầm trong vài giây.</p>
                </div>
              </div>
            </form>
          </section>

          {/* Ngăn cách dọc trên PC */}
          <div className="hidden lg:block w-[1px] bg-[#222226] self-stretch"></div>

          {/* Lịch Sử và Thư Viện Ảnh (Phải) */}
          <section className="flex-grow flex flex-col gap-6 text-left min-w-0">
            <div className="flex justify-between items-center border-b border-[#222226]/45 pb-2">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Thư viện ảnh đã tạo {isHistoryLoading && <span className="inline-block w-2.5 h-2.5 ml-2 border border-emerald-400 border-t-transparent rounded-full animate-spin"></span>}
              </h3>
              <button
                type="button"
                onClick={() => navigate('/dashboard/history?tab=analysis')}
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer bg-transparent border-none"
              >
                Xem lịch sử chung
              </button>
            </div>

            {/* Grid display of created images */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto max-h-[580px] pr-1 custom-scrollbar">
              {imageHistory.map((item) => (
                <div
                  key={item.id}
                  onMouseMove={handleMouseMove}
                  onClick={() => setPreviewJob({
                    id: item.id,
                    type: 'image',
                    title: item.title,
                    sub: item.sub,
                    status: item.status,
                    ratio: item.ratio,
                    time: item.time,
                    output_url: item.output_url
                  })}
                  className="bg-[#0f0f11] border border-[#222226]/45 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-[0_0_12px_rgba(16,185,129,0.1)] relative group cursor-pointer"
                >
                  {/* Container hình ảnh */}
                  <div className="w-full h-36 rounded-lg bg-[#18181c] border border-[#222226]/50 flex items-center justify-center relative overflow-hidden shrink-0">
                    {item.status === 'Completed' ? (
                      <img
                        src={`http://localhost:3000${item.output_url}`}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : item.status === 'Failed' ? (
                      <div className="text-center p-4">
                        <span className="text-red-500 text-[18px]">✗</span>
                        <p className="text-[9px] text-zinc-500 font-bold mt-1">Vẽ ảnh thất bại</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-emerald-400 text-[9px] font-bold tracking-widest uppercase">Đang vẽ... {item.progress}%</p>
                      </div>
                    )}

                    <span className="absolute top-2.5 left-2.5 bg-black/75 text-[8px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-[#222226]/50">
                      {item.ratio}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Imagen 3
                    </span>
                  </div>

                  {/* Chi tiết nội dung prompt */}
                  <div className="flex flex-col gap-1 min-w-0 !p-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-zinc-300">Tác vụ #{item.id}</span>
                      <span className="text-[8px] text-zinc-500 font-mono font-bold shrink-0">{item.time}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 line-clamp-2 h-7 overflow-hidden select-text leading-tight mt-1">
                      "{item.sub}"
                    </p>
                  </div>

                  {/* Thanh điều khiển tác vụ */}
                  <div className="flex gap-2 mt-1 pt-2 border-t border-[#222226]/40 w-full">
                    <button
                      type="button"
                      disabled={item.status !== 'Completed'}
                      onClick={(e) => handleDownload(e, item)}
                      className="flex-1 py-2 bg-[#18181c] hover:bg-zinc-800 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 border border-[#222226]/40 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Download size={12} />
                      <span>Tải xuống</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteImage(e, item)}
                      className="py-2 px-3 border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 text-red-400 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                    >
                      <Trash2 size={12} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              ))}

              {imageHistory.length === 0 && (
                <div className="text-center py-16 border border-dashed border-[#222226]/30 rounded-xl w-full col-span-full select-none bg-[#0f0f11]/10 flex flex-col items-center justify-center gap-2">
                  <ImageIcon size={24} className="text-zinc-600" />
                  <span className="text-xs text-zinc-500 font-bold">Chưa tạo hình ảnh nào</span>
                  <p className="text-[10px] text-zinc-650 max-w-[200px] leading-relaxed">Hãy nhập ý tưởng và nhấn nút Vẽ ảnh để bắt đầu!</p>
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {/* Button cuộn lên đầu trang */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 bg-emerald-500 hover:bg-emerald-600 text-black font-black rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out cursor-pointer z-50 text-xs tracking-wider border border-black/10 ${
          showScrollTop ? '!h-11 !w-11 opacity-100' : '!h-0 !w-0 opacity-0 pointer-events-none overflow-hidden'
        }`}
        title="Cuộn về đầu trang"
      >
        ▲
      </button>
    </div>
  );
}
