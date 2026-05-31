import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Play, Rocket, Mic } from 'lucide-react';
import { userService } from '../../../services/user.service';

export default function useDashboard() {
  const context = useOutletContext();
  const currentMenu = context?.currentMenu || 'video';
  const credits = context?.credits ?? 0;
  const setCredits = context?.setCredits;
  const userName = context?.userName ?? 'Trần Bắc';
  const setUserName = context?.setUserName;
  const userEmail = context?.userEmail ?? 'dung.tran@aistudio.vn';
  const setUserEmail = context?.setUserEmail;
  const userRole = context?.userRole ?? 'VIP Member';
  const avatarImage = context?.avatarImage ?? null;
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
  const [prompt, setPrompt] = useState('cưỡi ngựa trên sa mạc sao Hỏa, phong cách điện ảnh với ánh hoàng hôn đỏ rực rỡ.');
  const [aspectRatio, setAspectRatio] = useState('169');
  const [style, setStyle] = useState('realistic');
  const [voice, setVoice] = useState('adam');
  const [speed, setSpeed] = useState(1.3);
  const [generating, setGenerating] = useState(false);
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
    if (isPlaying || ttsPlaying || generating || ttsGenerating) {
      interval = setInterval(() => {
        setWaveBars(prev => prev.map(() => Math.floor(Math.random() * 35) + 8));
      }, 120);
    } else {
      setWaveBars([12, 28, 18, 42, 22, 32, 8, 22, 38, 48, 28, 18, 32, 42, 12, 28, 22, 38, 18, 8, 28, 12, 22, 8]);
    }
    return () => clearInterval(interval);
  }, [isPlaying, ttsPlaying, generating, ttsGenerating]);

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
    setGenerating(true);
    setProgress(0);
    setVideoTab('preview');

    try {
      const res = await userService.createJob({
        name: prompt.substring(0, 15) + '...',
        type: 'Video',
        prompt,
        meta_data: { aspectRatio, style, speed }
      });
      if (setCredits) {
        setCredits(res.credits);
      }
      loadHistory();
    } catch (err) {
      console.error('[VIDEO GEN] Failed:', err.message);
      alert(err.response?.data?.message || err.message || 'Không thể tạo video.');
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (generating && progress < 100) {
      const timer = setTimeout(() => setProgress(prev => prev + 5), 150);
      return () => clearTimeout(timer);
    } else if (progress >= 100) {
      setGenerating(false);
      loadHistory();
    }
  }, [generating, progress]);

  // TTS Gen Handler
  const handleGenerateTts = async () => {
    if (!ttsPrompt || !ttsPrompt.trim()) {
      toast.error("Vui lòng nhập kịch bản cần tạo giọng nói!");
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
        meta_data: { lang: ttsLang, voice: ttsVoice, speed: ttsSpeed, pitch: ttsPitch, volume: ttsVolume }
      });
      if (setCredits) {
        setCredits(res.credits);
      }
      loadHistory();
    } catch (err) {
      console.error('[TTS GEN] Failed:', err.message);
      alert(err.response?.data?.message || err.message || 'Không thể tạo giọng nói.');
      setTtsGenerating(false);
    }
  };

  useEffect(() => {
    if (ttsGenerating && ttsProgress < 100) {
      const timer = setTimeout(() => setTtsProgress(prev => prev + 10), 100);
      return () => clearTimeout(timer);
    } else if (ttsProgress >= 100) {
      setTtsGenerating(false);
      loadHistory();
    }
  }, [ttsGenerating, ttsProgress]);

  // Xử lý xóa lịch sử trực tiếp (không qua modal xác nhận nếu được gọi trực tiếp)
  const handleDeleteHistory = async (id) => {
    try {
      await userService.deleteJob(id);
      if (setHistoryList) {
        setHistoryList(prev => prev.filter(item => item.id !== id));
      }
      toast.success("Xóa lịch sử thành công!");
    } catch (err) {
      console.error('[DELETE HISTORY] Failed:', err.message);
      toast.error(err.response?.data?.message || err.message || 'Không thể xoá lịch sử.');
    }
  };

  const triggerDeleteHistory = (job) => {
    setJobToDelete(job);
    setDeleteModalOpen(true);
  };

  // Xác nhận xóa lịch sử từ Modal
  const confirmDeleteHistory = async () => {
    if (!jobToDelete) return;
    try {
      // Gọi API xóa thông qua client axios
      await userService.deleteJob(jobToDelete.id);
      
      // Cập nhật State trực tiếp ở Frontend để ẩn bản ghi đã xóa mà không cần reload trang
      if (setHistoryList) {
        setHistoryList(prev => prev.filter(item => item.id !== jobToDelete.id));
      }
      
      // Hiển thị thông báo thành công kèm tên tác vụ
      toast.success(`Đã xóa thành công: ${jobToDelete.title || 'tác vụ'}`);
    } catch (err) {
      // Ghi log lỗi để debug
      console.error('[DELETE HISTORY] Failed:', err.message);
      // Hiển thị thông báo lỗi cho người dùng bằng Toast
      toast.error(err.response?.data?.message || err.message || 'Không thể xoá lịch sử.');
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
    const matchesType = historyType === 'all' || item.type === historyType;
    const matchesSearch = item.title.toLowerCase().includes(historySearch.toLowerCase()) || 
                          item.sub.toLowerCase().includes(historySearch.toLowerCase());
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
    generating,
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
