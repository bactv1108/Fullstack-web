import React from 'react';
import { LayoutGrid, Download, Trash2, Mic, Play } from 'lucide-react';

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
  return (
    <div className="min-h-full w-full py-8 px-4 sm:px-6 lg:px-8 bg-[#0f0f13] flex items-start justify-center overflow-y-auto text-left">
      <div className="w-full max-w-6xl bg-[#18181b]/60 border border-zinc-800/80 rounded-2xl shadow-2xl p-6 lg:p-8 flex flex-col gap-6 animate-fade-in relative backdrop-blur-md">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 border-b border-zinc-900/60 pb-4"
          style={{padding:'1rem'}}>
        {/* Left: Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#f59e0b]/10 text-[#f59e0b] rounded-xl border border-[#f59e0b]/10">
            <LayoutGrid size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Lịch sử hoạt động</h2>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Quản lý và tải xuống các nội dung đã tạo</p>
          </div>
        </div>

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
        <div className="flex items-center gap-1 bg-[#0b0b0e] px-1.5 rounded-xl border border-zinc-900/60 shrink-0 h-[42px] w-full sm:w-auto">
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
            onClick={() => setHistoryType('tts')}
            className={`flex-1 sm:flex-none h-8 px-3.5 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center ${historyType === 'tts' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            style={{padding:'8px'}}>
            Giọng nói
          </button>
        </div>
      </div>

      {/* Content list */}
      {filteredHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border border-dashed border-zinc-800/80 rounded-2xl bg-[#121216]/20">
          <LayoutGrid size={36} className="text-zinc-700 mb-3" />
          <p className="text-xs text-[var(--text-secondary)] font-black tracking-wide">Không tìm thấy bản ghi nào trong lịch sử.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredHistory.map(item => {
            if (item.type === 'video') {
              const IconComponent = item.icon || Play;
              return (
                <div 
                  key={item.id} 
                  onMouseMove={handleMouseMove}
                  onClick={() => setPreviewJob && setPreviewJob(item)}
                  className="bg-[#121216]/65 border border-zinc-900/60 rounded-xl p-4 flex flex-col gap-3 relative group cursor-pointer transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f59e0b]/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
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
                  <div className="flex gap-2 mt-2 pt-2 border-t border-zinc-900/40 w-full">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAsset(item);
                      }}
                      className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-none transition-all cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Tải xuống</span>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (triggerDeleteHistory) triggerDeleteHistory(item);
                      }}
                      className="px-3.5 py-2 border border-red-500/20 hover:border-red-500/40 bg-red-955/10 hover:bg-red-955/20 text-red-400 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border-solid transition-all cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            } else {
              return (
                <div 
                  key={item.id} 
                  onMouseMove={handleMouseMove}
                  onClick={() => setPreviewJob && setPreviewJob(item)}
                  className="bg-[#121216]/65 border border-zinc-900/60 rounded-xl p-4 flex flex-col justify-between gap-4 relative group cursor-pointer text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f59e0b]/40 hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f59e0b]/15 to-zinc-950 border border-zinc-855 flex items-center justify-center text-[#f59e0b] shrink-0">
                      <Mic size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{item.title}</h4>
                        <span className="bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase">
                          {item.lang}
                        </span>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] truncate mt-0.5">{item.sub}</p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900/60 pt-3 flex justify-between items-center">
                    <span className="text-[9px] text-[var(--text-secondary)] font-medium">
                      Giọng: {item.voice} • {item.duration}
                    </span>
                    <span className="text-[9px] text-[#f59e0b] font-bold bg-[#f59e0b]/5 border border-[#f59e0b]/10 px-1.5 py-0.5 rounded">
                      {item.time}
                    </span>
                  </div>

                  {/* Buttons for download and delete */}
                  <div className="flex gap-2 mt-1 pt-3 border-t border-zinc-900/40">
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadAsset(item);
                      }}
                      className="flex-1 py-2 px-4 bg-zinc-850 hover:bg-zinc-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Tải âm thanh</span>
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (triggerDeleteHistory) triggerDeleteHistory(item);
                      }}
                      className="py-2 px-4 bg-red-950/40 hover:bg-red-900 border border-red-900/40 text-red-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>Xóa</span>
                    </button>
                  </div>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
   </div>
  );
}
