import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LayoutGrid, Download, Trash2, Mic, Play } from 'lucide-react';

const getFullImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 
                  (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : '') || 
                  'http://localhost:3000';
  return `${baseUrl}${path}`;
};

export default function HistoryView({
  historySearch,
  setHistorySearch,
  historyType,
  setHistoryType,
  filteredHistory,
  handleDeleteHistory,
  triggerDeleteHistory,
  handleMouseMove,
  handleDownloadAsset,
  setPreviewJob
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [showScrollTop, setShowScrollTop] = React.useState(false);
  React.useEffect(() => {
    const handleScroll = () => { setShowScrollTop(window.scrollY > 300); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      if (['all', 'video', 'audio', 'analysis'].includes(tabParam)) {
        setHistoryType(tabParam);
      }
    }
  }, [searchParams, setHistoryType]);

  // Filter lists independently
  const videos = filteredHistory.filter(i => i.type === 'video');
  const analyses = filteredHistory.filter(i => i.type === 'analysis' || i.prompt_output);
  const audios = filteredHistory.filter(i => i.type === 'audio' || i.type === 'tts');

  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <div className="!max-w-7xl !mx-auto !w-full !flex !flex-col !gap-6 md:!gap-8 !items-stretch">
        
        {/* Tiêu đề trang */}
        <div className="!flex !flex-col !gap-1 !w-full">
          <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
            <div className="p-2 bg-[#f59e0b]/10 text-[#f59e0b] rounded-xl border border-[#f59e0b]/10">
              <LayoutGrid size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Lịch sử hoạt động</h2>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Quản lý và tải xuống các nội dung đã tạo</p>
            </div>
          </div>
        </div>

        {/* THANH BỘ LỌC TABS & Ô TÌM KIẾM (Bản gốc) */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-b border-zinc-900/60 pb-4"
            style={{padding:'1rem'}}>
          {/* Middle: Centered Search Input */}
          <div className=" flex items-center w-full sm:w-80">
            <input
              type="text"
              placeholder="Tìm kiếm video, giọng nói..."
              value={historySearch}
              style={{padding:'8px'}}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-[#0b0b0e] border border-zinc-900/60 text-xs text-[var(--text-primary)] rounded-xl h-[42px] pl-10 pr-4 outline-none focus:border-[#f59e0b]/50 placeholder-zinc-500 transition-all font-bold"
            />
          </div>

          {/* Right: Filter sub tabs */}
          <div className="flex items-center gap-1 bg-[#0b0b0e] px-1.5 rounded-xl border border-zinc-900/60 shrink-0 h-[42px] w-full sm:w-auto overflow-x-auto">
            <button 
              type="button"
              onClick={() => setHistoryType('all')}
              className={`flex-1 sm:flex-none h-8 px-3.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center ${historyType === 'all' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              style={{padding:'8px'}}>
              Tất cả
            </button>
            <button 
              type="button"
              onClick={() => setHistoryType('video')}
              className={`flex-1 sm:flex-none h-8 px-3.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center ${historyType === 'video' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              style={{padding:'8px'}}>
              Video AI
            </button>
            <button 
              type="button"
              onClick={() => setHistoryType('audio')}
              className={`flex-1 sm:flex-none h-8 px-3.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center ${historyType === 'audio' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              style={{padding:'8px'}}>
              Giọng nói
            </button>
            <button 
              type="button"
              onClick={() => setHistoryType('analysis')}
              className={`flex-1 sm:flex-none h-8 px-3.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center ${historyType === 'analysis' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              style={{padding:'8px'}}>
              Mắt Thần AI
            </button>
          </div>
        </div>

      {/* Khối danh sách nội dung (Hộp Titan mờ giống Admin) */}
      <div className="!bg-[#111114] !border !border-[#222226] !rounded-2xl p-5 sm:p-6 md:p-8 !w-full !shadow-2xl !block">
          {/* Content list split by layout types */}
          <div className="w-full flex flex-col gap-8 text-left">
            
            {/* ------------------------------------------------------- */}
            {/* PHÂN KHU 1: VIDEO AI (Chỉ hiển thị ở Tab Tất cả hoặc Tab Video) */}
            {/* ------------------------------------------------------- */}
            {(historyType === 'all' || historyType === 'video') && videos.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226] pb-2">🎥 Lịch sử Video AI</h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
                  {videos.map((item) => (
                    <div 
                      key={item.id} 
                      onMouseMove={handleMouseMove}
                      onClick={() => setPreviewJob && setPreviewJob(item)}
                      className="bg-[#111114] border border-[#222226] hover:border-[#f59e0b]/40 rounded-xl p-4 flex flex-col justify-between gap-3.5 relative group cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                    >
                      <div className="w-full h-32 rounded-lg bg-[#0e0e11] border border-zinc-850 flex items-center justify-center relative overflow-hidden shrink-0">
                        {/* Blurry abstract background */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/15 via-zinc-900 to-amber-500/15 blur-xl"></div>
                        {/* Centered play button */}
                        <div className="z-10 w-9 h-9 rounded-full bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:scale-105 transition-all">
                          <Play size={14} className="text-white fill-white ml-0.5" />
                        </div>
                        <span className="absolute top-2.5 left-2.5 bg-black/60 text-[9px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-zinc-800/40">
                          {item.ratio}
                        </span>
                        <span className="absolute bottom-2.5 right-2.5 bg-[#f59e0b]/15 text-[#f59e0b] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#f59e0b]/20">
                          Video AI
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1 text-left flex-grow">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.title}</p>
                          <span className="text-[9px] text-[var(--text-secondary)] font-medium shrink-0">{item.time}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium line-clamp-2">{item.sub}</p>
                      </div>

                      {/* Buttons for download and delete */}
                      <div className="flex gap-2 mt-2 pt-2 border-t border-[#222226]/60 w-full">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadAsset(item);
                          }}
                          className="flex-1 py-2 bg-[#18181c] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-none transition-all cursor-pointer"
                        >
                          <Download size={13} />
                          <span>Tải xuống</span>
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (triggerDeleteHistory) {
                              triggerDeleteHistory(item);
                            } else {
                              handleDeleteHistory(item.id);
                            }
                          }}
                          className="px-3.5 py-2 border border-red-500/20 hover:border-red-500/40 bg-red-955/10 hover:bg-red-955/20 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-solid transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* PHÂN KHU 2: MẮT THẦN AI (Chỉ hiển thị ở Tab Tất cả hoặc Tab Mắt Thần) */}
            {/* ------------------------------------------------------- */}
            {(historyType === 'all' || historyType === 'analysis') && analyses.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226] pb-2">👁️ Lịch sử Mắt Thần AI (Phân tích ảnh)</h4>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
                  {analyses.map((item) => (
                    <div key={item.id} className="bg-[#111114] border border-[#222226] hover:border-[#f59e0b]/40 rounded-xl p-3.5 flex flex-col justify-between h-[145px] min-h-[145px] max-h-[145px] transition-all group relative hover:bg-[#151519] overflow-hidden shadow-md">
                      <div className="flex gap-3 items-start w-full min-w-0">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-black flex-shrink-0 border border-[#222226] flex items-center justify-center">
                          <img 
                            src={item.image_path ? getFullImageUrl(item.image_path) : ''} 
                            alt="Product" 
                            className="w-full h-full object-cover group-hover:scale-105 transition-all"
                            onError={(e) => { e.target.src = 'https://placehold.co/100x100/111114/888888?text=Image'; }}
                          />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0 flex-grow text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded text-[9px] font-black uppercase tracking-wider">Mắt Thần AI</span>
                            <span className="text-[10px] text-zinc-500 font-mono font-bold">#{item.id}</span>
                          </div>
                          <p className="text-xs font-bold text-zinc-200 truncate group-hover:text-[#f59e0b] transition-all pr-2">{item.image_name || "Phân tích hình ảnh"}</p>
                          <span className="text-[10px] text-zinc-500 font-medium">{new Date(item.createdAt || item.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                      
                      {/* Hàng hành động: Nút xem kịch bản và Nút xóa đồng bộ icon hệ thống */}
                      <div className="flex gap-2 items-center w-full border-t border-[#222226]/60 pt-2.5 mt-auto">
                        <button type="button" onClick={() => navigate(`/dashboard/mat-than/detail/${item.id}`)} className="flex-1 py-1.5 bg-[#18181c] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-zinc-350 hover:text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                          Xem kịch bản
                        </button>
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (triggerDeleteHistory) {
                              triggerDeleteHistory(item);
                            } else {
                              handleDeleteHistory(item.id);
                            }
                          }} 
                          className="p-1.5 border border-red-500/20 hover:border-red-500/40 bg-red-955/10 hover:bg-red-955/20 text-red-400 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ------------------------------------------------------- */}
            {/* PHÂN KHU 3: ÂM THANH / GIỌNG NÓI (Chỉ hiển thị ở Tab Tất cả hoặc Tab Giọng nói) */}
            {/* ------------------------------------------------------- */}
            {(historyType === 'all' || historyType === 'audio') && audios.length > 0 && (
              <div className="flex flex-col gap-4 w-full">
                {historyType === 'all' && (
                  <h4 className="text-[11px] font-black text-zinc-500 uppercase tracking-widest border-b border-[#222226] pb-2">🎙️ Lịch sử Giọng nói AI</h4>
                )}
                <div className="flex flex-col gap-4 w-full">
                  {audios.map((item) => (
                    <div 
                      key={item.id} 
                      onClick={() => setPreviewJob && setPreviewJob(item)}
                      className="w-full bg-[#111114] border border-[#222226] hover:border-zinc-700 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all group cursor-pointer"
                    >
                      {/* Left section: Mic Icon + Texts */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b]/15 to-zinc-950 border border-[#222226] flex items-center justify-center text-[#f59e0b] shrink-0">
                          <Mic size={18} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-left">
                            <h4 className="text-xs font-bold text-[var(--text-primary)] truncate max-w-[200px]">{item.title}</h4>
                            <span className="bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0">
                              {item.lang}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">#{item.id}</span>
                          </div>
                          <p className="text-[10px] text-[var(--text-secondary)] truncate mt-1 text-left max-w-[450px]">{item.sub}</p>
                          <div className="flex gap-3 text-[9px] text-zinc-500 mt-1 flex-wrap">
                            <span>Giọng: <strong className="text-zinc-400 font-bold">{item.voice}</strong></span>
                            <span>•</span>
                            <span>Thời lượng: <strong className="text-zinc-400 font-bold">{item.duration}</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Right section: Info & Actions */}
                      <div className="flex items-center gap-3.5 shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[#222226]/40 pt-3 sm:pt-0">
                        <span className="text-[10px] text-[#f59e0b] font-bold bg-[#f59e0b]/5 border border-[#f59e0b]/10 px-2 py-1 rounded">
                          {item.time}
                        </span>
                        <div className="flex gap-2">
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadAsset(item);
                            }}
                            className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border-none transition-all cursor-pointer"
                          >
                            <Download size={13} />
                            <span>Tải âm thanh</span>
                          </button>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (triggerDeleteHistory) {
                                triggerDeleteHistory(item);
                              } else {
                                handleDeleteHistory(item.id);
                              }
                            }}
                            className="p-1.5 bg-red-955/10 hover:bg-red-955/20 border border-red-500/20 hover:border-red-500/40 text-red-400 rounded-lg transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TRƯỜNG HỢP TRỐNG DỮ LIỆU */}
            {((historyType === 'all' && filteredHistory.length === 0) ||
              (historyType === 'video' && videos.length === 0) ||
              (historyType === 'audio' && audios.length === 0) ||
              (historyType === 'analysis' && analyses.length === 0)) && (
              <p className="text-xs text-zinc-500 italic py-12 text-center w-full">Không tìm thấy dữ liệu hoạt động tương ứng.</p>
            )}

          </div>
        </div>

      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 bg-[#f59e0b] hover:bg-[#d97706] text-black font-black rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ease-in-out cursor-pointer z-50 text-xs tracking-wider border border-black/10 ${
          showScrollTop ? '!h-11 !w-11 opacity-100' : '!h-0 !w-0 opacity-0 pointer-events-none overflow-hidden'
        }`}
        title="Cuộn về đầu trang"
      >
        ▲
      </button>
    </div>
  );
}
