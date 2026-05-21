import React, { useState, useEffect } from 'react';
import { Sparkles, Play, Pause, Rocket, Cat, LayoutGrid } from 'lucide-react';

export default function Dashboard({ currentMenu = 'video', setActiveModal, setCredits }) {
  const [prompt, setPrompt] = useState('cưỡi ngựa trên sa mạc sao Hỏa, phong cách điện ảnh với ánh hoàng hôn đỏ rực rỡ.');
  const [aspectRatio, setAspectRatio] = useState('169');
  const [style, setStyle] = useState('realistic');
  const [voice, setVoice] = useState('adam');
  const [speed, setSpeed] = useState(1.3);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleGenerate = () => {
    if (!prompt) return;
    setGenerating(true);
    setProgress(0);
  };

  useEffect(() => {
    if (generating && progress < 100) {
      const timer = setTimeout(() => setProgress(prev => prev + 5), 150);
      return () => clearTimeout(timer);
    } else if (progress >= 100) {
      setGenerating(false);
      if (setCredits) setCredits(prev => Math.max(0, prev - 10));
    }
  }, [generating, progress, setCredits]);

  return (
      <div 
          className="flex-1 flex flex-row overflow-hidden bg-[#121212] w-full h-full text-white select-none"
          style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#121212' }}
      >

        {/* 🟢 PANEL CẤU HÌNH NHẬP LIỆU BÊN TRÁI (CONFIG PANEL) */}
        <section 
            className="w-[360px] border-r border-[#1e1e24]/30 p-5 overflow-y-auto flex flex-col gap-5 bg-[#161616] shrink-0 text-left"
            style={{ width: '360px', backgroundColor: '#161616', borderRight: '1px solid rgba(255,255,255,0.06)' }}
        >
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Cấu hình Video AI
          </h2>

          <div className="flex flex-col gap-4">
            {/* 1. Ý tưởng video */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-400">1. Ý tưởng video (Kịch bản AI)</label>
                <span className="text-[10px] text-zinc-500 font-semibold">{prompt.length}/1000</span>
              </div>
              <textarea 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)} 
                className="w-full h-24 bg-white border border-zinc-200 rounded-xl p-3 text-xs text-black font-semibold outline-none focus:border-amber-500/40 transition-all resize-none shadow-sm" 
              />
            </div>

            {/* 2. Tỷ lệ khung hình */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400">2. Tỷ lệ khung hình</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                    type="button"
                    onClick={() => setAspectRatio('169')} 
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${aspectRatio === '169' ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#f59e0b]' : 'border-zinc-800 bg-[#1e1e24]/20 text-zinc-400 hover:text-white'}`}
                >
                  16:9 Ngang
                </button>
                <button 
                    type="button"
                    onClick={() => setAspectRatio('916')} 
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${aspectRatio === '916' ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#f59e0b]' : 'border-zinc-800 bg-[#1e1e24]/20 text-zinc-400 hover:text-white'}`}
                >
                  9:16 TikTok
                </button>
              </div>
            </div>

            {/* 3. Phong cách hình ảnh */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400">3. Phong cách hình ảnh</label>
              <select 
                value={style} 
                onChange={(e) => setStyle(e.target.value)} 
                className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 font-bold outline-none cursor-pointer focus:border-[#f59e0b]/30"
              >
                <option value="realistic">Cinematic Realistic</option>
                <option value="anime">Anime Japanese</option>
                <option value="3d">3D Animation</option>
              </select>
            </div>

            {/* 4. Giọng đọc AI */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400">4. Giọng đọc AI</label>
              <select 
                value={voice} 
                onChange={(e) => setVoice(e.target.value)} 
                className="w-full bg-[#161616] border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-300 font-bold outline-none cursor-pointer focus:border-[#f59e0b]/30"
              >
                <option value="adam">Adam — Giọng nam trầm ấm</option>
                <option value="bella">Bella — Giọng nữ ngọt ngào</option>
              </select>
            </div>

            {/* 5. Tốc độ video / giọng nói */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-400">5. Tốc độ video / giọng nói</label>
                <span className="text-xs font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">{speed}x</span>
              </div>
              <div className="relative pt-1 px-1">
                <input 
                  type="range" 
                  min="0.5" 
                  max="2.0" 
                  step="0.1" 
                  value={speed} 
                  onChange={(e) => setSpeed(parseFloat(e.target.value))} 
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#f59e0b]" 
                />
                <div className="flex justify-between text-[9px] text-zinc-500 mt-2 font-semibold">
                  <span>Chậm 0.5x</span>
                  <span>Chuẩn 1.0x</span>
                  <span>Nhanh 2.0x</span>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-2">
              <button 
                  type="button"
                  onClick={handleGenerate} 
                  disabled={generating} 
                  className="w-full py-3.5 bg-[#22222a] hover:bg-[#2a2a35] border border-zinc-850 text-zinc-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={14} className="text-zinc-400" />
                <span>Tạo Video Ngay — 10 Credits</span>
              </button>
            </div>
          </div>
        </section>

        {/* 🟢 PANEL HIỂN THỊ PREVIEW VÀ LỊCH SỬ BÊN PHẢI */}
        <section 
            className="flex-1 p-6 overflow-y-auto flex flex-col gap-5 bg-[#121212]"
            style={{ flex: 1, padding: '24px', overflowY: 'auto', backgroundColor: '#121212' }}
        >
          {/* Khung phát Video Preview */}
          <div className="bg-[#161616] border border-zinc-900 rounded-2xl p-5 flex flex-col gap-4 relative">
            <div 
                className={`relative mx-auto rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-900/60 transition-all duration-300`}
                style={{ 
                    position: 'relative', 
                    marginLeft: 'auto', 
                    marginRight: 'auto', 
                    borderRadius: '12px', 
                    overflow: 'hidden', 
                    backgroundColor: '#000000', 
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    aspectRatio: aspectRatio === '916' ? '9/16' : '16/9',
                    width: '100%',
                    maxWidth: aspectRatio === '916' ? '240px' : '100%'
                }}
            >
              {/* Badges on top of player */}
              <div className="absolute top-3 left-3 z-10 flex gap-2">
                <span className="bg-[#581c87]/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 shadow-sm">
                  Style: 3D Animation
                </span>
              </div>
              <div className="absolute top-3 right-3 z-10">
                <span className="bg-[#f59e0b]/90 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm">
                  AI Generated
                </span>
              </div>

              {/* Video Backdrop Gradient or Content */}
              <div className="absolute inset-0 bg-gradient-to-b from-zinc-800 to-black flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg cursor-pointer hover:scale-105 transition-all">
                  <Play size={20} className="text-white fill-white ml-0.5" />
                </div>
              </div>
              {generating && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                    <p className="text-amber-500 text-[10px] font-bold">MÔ HÌNH AI ĐANG RENDERING... {progress}%</p>
                  </div>
              )}
            </div>

            {/* Description Text: below the video preview frame and above the player controls */}
            <p className="text-xs italic text-zinc-400 text-center max-w-xl mx-auto leading-relaxed px-4 py-1">
              "Thành phố Atlantis cổ đại rực rỡ dưới lòng đại dương sâu thẳm, những sinh vật phát quang bơi lội xung quanh."
            </p>

            {/* Player controls row */}
            <div className="flex items-center gap-3 bg-[#121216] border border-zinc-900 rounded-xl px-4 py-2.5 w-full">
              <button 
                type="button" 
                onClick={() => setIsPlaying(!isPlaying)} 
                className="w-7 h-7 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0"
              >
                {isPlaying ? <Pause size={12} fill="black" /> : <Play size={12} fill="black" className="ml-0.5" />}
              </button>
              
              {/* Timeline progress bar */}
              <div className="flex-1 flex items-center relative py-2 cursor-pointer">
                <div className="w-full h-1 bg-zinc-800 rounded-full relative">
                  <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: '20%' }}></div>
                  <div className="absolute top-1/2 left-[20%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
              
              <span className="text-[10px] font-bold text-zinc-500 tracking-wider shrink-0">
                00:01 / 00:05
              </span>
            </div>
          </div>

          {/* History Section: Single header (Lịch sử Video (5) and Xem tất cả) */}
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex justify-between items-center border-b border-zinc-900 pb-2.5">
              <div className="flex items-center gap-2">
                <LayoutGrid size={14} className="text-zinc-500" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Lịch sử Video (5)</h3>
              </div>
              <a href="#" className="text-xs font-bold text-[#f59e0b] hover:text-amber-400 transition-colors">Xem tất cả</a>
            </div>

            {/* Grid of history cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Card 1: Rocket */}
              <div className="bg-[#161616] border border-zinc-900/60 rounded-xl p-3 flex flex-col gap-2.5 hover:border-zinc-800 transition-all cursor-pointer">
                <div className="w-full h-24 rounded-lg bg-gradient-to-br from-purple-900/30 to-[#0f0f13] flex items-center justify-center relative border border-zinc-900/40">
                  <Rocket size={24} className="text-purple-500" />
                  
                  <span className="absolute top-2 left-2 bg-[#000000]/60 text-[9px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-zinc-800/40">
                    16:9 Ngang
                  </span>
                  
                  <span className="absolute bottom-2 right-2 bg-[#000000]/60 text-[9px] px-1.5 py-0.5 rounded text-[#f59e0b] font-bold">
                    Vừa xong
                  </span>
                </div>
                
                <div className="flex flex-col gap-0.5 text-left">
                  <p className="text-xs font-bold text-zinc-200 truncate">Phi hành g...</p>
                  <p className="text-[10px] text-zinc-500 font-medium truncate">Sa mạc sao ...</p>
                </div>
              </div>

              {/* Card 2: Play */}
              <div className="bg-[#161616] border border-zinc-900/60 rounded-xl p-3 flex flex-col gap-2.5 hover:border-zinc-800 transition-all cursor-pointer">
                <div className="w-full h-24 rounded-lg bg-gradient-to-br from-blue-900/30 to-[#0f0f13] flex items-center justify-center relative border border-zinc-900/40">
                  <Play size={20} className="text-blue-500 fill-blue-500/10" />
                  
                  <span className="absolute top-2 left-2 bg-[#000000]/60 text-[9px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-zinc-800/40">
                    16:9 Ngang
                  </span>
                  
                  <span className="absolute bottom-2 right-2 bg-[#000000]/60 text-[9px] px-1.5 py-0.5 rounded text-[#f59e0b] font-bold">
                    10p trước
                  </span>
                </div>
                
                <div className="flex flex-col gap-0.5 text-left">
                  <p className="text-xs font-bold text-zinc-200 truncate">Atlantis c...</p>
                  <p className="text-[10px] text-zinc-500 font-medium truncate">Đại dương ...</p>
                </div>
              </div>

              {/* Card 3: Cat */}
              <div className="bg-[#161616] border border-zinc-900/60 rounded-xl p-3 flex flex-col gap-2.5 hover:border-zinc-800 transition-all cursor-pointer">
                <div className="w-full h-24 rounded-lg bg-gradient-to-br from-green-900/30 to-[#0f0f13] flex items-center justify-center relative border border-zinc-900/40">
                  <Cat size={24} className="text-green-500" />
                  
                  <span className="absolute top-2 left-2 bg-[#000000]/60 text-[9px] px-1.5 py-0.5 rounded text-zinc-300 font-bold border border-zinc-800/40">
                    9:16 TikTok
                  </span>
                  
                  <span className="absolute bottom-2 right-2 bg-[#000000]/60 text-[9px] px-1.5 py-0.5 rounded text-[#f59e0b] font-bold">
                    1 giờ trước
                  </span>
                </div>
                
                <div className="flex flex-col gap-0.5 text-left">
                  <p className="text-xs font-bold text-zinc-200 truncate">Mèo Cyber...</p>
                  <p className="text-[10px] text-zinc-500 font-medium truncate">Thành phố ...</p>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
  );
}