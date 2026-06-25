

/**
 * VideoStudioView.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * STUDIO TẠO VIDEO AI ANIMATION — Fullstack SaaS
 * Layout V3: Thao tác (Trái 55%) | Kết quả (Phải 45%)
 * Tech: React 18 + Tailwind CSS (Dark Mode Premium)
 *
 * Workflow States:
 *   'IDLE'       → Panel chờ / placeholder
 *   'PROCESSING' → Overlay spinner + chuỗi log Socket.IO thời gian thực
 *   'SUCCESS'    → HTML5 <video> player + nút Extend / Download
 *   'FAILED'     → Thẻ lỗi + nút Thử lại
 *
 * Socket.IO Events được lắng nghe:
 *   video_status_update  → { jobId, message }  → PROCESSING + log động
 *   video_finished       → { jobId, videoUrl } → SUCCESS + load video
 *   video_failed         → { jobId, reason }   → FAILED
 *
 * API Endpoints:
 *   POST /api/video-jobs/generate  → Tạo video mới
 *   POST /api/video-jobs/extend    → Mở rộng 12s (-50 credits)
 *   GET  /api/video-jobs/recent    → 4 video gần nhất
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
} from 'react';
import { useOutletContext, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Film,
  Wand2,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Maximize2,
  Sparkles,
  Play,
  Pause,
  Volume2,
  Clock,
  ImageIcon,
  ChevronRight,
  RotateCcw,
  Clapperboard,
  MonitorPlay,
  Smartphone,
  Monitor,
  SquarePlay,
  Timer,
  CreditCard,
  TrendingUp,
  X,
  Info,
  UploadCloud,
  Eye,
  FolderOpen,
  ArrowUp,
  History,
} from 'lucide-react';
import axiosClient   from '../../../services/axiosClient';
import socketService from '../../../services/socketService';
import { useAuth } from '../../../hooks/useAuth';
import EyeSelectionModal from '../../../components/modals/EyeSelectionModal';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

const WORKFLOW = {
  IDLE       : 'IDLE',
  PROCESSING : 'PROCESSING',
  SUCCESS    : 'SUCCESS',
  FAILED     : 'FAILED',
};

/** Cấu hình tỉ lệ khung hình — value khớp chính xác với DB ENUM */
const ASPECT_RATIO_OPTIONS = [
  {
    value      : '9:16',
    label      : 'Dọc',
    subLabel   : 'TikTok / Reels',
    icon       : Smartphone,
    aspectClass: 'aspect-[9/16]',
    maxH       : 'max-h-[420px]',
  },
  {
    value      : '16:9',
    label      : 'Ngang',
    subLabel   : 'YouTube / Web',
    icon       : Monitor,
    aspectClass: 'aspect-[16/9]',
    maxH       : 'max-h-[300px]',
  },
  {
    value      : '4:3',
    label      : 'Chuẩn',
    subLabel   : 'Truyền thống',
    icon       : MonitorPlay,
    aspectClass: 'aspect-[4/3]',
    maxH       : 'max-h-[320px]',
  },
];

const CREDITS_EXTEND   = 50;
const CREDITS_GENERATE = 150;
const WAN_COST         = 50;
const KLING_V2_COST    = 500;

const MODEL_OPTIONS = [
  {
    value   : 'wan_turbo',
    label   : 'Wan v2.2 Turbo',
    subLabel: 'Tiết kiệm',
    cost    : WAN_COST,
    icon    : Sparkles,
    desc    : 'Phù hợp gói Free / Basic',
    tier    : 'free',
  },
  {
    value   : 'kling_v2_5_standard',
    label   : 'Kling v2.5 Standard',
    subLabel: 'Chất lượng cao',
    cost    : KLING_V2_COST,
    icon    : Film,
    desc    : 'Chỉ dành cho gói Premium',
    tier    : 'premium',
  },
];

/** Regex: Trích xuất English prompt từ kịch bản Mắt Thần */
const MAT_THAN_PROMPT_REGEX =
  /PROMPT\s+SINH\s+VIDEO\s+CHO\s+AI\s+B[ẰA]NG\s+TI[ÊE]NG\s+ANH[^\n]*\n+([\s\S]+?)(?:\n{2,}|---|\*\*\*|$)/i;

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const h = Math.floor(mins / 60);
  if (h < 24)    return `${h} giờ trước`;
  return `${Math.floor(h / 24)} ngày trước`;
};

/** Map status DB → config hiển thị badge */
const STATUS_CONFIG = {
  success   : { label: 'Thành công',    dot: 'bg-emerald-400', ring: 'ring-emerald-500/30' },
  processing: { label: 'Đang render',   dot: 'bg-amber-400',   ring: 'ring-amber-500/30'    },
  queueing  : { label: 'Đang xếp hàng', dot: 'bg-amber-400',   ring: 'ring-amber-500/30'   },
  failed    : { label: 'Thất bại',      dot: 'bg-red-400',     ring: 'ring-red-500/30'     },
};

/** Map aspect_ratio DB string → Tailwind class */
const RATIO_TO_CLASS = {
  '9:16': 'aspect-[9/16]',
  '16:9': 'aspect-[16/9]',
  '4:3' : 'aspect-[4/3]',
};

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

/** Hiệu ứng orbs nền ambient */
const GlowOrbs = () => (
  <>
    <div className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-amber-500/5 blur-[150px]" />
    <div className="pointer-events-none absolute -bottom-40 -right-20 w-[420px] h-[420px] rounded-full bg-amber-600/3 blur-[130px]" />
    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] rounded-full bg-amber-500/2 blur-[110px]" />
  </>
);

/** Spinner mini nội tuyến */
const MiniSpinner = ({ className = 'w-3.5 h-3.5' }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

/** Panel trạng thái IDLE — placeholder video player */
const IdlePanel = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-5 select-none p-6">
    <div className="relative flex items-center justify-center">
      <div className="absolute w-28 h-28 rounded-full border border-amber-500/20 animate-[ping_3.5s_ease-in-out_infinite]" />
      <div className="absolute w-18 h-18 rounded-full border border-amber-400/12 animate-[ping_3.5s_ease-in-out_infinite_0.6s]" />
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center shadow-xl shadow-amber-500/10">
        <Clapperboard className="w-7 h-7 text-amber-400" />
      </div>
    </div>
    <div className="text-center space-y-1">
      <p className="text-sm font-bold text-slate-300">Màn hình xem trước</p>
      <p className="text-xs text-slate-500">
        Video thành phẩm sẽ hiện ra tại đây sau khi Fal.ai hoàn tất render
      </p>
    </div>
  </div>
);

