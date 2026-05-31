import React from 'react';
import { Settings, Check } from 'lucide-react';

export default function SettingsView({
  themeMode,
  setThemeMode,
  videoModel,
  setVideoModel,
  audioModel,
  setAudioModel,
  savedSettings,
  handleSaveSettings
}) {
  return (
    <div className="min-h-full w-full py-8 px-4 sm:px-6 lg:px-8 bg-[#0f0f13] flex items-start justify-center overflow-y-auto text-left text-[var(--text-primary)]">
      <div className="w-full max-w-3xl bg-[#18181b]/60 border border-zinc-800/80 rounded-2xl shadow-2xl p-6 lg:p-8 flex flex-col gap-6 animate-fade-in relative backdrop-blur-md">
        <div className="flex items-center gap-3 border-b border-zinc-900/60 pb-4">
          <div className="p-2 bg-[#f59e0b]/10 text-[#f59e0b] rounded-xl border border-[#f59e0b]/10">
            <Settings size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Cấu hình hệ thống</h2>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Tùy chỉnh chủ đề hiển thị và lựa chọn mô hình xử lý AI mặc định</p>
          </div>
        </div>
        
        {/* SECTION 1: Clean, modern Theme Toggle component (Dark Mode / Light Mode Switchers) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-zinc-900/60">
          <div>
            <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">1. Giao diện ứng dụng</h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Chuyển đổi giao diện hệ thống sáng hoặc tối phù hợp môi trường làm việc</p>
          </div>
          
          {/* Toggle switch with Sun/Moon icons & micro-animations */}
          <div className="flex gap-1.5 bg-[#0b0b0e] p-1 rounded-xl border border-zinc-850 shrink-0">
            <button 
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${themeMode === 'dark' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/15 scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'}`}
            >
              <span>🌙</span>
              <span>Tối (Dark)</span>
            </button>
            <button 
              type="button"
              onClick={() => setThemeMode('light')}
              className={`px-4 py-2 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${themeMode === 'light' ? 'bg-[#f59e0b] text-black shadow-md shadow-amber-500/15 scale-105' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-transparent'}`}
            >
              <span>☀️</span>
              <span>Sáng (Light)</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="flex flex-col gap-6">
          
          {/* SECTION 2: AI Generation Models */}
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">2. Bộ máy xử lý AI mặc định</h3>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">Lựa chọn mô hình nền tảng chịu trách nhiệm kết xuất video và giọng nói</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Video Generation Model</label>
                <select 
                  value={videoModel} 
                  onChange={(e) => setVideoModel(e.target.value)} 
                  className="w-full premium-input custom-select rounded-xl p-2.5 text-xs text-[var(--text-primary)] font-bold outline-none cursor-pointer"
                >
                  <option value="svd-1.5">Stable Video Diffusion v1.5 (Tiêu chuẩn)</option>
                  <option value="runway-gen2">Runway Gen-2 Engine</option>
                  <option value="luma-dream">Luma Dream Machine Engine</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Voice Generation Engine</label>
                <select 
                  value={audioModel} 
                  onChange={(e) => setAudioModel(e.target.value)} 
                  className="w-full premium-input custom-select rounded-xl p-2.5 text-xs text-[var(--text-primary)] font-bold outline-none cursor-pointer"
                >
                  <option value="elevenlabs-v2">ElevenLabs Multilingual v2</option>
                  <option value="openai-tts">OpenAI Audio TTS</option>
                  <option value="xtts-v2">Coqui XTTS v2 Engine</option>
                </select>
              </div>
            </div>
          </div>

          {/* Scale up button size and typography (py-4 px-6, text-[16px]) */}
          <div className="flex justify-between items-center pt-4 border-t border-zinc-900/60 mt-3">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {savedSettings && <span className="text-green-500 flex items-center gap-1.5"><Check size={14} /> Đã cập nhật cấu hình hệ thống</span>}
            </span>
            <button 
              type="submit" 
              className="py-4 px-6 bg-[#f59e0b] hover:bg-amber-600 text-black font-black text-[16px] rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/10 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Check size={18} />
              <span>Lưu cấu hình hệ thống</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
