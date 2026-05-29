import React, { useState, useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';
import Toast from '../ui/Toast';
import { Play, Pause, Download, X, Rocket, Mic } from 'lucide-react';
import { userService } from '../../services/user.service';

const MainLayout = () => {
  const [currentMenu, setCurrentMenu] = useState('video');
  const [credits, setCredits] = useState(0);
  const [activeModal, setActiveModal] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: '', email: '', role: '', avatar: null });

  // Preview Dialog state lifted globally
  const [previewJob, setPreviewJob] = useState(null);
  const [modalPlaying, setModalPlaying] = useState(false);
  const [modalVolume, setModalVolume] = useState(1.0);
  const modalAudioRef = useRef(null);
  const modalCanvasRef = useRef(null);

  // Global History State
  const [historyList, setHistoryList] = useState([]);

  // Toast notifications state
  const [toastState, setToastState] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToastState({ show: true, message, type });
  };
  const closeToast = () => {
    setToastState(prev => ({ ...prev, show: false }));
  };

  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error'),
    info: (msg) => showToast(msg, 'info')
  };

  const loadHistory = () => {
    userService.getHistory()
      .then(data => {
        if (data) {
          const mapped = data.map(job => {
            const isVideo = job.type === 'Video' || job.type === 'video' || job.type === 'render_task';
            return {
              id: job.id,
              title: job.name,
              sub: job.prompt,
              time: new Date(job.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(job.createdAt).toLocaleDateString('vi-VN'),
              type: isVideo ? 'video' : 'tts',
              status: job.status,
              progress: job.progress,
              output_url: job.output_url,
              ratio: job.meta_data?.aspectRatio === '916' ? '9:16 TikTok' : '16:9 Ngang',
              lang: job.meta_data?.lang === 'vi' ? 'Tiếng Việt' : job.meta_data?.lang === 'en' ? 'Tiếng Anh' : 'Tiếng Nhật',
              voice: job.meta_data?.voice === 'vi-VN-NamMinhNeural' || job.meta_data?.voice === 'vi-male-1' ? 'Adam (Nam)' :
                     job.meta_data?.voice === 'vi-VN-HoaiMyNeural' || job.meta_data?.voice === 'vi-female-1' ? 'Bella (Nữ)' :
                     job.meta_data?.voice || 'Mặc định',
              duration: '10 giây',
              icon: isVideo ? Rocket : Mic,
              iconColor: isVideo ? '#a855f7' : '#f59e0b',
              gradient: isVideo ? 'from-purple-900/30 to-[#0f0f13]' : null
            };
          });
          setHistoryList(mapped);
        }
      })
      .catch(err => {
        console.error('[GLOBAL HISTORY] Fetch failed:', err.message);
      });
  };

  useEffect(() => {
    userService.getProfile()
      .then(profile => {
        if (profile) {
          setUserProfile(profile);
          setCredits(profile.credits || 0);
        }
      })
      .catch(err => {
        console.error('[PROFILE] Fetch failed:', err.message);
      });
  }, []);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  // Sync volume of audio element and handle reset play state when job changes
  useEffect(() => {
    setModalPlaying(false);
    if (modalAudioRef.current) {
      modalAudioRef.current.pause();
      modalAudioRef.current.src = (previewJob && previewJob.type !== 'video') ? `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${previewJob.id}.mp3` : '';
      modalAudioRef.current.load();
      modalAudioRef.current.volume = modalVolume;
    }
  }, [previewJob]);

  useEffect(() => {
    if (modalAudioRef.current) {
      modalAudioRef.current.volume = modalVolume;
    }
  }, [modalVolume]);

  const handleDownloadAsset = async (job) => {
    if (job.status !== 'Completed') {
      toast.error("Tác vụ này chưa hoàn thành, không thể tải xuống!");
      return;
    }
    toast.info("🚀 Bắt đầu tải xuống! Vui lòng đợi trong giây lát...");
    try {
      const isVideo = job.type === 'Video' || job.type === 'video' || job.type === 'render_task';
      const fileUrl = isVideo
        ? `http://localhost:3000/uploads/videos/AI_Studio_Video_ID_${job.id}.mp4`
        : `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${job.id}.mp3`;

      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Server returned status ${response.status}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = isVideo ? `AI Studio_${job.id}.mp4` : `AI Studio_${job.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      toast.success("🎉 Tải xuống thành công!");
    } catch (err) {
      console.error('[DOWNLOAD ERROR]', err);
      toast.error("❌ Tải xuống thất bại! Vui lòng kiểm tra kết nối.");
    }
  };

  // Canvas visualizer animation for modal
  useEffect(() => {
    if (!previewJob || !modalCanvasRef.current || !modalAudioRef.current) return;
    const canvas = modalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const updateSize = () => {
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth || 300;
        canvas.height = 60;
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barCount = 25;
      const barWidth = (canvas.width / barCount) - 3;
      const isPlaying = modalPlaying;

      for (let i = 0; i < barCount; i++) {
        let height = 4;
        if (isPlaying) {
          const time = Date.now() * 0.008;
          height = Math.sin(i * 0.3 + time) * 18 + 22;
          height = Math.max(4, height);
        }

        const x = i * (barWidth + 3);
        const y = canvas.height - height;

        const grad = ctx.createLinearGradient(0, y, 0, canvas.height);
        grad.addColorStop(0, '#f59e0b');
        grad.addColorStop(1, '#ef4444');

        ctx.fillStyle = grad;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, height, 3);
        } else {
          ctx.rect(x, y, barWidth, height);
        }
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', updateSize);
    };
  }, [previewJob, modalPlaying]);

  const handleModalPlayPause = () => {
    if (!modalAudioRef.current) return;
    if (modalPlaying) {
      modalAudioRef.current.pause();
      setModalPlaying(false);
    } else {
      modalAudioRef.current.play()
        .then(() => setModalPlaying(true))
        .catch(err => console.error('[MODAL PLAY] Failed:', err));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }} className="relative">
      <Header credits={credits} onOpenModal={setActiveModal} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} className="relative">
        {/* Backdrop for mobile/tablet when sidebar is open */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/55 backdrop-blur-xs z-25 cursor-pointer"
          />
        )}
        <Sidebar 
          currentMenu={currentMenu} 
          setCurrentMenu={setCurrentMenu} 
          onOpenModal={setActiveModal} 
          isOpen={isSidebarOpen} 
          setIsOpen={setIsSidebarOpen} 
          previewJob={previewJob}
          setPreviewJob={setPreviewJob}
          historyList={historyList}
          loadHistory={loadHistory}
        />
        <main style={{ flex: 1, padding: '0', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          <Outlet context={{ 
            currentMenu, 
            setCurrentMenu, 
            credits, 
            setCredits, 
            activeModal, 
            setActiveModal,
            previewJob,
            setPreviewJob,
            historyList,
            setHistoryList,
            loadHistory,
            userName: userProfile.name,
            setUserName: (name) => setUserProfile(prev => ({ ...prev, name })),
            userEmail: userProfile.email,
            setUserEmail: (email) => setUserProfile(prev => ({ ...prev, email })),
            userRole: userProfile.role,
            avatarImage: userProfile.avatar,
            setAvatarImage: (avatar) => setUserProfile(prev => ({ ...prev, avatar }))
          }} />
        </main>
      </div>

      {/* Unified Global Toast Notification */}
      <Toast 
        show={toastState.show} 
        message={toastState.message} 
        type={toastState.type} 
        onClose={closeToast} 
      />

      {/* High-Specification History Preview Dialog Modal */}
      {previewJob && (
        <div className="backdrop-blur-sm bg-black/60 fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-left flex flex-col gap-4">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
              <h3 className="text-sm font-black text-[#f59e0b] uppercase tracking-wider">
                Xem trước {previewJob.type === 'video' ? 'video' : 'giọng nói'} #{previewJob.id}
              </h3>
              <button 
                type="button"
                onClick={() => {
                  if (modalAudioRef.current) {
                    modalAudioRef.current.pause();
                  }
                  setModalPlaying(false);
                  setPreviewJob(null);
                }}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-900 transition-all cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body: Video vs Audio */}
            {previewJob.type === 'video' ? (
              <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-900">
                <video 
                  src={`http://localhost:3000/uploads/videos/AI_Studio_Video_ID_${previewJob.id}.mp4`}
                  controls 
                  autoPlay 
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <>
                {/* Audio Node */}
                <audio 
                  ref={modalAudioRef}
                  src={`http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${previewJob.id}.mp3`}
                  crossOrigin="anonymous"
                  onPlay={() => setModalPlaying(true)}
                  onPause={() => setModalPlaying(false)}
                  onEnded={() => setModalPlaying(false)}
                />

                {/* Visualizer Canvas */}
                <div className="w-full h-18 bg-black/45 border border-zinc-900 rounded-xl flex items-end justify-center px-4 py-2 relative overflow-hidden">
                  <canvas ref={modalCanvasRef} className="w-full h-14" />
                  <div className="absolute top-2 left-2 text-[8px] bg-black/70 border border-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 uppercase tracking-widest font-black">
                    {modalPlaying ? 'Equalizer Active' : 'Idle'}
                  </div>
                </div>
              </>
            )}

            {/* Subtitle / Prompt text */}
            <div className="bg-[#0c0c0e] border border-zinc-900 p-3.5 rounded-xl max-h-24 overflow-y-auto select-text">
              <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                "{previewJob.sub}"
              </p>
            </div>

            {/* Stats info */}
            <div className="grid grid-cols-2 gap-2 text-[10px] bg-zinc-900/20 p-3 rounded-xl border border-zinc-900/40 text-zinc-400">
              {previewJob.type === 'video' ? (
                <>
                  <div>
                    Tỷ lệ: <span className="text-zinc-200 font-bold">{previewJob.ratio}</span>
                  </div>
                  <div>
                    Thời lượng: <span className="text-zinc-200 font-bold">{previewJob.duration || '5 giây'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    Giọng: <span className="text-zinc-200 font-bold">{previewJob.voice}</span>
                  </div>
                  <div>
                    Ngôn ngữ: <span className="text-zinc-200 font-bold">{previewJob.lang}</span>
                  </div>
                </>
              )}
              <div>
                Thời gian: <span className="text-zinc-200 font-bold">{previewJob.time}</span>
              </div>
              <div>
                Trạng thái: <span className="text-green-500 font-bold uppercase">{previewJob.status}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-3.5 pt-2">
              {previewJob.type !== 'video' && (
                <div className="flex items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 rounded-xl p-3">
                  {/* Large Play/Pause Toggle button */}
                  <button
                    type="button"
                    onClick={handleModalPlayPause}
                    className="w-10 h-10 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0 border-none shadow-md"
                  >
                    {modalPlaying ? (
                      <Pause size={16} fill="black" />
                    ) : (
                      <Play size={16} fill="black" className="ml-0.5" />
                    )}
                  </button>

                  {/* Volume slider */}
                  <div className="flex-1 flex flex-col gap-1 text-left">
                    <div className="flex justify-between items-center text-[9px] font-bold text-zinc-500">
                      <span>Âm lượng</span>
                      <span>{Math.round(modalVolume * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={modalVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setModalVolume(val);
                      }}
                      className="w-full cursor-pointer accent-[#f59e0b] h-1 bg-zinc-800 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              )}

              {/* Direct download button linked to toast handler */}
              <button
                type="button"
                onClick={() => handleDownloadAsset(previewJob)}
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border-none"
              >
                <Download size={14} />
                <span>Tải xuống</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
