import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Play, Rocket, Mic } from 'lucide-react';
import { userService } from '../../../services/user.service';
import axiosClient from '../../../services/axiosClient';
import { useAuth } from '../../../hooks/useAuth';

// ─── Helper: Resolve đúng DELETE endpoint dựa theo type của job ───────────────
// Backend có 4 bảng riêng biệt:
//   • ImageJob          → xóa qua DELETE /api/image/:id
//   • ImageAnalysis     → xóa qua DELETE /api/image-analyzer/:id
//   • VideoJob          → xóa qua DELETE /api/video-jobs/:id
//   • Job (Voice / TTS) → xóa qua DELETE /api/user/jobs/:id
const resolveDeleteEndpoint = (job) => {
  const t = (job?.type || '').toLowerCase();
  if (t === 'image' || t === 'flux') {
    return `/image/${job.id}`;
  }
  if (t === 'analysis' || t === 'vision' || t === 'mat_than') {
    return `/image-analyzer/${job.id}`;
  }
  // Video items từ bảng video_jobs
  if (t === 'video' || t === 'render_task') {
    return `/video-jobs/${job.id}`;
  }
  // Voice, TTS, render_task cũ → bảng Job chung
  return `/user/jobs/${job.id}`;
};

export default function useDashboard() {
  const context = useOutletContext();
  const { user, updateUserState } = useAuth();

  const currentMenu = context?.currentMenu || 'video';
  const credits = user?.credits || 0;
  const setCredits = context?.setCredits;
  const userName = user?.name || '';
  const setUserName = context?.setUserName;
  const userEmail = user?.email || '';
  const setUserEmail = context?.setUserEmail;
  const userRole = user?.role || '';
  const avatarImage = user?.avatar || '';
  const setAvatarImage = context?.setAvatarImage;
  const themeMode = context?.themeMode || 'dark';
  const setThemeMode = context?.setThemeMode;
  const setCurrentMenu = context?.setCurrentMenu;
  const previewJob = context?.previewJob;
  const setPreviewJob = context?.setPreviewJob;
  const historyList = context?.historyList || [];
  const setHistoryList = context?.setHistoryList;
  const loadHistory = context?.loadHistory || (() => {});

  // 1. STATE: VIDEO GENERATOR
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('169');
  const [style, setStyle] = useState('realistic');
  const [voice, setVoice] = useState('adam');
  const [speed, setSpeed] = useState(1.3);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoTab, setVideoTab] = useState('config'); // Mobile tabs: 'config' | 'preview'
  const [isMuted, setIsMuted] = useState(false);
  const [isTtsMuted, setIsTtsMuted] = useState(false);

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

  // 2. STATE: TEXT-TO-SPEECH (TTS) GENERATOR
  const [ttsPrompt, setTtsPrompt] = useState('');
  const [ttsLang, setTtsLang] = useState('vi');
  const [ttsVoice, setTtsVoice] = useState('vi-VN-NamMinhNeural');
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [ttsVolume, setTtsVolume] = useState(90);
  const [ttsGenerating, setTtsGenerating] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsTab, setTtsTab] = useState('config'); // Mobile tabs: 'config' | 'preview'

  // Centralized Audio Player States
  const [activeAudioUrl, setActiveAudioUrl] = useState(null);
  const [activeJobId, setActiveJobId] = useState(null);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);

  // Waveform animation
  const [waveBars, setWaveBars] = useState([12, 28, 18, 42, 22, 32, 8, 22, 38, 48, 28, 18, 32, 42, 12, 28, 22, 38, 18, 8, 28, 12, 22, 8]);
  useEffect(() => {
    let interval;
    if (isPlaying || ttsPlaying || isRendering || ttsGenerating) {
      interval = setInterval(() => {
        setWaveBars(prev => prev.map(() => Math.floor(Math.random() * 35) + 8));
      }, 120);
    } else {
      setWaveBars([12, 28, 18, 42, 22, 32, 8, 22, 38, 48, 28, 18, 32, 42, 12, 28, 22, 38, 18, 8, 28, 12, 22, 8]);
    }
    return () => clearInterval(interval);
  }, [isPlaying, ttsPlaying, isRendering, ttsGenerating]);

  // 3. STATE: UNIFIED HISTORY
  const [historyType, setHistoryType] = useState('all'); // 'all' | 'video' | 'tts'
  const [historySearch, setHistorySearch] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);

  // 4. STATE: SETTINGS
  const [videoModel, setVideoModel] = useState(() => localStorage.getItem('user_video_model') || 'svd-1.5');
  const [audioModel, setAudioModel] = useState(() => localStorage.getItem('user_audio_model') || 'elevenlabs-v2');
  const [savedSettings, setSavedSettings] = useState(false);

  // Video Gen Handler
  const handleGenerateVideo = async () => {
    if (!prompt || !prompt.trim()) {
      toast.error("Vui lòng nhập ý tưởng kịch bản cho video!");
      return;
    }

    // Kiểm tra số dư credit của người dùng
    if (credits < 10) {
      toast.error("Số dư tín dụng (credits) của bạn không đủ để thực hiện tác vụ này.");
      return;
    }

    setIsRendering(true);
    setProgress(0);
    setVideoTab('preview');

    let progressInterval = null;
    let apiCompleted = false;
    let apiResponse = null;

    // Chạy bộ đếm mô phỏng render tăng dần mượt mà
    progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) {
          if (apiCompleted) {
            clearInterval(progressInterval);
            setIsRendering(false);
            if (updateUserState && apiResponse) {
              updateUserState({ credits: apiResponse.credits });
            }
            loadHistory();
            toast.success("Tạo video AI thành công!");
            return 100;
          }
          return 98;
        }
        return prev + 2;
      });
    }, 150);

    try {
      const res = await userService.createJob({
        name: prompt.substring(0, 15) + '...',
        type: 'Video',
        prompt,
        meta_data: { aspectRatio, style, speed }
      });
      apiResponse = res;
      apiCompleted = true;
    } catch (err) {
      console.error('[VIDEO GEN] Failed:', err.message);
      clearInterval(progressInterval);
      setIsRendering(false);
      setProgress(0);
      toast.error(err.response?.data?.message || err.message || 'Không thể tạo video.');
    }
  };

  // TTS Gen Handler
  const handleGenerateTts = async () => {
    if (!ttsPrompt || !ttsPrompt.trim()) {
      toast.error("Vui lòng nhập kịch bản cần tạo giọng nói!");
      return;
    }

    // Kiểm tra số dư credit của người dùng trước khi tạo TTS
    if (credits < 5) {
      toast.error("Số dư tín dụng (credits) của bạn không đủ để thực hiện tác vụ này.");
      return;
    }

    setTtsGenerating(true);
    setTtsProgress(0);
    setTtsTab('preview');

    try {
      const res = await userService.createJob({
        name: ttsPrompt.substring(0, 15) + '...',
        type: 'Voice',
        prompt: ttsPrompt,
        text: ttsPrompt,
        meta_data: {
          voiceModel: ttsVoice,  // key chính Backend ưu tiên đọc (meta?.voiceModel)
          voice: ttsVoice,       // key fallback để tương thích ngược
          lang: ttsLang,
          speed: ttsSpeed,
          pitch: ttsPitch,
          volume: ttsVolume
        }
      });
      console.log('[TTS GEN] Request sent — voice:', ttsVoice, '| lang:', ttsLang, '| speed:', ttsSpeed, '| pitch:', ttsPitch);
      if (updateUserState) {
        updateUserState({ credits: res.credits });
      }
      if (setCredits) {
        setCredits(res.credits);
      }
      setTtsPrompt('');
      setTtsProgress(100);
      setTtsGenerating(false);
      loadHistory();
    } catch (err) {
      console.error('[TTS GEN] Failed:', err.message);
      toast.error(err.response?.data?.message || err.message || 'Không thể tạo giọng nói.');
      setTtsGenerating(false);
    }
  };

  useEffect(() => {
    if (ttsGenerating && ttsProgress < 100) {
      const timer = setTimeout(() => setTtsProgress(prev => prev + 10), 100);
      return () => clearTimeout(timer);
    } else if (!ttsGenerating && ttsProgress >= 100) {
      // Reset progress sau khi hoàn thành, KHÔNG gọi lại loadHistory (đã gọi ở handler)
      setTtsProgress(0);
    }
  }, [ttsGenerating, ttsProgress]);

  // Không cần gọi lại loadHistory khi đổi filter - dữ liệu đã có sẵn trong historyList,
  // chỉ cần lọc lại qua filteredHistory ở dưới (client-side filtering)
  // useEffect(() => { loadHistory(); }, [historyType]); // ĐÃ XÓA ĐỂ TRÁNH VÒNG LẶP

  // Xử lý xóa lịch sử trực tiếp (không qua modal xác nhận nếu được gọi trực tiếp)
  // Tham số job có thể là object (có .type) hoặc id thuần — hỗ trợ cả hai
  const handleDeleteHistory = async (jobOrId) => {
    const isObject = typeof jobOrId === 'object' && jobOrId !== null;
    const endpoint = isObject
      ? resolveDeleteEndpoint(jobOrId)
      : `/user/jobs/${jobOrId}`; // fallback nếu chỉ truyền id
    const id = isObject ? jobOrId.id : jobOrId;
    try {
      await axiosClient.delete(endpoint);
      if (setHistoryList) {
        setHistoryList(prev => prev.filter(item => item.id !== id));
      }
      toast.success('Xóa lịch sử thành công!');
    } catch (err) {
      console.error('[DELETE HISTORY] Failed:', err.message);
      toast.error(err.response?.data?.message || err.message || 'Không thể xoá lịch sử.');
    }
  };

  const triggerDeleteHistory = (job) => {
    setJobToDelete(job);
    setDeleteModalOpen(true);
  };

  // Xác nhận xóa lịch sử từ Global Modal Dialog
  // FIX TRIỆT ĐỂ 404: Route tới đúng endpoint Backend dựa theo jobToDelete.type:
  //   • image/flux        → DELETE /api/image/:id             (ImageJob table)
  //   • vision/mat_than/analysis → DELETE /api/image-analyzer/:id (ImageAnalysis table)
  //   • video/voice/tts   → DELETE /api/user/jobs/:id         (Job table)
  const confirmDeleteHistory = async () => {
    if (!jobToDelete) return;
    const endpoint = resolveDeleteEndpoint(jobToDelete);
    // Lưu callback trước khi reset state (tránh lost reference sau finally)
    const onSuccessCallback = jobToDelete._onDeleteSuccess || null;
    try {
      // Gọi đúng endpoint tương ứng với loại tác vụ
      await axiosClient.delete(endpoint);

      // Cập nhật State trực tiếp ở Frontend để ẩn bản ghi đã xóa mà không cần reload trang
      if (setHistoryList) {
        setHistoryList(prev => prev.filter(item => item.id !== jobToDelete.id));
      }

      // Tải lại lịch sử từ server để đồng bộ dữ liệu mới nhất
      if (typeof loadHistory === 'function') {
        loadHistory();
      }

      // Hiển thị thông báo thành công kèm tên tác vụ
      toast.success(`Đã xóa thành công: ${jobToDelete.title || 'tác vụ'}`);

      // Gọi callback điều hướng sau xóa (nếu có) — dùng cho MatThanDetailView navigate(-1)
      if (typeof onSuccessCallback === 'function') {
        onSuccessCallback();
      }
    } catch (err) {
      // Ghi log lỗi để debug — bao gồm endpoint đã gọi để dễ trace
      console.error(`[DELETE HISTORY] Failed at ${endpoint}:`, err.message);
      // Hiển thị thông báo lỗi cho người dùng bằng Toast
      toast.error(err.response?.data?.message || err.message || 'Không thể xoá tác vụ.');
    } finally {
      // Đóng modal và reset job được chọn xóa
      setDeleteModalOpen(false);
      setJobToDelete(null);
    }
  };

  const cancelDeleteHistory = () => {
    setDeleteModalOpen(false);
    setJobToDelete(null);
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('user_video_model', videoModel);
    localStorage.setItem('user_audio_model', audioModel);
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
  };

  const handleDownloadAsset = async (job) => {
    const isVideo = job.type === 'Video' || job.type === 'video' || job.type === 'render_task';
    const assetTypeName = isVideo ? "video" : "giọng nói";

    // STAGE 1: Validation Check
    if (job.status !== 'Completed') {
      toast.error(`Tác vụ ${assetTypeName} này chưa hoàn thành, không thể tải xuống!`);
      return;
    }

    // STAGE 2: Initialization
    toast.info(`📥 Đang tải xuống ${assetTypeName}... Vui lòng đợi trong giây lát.`);

    try {
      const fileUrl = isVideo
        ? `http://localhost:3000/uploads/videos/AI_Studio_Video_ID_${job.id}.mp4`
        : `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${job.id}.mp3`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      const blob = await response.blob();

      // STAGE 3: Success Save
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = isVideo ? `AI_Studio_Video_${job.id}.mp4` : `AI_Studio_Voice_${job.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success(`🎉 Tải xuống ${assetTypeName} thành công!`);
    } catch (err) {
      console.error('[DOWNLOAD ERROR]', err);
      // STAGE 4: Network Catch Error
      toast.error(`❌ Tải xuống ${assetTypeName} thất bại! Vui lòng kiểm tra kết nối.`);
    }
  };

  // Filter history based on type and search query
  const filteredHistory = historyList.filter(item => {
    let matchesType = false;
    if (historyType === 'all') {
      matchesType = true;
    } else if (historyType === 'video') {
      matchesType = item.type === 'video';
    } else if (historyType === 'image') {
      matchesType = item.type === 'image';
    } else if (historyType === 'audio' || historyType === 'tts') {
      matchesType = item.type === 'audio' || item.type === 'tts';
    } else if (historyType === 'analysis') {
      matchesType = item.type === 'analysis' || item.prompt_output;
    }

    const title = item.title || '';
    const sub = item.sub || '';
    const matchesSearch = title.toLowerCase().includes(historySearch.toLowerCase()) || 
                          sub.toLowerCase().includes(historySearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  return {
    currentMenu,
    setCurrentMenu,
    credits,
    userName,
    userEmail,
    userRole,
    avatarImage,
    themeMode,
    setThemeMode,
    
    // Video generator
    prompt,
    setPrompt,
    aspectRatio,
    setAspectRatio,
    style,
    setStyle,
    voice,
    setVoice,
    speed,
    setSpeed,
    isRendering,
    generating: isRendering, // compatibility fallback
    progress,
    isPlaying,
    setIsPlaying,
    videoTab,
    setVideoTab,
    isMuted,
    setIsMuted,
    
    // TTS generator
    ttsPrompt,
    setTtsPrompt,
    ttsLang,
    setTtsLang,
    ttsVoice,
    setTtsVoice,
    ttsSpeed,
    setTtsSpeed,
    ttsPitch,
    setTtsPitch,
    ttsVolume,
    setTtsVolume,
    ttsGenerating,
    ttsProgress,
    ttsPlaying,
    setTtsPlaying,
    ttsTab,
    setTtsTab,
    isTtsMuted,
    setIsTtsMuted,
    waveBars,

    // Centralized Player States
    activeAudioUrl,
    setActiveAudioUrl,
    activeJobId,
    setActiveJobId,
    audioCurrentTime,
    setAudioCurrentTime,
    audioDuration,
    setAudioDuration,
    previewJob,
    setPreviewJob,
    
    // History
    historyType,
    setHistoryType,
    historySearch,
    setHistorySearch,
    historyList,
    filteredHistory,
    
    // Settings
    videoModel,
    setVideoModel,
    audioModel,
    setAudioModel,
    savedSettings,
    setUserName,
    setAvatarImage,
    
    toastState,
    closeToast,
    toast,

    // Handlers
    handleGenerateVideo,
    handleGenerateTts,
    handleDeleteHistory,
    handleSaveSettings,
    handleMouseMove,
    handleDownloadAsset,
    
    // Deletion Modal
    deleteModalOpen,
    jobToDelete,
    triggerDeleteHistory,
    confirmDeleteHistory,
    cancelDeleteHistory
  };
}
