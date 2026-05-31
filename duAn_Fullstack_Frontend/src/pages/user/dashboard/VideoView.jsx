import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, Video, Volume2, VolumeX, RefreshCw, Play, Pause, Download, Trash2 } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

export default function VideoView({
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
  handleGenerateVideo,
  historyList = [],
  setCurrentMenu,
  handleDeleteHistory,
  triggerDeleteHistory,
  handleMouseMove,
  handleDownloadAsset
}) {
  const videoTextareaRef = useRef(null);

  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [styleSearch, setStyleSearch] = useState("");
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [voiceSearch, setVoiceSearch] = useState("");

  const styleRef = useRef(null);
  const voiceRef = useRef(null);

  const [playingVoiceId, setPlayingVoiceId] = useState(null);
  const previewAudioRef = useRef(null);

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

    // Determine the absolute remote URL for the audio preview.
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

    // Default general fallback link if missing or invalid
    if (!absoluteUrl || typeof absoluteUrl !== 'string' || !absoluteUrl.startsWith('http')) {
      absoluteUrl = "https://samplelib.com/samples/sample-speech-1m.mp3";
    }

    console.log("[VIDEO VIEW] Playing preview voice ID:", voiceId, "via un-proxied URL:", absoluteUrl);

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
          setPlayingVoiceId(null);
        });
      } catch (err) {
        console.error("Error creating audio instance:", err);
        setPlayingVoiceId(null);
      }
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (styleRef.current && !styleRef.current.contains(event.target)) {
        setIsStyleOpen(false);
      }
      if (voiceRef.current && !voiceRef.current.contains(event.target)) {
        setIsVoiceOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const styleOptions = [
    { value: "realistic", label: "Cinematic Realistic" },
    { value: "anime", label: "Anime Japanese" },
    { value: "3d", label: "3D Animation" }
  ];

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

  const mergePremiumVoices = (fetchedVoices) => {
    const premiumMap = {};
    initialPremiumVoices.forEach(pv => {
      premiumMap[pv.id] = pv;
    });

    const merged = [];
    const processedIds = new Set();

    fetchedVoices.forEach(fv => {
      const fvId = fv.voice_id || fv.identifier || fv.id;
      if (premiumMap[fvId]) {
        merged.push({
          ...premiumMap[fvId],
          gender: fv.gender || premiumMap[fvId].gender,
          preview_url: fv.preview_url || premiumMap[fvId].preview_url
        });
      } else {
        merged.push(fv);
      }
      processedIds.add(fvId);
    });

    initialPremiumVoices.forEach(pv => {
      if (!processedIds.has(pv.id)) {
        merged.push(pv);
      }
    });

    return merged;
  };

  const fetchVoiceAssets = async () => {
    try {
      const data = await axiosClient.get('/voices');
      const voiceList = Array.isArray(data) ? data : (data?.voices || data?.data || []);
      const mapped = voiceList.map(v => ({
        id: v.id,
        identifier: v.voice_id || v.identifier || v.id,
        name: v.name,
        preview_url: v.preview_url
      }));
      setVoices(mapped);
    } catch (err) {
      console.error('[VIDEO VIEW] Failed to load voice assets from local database:', err.message);
      setVoices(initialPremiumVoices);
    }
  };

  useEffect(() => {
    fetchVoiceAssets();
    const intervalId = setInterval(fetchVoiceAssets, 15000); // Auto refresh every 15s
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (isVoiceOpen) {
      fetchVoiceAssets(); // Refresh immediately when user opens voice dropdown
    }
  }, [isVoiceOpen]);

  useEffect(() => {
    if (voices.length > 0) {
      if (voice === 'adam') {
        const found = voices.find(v => v.name.toLowerCase().includes('adam') || v.identifier === 'pNInz6obpgDQGcFmaJgB' || v.identifier === 'pNInz6obpgmA5QCmsfUR');
        if (found) setVoice(found.identifier);
      } else if (voice === 'bella') {
        const found = voices.find(v => v.name.toLowerCase().includes('bella') || v.identifier === 'EXAVITQu4vr4xnSDxMaL');
        if (found) setVoice(found.identifier);
      }
    }
  }, [voices, voice, setVoice]);

  const defaultVoiceOptions = [
    { value: "vi-VN-NamMinhNeural", label: "Giọng mặc định (Nam Minh)" },
    { value: "vi-VN-HoaiMyNeural", label: "Giọng mặc định (Hoài My)" },
    { value: "en-US-JennyNeural", label: "Giọng mặc định (Jenny)" },
    { value: "ja-JP-NanamiNeural", label: "Giọng mặc định (Nanami)" }
  ];

  const voiceOptions = voices.length > 0 
    ? voices.map(v => ({ value: v.identifier, label: v.name }))
    : defaultVoiceOptions;

  const filteredStyles = styleOptions.filter(item => 
    item.label.toLowerCase().includes(styleSearch.toLowerCase())
  );

  const filteredVoices = voiceOptions.filter(item => 
    item.label.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  // Auto adjust textarea height on prompt change
  useEffect(() => {
    const tx = videoTextareaRef.current;
    if (tx) {
      tx.style.height = 'auto';
      tx.style.height = `${tx.scrollHeight}px`;
    }
  }, [prompt]);

  return (
    <div className="min-h-full w-full py-6 px-2 sm:px-4 bg-[#0f0f13] flex items-start justify-center overflow-y-auto select-none text-[var(--text-primary)]">
      <div style={{padding:'1em'}} className="w-full bg-[#18181b]/60 border border-zinc-800/80 rounded-2xl shadow-2xl p-6 lg:p-8 flex flex-col lg:flex-row gap-8 animate-fade-in relative backdrop-blur-md">
        
        {/* Configuration Panel */}
        <section
          className={`w-full lg:w-[360px] flex-col gap-5 text-left shrink-0 ${videoTab === 'config' ? 'flex' : 'hidden lg:flex'}`}
        >
          {/* Mobile/Tablet Sub-Tab Selector */}
          <div className="lg:hidden flex border border-zinc-800 bg-[#0f0f13] p-1 gap-1.5 rounded-xl mb-4 shrink-0">
            <button 
              type="button"
              onClick={() => setVideoTab('config')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${videoTab === 'config' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 shadow-sm shadow-amber-500/5' : 'text-[var(--text-secondary)] border border-transparent'}`}
            >
              ⚙️ Cấu hình
            </button>
            <button 
              type="button"
              onClick={() => setVideoTab('preview')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${videoTab === 'preview' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 shadow-sm shadow-amber-500/5' : 'text-[var(--text-secondary)] border border-transparent'}`}
            >
              🎬 Xem thử
            </button>
          </div>
        <div className="flex flex-col gap-1.5 border-b border-zinc-900 pb-3">
          <div className="flex items-center gap-2.5">
            <Video size={18} className="text-[#f59e0b]" />
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-widest">Cấu hình Video AI</h2>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]">Thiết lập các tham số để tạo video chất lượng cao</p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-[var(--text-secondary)]">1. Ý tưởng video (Kịch bản AI)</label>
              <span className="text-[10px] text-[var(--text-secondary)] font-bold">{prompt.length}/1000</span>
            </div>
            <textarea
              ref={videoTextareaRef}
              value={prompt}
              style={{padding:'4px'}}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-20 p-4 bg-white text-zinc-900 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium text-sm shadow-inner resize-none"
              maxLength={1000}
              placeholder="Nhập mô tả ý tưởng chi tiết cho video..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[var(--text-secondary)]">2. Tỷ lệ khung hình</label>
            <div className="grid grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => setAspectRatio('169')}
                className={`py-4 px-6 rounded-xl border flex items-center justify-center gap-2 text-[16px] font-black transition-all cursor-pointer ${aspectRatio === '169' ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#f59e0b] shadow-md shadow-amber-500/5' : 'border-zinc-800 bg-[#121216]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                <span>📺</span> 16:9 Ngang
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('916')}
                className={`py-4 px-6 rounded-xl border flex items-center justify-center gap-2 text-[16px] font-black transition-all cursor-pointer ${aspectRatio === '916' ? 'border-[#f59e0b] bg-[#f59e0b]/5 text-[#f59e0b] shadow-md shadow-amber-500/5' : 'border-zinc-800 bg-[#121216]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
              >
                <span>📱</span> 9:16 Dọc
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative" ref={styleRef}>
            <label className="text-xs font-bold text-[var(--text-secondary)]">3. Phong cách hình ảnh</label>
            <button
              type="button"
              onClick={() => {
                setIsStyleOpen(!isStyleOpen);
                setStyleSearch("");
              }}
              className="w-full bg-[#16161a] border border-zinc-800 hover:border-zinc-700 rounded-xl p-2.5 text-xs text-[var(--text-primary)] font-bold outline-none cursor-pointer flex justify-between items-center transition-all"
            >
              <span>{styleOptions.find(o => o.value === style)?.label || "Chọn phong cách"}</span>
              <span className="text-zinc-500 text-[10px]">▼</span>
            </button>
            
            {isStyleOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 bg-[#121216] border border-zinc-800 rounded-xl shadow-2xl p-2 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Tìm kiếm phong cách..."
                  value={styleSearch}
                  onChange={(e) => setStyleSearch(e.target.value)}
                  className="w-full bg-[#18181c] border border-zinc-800 rounded-lg p-2 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                  {filteredStyles.map(item => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        setStyle(item.value);
                        setIsStyleOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        style === item.value 
                          ? "bg-[#f59e0b]/15 text-[#f59e0b]" 
                          : "text-zinc-300 hover:bg-[#18181c] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  {filteredStyles.length === 0 && (
                    <span className="text-[10px] text-zinc-500 text-center py-2">Không tìm thấy kết quả</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 relative" ref={voiceRef}>
            <label className="text-xs font-bold text-[var(--text-secondary)]">4. Giọng đọc AI</label>
            <div
              onClick={() => {
                setIsVoiceOpen(!isVoiceOpen);
                setVoiceSearch("");
              }}
              className="w-full bg-[#16161a] border border-zinc-800 hover:border-[#f59e0b]/30 rounded-xl p-2.5 text-xs text-[var(--text-primary)] font-bold outline-none flex justify-between items-center transition-all cursor-pointer"
            >
              <div className="flex items-center min-w-0">
                <span className="truncate">🎙️ {voices.find(v => v.identifier === voice || v.id === voice)?.name || "Chọn giọng đọc"}</span>
                {(() => {
                  const activeVoice = voices.find(v => v.identifier === voice || v.id === voice);
                  if (activeVoice) {
                    if (activeVoice.preview_url) {
                      return (
                        <button
                          type="button"
                          onClick={(e) => handlePlayPreview(e, activeVoice.preview_url, activeVoice.identifier || activeVoice.id)}
                          className={
                            playingVoiceId === (activeVoice.identifier || activeVoice.id)
                              ? "flex items-center justify-center p-2 rounded-full bg-amber-500 text-zinc-950 animate-pulse text-[10px] cursor-pointer ml-2 border-none shrink-0"
                              : "flex items-center justify-center p-2 rounded-full bg-zinc-800 hover:bg-amber-500 text-zinc-300 hover:text-zinc-950 transition-all shadow-md text-[10px] cursor-pointer ml-2 border-none shrink-0"
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
                    } else {
                      return (
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center p-2 rounded-full bg-zinc-800 text-zinc-650 cursor-not-allowed opacity-40 text-[10px] ml-2 border-none shrink-0"
                          title="Không có file nghe thử"
                          disabled
                        >
                          <Play size={10} fill="currentColor" className="ml-[1px]" />
                        </button>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
              <span className="text-zinc-500 text-[10px]">▼</span>
            </div>
            
            {isVoiceOpen && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 bg-[#121216] border border-zinc-800 rounded-xl shadow-2xl p-2 flex flex-col gap-2">
                <input
                  type="text"
                  placeholder="Tìm kiếm giọng đọc..."
                  value={voiceSearch}
                  onChange={(e) => setVoiceSearch(e.target.value)}
                  className="w-full bg-[#18181c] border border-zinc-800 rounded-lg p-2 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="max-h-40 overflow-y-auto flex flex-col gap-1 pr-1 custom-scrollbar">
                  {voices.filter(v => (v.name || '').toLowerCase().includes(voiceSearch.toLowerCase()) || (v.identifier || '').toLowerCase().includes(voiceSearch.toLowerCase())).map(item => (
                    <div
                      key={item.id || item.identifier}
                      onClick={() => {
                        setVoice(item.identifier || item.id);
                        setIsVoiceOpen(false);
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center justify-between ${
                        voice === item.identifier || voice === item.id
                          ? "bg-[#f59e0b]/15 text-[#f59e0b]" 
                          : "text-zinc-300 hover:bg-[#18181c] hover:text-white"
                      }`}
                    >
                      <span className="truncate">🎙️ {item.name}</span>
                      {item.preview_url ? (
                        <button
                          type="button"
                          onClick={(e) => handlePlayPreview(e, item.preview_url, item.identifier || item.id)}
                          className={
                            playingVoiceId === (item.identifier || item.id)
                              ? "flex items-center justify-center p-2 rounded-full bg-amber-500 text-zinc-950 animate-pulse text-[10px] cursor-pointer ml-2 border-none shrink-0"
                              : "flex items-center justify-center p-2 rounded-full bg-zinc-800 hover:bg-amber-500 text-zinc-300 hover:text-zinc-950 transition-all shadow-md text-[10px] cursor-pointer ml-2 border-none shrink-0"
                          }
                          title="Nghe thử"
                        >
                          {playingVoiceId === (item.identifier || item.id) ? (
                            <Pause size={10} fill="currentColor" />
                          ) : (
                            <Play size={10} fill="currentColor" className="ml-[1px]" />
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center justify-center p-2 rounded-full bg-zinc-800 text-zinc-650 cursor-not-allowed opacity-40 text-[10px] ml-2 border-none shrink-0"
                          title="Không có file nghe thử"
                          disabled
                        >
                          <Play size={10} fill="currentColor" className="ml-[1px]" />
                        </button>
                      )}
                    </div>
                  ))}
                  {voices.filter(v => (v.name || '').toLowerCase().includes(voiceSearch.toLowerCase()) || (v.identifier || '').toLowerCase().includes(voiceSearch.toLowerCase())).length === 0 && (
                    <span className="text-[10px] text-zinc-500 text-center py-2">Không tìm thấy kết quả</span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-[var(--text-secondary)]">5. Tốc độ video / giọng nói</label>
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
                className="w-full cursor-pointer accent-[#f59e0b]"
              />
              <div className="flex justify-between text-[9px] text-[var(--text-secondary)] mt-2 font-bold tracking-wide">
                <span>Chậm 0.5x</span>
                <span>Chuẩn 1.0x</span>
                <span>Nhanh 2.0x</span>
              </div>
            </div>
          </div>

          {/* Scaled up CTA button with Separator */}
          <div className="pt-2">
            <div className="border-t border-zinc-855 my-4 w-full"></div>
            <button
                type="button"
                onClick={handleGenerateVideo}
                disabled={generating}
                className="py-6 px-8 bg-[#f59e0b] text-black font-black text-[14px] rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest cursor-pointer disabled:opacity-50 transition-all duration-300 border-none shadow-md hover:bg-[#ffb020] hover:shadow-[0_0_25px_rgba(245,158,11,0.6)] hover:scale-[1.01] active:scale-[0.98]"
                style={{padding:'8px',width:'100%'}}>
              <Sparkles size={16} fill="black" className="text-black animate-pulse" />
              <span>Tạo Video Ngay — 10 Credits</span>
            </button>
            <div className="flex flex-col gap-1 text-center mt-3 select-none">
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Mỗi lần tạo video tiêu thụ 10 credits từ số dư của bạn.</p>
              <p className="text-[11px] text-[var(--text-secondary)] font-medium">Thời gian xử lý dự kiến từ 5-10 giây.</p>
            </div>
          </div>
        </div>
        </section>

        {/* Vertical divider line for desktop */}
        <div className="hidden lg:block w-[1px] bg-zinc-800/80 self-stretch"></div>

        {/* Preview Panel */}
        <section className={`flex-grow flex flex-col gap-6 text-left min-w-0 ${videoTab === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Mobile/Tablet Sub-Tab Selector */}
          <div className="lg:hidden flex border border-zinc-800 bg-[#0f0f13] p-1 gap-1.5 rounded-xl mb-4 shrink-0">
            <button 
              type="button"
              onClick={() => setVideoTab('config')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${videoTab === 'config' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 shadow-sm shadow-amber-500/5' : 'text-[var(--text-secondary)] border border-transparent'}`}
            >
              ⚙️ Cấu hình
            </button>
            <button 
              type="button"
              onClick={() => setVideoTab('preview')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${videoTab === 'preview' ? 'bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 shadow-sm shadow-amber-500/5' : 'text-[var(--text-secondary)] border border-transparent'}`}
            >
              🎬 Xem thử
            </button>
          </div>
          
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4 relative w-full mx-auto">
          <div 
            className="relative self-center rounded-xl overflow-hidden bg-black flex items-center justify-center border border-zinc-900/60 transition-all duration-300 w-full shadow-2xl"
            style={{ 
              aspectRatio: aspectRatio === '916' ? '9/16' : '16/9',
              maxWidth: aspectRatio === '916' ? '280px' : '640px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
            }}
          >
            <div className="absolute top-3 left-3 z-10 flex gap-2">
              <span className="bg-[#581c87]/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border border-purple-500/20 shadow-md">
                Style: {style === 'realistic' ? 'Cinematic' : style === 'anime' ? 'Anime' : '3D Animation'}
              </span>
            </div>
            <div className="absolute top-3 right-3 z-10">
              <span className="bg-[#f59e0b]/90 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-md">
                AI Generated
              </span>
            </div>

            <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg cursor-pointer hover:scale-105 transition-all">
                <Play size={20} className="text-white fill-white ml-0.5" />
              </div>
            </div>
            {generating && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-20">
                <div className="w-6 h-6 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-[#f59e0b] text-[10px] font-bold tracking-widest">MÔ HÌNH AI ĐANG RENDERING... {progress}%</p>
              </div>
            )}
          </div>

          <p className="text-xs italic text-[var(--text-secondary)] text-center max-w-xl mx-auto leading-relaxed px-4 py-1">
            "{prompt}"
          </p>

          <div className="flex items-center gap-3 bg-[#0d0d10] border border-zinc-900/60 rounded-xl px-4 py-2.5 w-full">
            {/* Play button */}
            <button 
              type="button" 
              onClick={() => setIsPlaying(!isPlaying)} 
              className="w-7 h-7 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-full flex items-center justify-center cursor-pointer transition-all shrink-0 shadow-md shadow-amber-500/10"
            >
              {isPlaying ? <Pause size={12} fill="black" /> : <Play size={12} fill="black" className="ml-0.5" />}
            </button>

            {/* Volume Icon right after play button */}
            <button 
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Unmute preview" : "Mute preview"}
              className="p-1.5 hover:text-[#f59e0b] text-[var(--text-secondary)] hover:bg-zinc-800/30 rounded-lg transition-colors cursor-pointer bg-transparent border-none shrink-0"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            
            {/* Progress bar */}
            <div className="flex-1 flex items-center relative py-2 cursor-pointer">
              <div className="w-full h-1 bg-zinc-800 rounded-full relative">
                <div className="h-full bg-[#f59e0b] rounded-full" style={{ width: '20%' }}></div>
                <div className="absolute top-1/2 left-[20%] -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full shadow-md"></div>
              </div>
            </div>

            {/* Repost/Reset button before duration text */}
            <button 
              type="button"
              onClick={() => {
                setPrompt('cưỡi ngựa trên sa mạc sao Hỏa, phong cách điện ảnh với ánh hoàng hôn đỏ rực rỡ.');
                setAspectRatio('169');
                setStyle('realistic');
              }}
              title="Reset Preview"
              className="p-1.5 hover:text-[#f59e0b] text-[var(--text-secondary)] hover:bg-zinc-800/30 rounded-lg transition-colors cursor-pointer bg-transparent border-none shrink-0"
            >
              <RefreshCw size={14} />
            </button>

            {/* Duration text */}
            <span className="text-[10px] font-bold text-[var(--text-secondary)] tracking-wider shrink-0">
              00:01 / 00:05
            </span>
          </div>
        </div>

        {/* Lịch sử Video đã tạo */}
        <div className="flex flex-col gap-4 w-full mx-auto mt-4 text-left animate-fade-in">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Lịch sử Video</span>
            <button 
              type="button" 
              onClick={() => setCurrentMenu && setCurrentMenu('history')}
              className="text-xs font-bold text-[#f59e0b] hover:text-amber-400 transition-colors cursor-pointer bg-transparent border-none"
            >
              Xem tất cả
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {historyList.filter(item => item.type === 'video').slice(0, 3).map(item => (
              <div 
                key={item.id}
                onMouseMove={handleMouseMove}
                className="bg-[#121216]/65 border border-zinc-900/60 rounded-xl p-3 flex flex-col gap-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#f59e0b]/40 hover:shadow-[0_0_12px_rgba(245,158,11,0.1)] relative group cursor-pointer"
              >
                {/* Visual thumbnail area */}
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

                {/* Details */}
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">{item.title}</span>
                    <span className="text-[8px] text-[var(--text-secondary)] font-mono font-bold shrink-0">{item.time}</span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2 h-7 overflow-hidden select-text leading-tight">
                    "{item.sub}"
                  </p>
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
            ))}
            {historyList.filter(item => item.type === 'video').length === 0 && (
              <div className="text-center py-4 border border-dashed border-zinc-850 rounded-xl w-full col-span-full">
                <span className="text-[10px] text-zinc-500 font-bold">Chưa tạo video nào</span>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  </div>
  );
}
