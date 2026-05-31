import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Volume2, 
  Download, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause, 
  RefreshCw 
} from 'lucide-react';

export default function VoiceStudio() {
  // State definitions
  const [text, setText] = useState('');
  const [voiceModel, setVoiceModel] = useState('vietnam-female');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(''); // 'Pending' | 'Rendering' | 'Completed' | 'Failed'
  const [currentJobId, setCurrentJobId] = useState(null);
  const [outputUrl, setOutputUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  // Constants
  const MAX_CHARS = 2000;
  const API_BASE = 'http://localhost:5000/api/jobs';

  // Polling interval ref to clear on unmount
  const pollingRef = useRef(null);

  // Clear polling interval safely
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Safe cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  // Sync state if audio ends
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Toggle playback manually
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play()
        .catch(err => console.error("Playback failed:", err));
    }
  };

  // Submit script generation request
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setOutputUrl('');
    setIsPlaying(false);
    
    // 1. Client-side Form Validation
    const trimmedText = text.trim();
    if (!trimmedText) {
      alert("Vui lòng nhập nội dung kịch bản cần chuyển đổi!");
      return;
    }
    if (trimmedText.length > MAX_CHARS) {
      alert(`Nội dung kịch bản không được vượt quá ${MAX_CHARS} ký tự!`);
      return;
    }

    // 2. Lock UI and configure state
    setIsLoading(true);
    setProgress(0);
    setStatus('Pending');

    try {
      // 3. Extract access token from localStorage
      const token = localStorage.getItem('token') || localStorage.getItem('Access_token');
      
      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // 4. Issue asynchronous HTTP POST
      const response = await fetch(API_BASE, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          type: 'Voice',
          prompt: trimmedText,
          meta_data: { voiceModel }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Lỗi hệ thống (${response.status}) khi gửi yêu cầu.`);
      }

      const data = await response.json();
      const jobId = data.job?.id || data.id;

      if (!jobId) {
        throw new Error("Không nhận được ID tiến trình xử lý từ máy chủ.");
      }

      setCurrentJobId(jobId);
      
      // 5. Trigger Background Polling Scheduler every 2 seconds
      startPolling(jobId, headers);

    } catch (error) {
      console.error("[VOICE STUDIO] Error creating job:", error);
      setIsLoading(false);
      setStatus('Failed');
      setErrorMessage(error.message || "Không thể kết nối đến máy chủ.");
    }
  };

  // Background status polling logic
  const startPolling = (jobId, headers) => {
    stopPolling(); // Reset any existing interval

    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/${jobId}`, {
          method: 'GET',
          headers: headers
        });

        if (!response.ok) {
          throw new Error(`Lỗi kết nối kiểm tra tiến trình (${response.status}).`);
        }

        const data = await response.json();
        const job = data.job || data;

        // Map status and progress from database updates
        setStatus(job.status);
        setProgress(job.progress || 0);

        if (job.status === 'Completed') {
          stopPolling();
          setIsLoading(false);
          setOutputUrl(job.output_url);
          console.log(`[VOICE STUDIO] Job #${jobId} completed successfully.`);
        } else if (job.status === 'Failed') {
          stopPolling();
          setIsLoading(false);
          setErrorMessage(job.error_message || job.errorMessage || "Kết xuất giọng nói bị lỗi ở phía server.");
          console.log(`[VOICE STUDIO] Job #${jobId} failed.`);
        }
      } catch (err) {
        console.error("[VOICE STUDIO] Polling error:", err.message);
        // We keep polling in case of minor network jitter, unless critical failures happen
      }
    }, 2000);
  };

  // Form Reset
  const handleReset = () => {
    setText('');
    setErrorMessage('');
    setOutputUrl('');
    setIsPlaying(false);
    setProgress(0);
    setStatus('');
    setCurrentJobId(null);
    stopPolling();
  };

  return (
    <div className="min-h-screen w-full bg-[#121214] text-zinc-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 select-none font-sans">
      <div className="w-full max-w-3xl bg-[#18181c]/80 border border-zinc-800/80 rounded-2xl shadow-2xl p-6 md:p-8 backdrop-blur-md relative overflow-hidden">
        
        {/* Amber Light Glow Effect */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-amber-500/5 rounded-full filter blur-[80px] pointer-events-none"></div>
        <div className="absolute -bottom-10 left-1/4 w-80 h-80 bg-amber-500/3 rounded-full filter blur-[100px] pointer-events-none"></div>

        {/* Component Header */}
        <div className="flex items-center gap-3 border-b border-zinc-850 pb-5 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-md shadow-amber-500/5">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-zinc-100">AI Voice Studio</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Chuyển đổi văn bản thành giọng nói chất lượng cao miễn phí qua Microsoft Edge TTS</p>
          </div>
        </div>

        {/* Alert Error Box */}
        {status === 'Failed' && errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-500/30 flex items-start gap-3 text-red-400 animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-left">
              <span className="text-xs font-black uppercase tracking-wider block">Giao dịch/Kết xuất thất bại</span>
              <p className="text-xs text-red-300 mt-1 leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Input & Form Logic */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Script Textarea Input */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Nhập Kịch bản</label>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${text.length > MAX_CHARS ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800/60 text-zinc-400'}`}>
                {text.length}/{MAX_CHARS}
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={isLoading}
              placeholder="Nhập nội dung văn bản bạn muốn chuyển đổi sang giọng nói tại đây (ví dụ: Chào mừng bạn đến với AI Studio, nền tảng sản xuất nội dung kỹ thuật số chuyên nghiệp...)"
              maxLength={MAX_CHARS}
              className="w-full min-h-[160px] max-h-[300px] p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-500 text-sm outline-none transition-all focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed resize-y leading-relaxed"
            />
          </div>

          {/* Configuration Selection dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-left">Chọn Giọng Đọc AI Cloud</label>
            <select
              value={voiceModel}
              onChange={(e) => setVoiceModel(e.target.value)}
              disabled={isLoading}
              className="w-full p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-zinc-200 text-sm outline-none cursor-pointer transition-all focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <option value="vietnam-male">Nam Minh (Giọng nam Việt Nam - Trầm ấm, thuyết minh)</option>
              <option value="vietnam-female">Hoài Mỹ (Giọng nữ Việt Nam - Truyền cảm, quảng cáo)</option>
              <option value="us-male">Guy (Giọng nam Mỹ - Cinematic, truyền thông)</option>
              <option value="us-female">Jenny (Giọng nữ Mỹ - Tự nhiên, lưu loát)</option>
              <option value="us-kid">Ana (Giọng trẻ em Mỹ - Vui vẻ, nhí nhảnh)</option>
              <option value="uk-male">Ryan (Giọng nam Anh - Chuyên nghiệp, lịch lãm)</option>
              <option value="uk-female">Sonia (Giọng nữ Anh - Quý phái, thanh lịch)</option>
            </select>
          </div>

          {/* Action buttons & Processing indicator */}
          <div className="pt-2 flex flex-col gap-4">
            
            {/* Progress bar loader mapping active database polling updates */}
            {isLoading && (
              <div className="space-y-2 bg-zinc-900/40 border border-zinc-800/40 p-4 rounded-xl">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Đang xử lý kịch bản...
                  </span>
                  <span className="text-zinc-400 font-mono font-bold">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-[10px] text-zinc-500 text-left">Đang khởi tạo kết nối Edge TTS và ghi tập tin âm thanh vào phân vùng lưu trữ.</p>
              </div>
            )}

            {/* Submit & Reset CTAs */}
            <div className="flex items-center gap-3">
              {status && !isLoading && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30 text-zinc-300 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer select-none"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Làm mới</span>
                </button>
              )}
              
              <button
                type="submit"
                disabled={isLoading || !text.trim()}
                className="flex-1 py-3 px-6 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-800 text-black disabled:text-zinc-600 font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed active:scale-[0.99] shadow-lg shadow-amber-500/10 disabled:shadow-none border-none select-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                    <span>Đang render ({progress}%)</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 text-black" />
                    <span>Bắt đầu chuyển đổi (5 Credits)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Audio Player and Branded Download Workspace */}
        {status === 'Completed' && outputUrl && (
          <div className="mt-8 p-5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-4 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4" />
                <span>Hoàn thành tạo giọng nói AI</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Job ID: #{currentJobId}</span>
            </div>

            {/* Hidden native player for audio state syncing */}
            <audio 
              ref={audioRef}
              src={outputUrl || undefined}
              crossOrigin="anonymous"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={handleAudioEnded}
              className="hidden"
            />

            {/* Interactive Player Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-4 bg-zinc-950/40 p-4 border border-zinc-850 rounded-lg">
              
              {/* Play / Pause button */}
              <button
                type="button"
                onClick={togglePlay}
                className="w-10 h-10 bg-amber-500 hover:bg-amber-600 text-black rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-md shadow-amber-500/10 active:scale-95"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black ml-0.5" />}
              </button>

              {/* Player text feedback info */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-300 truncate">Tập tin kết xuất âm thanh AI</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-[10px] text-zinc-400 truncate">Edge TTS Model: {voiceModel}</span>
                </div>
              </div>

              {/* Hybrid Branded Local Download Link */}
              <a
                href={outputUrl}
                download={`AI_Studio_Voice_#${currentJobId}.mp3`}
                className="w-full sm:w-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-750 text-zinc-200 font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer no-underline select-none active:scale-98"
                title="Tải xuống tệp tin với nhãn thương hiệu"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải xuống</span>
              </a>
            </div>
            
            <p className="text-[10px] text-zinc-500 italic text-center leading-normal">
              * Ghi chú: File được tải về sẽ tự động chuyển tên thành "AI_Studio_Voice_#{currentJobId}.mp3" qua cấu hình download tag nhằm định vị thương hiệu.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
