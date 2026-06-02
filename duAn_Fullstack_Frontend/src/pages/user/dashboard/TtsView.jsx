import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Volume2, VolumeX, RefreshCw, Play, Pause, Download, Trash2 } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

export default function TtsView({
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
  handleGenerateTts,
  historyList = [],
  setCurrentMenu,
  handleDeleteHistory,
  triggerDeleteHistory,
  handleMouseMove,
  handleDownloadAsset,
  previewJob,
  setPreviewJob,
  toast,

  // Centralized Audio States
  activeAudioUrl,
  setActiveAudioUrl,
  activeJobId,
  setActiveJobId,
  audioCurrentTime,
  setAudioCurrentTime,
  audioDuration,
  setAudioDuration
}) {
  const navigate = useNavigate();
  const ttsTextareaRef = useRef(null);
  const audioRef = useRef(null);
  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const previewAudioRef = useRef(null);

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => { setShowScrollTop(window.scrollY > 300); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handlePlayPreview = (e, previewUrl, voiceId) => {
    e.stopPropagation();

    let absoluteUrl = previewUrl;
    
    if (!absoluteUrl || typeof absoluteUrl !== 'string' || !absoluteUrl.startsWith('http')) {
      const targetId = voiceId || previewUrl;
      const matchedVoice = voices.find(v => v.id === targetId || v.identifier === targetId);
      if (matchedVoice && matchedVoice.preview_url && matchedVoice.preview_url.startsWith('http')) {
        absoluteUrl = matchedVoice.preview_url;
      }
    }

    if (!absoluteUrl || typeof absoluteUrl !== 'string' || !absoluteUrl.startsWith('http')) {
      const targetId = voiceId || previewUrl;
      const matchedVoice = initialPremiumVoices.find(v => v.id === targetId || v.identifier === targetId);
      if (matchedVoice && matchedVoice.preview_url && matchedVoice.preview_url.startsWith('http')) {
        absoluteUrl = matchedVoice.preview_url;
      }
    }

    if (!absoluteUrl || typeof absoluteUrl !== 'string' || !absoluteUrl.startsWith('http')) {
      absoluteUrl = "https://samplelib.com/samples/sample-speech-1m.mp3";
    }

    console.log("[TTS VIEW] Playing preview voice ID:", voiceId, "via URL:", absoluteUrl);

    const idToToggle = voiceId || previewUrl;
    if (playingVoiceId === idToToggle) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPlayingVoiceId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      
      try {
        previewAudioRef.current = new Audio(absoluteUrl);
        setPlayingVoiceId(idToToggle);
        previewAudioRef.current.onended = () => {
          setPlayingVoiceId(null);
        };
        previewAudioRef.current.play().catch(err => {
          console.error("Failed to play preview:", err);
          if (toast && toast.error) {
            toast.error("Không thể phát thử giọng nói này.");
          }
          setPlayingVoiceId(null);
        });
      } catch (err) {
        console.error("Error creating audio instance:", err);
        if (toast && toast.error) {
          toast.error("Thiết bị của bạn không hỗ trợ định dạng âm thanh này.");
        }
        setPlayingVoiceId(null);
      }
    }
  };

  const initialPremiumVoices = [
    { id: "vi-VN-NamMinhNeural", identifier: "vi-VN-NamMinhNeural", name: "Giọng mặc định (Nam Minh)", gender: "Male", preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "vi-VN-HoaiMyNeural", identifier: "vi-VN-HoaiMyNeural", name: "Giọng mặc định (Hoài My)", gender: "Female", preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "en-US-JennyNeural", identifier: "en-US-JennyNeural", name: "Giọng mặc định (Jenny)", gender: "Female", preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "ja-JP-NanamiNeural", identifier: "ja-JP-NanamiNeural", name: "Giọng mặc định (Nanami)", gender: "Female", preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "pNInz6obpgmA5QCmsfUR", identifier: "pNInz6obpgmA5QCmsfUR", name: "Adam (Nam Trầm - Cuốn hút)", gender: "Male", tags: ["Narration", "Lifestyle"], preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/pNInz6obpgDQGcFmaJgB/38a69695-2ca9-4b9e-b9ec-f07ced494a58.mp3" },
    { id: "21m00Tcm4TlvDq8ikWAM", identifier: "21m00Tcm4TlvDq8ikWAM", name: "Rachel (Nữ Ấm áp - Quốc dân)", gender: "Female", tags: ["Review", "Story"], preview_url: "https://storage.googleapis.com/eleven-public-prod/premade/voices/21m00Tcm4TlvDq8ikWAM/df6788f9-5c96-470d-8312-aab3b3d8f50a.mp3" },
    { id: "ErXwobaYiN019PkySvjV", identifier: "ErXwobaYiN019PkySvjV", name: "Antoni (Nam Đọc Sắc nét - Pro)", gender: "Male", tags: ["Technology", "Ads"], preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "EXAVITQu4vr4xnSDxMaL", identifier: "EXAVITQu4vr4xnSDxMaL", name: "Bella (Nữ Nhẹ nhàng - Sâu lắng)", gender: "Female", tags: ["Podcast", "Vlog"], preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "jBpfYwDxm6atqNs9Q7gH", identifier: "jBpfYwDxm6atqNs9Q7gH", name: "Gigi (Nữ Năng động - TikTok trend)", gender: "Female", tags: ["Animation", "Promo"], preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "TxGEqn7nU7vIuJ7DgnCc", identifier: "TxGEqn7nU7vIuJ7DgnCc", name: "Josh (Nam Trầm dày - Thương hiệu)", gender: "Male", tags: ["Commercial"], preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "MF3mGyEYCl7XYWbms88w", identifier: "MF3mGyEYCl7XYWbms88w", name: "Elli (Nữ Trong trẻo - Tin tức)", gender: "Female", tags: ["News", "Tutorial"], preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" },
    { id: "IKne3meq5aSn9XLyUdCD", identifier: "IKne3meq5aSn9XLyUdCD", name: "Arnold (Nam Mạnh mẽ - Động lực)", gender: "Male", tags: ["Motivation"], preview_url: "https://samplelib.com/samples/sample-speech-1m.mp3" }
  ];

  const [voices, setVoices] = useState(initialPremiumVoices);
  const [text, setText] = useState("");

  const isPremiumVoice = (identifier) => {
    const premiumIds = [
      "pNInz6obpgmA5QCmsfUR",
      "21m00Tcm4TlvDq8ikWAM",
      "ErXwobaYiN019PkySvjV",
      "EXAVITQu4vr4xnSDxMaL",
      "jBpfYwDxm6atqNs9Q7gH",
      "TxGEqn7nU7vIuJ7DgnCc",
      "MF3mGyEYCl7XYWbms88w",
      "IKne3meq5aSn9XLyUdCD"
    ];
    return premiumIds.includes(identifier) || (identifier && identifier.length === 20 && /^[a-zA-Z0-9]+$/.test(identifier));
  };

  const [isLangOpen, setIsLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");

  const langRef = useRef(null);
  const voiceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
      if (voiceRef.current && !voiceRef.current.contains(event.target)) {
        setIsVoiceOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const languages = [
    { value: "vi", label: "Tiếng Việt (Vietnamese)" },
    { value: "en", label: "Tiếng Anh (English)" },
    { value: "jp", label: "Tiếng Nhật (Japanese)" },
    { value: "all", label: "Tất cả ngôn ngữ" }
  ];

  const filteredLanguages = languages.filter(lang => 
    lang.label.toLowerCase().includes(langSearch.toLowerCase())
  );

  const detectLanguage = (identifier, name) => {
    const id = (identifier || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (id.startsWith('vi-') || n.includes('việt') || n.includes('viet')) {
      return 'vi';
    }
    if (id.startsWith('en-') || n.includes('mỹ') || n.includes('anh') || n.includes('english') || n.includes('us')) {
      return 'en';
    }
    if (id.startsWith('ja-') || id.startsWith('jp-') || n.includes('nhật') || n.includes('japanese') || n.includes('japan')) {
      return 'jp';
    }
    return 'other';
  };

  const langFilteredVoices = voices.filter(asset => {
    if (ttsLang === 'all') return true;
    if (isPremiumVoice(asset.identifier)) return true;
    const detected = detectLanguage(asset.identifier, asset.name);
    return detected === ttsLang;
  });

  const displayVoices = langFilteredVoices.length > 0 ? langFilteredVoices : [
    {
      id: 'default',
      identifier: ttsLang === 'vi' ? 'vi-VN-NamMinhNeural' : ttsLang === 'en' ? 'en-US-JennyNeural' : 'ja-JP-NanamiNeural',
      name: ttsLang === 'vi' ? 'Giọng mặc định (Nam Minh)' : ttsLang === 'en' ? 'Giọng mặc định (Jenny)' : 'Giọng mặc định (Nanami)'
    }
  ];

  const filteredVoices = displayVoices.filter(voice => 
    (voice.name || '').toLowerCase().includes(voiceSearch.toLowerCase()) ||
    (voice.identifier || '').toLowerCase().includes(voiceSearch.toLowerCase())
  );

  useEffect(() => {
    setText(ttsPrompt || "");
  }, [ttsPrompt]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    setTtsPrompt(val);
  };

  const fetchVoiceAssets = async () => {
    try {
      const url = ttsLang && ttsLang !== 'all' ? `/voices?lang=${ttsLang}` : '/voices';
      const data = await axiosClient.get(url);
      const voiceList = Array.isArray(data) ? data : (data?.voices || data?.data || []);
      const mapped = voiceList.map(v => ({
        id: v.id,
        identifier: v.voice_id || v.identifier || v.id,
        name: v.name,
        preview_url: v.preview_url
      }));
      setVoices(mapped);
    } catch (err) {
      console.error('[TTS VIEW] Failed to load voice assets:', err.message);
      setVoices(initialPremiumVoices);
    }
  };

  useEffect(() => {
    fetchVoiceAssets();
    const intervalId = setInterval(fetchVoiceAssets, 15000);
    return () => clearInterval(intervalId);
  }, [ttsLang]);

  useEffect(() => {
    if (isVoiceOpen || isLangOpen) {
      fetchVoiceAssets();
    }
  }, [isVoiceOpen, isLangOpen, ttsLang]);

  useEffect(() => {
    if (voices.length > 0) {
      const filtered = voices.filter(asset => {
        if (ttsLang === 'all') return true;
        if (isPremiumVoice(asset.identifier)) return true;
        const detected = detectLanguage(asset.identifier, asset.name);
        return detected === ttsLang;
      });

      if (filtered.length > 0) {
        const hasMatch = filtered.some(asset => asset.identifier === ttsVoice || asset.id === ttsVoice);
        if (!hasMatch) {
          setTtsVoice(filtered[0].identifier || filtered[0].id);
        }
      } else {
        const defaultVoices = {
          vi: 'vi-VN-NamMinhNeural',
          en: 'en-US-JennyNeural',
          jp: 'ja-JP-NanamiNeural'
        };
        const fallback = defaultVoices[ttsLang] || 'vi-VN-NamMinhNeural';
        if (ttsVoice !== fallback) {
          setTtsVoice(fallback);
        }
      }
    } else {
      const defaultVoices = {
        vi: 'vi-VN-NamMinhNeural',
        en: 'en-US-JennyNeural',
        jp: 'ja-JP-NanamiNeural'
      };
      const fallback = defaultVoices[ttsLang] || 'vi-VN-NamMinhNeural';
      if (ttsVoice !== fallback) {
        setTtsVoice(fallback);
      }
    }
  }, [voices, ttsLang, ttsVoice, setTtsVoice]);

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (ttsPlaying) {
      audioRef.current.pause();
    } else {
      let currentUrl = activeAudioUrl;
      if (currentUrl && currentUrl.includes('storage.googleapis.com') && activeJobId) {
        currentUrl = `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${activeJobId}.mp3`;
        setActiveAudioUrl(currentUrl);
      }

      if (currentUrl) {
        if (audioRef.current.src !== currentUrl) {
          audioRef.current.src = currentUrl;
        }
        audioRef.current.play().catch(err => console.error("Playback failed:", err));
      } else {
        const completedJobs = historyList.filter(item => (item.type === 'tts' || item.type === 'Voice') && item.status === 'Completed');
        if (completedJobs.length > 0) {
          const job = completedJobs[0];
          const targetUrl = `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${job.id}.mp3`;
          setActiveAudioUrl(targetUrl);
          setActiveJobId(job.id);
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.play().catch(e => console.error(e));
            }
          }, 50);
        } else {
          alert("Chưa có âm thanh lịch sử nào để phát thử!");
        }
      }
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, clickX / width));
    audioRef.current.currentTime = percentage * audioDuration;
  };

  const progressPercentage = audioDuration ? (audioCurrentTime / audioDuration) * 100 : 0;

  useEffect(() => {
    const tx = ttsTextareaRef.current;
    if (tx) {
      tx.style.height = 'auto';
      tx.style.height = `${tx.scrollHeight}px`;
    }
  }, [text]);

  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <div className="!max-w-7xl !mx-auto !w-full !flex !flex-col !gap-6 md:!gap-8 !items-stretch">
        
        {/* KHU VỰC TIÊU ĐỀ TRANG */}
        <div className="!flex !flex-col !gap-1 !w-full">
          <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
            <div className="p-2 bg-[#f59e0b]/10 text-[#f59e0b] rounded-xl border border-[#f59e0b]/10">
              <Mic size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Cấu hình Giọng nói AI</h2>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Thiết lập tham số để tạo âm thanh tự nhiên nhất</p>
            </div>
          </div>
        </div>

        {/* Outer panel container styled matching geometric layout */}
        <div className="!bg-[#111114] !border !border-[#222226] !rounded-2xl p-5 sm:p-6 md:p-8 !w-full !shadow-2xl flex flex-col lg:flex-row gap-8 relative select-none">

        {/* Configuration Panel */}
        <section
          className={`w-full h-full lg:w-[360px] flex flex-col gap-5 text-left shrink-0 ${ttsTab === 'config' ? 'flex' : 'hidden lg:flex'}`}
        >
          {/* Mobile sub tab selector styled using inner block styles */}
          <div className="lg:hidden flex border border-[#222226]/80 bg-[#0f0f11] p-1 gap-1.5 rounded-xl mb-4 shrink-0">
            <button 
              type="button"
              onClick={() => setTtsTab('config')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer border-none ${
                ttsTab === 'config' 
                  ? 'bg-amber-500/10 text-[#f59e0b]' 
                  : 'text-zinc-400 bg-transparent'
              }`}
            >
              ⚙️ Cấu hình
            </button>
            <button 
              type="button"
              onClick={() => setTtsTab('preview')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer border-none ${
                ttsTab === 'preview' 
                  ? 'bg-amber-500/10 text-[#f59e0b]' 
                  : 'text-zinc-400 bg-transparent'
              }`}
            >
              🔊 Xem thử
            </button>
          </div>



          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-450">1. Kịch bản đọc (Văn bản AI)</label>
                <span className="text-[10px] text-zinc-500 font-bold">{text.length}/2000</span>
              </div>
              <textarea
                ref={ttsTextareaRef}
                value={text}
                onChange={handleTextChange}
                className="w-full min-h-[120px] h-32 bg-[#0f0f11] text-white p-4 rounded-xl border border-[#222226] placeholder-zinc-500 transition-all focus:outline-none focus:border-[#f59e0b] resize-none font-medium text-sm shadow-inner"
                placeholder="Nhập kịch bản văn bản tại đây..."
              />
            </div>

            <div className="flex flex-col gap-2 relative" ref={langRef}>
              <label className="text-xs font-bold text-zinc-450">2. Chọn ngôn ngữ</label>
              <button
                type="button"
                onClick={() => {
                  setIsLangOpen(!isLangOpen);
                  setLangSearch("");
                }}
                className="w-full bg-[#0f0f11] border border-[#222226] hover:border-zinc-705 rounded-xl p-2.5 text-xs text-white font-bold outline-none cursor-pointer flex justify-between items-center transition-all"
              >
                <span>{languages.find(l => l.value === ttsLang)?.label || "Chọn ngôn ngữ"}</span>
                <span className="text-zinc-500 text-[10px]">▼</span>
              </button>
              
              {isLangOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 bg-[#0f0f11] border border-[#222226] rounded-xl shadow-2xl p-2 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Tìm kiếm ngôn ngữ..."
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    className="w-full bg-[#18181c] border border-[#222226] rounded-lg p-2 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                    {filteredLanguages.map(lang => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => {
                          const newLang = lang.value;
                          setTtsLang(newLang);
                          if (newLang === 'vi') setTtsVoice('vi-VN-NamMinhNeural');
                          else if (newLang === 'en') setTtsVoice('en-US-JennyNeural');
                          else setTtsVoice('ja-JP-NanamiNeural');
                          setIsLangOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors border-none ${
                          ttsLang === lang.value 
                            ? "bg-[#f59e0b]/15 text-[#f59e0b]" 
                            : "text-zinc-305 hover:bg-[#18181c] hover:text-white"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 relative" ref={voiceRef}>
              <label className="text-xs font-bold text-zinc-450">3. Chọn giọng độc quyền</label>
              <div
                onClick={() => {
                  setIsVoiceOpen(!isVoiceOpen);
                  setVoiceSearch("");
                }}
                className="w-full bg-[#0f0f11] border border-[#222226] hover:border-zinc-705 rounded-xl p-2.5 text-xs text-white font-bold outline-none flex justify-between items-center transition-all cursor-pointer"
              >
                <div className="flex items-center min-w-0">
                  <span className="truncate">🎙️ {displayVoices.find(v => v.identifier === ttsVoice || v.id === ttsVoice)?.name || "Chọn giọng độc quyền"}</span>
                  {(() => {
                    const activeVoice = displayVoices.find(v => v.identifier === ttsVoice || v.id === ttsVoice);
                    if (activeVoice?.preview_url) {
                      return (
                        <button
                          type="button"
                          onClick={(e) => handlePlayPreview(e, activeVoice.preview_url, activeVoice.identifier || activeVoice.id)}
                          className={
                            playingVoiceId === (activeVoice.identifier || activeVoice.id)
                              ? "flex items-center justify-center p-2 rounded-full bg-[#f59e0b] text-zinc-950 animate-pulse text-[10px] cursor-pointer ml-2 border-none shrink-0"
                              : "flex items-center justify-center p-2 rounded-full bg-zinc-800 hover:bg-[#f59e0b] text-zinc-300 hover:text-zinc-950 transition-all shadow-md text-[10px] cursor-pointer ml-2 border-none shrink-0"
                          }
                          title="Nghe thử"
                        >
                          {playingVoiceId === (activeVoice.identifier || activeVoice.id) ? (
                            <Pause size={10} fill="currentColor" />
                          ) : (
                            <Play size={10} fill="currentColor" className="ml-[1px]" />
                          )}
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
                <span className="text-zinc-500 text-[10px]">▼</span>
              </div>
              
              {isVoiceOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 bg-[#0f0f11] border border-[#222226] rounded-xl shadow-2xl p-2 flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Tìm kiếm giọng đọc..."
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    className="w-full bg-[#18181c] border border-[#222226] rounded-lg p-2 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                    {filteredVoices.map(voice => (
                      <div
                        key={voice.id || voice.identifier}
                        onClick={() => {
                          setTtsVoice(voice.identifier || voice.id);
                          setIsVoiceOpen(false);
                        }}
                        className={`w-full text-left p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                          ttsVoice === voice.identifier || ttsVoice === voice.id
                            ? "bg-[#f59e0b]/15 text-[#f59e0b]" 
                            : "text-zinc-300 hover:bg-[#18181c] hover:text-white"
                        }`}
                      >
                        <span className="truncate">🎙️ {voice.name}</span>
                        {voice.preview_url ? (
                          <button
                            type="button"
                            onClick={(e) => handlePlayPreview(e, voice.preview_url, voice.identifier || voice.id)}
                            className={
                              playingVoiceId === (voice.identifier || voice.id)
                                ? "flex items-center justify-center p-2 rounded-full bg-[#f59e0b] text-zinc-950 animate-pulse text-[10px] cursor-pointer ml-2 border-none shrink-0"
                                : "flex items-center justify-center p-2 rounded-full bg-zinc-800 hover:bg-[#f59e0b] text-zinc-300 hover:text-zinc-950 transition-all shadow-md text-[10px] cursor-pointer ml-2 border-none shrink-0"
                            }
                            title="Nghe thử"
                          >
                            {playingVoiceId === (voice.identifier || voice.id) ? (
                              <Pause size={10} fill="currentColor" />
                            ) : (
                              <Play size={10} fill="currentColor" className="ml-[1px]" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-450">4. Tốc độ đọc</label>
                <span className="text-xs font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">{ttsSpeed}x</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.1" 
                value={ttsSpeed} 
                onChange={(e) => setTtsSpeed(parseFloat(e.target.value))} 
                className="w-full cursor-pointer accent-[#f59e0b] h-2 bg-zinc-800 rounded-lg appearance-none" 
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-450">5. Cao độ (Pitch)</label>
                <span className="text-xs font-bold text-[#f59e0b] bg-[#f59e0b]/10 px-2 py-0.5 rounded-full">{ttsPitch > 0 ? `+${ttsPitch}` : ttsPitch}</span>
              </div>
              <input 
                type="range" 
                min="-10" 
                max="10" 
                step="1" 
                value={ttsPitch} 
                onChange={(e) => setTtsPitch(parseInt(e.target.value))} 
                className="w-full cursor-pointer accent-[#f59e0b] h-2 bg-zinc-800 rounded-lg appearance-none" 
              />
            </div>

            {/* Generate Trigger */}
            <div className="pt-2">
              <div className="border-t border-[#222226]/40 my-4 w-full"></div>
              <button 
                type="button"
                onClick={handleGenerateTts} 
                disabled={ttsGenerating}
                className="w-full py-4 px-8 bg-[#f59e0b] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50 transition-all duration-300 border-none shadow-md hover:bg-amber-600 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-[1.01] active:scale-[0.98]"
              >
                <Mic size={18} className="text-black" />
                <span>Tạo Giọng Nói — 5 Credits</span>
              </button>
              <div className="flex flex-col gap-1 text-center mt-3 select-none">
                <p className="text-[10px] text-zinc-400 font-medium">Mỗi lần tạo giọng nói tiêu thụ 5 credits từ số dư của bạn.</p>
                <p className="text-[10px] text-zinc-400 font-medium">Thời gian xử lý dự kiến từ 3-5 giây.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Vertical divider line for desktop */}
        <div className="hidden lg:block w-[1px] bg-[#222226]/60 self-stretch"></div>

        {/* Preview Panel */}
        <section className={`flex-grow flex flex-col gap-6 text-left min-w-0 ${ttsTab === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Mobile sub tab selector */}
          <div className="lg:hidden flex border border-[#222226]/80 bg-[#0f0f11] p-1 gap-1.5 rounded-xl mb-4 shrink-0">
            <button 
              type="button"
              onClick={() => setTtsTab('config')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer border-none ${
                ttsTab === 'config' 
                  ? 'bg-amber-500/10 text-[#f59e0b]' 
                  : 'text-zinc-400 bg-transparent'
              }`}
            >
              ⚙️ Cấu hình
            </button>
            <button 
              type="button"
              onClick={() => setTtsTab('preview')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer border-none ${
                ttsTab === 'preview' 
                  ? 'bg-amber-500/10 text-[#f59e0b]' 
                  : 'text-zinc-400 bg-transparent'
              }`}
            >
              🔊 Xem thử
            </button>
          </div>
          
          <div className="bg-[#0f0f11] p-4 rounded-xl border border-[#222226]/40 flex flex-col gap-4 relative w-full mx-auto">
            
            {/* Waveform Player */}
            <div className="w-full h-50 rounded-xl bg-[#0f0f11] border border-[#222226]/40 flex flex-col items-center justify-center relative overflow-hidden px-6">
              {ttsGenerating && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-20">
                  <div className="w-6 h-6 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin mb-2"></div>
                  <p className="text-[#f59e0b] text-[10px] font-bold tracking-widest">MÔ HÌNH AI ĐANG TẠO GIỌNG NÓI... {ttsProgress}%</p>
                </div>
              )}
              
              <div className="flex items-end gap-1 h-14 justify-center">
                {waveBars.map((h, i) => (
                  <div 
                    key={i} 
                    style={{ height: `${h}px` }} 
                    className={`w-1.5 rounded-full transition-all duration-100 ${
                      ttsPlaying ? 'bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]' : 'bg-zinc-700'
                    }`}
                  />
                ))}
              </div>
              
              <span className="text-[10px] text-zinc-500 font-black mt-4 uppercase tracking-widest">
                {activeJobId ? `Đang phát: Lịch sử tác vụ #${activeJobId}` : (ttsPlaying ? 'Đang phát âm thanh mẫu' : 'Bộ phát thử giọng nói AI')}
              </span>
            </div>
            
            {/* HTML5 Audio Player Element */}
            <audio
              ref={audioRef}
              src={
                activeAudioUrl && activeAudioUrl.includes('storage.googleapis.com') && activeJobId
                  ? `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${activeJobId}.mp3`
                  : (activeAudioUrl || undefined)
              }
              crossOrigin="anonymous"
              muted={isTtsMuted}
              onPlay={() => setTtsPlaying(true)}
              onPause={() => setTtsPlaying(false)}
              onEnded={() => setTtsPlaying(false)}
              onTimeUpdate={() => {
                if (audioRef.current) {
                  setAudioCurrentTime(audioRef.current.currentTime);
                }
              }}
              onLoadedMetadata={() => {
                if (audioRef.current) {
                  setAudioDuration(audioRef.current.duration);
                }
              }}
            />

            <p className="text-center max-w-xl mx-auto leading-relaxed px-4 py-1 select-none">
              <span className="text-zinc-300 text-sm font-bold tracking-wide">
                {activeJobId 
                  ? (historyList.find(item => item.id === activeJobId)?.title || `Giọng nói #${activeJobId}`) 
                  : "Giọng nói bản nháp mới"}
              </span>
            </p>

            <div className="flex items-center gap-3 bg-[#0d0d10] border border-[#222226]/60 rounded-xl px-4 py-2.5 w-full">
              {/* Play button */}
              <button 
                type="button" 
                onClick={handlePlayPause} 
                className="w-7 h-7 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0 shadow-md shadow-amber-500/10 border-none"
              >
                {ttsPlaying ? <Pause size={12} fill="black" /> : <Play size={12} fill="black" className="ml-0.5" />}
              </button>

              {/* Volume Icon */}
              <button 
                type="button"
                onClick={() => setIsTtsMuted(!isTtsMuted)}
                title={isTtsMuted ? "Unmute preview" : "Mute preview"}
                className="p-1.5 hover:text-[#f59e0b] text-zinc-400 hover:bg-zinc-800/30 rounded-lg transition-colors cursor-pointer bg-transparent border-none shrink-0"
              >
                {isTtsMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              
              {/* Progress bar */}
              <div 
                onClick={handleSeek}
                className="flex-1 flex items-center relative py-2 cursor-pointer"
              >
                <div className="w-full h-1 bg-zinc-800 rounded-full relative">
                  <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                  <div 
                    className="absolute top-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md" 
                    style={{ left: `${progressPercentage}%`, transform: 'translate(-50%, -50%)' }}
                  ></div>
                </div>
              </div>

              {/* Reset button */}
              <button 
                type="button"
                onClick={() => {
                  setText('');
                  setTtsPrompt('');
                  setTtsLang('vi');
                  setTtsVoice('vi-VN-NamMinhNeural');
                  setTtsSpeed(1.0);
                  setTtsPitch(0);
                  setActiveAudioUrl(null);
                  setActiveJobId(null);
                  setAudioCurrentTime(0);
                  setAudioDuration(0);
                }}
                title="Reset Preview"
                className="p-1.5 hover:text-[#f59e0b] text-zinc-400 hover:bg-zinc-800/30 rounded-lg transition-colors cursor-pointer bg-transparent border-none shrink-0"
              >
                <RefreshCw size={14} />
              </button>

              <span className="text-[10px] font-bold text-zinc-550 tracking-wider shrink-0 font-mono select-none">
                {formatTime(audioCurrentTime)} / {formatTime(audioDuration)}
              </span>
            </div>
          </div>

          {/* Lịch sử Giọng nói đã tạo bottom section inside inner card layout format */}
          <div className="flex flex-col gap-4 w-full mx-auto mt-6 pt-6 border-t border-[#222226]/60 text-left animate-fade-in">
            <div className="flex justify-between items-center border-b border-[#222226]/40 pb-2 select-none">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Lịch sử Giọng nói</span>
              <button 
                type="button" 
                onClick={() => {
                  if (setCurrentMenu) setCurrentMenu('history');
                  navigate('/dashboard?tab=audio');
                }}
                className="text-xs font-bold text-[#f59e0b] hover:text-amber-400 transition-colors cursor-pointer bg-transparent border-none"
              >
                Xem tất cả
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              {historyList.filter(item => item.type === 'tts').slice(0, 3).map(item => (
                <div 
                  key={item.id}
                  onClick={() => setPreviewJob && setPreviewJob(item)}
                  className="bg-[#0f0f11] border border-[#222226]/40 rounded-xl p-3 flex justify-between items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f59e0b]/40 hover:shadow-[0_0_12px_rgba(245,158,11,0.1)] relative group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#18181c] text-[#f59e0b] border border-[#222226] flex items-center justify-center shrink-0">
                      <Mic size={14} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white truncate">{item.title}</span>
                        <span className="bg-amber-500/10 text-[#f59e0b] border border-[#f59e0b]/20 text-[8px] font-bold px-1 py-0.2 rounded shrink-0 uppercase select-none">
                          {item.lang}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400 truncate">{item.sub}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 select-none">
                    <span className="text-[9px] text-zinc-500 font-medium hidden sm:inline mr-1">
                      {item.voice}
                    </span>
                    {item.status === 'Completed' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const targetUrl = `http://localhost:3000/uploads/voices/AI_Studio_Voice_ID_${item.id}.mp3`;
                          
                          if (activeJobId === item.id) {
                            if (ttsPlaying) {
                              audioRef.current?.pause();
                            } else {
                              if (audioRef.current && (!activeAudioUrl || activeAudioUrl.includes('storage.googleapis.com'))) {
                                setActiveAudioUrl(targetUrl);
                                audioRef.current.src = targetUrl;
                              }
                              audioRef.current?.play().catch(err => console.error(err));
                            }
                          } else {
                            setActiveAudioUrl(targetUrl);
                            setActiveJobId(item.id);
                            setTimeout(() => {
                              if (audioRef.current) {
                                audioRef.current.play().catch(err => console.error(err));
                              }
                            }, 50);
                          }
                        }}
                        className="p-1.5 text-[#f59e0b] hover:text-amber-400 hover:bg-zinc-800 rounded transition-colors cursor-pointer bg-transparent border-none"
                        title={activeJobId === item.id && ttsPlaying ? "Tạm dừng" : "Phát"}
                      >
                        {activeJobId === item.id && ttsPlaying ? <Pause size={12} fill="#f59e0b" /> : <Play size={12} fill="#f59e0b" />}
                      </button>
                    )}
                    {item.status === 'Completed' && (
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadAsset(item);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-[#18181c] border border-[#222226]/40 rounded transition-colors cursor-pointer bg-transparent flex items-center justify-center font-bold"
                        title="Tải xuống"
                      >
                        <Download size={12} />
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (triggerDeleteHistory) triggerDeleteHistory(item);
                      }}
                      className="p-1.5 text-zinc-550 hover:text-red-400 hover:bg-red-955/20 rounded transition-colors cursor-pointer bg-transparent border-none flex items-center justify-center"
                      title="Xóa"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
              {historyList.filter(item => item.type === 'tts').length === 0 && (
                <div className="text-center py-4 border border-dashed border-[#222226]/30 rounded-xl w-full select-none bg-[#0f0f11]/10">
                  <span className="text-[10px] text-zinc-500 font-bold">Chưa tạo giọng nói nào</span>
                </div>
              )}
            </div>
          </div>
        </section>
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