/** Panel trạng thái PROCESSING */
const ProcessingPanel = ({ logs }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-5 p-6">
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="36" fill="none" stroke="url(#gradProc)" strokeWidth="3"
          strokeDasharray="180 48" strokeLinecap="round" />
        <defs>
          <linearGradient id="gradProc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>
      </svg>
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/40 flex items-center justify-center">
        <Film className="w-5 h-5 text-amber-300" />
      </div>
    </div>
    <div className="text-center">
      <p className="text-sm font-black text-white">Đang tạo video AI...</p>
      <p className="text-xs text-slate-400 mt-0.5">Vui lòng không đóng trang này</p>
    </div>
    {logs.length > 0 && (
      <div className="w-full max-w-[280px] bg-slate-900/60 border border-slate-700/50 rounded-xl p-3 space-y-1.5 max-h-[120px] overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i} className={`flex items-start gap-2 text-[11px] ${i === logs.length - 1 ? 'text-amber-300' : 'text-slate-500'}`}>
            {i === logs.length - 1
              ? <MiniSpinner className="w-3 h-3 mt-0.5 flex-shrink-0" />
              : <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0 text-emerald-500" />
            }
            <span className="leading-tight">{log}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

/** Panel trạng thái FAILED */
const FailedPanel = ({ onRetry }) => (
  <div className="flex flex-col items-center justify-center h-full min-h-[240px] gap-4 p-6">
    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
      <AlertTriangle className="w-8 h-8 text-red-400" />
    </div>
    <div className="text-center">
      <p className="text-sm font-bold text-red-300">Tạo video thất bại</p>
      <p className="text-xs text-slate-400 mt-1">Đã xảy ra lỗi khi xử lý yêu cầu của bạn</p>
    </div>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold hover:bg-red-500/20 transition-all duration-200 cursor-pointer"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Thử lại
    </button>
  </div>
);

/** Card lịch sử video mini — dùng trong grid 3 cột ở cột phải */
const MiniHistoryCard = ({ item, onPreviewClick }) => {
  const isSuccess = item.status?.toLowerCase() === 'success';
  const isActive  = ['processing', 'queueing'].includes(item.status?.toLowerCase());
  const cfg       = STATUS_CONFIG[item.status?.toLowerCase()] || STATUS_CONFIG.queueing;

  const modelName = item?.modelName || item?.model_name;
  const modelLabel = modelName === 'wan_turbo' ? 'Wan v2.2'
    : modelName === 'kling_v2_5_standard' ? 'Kling v2.5'
    : modelName || item?.model || item?.engine || '';

  const handleDownloadVideoFile = async (fileUrl, jobId) => {
    if (!fileUrl) return;
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const extension = fileUrl.split('.').pop().split(/[?#]/)[0] || 'mp4';
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `AI_Studio_Video_${jobId}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className={`group relative bg-slate-900/70 border border-[#222226] rounded-xl overflow-hidden
                    transition-all duration-300
                    hover:shadow-lg hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]
                    ${isActive ? '!cursor-not-allowed opacity-70' : '!cursor-pointer hover:border-amber-500/40 hover:bg-slate-900/90'}`}
         onClick={() => {
           if (isActive) return;
           if (typeof onPreviewClick === 'function') {
             onPreviewClick({
               id: item.id,
               prompt: item.prompt,
               videoUrl: item.videoUrl,
               ratio: item.aspectRatio,
               createdAt: item.createdAt,
               status: item.status
             });
           }
           if (typeof setPreviewJob === 'function') {
             setPreviewJob({
               id: item.id,
               prompt: item.prompt,
               type: 'video',
               output_url: item.videoUrl,
               ratio: item.aspectRatio,
               createdAt: item.createdAt,
               status: item.status
             });
           }
         }}>
      {/* Thumbnail */}
      <div className="h-52 relative bg-slate-950 overflow-hidden">
        {isSuccess && item.videoUrl ? (
          <video
            src={item.videoUrl}
            className="w-full h-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={e => e.target.play()}
            onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
          />
        ) : item.inputImageUrl ? (
          <img src={item.inputImageUrl} alt="Input" className="w-full h-full object-cover opacity-40" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Film className="w-6 h-6 text-slate-700" />
          </div>
        )}

        {/* Active spinner overlay */}
        {isActive && (
          <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center">
            <MiniSpinner className="w-5 h-5 text-amber-400" />
          </div>
        )}

        {/* Play overlay hover */}
        {isSuccess && item.videoUrl && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-3 h-3 text-white fill-white ml-0.5" />
            </div>
          </div>
        )}

        {/* Status dot */}
        <div className="absolute top-1.5 left-1.5">
          <div className={`w-2 h-2 rounded-full ${cfg.dot} ${isActive ? 'animate-pulse' : ''} ring-2 ${cfg.ring}`} title={cfg.label} />
        </div>

        {/* Model badge */}
        {modelLabel && (
          <div className="absolute top-1.5 right-1.5">
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${
              modelName === 'kling_v2_5_standard'
                ? 'bg-gradient-to-r from-amber-500/10 to-purple-500/10 text-purple-400 border-purple-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {modelLabel}
            </span>
          </div>
        )}

        {/* Download button */}
        {isSuccess && item.videoUrl && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadVideoFile(item?.videoUrl || item?.output_url || item?.url, item?.id);
            }}
            title="Tải xuống video"
            className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-md bg-black/60 backdrop-blur-sm
                       border border-white/15 text-slate-300 hover:text-white hover:bg-amber-600/80
                       flex items-center justify-center transition-all duration-200 cursor-pointer
                       opacity-0 group-hover:opacity-100"
          >
            <Download className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-2.5 py-2">
        <p className="text-[10px] text-slate-400 font-medium line-clamp-2 leading-snug">
          {item.prompt || 'Không có mô tả'}
        </p>
        <div className="flex items-center gap-1 text-[9px] text-slate-600 mt-0.5">
          <Clock className="w-2 h-2" />
          <span>{timeAgo(item.createdAt)}</span>
          <span className="font-mono ml-1">{item.aspectRatio}</span>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// BACK TO TOP BUTTON
// ══════════════════════════════════════════════════════════════════════════════
const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      title="Quay về đầu trang"
      className="!fixed !bottom-6 !right-6 !z-[9999] !block bg-amber-500 text-black p-3 rounded-full shadow-lg hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-all duration-200"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function VideoStudioView() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Context ───────────────────────────────────────────────────────────────
  const outletCtx        = useOutletContext() || {};
  const { setPreviewJob } = outletCtx;
  const matThanRawOutput = outletCtx?.matThanRawOutput || outletCtx?.analysisResult || '';
  const { user, updateUserState } = useAuth();

  // ── Workflow State ────────────────────────────────────────────────────────
  const [workflowStatus, setWorkflowStatus] = useState(WORKFLOW.IDLE);
  const [statusLogs,     setStatusLogs]     = useState([]);
  const [currentJobId,   setCurrentJobId]   = useState(null);
  const [videoUrl,       setVideoUrl]       = useState(null);
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [errorMsg,       setErrorMsg]       = useState('');

  // ── Form State ────────────────────────────────────────────────────────────
  const [prompt,           setPrompt]           = useState('');
  const [previewUrl,       setPreviewUrl]       = useState(''); // Chi de hien thi <img>
  const [uploadedImageUrl, setUploadedImageUrl] = useState(''); // Link that (Cloudinary/localhost) de gui API
  const [aspectRatio,      setAspectRatio]      = useState('16:9');
  const [selectedModel,    setSelectedModel]    = useState('wan_turbo');
  const [duration,         setDuration]         = useState(5);
  const [isGenerating,     setIsGenerating]     = useState(false);
  const [isExtending,   setIsExtending]      = useState(false);

  // ── Modal Mắt Thần AI ────────────────────────────────────────────────────
  const [isEyeModalOpen, setIsEyeModalOpen] = useState(false);

  // ── Recent Jobs ───────────────────────────────────────────────────────────
  const [recentJobs,    setRecentJobs]    = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  // ── Cost & Credits Calculations (Safe after State declarations) ───────────
  const currentCredits = Number(user?.credits || 0);
  const cost = selectedModel === 'kling_v2_5_standard' ? (Number(duration) === 10 ? 1000 : 500) : 50;
  const isEnoughCredit = currentCredits >= cost;
  const isPremiumUser = (user?.current_package || 'free').toLowerCase() === 'premium';

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef      = useRef(null);
  const promptRef     = useRef(null);
  const logsEndRef    = useRef(null);
  const fileInputRef  = useRef(null);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedRatio = ASPECT_RATIO_OPTIONS.find(o => o.value === aspectRatio) || ASPECT_RATIO_OPTIONS[1];

  // ══════════════════════════════════════════════════════════════════════════
  // TOAST HELPERS
  // ══════════════════════════════════════════════════════════════════════════
  const showToast = useCallback((message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 4000);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // FETCH RECENT JOBS
  // ══════════════════════════════════════════════════════════════════════════
  const fetchRecentJobs = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await axiosClient.get('/video-jobs/recent');
      setRecentJobs(res?.jobs || []);
    } catch (err) {
      console.warn('[VideoStudio] fetchRecentJobs error:', err?.message);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentJobs();
  }, [fetchRecentJobs]);

  // Auto-open video preview from navigation state (notification click)
  useEffect(() => {
    if (recentJobs && recentJobs.length > 0 && location.state?.openJobId) {
      const searchId = Number(String(location.state.openJobId).replace(/\D/g, ''));
      console.log("[DEBUG VIDEO]: Target ID:", searchId, "Sample Item:", recentJobs[0]);

      const target = recentJobs.find(item => 
        Number(item.job_id) === searchId || Number(item.jobId) === searchId || Number(item.id) === searchId
      );
      if (target) {
        // Set inline preview
        setSelectedPreview({
          id: target.id,
          videoUrl: target.videoUrl || target.video_url,
          prompt: target.prompt,
          title: `Video #${target.id}`,
        });
        // Set global modal preview
        if (typeof setPreviewJob === 'function') {
          setPreviewJob({
            id: target.id,
            title: `Tác vụ #${target.id}`,
            prompt: target.prompt,
            sub: target.prompt || 'Video Ads',
            type: 'video',
            status: target.status,
            output_url: target.videoUrl || target.video_url || target.output_url,
            videoUrl: target.videoUrl || target.video_url || target.output_url,
            ratio: target.aspectRatio || target.ratio || '16:9',
            createdAt: target.createdAt
          });
        }
        window.history.replaceState({}, document.title);
      }
    }
  }, [recentJobs, location.state, setPreviewJob]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [statusLogs]);

  // ══════════════════════════════════════════════════════════════════════════
  // SOCKET.IO — REAL-TIME EVENTS
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    socketService.connectSocket();

    const onStatusUpdate = (data) => {
      console.log('🎬 [SOCKET VIDEO UPDATE RECEIVE]:', data);
      setWorkflowStatus(WORKFLOW.PROCESSING);
      setStatusLogs(prev => [...prev, data.message || 'Đang xử lý...']);

      setRecentJobs((prevVideos) =>
        prevVideos.map((video) => {
          if (video.id === data.jobId) {
            return {
              ...video,
              status: data.status || 'processing',
              video_url: data.video_url || video.video_url,
            };
          }
          return video;
        })
      );
    };

    const onFinished = (data) => {
      console.log('[Socket] video_finished:', data);
      setWorkflowStatus(WORKFLOW.SUCCESS);
      setVideoUrl(data.videoUrl || null);
      setIsGenerating(false);
      setStatusLogs([]);
      showToast('🎉 Video đã được tạo thành công!', 'success');

      setRecentJobs((prevVideos) =>
        prevVideos.map((video) => {
          if (video.id === data.jobId) {
            return {
              ...video,
              status: 'success',
              video_url: data.videoUrl || video.video_url,
            };
          }
          return video;
        })
      );
      fetchRecentJobs();
    };

    const onFailed = (data) => {
      console.log('[Socket] video_failed:', data);
      setWorkflowStatus(WORKFLOW.FAILED);
      setErrorMsg(data.reason || 'Đã xảy ra lỗi không xác định.');
      setIsGenerating(false);
      setStatusLogs([]);
      showToast('❌ Tạo video thất bại. Vui lòng thử lại.', 'error');

      setRecentJobs((prevVideos) =>
        prevVideos.map((video) => {
          if (video.id === data.jobId) {
            return { ...video, status: 'failed' };
          }
          return video;
        })
      );
      fetchRecentJobs();
    };

    socketService.on('video_status_update', onStatusUpdate);
    socketService.on('video_finished',      onFinished);
    socketService.on('video_failed',        onFailed);

    return () => {
      socketService.off('video_status_update', onStatusUpdate);
      socketService.off('video_finished',      onFinished);
      socketService.off('video_failed',        onFailed);
    };
  }, [fetchRecentJobs, showToast]);

  // ══════════════════════════════════════════════════════════════════════════
  // CONFIRM SYNC — nhận object log từ EyeSelectionModal và nạp vào Studio
  // ══════════════════════════════════════════════════════════════════════════
  const handleConfirmSync = useCallback((selectedLog) => {
    if (!selectedLog) return;

    // 1. Trích xuất đường link ảnh gốc từ log và cập nhật vào State ảnh Studio
    //    image_path là đường dẫn tương đối (vd: /uploads/images/product-xxx.jpg)
    //    → cần nối baseUrl để trình duyệt load được
    const baseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
        : '') ||
      'http://localhost:3000';
    const fullImageUrl = selectedLog.image_path
      ? (selectedLog.image_path.startsWith('http')
          ? selectedLog.image_path
          : `${baseUrl}${selectedLog.image_path}`)
      : '';
    setPreviewUrl(fullImageUrl);
    setUploadedImageUrl(fullImageUrl);

    // 2. Trích xuất đoạn prompt tiếng Anh từ prompt_output và nạp vào State prompt
    const rawOutput = selectedLog.prompt_output || '';
    let englishPrompt = '';
    const matchEn = rawOutput.match(
      /PROMPT\s+SINH\s+VIDEO\s+CHO\s+AI\s+B[ẰA]NG\s+TI[ÊE]NG\s+ANH[^\n]*\n+([\s\S]+?)(?:\n{2,}|---|\*\*\*|$)/i
    );
    if (matchEn && matchEn[1]) {
      englishPrompt = matchEn[1].trim();
    } else {
      // Fallback: regex mềm hơn
      const altMatch = rawOutput.match(
        /(?:PROMPT|VIDEO PROMPT|AI PROMPT)[^\n]*\n+([\s\S]{20,500})/i
      );
      englishPrompt = altMatch && altMatch[1] ? altMatch[1].trim() : rawOutput.slice(0, 500).trim();
    }
    setPrompt(englishPrompt);

    // 3. Đóng Modal
    setIsEyeModalOpen(false);

    // 4. Thông báo thành công
    showToast(
      `✅ Đã đồng bộ Log #${selectedLog.id} — Ảnh & Prompt sẵn sàng!`,
      'success'
    );
  }, [showToast]);

  // ══════════════════════════════════════════════════════════════════════════
  // PARSER: Trích xuất English Prompt từ kịch bản Mắt Thần
  // ══════════════════════════════════════════════════════════════════════════
  const handleImportFromMatThan = useCallback(() => {
    if (!matThanRawOutput) {
      showToast('Chưa có dữ liệu kịch bản từ Mắt Thần AI.', 'warning');
      return;
    }
    const match = matThanRawOutput.match(MAT_THAN_PROMPT_REGEX);
    if (match && match[1]) {
      const extracted = match[1].trim();
      setPrompt(extracted);
      promptRef.current?.focus();
      showToast('✅ Đã nhập prompt từ kịch bản Mắt Thần!', 'success');
    } else {
      const altMatch = matThanRawOutput.match(
        /(?:PROMPT|VIDEO PROMPT|AI PROMPT)[^\n]*\n+([\s\S]{20,500})/i
      );
      if (altMatch && altMatch[1]) {
        setPrompt(altMatch[1].trim());
        showToast('✅ Đã nhập prompt từ kịch bản Mắt Thần!', 'success');
      } else {
        showToast('Không tìm thấy mục PROMPT TIẾNG ANH trong kịch bản. Vui lòng kiểm tra lại.', 'warning');
      }
    }
  }, [matThanRawOutput, showToast]);

  // ══════════════════════════════════════════════════════════════════════════
  // GENERATE VIDEO
  // ══════════════════════════════════════════════════════════════════════════
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      showToast('Vui lòng nhập prompt mô tả nội dung video.', 'warning');
      promptRef.current?.focus();
      return;
    }
    if (isGenerating) return;

    // Chan blob URL: neu uploadedImageUrl co nhung dang la blob -> bao loi
    if (uploadedImageUrl && uploadedImageUrl.startsWith('blob:')) {
      showToast('⚠️ Ảnh đầu vào chưa được upload xong. Vui lòng chờ hoặc dán lại ảnh (Ctrl+V).', 'warning');
      return;
    }

    // Khoa nut ngay lap tuc — triet tieu loi double-click spam request
    setIsGenerating(true);
    setWorkflowStatus(WORKFLOW.PROCESSING);
    setStatusLogs(['🚀 Đang gửi yêu cầu tới server...']);
    setVideoUrl(null);
    setErrorMsg('');

    try {
      const effectiveImageUrl = uploadedImageUrl ? uploadedImageUrl.trim() : null;

      const payload = {
        prompt       : prompt.trim(),
        aspectRatio,
        inputImageUrl: effectiveImageUrl,
        imageUrl     : effectiveImageUrl, // Gui ca hai truong de dam bao tuong thich
        model_name   : selectedModel,
        duration     : parseInt(duration, 10) || 5, // Luon gui duration len backend
      };

      const res = await axiosClient.post('/video-jobs/generate', payload);

      if (res?.success) {
        setCurrentJobId(res.jobId);
        setStatusLogs(prev => [
          ...prev,
          `✅ Yêu cầu đã được tiếp nhận — Job #${res.jobId}`,
          '⏳ Đang chờ Fal.ai xử lý...',
        ]);
        showToast(`Job #${res.jobId} đã vào hàng đợi. Vui lòng chờ.`, 'info');
      } else {
        throw new Error(res?.message || 'Phản hồi không hợp lệ từ server.');
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.message || 'Lỗi không xác định.';
      setWorkflowStatus(WORKFLOW.FAILED);
      setErrorMsg(msg);
      setStatusLogs([]);
      showToast(`Lỗi: ${msg}`, 'error');
      if (status === 403) {
        showToast('Tính năng này chỉ dành cho tài khoản Premium. Vui lòng nâng cấp gói cước để sử dụng.', 'warning');
      }
    } finally {
      // Giai phong khoa nut trong moi truong hop (thanh cong / loi)
      // Socket video_finished va video_failed cung goi setIsGenerating(false)
      // nhung finally dam bao nut luon duoc giai phong khi API call ket thuc
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, uploadedImageUrl, selectedModel, duration, isGenerating, showToast]);

  // ══════════════════════════════════════════════════════════════════════════
  // EXTEND VIDEO (12s)
  // ══════════════════════════════════════════════════════════════════════════
  const handleExtend = useCallback(async () => {
    if (!currentJobId || isExtending) return;

    const credits = user?.credits || 0;
    if (credits < CREDITS_EXTEND) {
      showToast(`Không đủ Credits. Cần ${CREDITS_EXTEND} Credits để mở rộng video.`, 'error');
      return;
    }

    setIsExtending(true);
    try {
      const res = await axiosClient.post('/video-jobs/extend', { jobId: currentJobId });
      if (res?.success) {
        showToast(`✅ Đang mở rộng video lên 12 giây (-${CREDITS_EXTEND} Credits)`, 'success');
        if (updateUserState && res.remainCredits !== undefined) {
          updateUserState({ credits: res.remainCredits });
        }
        setWorkflowStatus(WORKFLOW.PROCESSING);
        setStatusLogs(['🔄 Đang xử lý mở rộng video lên 12 giây...']);
        setVideoUrl(null);
      } else {
        throw new Error(res?.message || 'Không thể mở rộng video.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi không xác định.';
      showToast(`Lỗi: ${msg}`, 'error');
    } finally {
      setIsExtending(false);
    }
  }, [currentJobId, isExtending, user, showToast, updateUserState]);

  // ══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD VIDEO
  // ══════════════════════════════════════════════════════════════════════════
  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href     = videoUrl;
    a.download = `video-ai-${currentJobId || Date.now()}.mp4`;
    a.target   = '_blank';
    a.click();
  }, [videoUrl, currentJobId]);

  // ══════════════════════════════════════════════════════════════════════════
  // RESET
  // ══════════════════════════════════════════════════════════════════════════
  const handleReset = useCallback(() => {
    setWorkflowStatus(WORKFLOW.IDLE);
    setStatusLogs([]);
    setVideoUrl(null);
    setCurrentJobId(null);
    setErrorMsg('');
    setIsGenerating(false);
    setIsExtending(false);
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // CLIPBOARD PASTE (Ctrl+V) — Bắt ảnh dán từ clipboard và upload lên server
  // ══════════════════════════════════════════════════════════════════════════
  const handleClipboardPaste = useCallback(async (e) => {
    // Bước 1: Lấy danh sách items từ clipboard
    const items = e.clipboardData?.items;
    if (!items) return;

    // Bước 2: Tìm item đầu tiên có type là image
    let imageBlob = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageBlob = items[i].getAsFile();
        break;
      }
    }

    if (!imageBlob) return; // Không có ảnh trong clipboard — bỏ qua

    // Bước 3: Hiển thị preview tạm bằng Object URL (TUYET DOI khong gui blob nay di API)
    const blobUrl = URL.createObjectURL(imageBlob);
    setPreviewUrl(blobUrl);
    // Xoa uploadedImageUrl cu de tranh gui nham link cu khi upload moi
    setUploadedImageUrl('');
    showToast('⏳ Đang upload ảnh lên server...', 'info');

    // Bước 4: Gửi blob lên endpoint /api/video-jobs/upload-image
    try {
      const formData = new FormData();
      const ext  = imageBlob.type.split('/')[1] || 'png';
      const file = new File([imageBlob], `clipboard-paste.${ext}`, { type: imageBlob.type });
      formData.append('image', file);

      const res = await axiosClient.post('/video-jobs/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.success && res.imageUrl) {
        URL.revokeObjectURL(blobUrl);
        setPreviewUrl(res.imageUrl);
        setUploadedImageUrl(res.imageUrl);
        showToast('✅ Đã dán ảnh thành công!', 'success');
      } else {
        throw new Error(res?.message || 'Upload thất bại.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi upload.';
      showToast(`⚠️ Upload thất bại: ${msg}`, 'warning');
      console.error('[Paste] Upload error:', err);
      // Phat hien loi -> xoa preview, nguoi dung co the thu lai
      URL.revokeObjectURL(blobUrl);
      setPreviewUrl('');
      setUploadedImageUrl('');
    }
  }, [showToast]);

  // ══════════════════════════════════════════════════════════════════════════
  // FILE PICKER CHANGE — Tự động upload file lên Cloudinary ngay khi chọn
  // ══════════════════════════════════════════════════════════════════════════
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Hiển thị preview tạm bằng blob
    const blobUrl = URL.createObjectURL(file);
    setPreviewUrl(blobUrl);
    setUploadedImageUrl('');
    showToast(`⏳ Đang upload ${file.name}...`, 'info');

    // Tự động upload lên Cloudinary
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await axiosClient.post('/video-jobs/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res?.success && res.imageUrl) {
        URL.revokeObjectURL(blobUrl);
        setPreviewUrl(res.imageUrl);
        setUploadedImageUrl(res.imageUrl);
        showToast('✅ Upload ảnh thành công!', 'success');
      } else {
        throw new Error(res?.message || 'Upload thất bại.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi upload.';
      showToast(`⚠️ Upload thất bại: ${msg}`, 'warning');
      console.error('[FilePicker] Upload error:', err);
      URL.revokeObjectURL(blobUrl);
      setPreviewUrl('');
      setUploadedImageUrl('');
    }

    // Reset input để chọn lại file cùng tên không bị block
    e.target.value = '';
  }, [showToast]);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER PREVIEW PANEL CONTENT (Right Column - Player)
  // ══════════════════════════════════════════════════════════════════════════
  const renderPreviewContent = () => {
    // BƯỚC ĐÁNH CHẶN: Nếu người dùng click xem video từ lịch sử, phát ngay tại chỗ
    if (selectedPreview?.videoUrl) {
      return (
        <div className="relative w-full flex flex-col">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-900">
            <video
              src={selectedPreview.videoUrl}
              controls={false}
              autoPlay
              className="w-full h-full object-contain"
            />
            {/* Nút đóng xem trước */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPreview(null);
              }}
              className="absolute top-3 right-3 !z-30 bg-black/80 hover:bg-zinc-900 text-amber-400 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer opacity-80 hover:opacity-100"
            >
              ✕ Đóng xem trước
            </button>
          </div>
          {/* Thanh điều khiển custom */}
          <div className="!w-full !bg-[#111114] !border !border-[#222226] !rounded-xl !p-3 !flex !items-center !justify-between !gap-4 !mt-2 !relative !z-20 !block">
            <div className="!flex !items-center !gap-3">
              <button
                onClick={(e) => {
                  const v = e.currentTarget.closest('.flex.flex-col').querySelector('video');
                  if (v) v.paused ? v.play() : v.pause();
                }}
                className="!w-8 !h-8 !rounded-full !bg-amber-500 !flex !items-center !justify-center !text-black !cursor-pointer hover:!bg-amber-400 active:!scale-95 !transition-all"
              >
                <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
              </button>
              <div className="!flex !items-center !gap-3">
                <Volume2 className="w-3.5 h-3.5 !text-zinc-400" />
                <div className="!w-20 !h-1 !bg-zinc-800 !rounded-lg !relative">
                  <div className="w-3/4 h-full !bg-amber-500 !rounded-lg" />
                  <div className="!w-2 !h-2 !bg-white !rounded-full !absolute !top-1/2 !-translate-y-1/2 !left-1/2" />
                </div>
              </div>
            </div>
            <div className="!flex !items-center !gap-3">
              <RefreshCw className="w-3.5 h-3.5 !text-zinc-400 !cursor-pointer" />
              <span className="!text-xs !font-mono !text-amber-400 !tracking-wider !font-bold">00:00 / 00:10</span>
            </div>
          </div>
        </div>
      );
    }

    switch (workflowStatus) {
      case WORKFLOW.PROCESSING:
        return <ProcessingPanel logs={statusLogs} />;

      case WORKFLOW.SUCCESS:
        return videoUrl ? (
          <div className="relative w-full flex flex-col">
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-900">
              <video
                ref={videoRef}
                src={videoUrl}
                controls={false}
                loop
                playsInline
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            {/* Thanh điều khiển custom */}
            <div className="!w-full !bg-[#111114] !border !border-[#222226] !rounded-xl !p-3 !flex !items-center !justify-between !gap-4 !mt-2 !relative !z-20 !block">
              <div className="!flex !items-center !gap-3">
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
                  }}
                  className="!w-8 !h-8 !rounded-full !bg-amber-500 !flex !items-center !justify-center !text-black !cursor-pointer hover:!bg-amber-400 active:!scale-95 !transition-all"
                >
                  <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                </button>
                <div className="!flex !items-center !gap-3">
                  <Volume2 className="w-3.5 h-3.5 !text-zinc-400" />
                  <div className="!w-20 !h-1 !bg-zinc-800 !rounded-lg !relative">
                    <div className="w-3/4 h-full !bg-amber-500 !rounded-lg" />
                    <div className="!w-2 !h-2 !bg-white !rounded-full !absolute !top-1/2 !-translate-y-1/2 !left-1/2" />
                  </div>
                </div>
              </div>
              <div className="!flex !items-center !gap-3">
                <RefreshCw className="w-3.5 h-3.5 !text-zinc-400 !cursor-pointer" />
                <span className="!text-xs !font-mono !text-amber-400 !tracking-wider !font-bold">00:00 / 00:10</span>
              </div>
            </div>
          </div>
        ) : <IdlePanel />;

      case WORKFLOW.FAILED:
        return <FailedPanel onRetry={handleReset} />;

      default:
        return <IdlePanel />;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      <GlowOrbs />

      <div className="!relative !z-10 !max-w-[1920px] !mx-auto !w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both !space-y-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/10">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">Tạo Video AI </h1>
              <p className="text-xs text-slate-500">Chuyển đổi hình ảnh &amp; kịch bản thành video với AI-STUDIO</p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN V3 LAYOUT: LEFT 55% | RIGHT 45%
            Sử dụng grid-cols-12: LEFT = col-span-7, RIGHT = col-span-5
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-[#111114] border border-[#222226] rounded-2xl p-6 shadow-2xl">
          <div className="!grid !grid-cols-1 lg:!grid-cols-12 !gap-6 lg:!gap-8 !items-start">

          {/* ╔═══════════════════════════════════════════════════════════════╗
              ║  CỘT TRÁI — KHÔNG GIAN THAO TÁC & NHẬP LIỆU (7/12 ≈ 58%)  ║
              ╚═══════════════════════════════════════════════════════════════╝ */}
          <div className="lg:!col-span-5 !flex !flex-col !gap-5">

            {/* ── BƯỚC 1: HÌNH ẢNH SẢN PHẨM ─────────────────────────────── */}
            <div className="!p-2 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <label className="!p-2 block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Bước 1 — Hình ảnh sản phẩm đầu vào
                </span>
              </label>

              {/* Khung Preview ảnh trực quan — có tabIndex và onPaste để bắt Ctrl+V */}
              <div
                tabIndex={0}
                onPaste={handleClipboardPaste}
                className={`
                  relative w-full aspect-video max-h-[260px] rounded-xl overflow-hidden
                  border-2 border-dashed transition-all duration-300
                  focus:outline-none focus:ring-2 focus:ring-amber-500/50
                  ${previewUrl
                    ? 'border-amber-500/50 bg-slate-950/60'
                    : 'border-[#222226] bg-slate-900/40 hover:border-amber-500/40 hover:bg-slate-900/60 cursor-pointer'
                  }
                `}
              >
                {previewUrl ? (
                  <>
                    <img
                      src={previewUrl}
                      alt="Ảnh đầu vào"
                      className="w-full h-full object-contain"
                      onError={() => showToast('Không thể tải ảnh từ URL này.', 'error')}
                    />
                    {/* Overlay xóa ảnh */}
                    <button
                      onClick={() => { setPreviewUrl(''); setUploadedImageUrl(''); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/60 backdrop-blur-sm
                                 border border-white/15 text-slate-300 hover:text-white hover:bg-red-500/70
                                 flex items-center justify-center transition-all duration-200 cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
                      <UploadCloud className="w-7 h-7 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-400">
                        Click vào đây, rồi bấm{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px]">Ctrl+V</kbd>
                        {' '}để dán ảnh
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Hoặc chọn file / dán URL ở ô bên dưới
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Input URL + nút chọn file — tách biệt hoàn toàn với khung preview phía trên */}
              <div className="!p-2 space-y-1.5">
                <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                  Hoặc nhập URL ảnh thủ công
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={previewUrl}
                    onChange={e => { setPreviewUrl(e.target.value); setUploadedImageUrl(e.target.value); }}
                    placeholder="https://example.com/product-image.jpg"
                    disabled={workflowStatus === WORKFLOW.PROCESSING}
                    className="!mt-1 !p-1 flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2.5
                               text-sm text-slate-200 placeholder-slate-600
                               focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30
                               transition-all duration-200 disabled:opacity-40"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={workflowStatus === WORKFLOW.PROCESSING}
                    title="Chọn ảnh từ máy tính"
                    className="!p-1 flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl
                               bg-slate-800/60 border border-slate-700/50 text-slate-400
                               hover:border-amber-500/40 hover:text-slate-200
                               text-xs font-medium transition-all duration-200 cursor-pointer disabled:opacity-40"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span className="hidden sm:inline">Chọn ảnh</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>


              {/* WIDGET: LẤY DỮ LIỆU TỪ MẮT THẦN AI — mở EyeSelectionModal */}
              <button
                onClick={() => setIsEyeModalOpen(true)}
                disabled={workflowStatus === WORKFLOW.PROCESSING}
                className="w-full !p-1 flex items-center justify-center gap-2.5 py-2.5 rounded-xl
                           bg-amber-500/10 border border-amber-500/30 text-amber-300
                           hover:bg-amber-500/20 hover:border-amber-400/50
                           text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-40"
              >
                <Eye className="w-4 h-4" />
                 LẤY DỮ LIỆU TỪ MẮT THẦN AI
              </button>
            </div>

            {/* ── BƯỚC 2: CẤU HÌNH TỈ LỆ KHUNG HÌNH ────────────────────── */}
            <div className="!p-2 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Bước 2 — Tỉ lệ khung hình
              </label>

              <div className="!mt-2 grid grid-cols-3 gap-2.5">
                {ASPECT_RATIO_OPTIONS.map((opt) => {
                  const Icon   = opt.icon;
                  const active = aspectRatio === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      disabled={workflowStatus === WORKFLOW.PROCESSING}
                      className={`
                        flex flex-col items-center justify-center gap-1.5 h-26 py-3 px-4 rounded-xl border font-semibold
                        transition-all duration-200 cursor-pointer
                        ${active
                          ? 'border-amber-500 bg-amber-500/5 text-amber-400 shadow-md shadow-amber-500/5'
                          : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:border-zinc-700 hover:text-white'
                        }
                        disabled:opacity-40 disabled:cursor-not-allowed
                      `}
                    >
                      <Icon className={`w-5 h-5 ${active ? 'text-amber-400' : 'text-slate-500'}`} />
                      <span className="text-xs">{opt.label}</span>
                      <span className={`text-[9px] font-mono ${active ? 'text-amber-400/90' : 'text-slate-600'}`}>
                        {opt.value}
                      </span>
                      <span className={`text-[9px] text-center leading-tight ${active ? 'text-amber-400/60' : 'text-slate-600'}`}>
                        {opt.subLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── BƯỚC 3: PROMPT MÔ TẢ CHUYỂN ĐỘNG ──────────────────────── */}
            <div className="!p-1 bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Bước 3 — Kịch bản &amp; Prompt video
                </label>
                <div className="!p-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-600">{prompt.length} ký tự</span>
                  {prompt.length > 0 && (
                    <button
                      onClick={() => setPrompt('')}
                      className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Xóa
                    </button>
                  )}
                </div>
              </div>

              <textarea
                ref={promptRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder={`Mô tả chi tiết chuyển động video bằng tiếng Anh...\nVí dụ: A stunning fashion product floating in the air, surrounded by golden particles, slow zoom-in, cinematic lighting, 4K quality...`}
                rows={7}
                disabled={workflowStatus === WORKFLOW.PROCESSING}
                className="!p-2 w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3
                           text-sm text-slate-200 placeholder-slate-600 resize-none
                           focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30
                           transition-all duration-200 disabled:opacity-40 leading-relaxed"
              />
            </div>

            {/* ── KHỐI HẠ CÁNH: CHỌN MÔ HÌNH + CHI PHÍ + CTA ───────────── */}
            <div className="space-y-3">
              {/* Model Selector */}
              <div className="grid grid-cols-2 gap-2.5">
                {MODEL_OPTIONS.map((opt) => {
                  const active = selectedModel === opt.value;
                  const isPremium = opt.value === 'kling_v2_5_standard';
                  const isLocked = isPremium && !isPremiumUser;
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (isLocked) {
                          alert('Chỉ dành cho gói Premium. Vui lòng nâng cấp tài khoản!');
                          return;
                        }
                        setSelectedModel(opt.value);
                      }}
                      className={`
                        flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border font-semibold
                        transition-all duration-200 relative
                        ${active && !isLocked
                          ? 'border-amber-500 bg-amber-500/5 text-amber-400 shadow-md shadow-amber-500/5'
                          : isLocked
                          ? 'bg-slate-800/30 border-slate-700/40 text-slate-500 cursor-not-allowed opacity-70'
                          : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:border-amber-500/30 hover:text-zinc-300 cursor-pointer'
                        }
                      `}
                    >
                      {isLocked && (
                        <span className="absolute -top-1.5 -right-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300">
                          🔒
                        </span>
                      )}
                      <Icon className={`w-4 h-4 ${active && !isLocked ? 'text-amber-400' : isLocked ? 'text-slate-600' : 'text-slate-500'}`} />
                      <span className="text-xs">{opt.label}</span>
                      <span className="text-[9px] text-slate-500">{opt.subLabel}</span>
                      {isLocked && (
                        <span className="text-[8px] text-amber-400/70">Chỉ dành cho gói Premium</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bộ chọn thời lượng cho model Premium */}
              {selectedModel === 'kling_v2_5_standard' && (
                <div className="!p-2 flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800/50">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <span className="text-xs text-slate-400">Thời lượng video</span>
                  </div>
                  <div className="flex gap-2">
                    {[5, 10].map((val) => (
                      <button
                        key={val}
                        onClick={() => setDuration(val)}
                        className={`
                          !p-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-200 cursor-pointer
                          ${duration === val
                            ? 'border-amber-500 bg-amber-500/5 text-amber-400 shadow-md shadow-amber-500/5'
                            : 'border-[#222226] bg-[#0f0f11] text-zinc-400 hover:border-amber-500/30'
                          }
                        `}
                      >
                        {val}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chi phí động theo model và thời lượng */}
              <div className="!p-2 flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-800/50">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-xs text-slate-400">
                    Chi phí:{' '}
                    <span className="text-amber-300 font-bold">
                      {cost} Credits
                    </span>{' '}
                    / lần
                  </span>
                </div>
                <span className="text-[10px] text-slate-600 font-mono">
                  {selectedModel === 'kling_v2_5_standard' ? 'Kling v2.5 Standard' : 'Wan v2.2 Turbo'}
                </span>
              </div>

              {/* CTA Button */}
              <button
                id="btn-generate-video"
                type="button"
                onClick={handleGenerate}
                disabled={!isEnoughCredit || isGenerating}
                className={`
                  relative !p-2 flex items-center justify-center gap-3 w-full py-4 rounded-2xl
                  text-base font-black tracking-wide transition-all duration-300
                  ${isEnoughCredit && !isGenerating
                    ? '!bg-amber-500 !text-black hover:!bg-amber-400 !cursor-pointer'
                    : '!bg-zinc-800 !text-zinc-500 !cursor-not-allowed'
                  }
                `}
              >
                {isGenerating
                  ? 'HỆ THỐNG ĐANG KHỞI TẠO TÁC VỤ...'
                  : isEnoughCredit
                  ? `TẠO VIDEO AI — KHỞI CHẠY (-${cost} Credits)`
                  : 'Không đủ Credit'
                }
              </button>
            </div>
          </div>

          {/* ╔═══════════════════════════════════════════════════════════════╗
              ║  CỘT PHẢI — KẾT QUẢ & LỊCH SỬ THU GỌN (5/12 ≈ 42%)        ║
              ╚═══════════════════════════════════════════════════════════════╝ */}
          <div className="lg:!col-span-7 !flex !flex-col !gap-5">

            {/* ── KHUNG REVIEW CHÍNH — Video Player ──────────────────────── */}
            <div className="bg-[#111114] border border-[#222226] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header Player */}
              <div className="!p-2 flex items-center justify-between px-4 py-3 border-b border-[#222226]/60">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <SquarePlay className="w-3.5 h-3.5 text-amber-400" />
                  Màn hình Review
                </h2>
                <div className="flex items-center gap-2">
                  {/* Status indicator */}
                  <span className={`!p-1 flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    workflowStatus === WORKFLOW.SUCCESS
                      ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                      : workflowStatus === WORKFLOW.PROCESSING
                      ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20'
                      : workflowStatus === WORKFLOW.FAILED
                      ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                      : 'text-slate-500 bg-slate-800/40 border border-slate-700/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      workflowStatus === WORKFLOW.SUCCESS    ? 'bg-emerald-400'
                      : workflowStatus === WORKFLOW.PROCESSING ? 'bg-amber-400 animate-pulse'
                      : workflowStatus === WORKFLOW.FAILED    ? 'bg-red-400'
                      : 'bg-slate-600'
                    }`} />
                    {workflowStatus === WORKFLOW.SUCCESS    ? 'Hoàn tất'
                     : workflowStatus === WORKFLOW.PROCESSING ? 'Đang render'
                     : workflowStatus === WORKFLOW.FAILED    ? 'Thất bại'
                     : 'Chờ'}
                  </span>
                  {workflowStatus !== WORKFLOW.IDLE && (
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Tạo mới
                    </button>
                  )}
                </div>
              </div>

              {/* Player Body — dynamic aspect ratio */}
              <div
                className={`
                  relative w-full h-[420px] flex flex-col items-center justify-center
                  bg-slate-950/80 transition-all duration-500
                  ${workflowStatus === WORKFLOW.SUCCESS
                    ? 'shadow-inner shadow-emerald-500/5'
                    : workflowStatus === WORKFLOW.PROCESSING
                    ? 'shadow-inner shadow-amber-500/8'
                    : ''
                  }
                `}
              >
                {renderPreviewContent()}
              </div>

              {/* SUCCESS: Download + Extend actions */}
              {workflowStatus === WORKFLOW.SUCCESS && (
                <div className="p-4 border-t border-slate-800/50 flex flex-col gap-2.5">
                  <button
                    onClick={handleDownload}
                    disabled={!videoUrl}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                               bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40
                               text-white text-sm font-bold transition-all duration-200 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Tải xuống Video (MP4)
                  </button>
                  <button
                    onClick={handleExtend}
                    disabled={isExtending || (user?.credits || 0) < CREDITS_EXTEND}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                               bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20
                               text-amber-300 text-sm font-semibold transition-all duration-200
                               disabled:opacity-40 cursor-pointer"
                  >
                    {isExtending
                      ? <><MiniSpinner className="w-4 h-4" />Đang mở rộng...</>
                       : <><Timer className="w-4 h-4" />Mở rộng lên 12 giây <span className="text-amber-400/70 text-xs">(-{CREDITS_EXTEND} Credits)</span></>
                    }
                  </button>
                </div>
              )}
            </div>

            {/* ── DANH SÁCH VIDEO ĐÃ TẠO GẦN ĐÂY (3 card mini) ─────────── */}
            <div className="bg-[#111114] border border-[#222226] rounded-2xl p-4 shadow-2xl space-y-3">
              {/* Header: tiêu đề trái — "Xem tất cả" phải */}
              <div className="!p-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-amber-400" />
                  Video đã tạo gần đây
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchRecentJobs}
                    disabled={loadingRecent}
                    title="Làm mới danh sách"
                    className="text-slate-600 hover:text-slate-400 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingRecent ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => navigate('/dashboard/history')}
                    className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300
                               font-semibold transition-colors cursor-pointer"
                  >
                    Xem tất cả
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Grid 3 card */}
              {loadingRecent ? (
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-52 bg-slate-800/60 border border-slate-700/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : recentJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2
                                bg-slate-900/30 border border-dashed border-slate-800/40 rounded-xl">
                  <SquarePlay className="w-7 h-7 text-slate-700" />
                  <p className="text-xs text-slate-500 text-center">Chưa có video nào. Hãy tạo video đầu tiên!</p>
                </div>
              ) : (
                <div className="!p-2 grid grid-cols-3 gap-2">
                  {recentJobs.slice(0, 3).map(item => (
                    <MiniHistoryCard
                      key={item.id}
                      item={item}
                      onPreviewClick={(data) => {
                        setSelectedPreview(data);
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Info tip */}
              <p className="text-[10px] text-slate-700 text-center">
                Hiển thị 3 video gần nhất · <span
                  onClick={() => navigate('/dashboard/history')}
                  className="text-amber-500/70 cursor-pointer hover:text-amber-400 transition-colors"
                >Xem toàn bộ lịch sử</span>
              </p>
            </div>
          </div>
        </div>
        </div>

      </div>

      {/* ── Back To Top Button ────────────────────────────────────────────────── */}
      <BackToTopButton />

      {/* ── EyeSelectionModal — Chọn lịch sử Mắt Thần AI ───────────────────── */}
      <EyeSelectionModal
        isOpen={isEyeModalOpen}
        onClose={() => setIsEyeModalOpen(false)}
        onConfirmSync={handleConfirmSync}
      />

      {/* ── Global Toast ─────────────────────────────────────────────────────── */}
      {toast.show && (
        <div
          className={`
            fixed bottom-6 right-6 z-[9999] flex items-center gap-3
            px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-sm
            text-sm font-semibold max-w-sm
            transition-all duration-300 animate-in slide-in-from-bottom-4
            ${toast.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/40 text-emerald-200'
            : toast.type === 'error'   ? 'bg-red-900/90 border-red-500/40 text-red-200'
            : toast.type === 'warning' ? 'bg-amber-900/90 border-amber-500/40 text-amber-200'
            : 'bg-slate-800/90 border-slate-600/40 text-slate-200'}
          `}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
          {toast.type === 'error'   && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
          {toast.type === 'info'    && <Info className="w-4 h-4 flex-shrink-0" />}
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => setToast(t => ({ ...t, show: false }))}
            className="text-current opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
