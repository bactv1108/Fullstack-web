import React, { useState, useEffect, useRef, useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Eye, Sparkles, Upload, FileText, CheckCircle, AlertCircle, RefreshCw, Clock, ShieldAlert } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';
import socketService from '../../../services/socketService';
import { AuthContext } from '../../../contexts/AuthContext';

export default function ImageAnalyzerView() {
  const dashboardState = useOutletContext();
  const { toast } = dashboardState;

  // Lấy thông tin user và cập nhật profile từ AuthContext
  const { user, updateUserState, updateUserProfile, refreshUserProfile } = useContext(AuthContext);

  // ── State cơ bản ─────────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // States quản lý thời gian khóa cục bộ
  const [isBanned, setIsBanned] = useState(false);
  const [countdownText, setCountdownText] = useState('15:00');
  const [muteErrorMessage, setMuteErrorMessage] = useState('');

  // ── Blacklist từ khóa cấm — nạp từ API khi component mount ───────────────────────
  const [blacklist, setBlacklist] = useState([]);

  // ── State cho luồng "Pending – Chờ Admin duyệt" ───────────────────────────
  // Lưu ID của bản ghi đang ở trạng thái pending để socket biết cần match sự kiện nào
  const [pendingAnalysisId, setPendingAnalysisId] = useState(null);
  const [pendingMessage, setPendingMessage] = useState('');

  // Dùng ref để luôn đọc được giá trị mới nhất bên trong callback socket (tránh stale closure)
  const pendingAnalysisIdRef = useRef(null);
  useEffect(() => {
    pendingAnalysisIdRef.current = pendingAnalysisId;
  }, [pendingAnalysisId]);

  // ─────────────────────────────────────────────────────────────────────────────
  //  Nạp danh sách từ khóa cấm từ Backend ngay khi component vừa mount
  //  API public, không cần JWT — Frontend dùng để đánh chặn từ xa trước khi POST
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchBlacklist = async () => {
      try {
        const res = await axiosClient.get('/image-analyzer/frontend-blacklist');
        const keywords = res?.keywords || res?.data?.keywords || [];
        if (Array.isArray(keywords) && keywords.length > 0) {
          setBlacklist(keywords);
          console.log(`[BLACKLIST] Đã nạp ${keywords.length} từ khóa cấm từ Backend.`);
        }
      } catch (err) {
        // Không hiển thị lỗi cho user — blacklist lỗi không được chặn luồng chính
        console.warn('[BLACKLIST] Không thể nạp danh sách từ khóa cấm:', err.message);
      }
    };
    fetchBlacklist();
  }, []); // Mount một lần duy nhất

  useEffect(() => {
    // Nếu không có mốc thời gian cấm, giải phóng giao diện ngay
    if (!user?.banned_until) {
      setIsBanned(false);
      return;
    }

    const banTime = new Date(user.banned_until).getTime();
    let timer;
    
    const runCountdown = () => {
      const now = Date.now();
      const distance = banTime - now;

      // 💡 TINH HOA: Khi thời gian kết thúc (distance <= 0), hủy cấm và mở khóa UI lập tức không cần F5
      if (distance <= 0) {
        setIsBanned(false);
        setCountdownText('00:00');
        if (timer) clearInterval(timer);
        
        // Nếu trong Context có hàm silent refresh profile, gọi để đồng bộ lại backend sạch sẽ
        if (typeof refreshUserProfile === 'function') {
          refreshUserProfile();
        } else if (typeof updateUserProfile === 'function') {
          updateUserProfile();
        }
        return;
      }

      // Nếu vẫn đang trong thời gian chịu án phạt
      setIsBanned(true);
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      
      setCountdownText(
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    // Kích hoạt chạy vòng lặp đếm ngược chính xác mỗi 1 giây
    runCountdown();
    timer = setInterval(runCountdown, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [user?.banned_until]);

  // ── Scroll-to-top button ─────────────────────────────────────────────────────
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => { setShowScrollTop(window.scrollY > 300); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  // ─────────────────────────────────────────────────────────────────────────────
  //  WEBSOCKET LISTENER: Lắng nghe sự kiện 'image_analysis_result'
  //  Khi Admin duyệt hoặc AI hoàn thành phân tích, server sẽ bắn sự kiện này
  //  về đúng room 'user_room_${userId}' của user đang chờ kết quả.
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Kết nối socket (tự động đọc token từ localStorage & gửi 'authenticate')
    const socket = socketService.connectSocket();

    /**
     * Handler nhận kết quả phân tích Mắt Thần từ server.
     * Payload: { itemId, status, resultData, message }
     */
    const handleAnalysisResult = (payload) => {
      console.log('[SOCKET] Nhận sự kiện image_analysis_result:', payload);

      const { itemId, status, resultData, message } = payload || {};

      // Chỉ xử lý nếu itemId khớp với bản ghi user đang chờ
      const currentPendingId = pendingAnalysisIdRef.current;
      if (!currentPendingId || Number(itemId) !== Number(currentPendingId)) {
        console.log(`[SOCKET] itemId=${itemId} không khớp pendingId=${currentPendingId}, bỏ qua.`);
        return;
      }

      // Tắt trạng thái loading / pending
      setAnalyzing(false);
      setPendingAnalysisId(null);
      setPendingMessage('');

      if (status === 'success' && resultData?.prompt_output) {
        // ✅ Thành công: hiển thị kết quả phân tích lên giao diện
        setResult(resultData);
        setErrorMsg(null);
        if (toast?.success) {
          toast.success(`🎉 ${message || 'Kết quả phân tích Mắt Thần đã sẵn sàng!'}`);
        }
        console.log('[SOCKET] ✅ Cập nhật kết quả phân tích thành công vào UI.');
      } else if (status === 'failed') {
        // ❌ Thất bại: hiển thị thông báo lỗi
        const errText = resultData?.error_message || message || 'Ảnh bị từ chối hoặc phân tích thất bại.';
        setErrorMsg(errText);
        setResult(null);
        if (toast?.error) {
          toast.error(`❌ ${message || 'Ảnh đã bị từ chối bởi Admin.'}`);
        }
        console.log('[SOCKET] ❌ Nhận trạng thái failed, cập nhật UI lỗi.');
      } else if (status === 'success' && !resultData?.prompt_output) {
        // Edge case: approved nhưng chưa có nội dung (không nên xảy ra nhưng xử lý phòng thủ)
        setErrorMsg('Ảnh đã được duyệt nhưng kết quả phân tích không có sẵn. Vui lòng thử lại.');
        if (toast?.error) toast.error('⚠️ Đã duyệt nhưng dữ liệu kết quả bị thiếu.');
      }
    };

    // Đăng ký listener — off trước khi on để đảm bảo không bị duplicate
    socket.off('image_analysis_result', handleAnalysisResult);
    socket.on('image_analysis_result', handleAnalysisResult);

    // ── CLEANUP: Hủy đăng ký khi component unmount để tránh Memory Leak ─────
    return () => {
      socket.off('image_analysis_result', handleAnalysisResult);
      console.log('[SOCKET] 🧹 Đã cleanup listener image_analysis_result.');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Mount một lần duy nhất, dùng ref để đọc state mới nhất

  // ── Paste ảnh từ Clipboard (Ctrl + V) ──────────────────────────────────────
  useEffect(() => {
    const handlePasteEvent = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (file.size > MAX_FILE_SIZE) {
              toast?.error ? toast.error('Kích thước ảnh vượt quá 20MB.') : alert('Kích thước ảnh vượt quá 20MB.');
              return;
            }
            setSelectedFile(file);
            setImagePreview(URL.createObjectURL(file));
            setResult(null);
            setErrorMsg(null);
            setPendingAnalysisId(null);
            setPendingMessage('');
            if (toast?.success) toast.success('📋 Đã nạp hình ảnh sản phẩm từ bộ nhớ tạm!');
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [toast]);

  // Định dạng thời gian từ số giây sang phút/giây (MM:SS)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ── Validate và set file ảnh ─────────────────────────────────────────────────
  const validateAndSetFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      if (toast?.error) {
        toast.error('Kích thước ảnh vượt quá 20MB. Vui lòng chọn tệp nhỏ hơn.');
      } else {
        alert('Kích thước ảnh vượt quá 20MB.');
      }
      return;
    }
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
    setPendingAnalysisId(null);
    setPendingMessage('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) validateAndSetFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      if (toast?.error) toast.error('Chỉ chấp nhận các tập tin định dạng hình ảnh!');
      return;
    }
    validateAndSetFile(file);
  };

  // ── Hàm chính: Gửi ảnh lên server để phân tích ─────────────────────────────
  //  GATE 1: Kiểm tra từ khóa cấm (blacklist) TRƯỚC khi POST lên server
  //  GATE 2: Validate file tồn tại
  // ─────────────────────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║  GATE 1: ĐÁNH CHẶN TỪ XA — Kiểm tra từ khóa cấm (Blacklist Filter)   ║
    // ║  Chặn request trước khi chạm tới server, bảo vệ credits của User           ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    if (blacklist.length > 0) {
      // Lấy tên file ảnh (originalname) làm chuỗi kiểm tra đại diện
      // Trong tương lai có thể mở rộng thêm trường nhập liệu mô tả sản phẩm
      const userInputRaw = selectedFile ? selectedFile.name : '';
      const userInputNormalized = userInputRaw.toLowerCase().trim();

      // Đối chiếu với từng từ khóa trong blacklist
      const hitKeyword = blacklist.find((kw) => userInputNormalized.includes(kw));

      if (hitKeyword) {
        // Vi phạm phát hiện — chặn luồng, giữ nguyên trạng thái, bảo vệ credits
        console.warn(`[BLACKLIST GATE] Từ khóa bị cấm phát hiện: "${hitKeyword}" trong "${userInputNormalized}"`);
        if (toast?.error) {
          toast.error(
            `Nội dung của bạn vi phạm quy tắc cộng đồng do chứa từ khóa cấm: "${hitKeyword}". Vui lòng sửa lại!`
          );
        }
        // Ngắt luồng — không gửi request lên server
        return;
      }
    }

    // ╔════════════════════════════════════════════════════════════════════════╗
    // ║  GATE 2: Validate file ảnh tồn tại trước khi gửi                        ║
    // ╚════════════════════════════════════════════════════════════════════════╝
    if (!selectedFile) {
      if (toast?.error) toast.error('Vui lòng tải hoặc Ctrl+V hình ảnh sản phẩm trước!');
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);
    setResult(null);
    setPendingAnalysisId(null);
    setPendingMessage('');

    const formData = new FormData();
    formData.append('productImage', selectedFile);

    try {
      if (toast?.info) toast.info('📥 Đang tải ảnh lên và phân tích qua Fal.ai Llava-Next...');

      const res = await axiosClient.post('/image-analyzer/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Bóc tách dữ liệu từ response wrapper linh hoạt
      const responseData = res.success ? res.data : (res.data || res);

      // ── LUỒNG 1: AI trả kết quả ngay lập tức (safetyVerdict = 'safe') ─────
      if (responseData && responseData.prompt_output) {
        setResult(responseData);
        setAnalyzing(false);
        if (toast?.success) toast.success('🎉 Phân tích sản phẩm thành công!');
        return;
      }

      // ── LUỒNG 2: Ảnh cần kiểm duyệt (safetyVerdict = 'unclear' / AI fallback)
      // Backend trả về { data: { id, status: 'pending' } }
      // User phải chờ Admin duyệt — Socket sẽ đẩy kết quả khi sẵn sàng
      if (responseData && responseData.id && responseData.status === 'pending') {
        const analysisId = responseData.id;
        setPendingAnalysisId(analysisId);
        setPendingMessage(
          res.message ||
          'Ảnh đang chờ kiểm duyệt thủ công bởi Admin. Bạn sẽ nhận được kết quả tự động qua thông báo realtime.'
        );
        // Giữ analyzing = true để hiện spinner chờ đợi
        // Toast thông báo nhẹ nhàng để user biết trạng thái
        if (toast?.info) {
          toast.info('⏳ Ảnh đang chờ Admin kiểm duyệt. Vui lòng giữ trang này mở...');
        }
        console.log(`[IMAGE ANALYZER] Ảnh #${analysisId} đang pending, lắng nghe socket...`);
        return;
      }

      // ── LUỒNG 3: Response không hợp lệ ─────────────────────────────────────
      throw new Error(res.message || 'Không nhận được dữ liệu kịch bản hợp lệ.');

    } catch (error) {
      console.error('[IMAGE ANALYZER VIEW ERROR]', error);

      // Nếu Backend trả về mã lỗi cấm hoặc thông tin mutedUntil / banned_until, cập nhật global state
      const bannedUntil = error.response?.data?.banned_until || error.response?.data?.mutedUntil;
      if (bannedUntil || error.response?.status === 403 || (error.response?.status === 400 && error.response?.data?.message?.includes('khóa'))) {
        const finalBanTime = bannedUntil || new Date(Date.now() + 15 * 60 * 1000).toISOString();
        setMuteErrorMessage(error.response?.data?.message || 'Tài khoản của bạn đang bị hạn chế do gửi ảnh vi phạm.');
        setAnalyzing(false);
        if (typeof updateUserState === 'function') {
          updateUserState({ banned_until: finalBanTime });
        }
        if (toast?.error) toast.error('⚠️ Tài khoản bị tạm khóa tính năng do gửi ảnh vi phạm!');
        return;
      }

      const errMsg = error.response?.data?.message || error.response?.data?.error || error.message || 'Lỗi kết nối API Mắt Thần.';
      setErrorMsg(errMsg);
      setAnalyzing(false);
      if (toast?.error) toast.error('❌ Phân tích hình ảnh thất bại!');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <div className="!max-w-[1920px] !mx-auto !w-full !flex !flex-col !gap-6 md:!gap-8 !items-stretch">

        {/* KHU VỰC TIÊU ĐỀ TRANG */}
        <div className="!flex !flex-col !gap-1 !w-full">
          <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
            <div className="p-2 bg-[#f59e0b]/10 text-[#f59e0b] rounded-xl border border-[#f59e0b]/10">
              <Eye size={18} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-wider">Mắt Thần AI (Phân Tích Sản Phẩm)</h2>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Tải ảnh lên hoặc bấm Ctrl + V tại đây để tự động trích xuất cấu trúc kịch bản và prompt cinematic 4K 9:16 chuẩn lifestyle.</p>
            </div>
          </div>
        </div>

        <div className="!p-4 !bg-[#111114] !border !border-[#222226] !rounded-2xl p-5 sm:p-6 md:p-8 !w-full !shadow-2xl flex flex-col gap-6 relative">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Cột 1: Thả / Xem trước ảnh */}
            <div className="flex flex-col gap-5 text-left w-full">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">1. Hình ảnh sản phẩm</h3>

              {!imagePreview ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('productImageInput').click()}
                  className="w-full aspect-video border-2 border-dashed border-[#222226] hover:border-[#f59e0b] rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer bg-[#0f0f11] hover:bg-[#f59e0b]/5 transition-all group"
                >
                  <input type="file" id="productImageInput" accept="image/*" onChange={handleFileChange} className="hidden" />
                  <div className="w-12 h-12 bg-[#18181c] border border-[#222226]/40 group-hover:bg-[#f59e0b]/10 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-[#f59e0b] transition-all">
                    <Upload size={20} />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-xs font-bold text-zinc-300">Kéo thả ảnh, click chọn file hoặc nhấn Ctrl + V để dán</p>
                    <p className="text-[10px] text-zinc-500 mt-1">Chấp nhận tối đa 20MB theo cấu hình hệ thống</p>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col gap-3">
                  <div className="w-full aspect-video rounded-xl overflow-hidden border border-[#222226] bg-[#0f0f11] relative flex items-center justify-center">
                    <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />

                    {/* ── OVERLAY LOADING: Hiển thị khi đang phân tích hoặc chờ Admin ── */}
                    {analyzing && (
                      <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 p-4">
                        {pendingAnalysisId ? (
                          /* Trạng thái chờ Admin duyệt */
                          <>
                            <div className="w-10 h-10 rounded-full border-2 border-[#f59e0b]/30 flex items-center justify-center">
                              <Clock size={20} className="text-[#f59e0b] animate-pulse" />
                            </div>
                            <p className="text-[#f59e0b] text-[10px] font-bold tracking-widest uppercase animate-pulse text-center">
                              Đang chờ Admin kiểm duyệt...
                            </p>
                            <p className="text-zinc-400 text-[9px] text-center max-w-[200px] leading-relaxed">
                              Hệ thống sẽ tự động cập nhật kết quả khi Admin xử lý xong
                            </p>
                            {/* Indicator socket đang lắng nghe */}
                            <div className="flex items-center gap-1.5 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-full px-3 py-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
                              <span className="text-[#f59e0b] text-[8px] font-bold uppercase tracking-widest">Real-time chờ kết quả</span>
                            </div>
                          </>
                        ) : (
                          /* Trạng thái đang phân tích AI */
                          <>
                            <div className="w-8 h-8 border-3 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
                            <p className="text-[#f59e0b] text-[10px] font-bold tracking-widest uppercase animate-pulse">Đang quét ảnh & sinh kịch bản...</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      style={{ padding: '8px' }}
                      onClick={() => {
                        setSelectedFile(null);
                        setImagePreview(null);
                        setPendingAnalysisId(null);
                        setPendingMessage('');
                        setResult(null);
                        setErrorMsg(null);
                        setAnalyzing(false);
                      }}
                      disabled={analyzing && !pendingAnalysisId}
                      className="flex-1 py-2.5 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226]/60 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer disabled:opacity-40"
                    >
                      Chọn ảnh khác
                    </button>
                    <button
                      type="button"
                      onClick={handleAnalyze}
                      disabled={analyzing || isBanned}
                      className="flex-1 py-2.5 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 border-none"
                    >
                      <Sparkles size={14} className="text-black" />
                      {isBanned
                        ? 'TÀI KHOẢN ĐANG BỊ HẠN CHẾ'
                        : analyzing
                          ? (pendingAnalysisId ? 'Đang chờ Admin...' : 'Đang phân tích...')
                          : 'BẮT ĐẦU PHÂN TÍCH NGAY - 20 CREDITS'
                      }
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-3 text-center text-xs font-medium text-red-400/80 tracking-wide max-w-xl mx-auto border border-red-500/20 bg-red-500/5 py-2 px-4 rounded-xl">
                ⚠️ <b>CẢNH BÁO CHÍNH SÁCH:</b> Hệ thống nghiêm cấm mọi hành vi tải lên hình ảnh khỏa thân, khiêu dâm, đồi trụy hoặc vi phạm tiêu chuẩn cộng đồng. Bộ lọc độc quyền của Mắt Thần AI sẽ tự động kích hoạt chế độ <b>ĐÓNG BĂNG TÀI KHOẢN 15 PHÚT</b> đối với các trường hợp cố tình vi phạm.
              </p>

              <div className="bg-[#0f0f11] border border-[#222226]/40 rounded-xl p-4 flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase text-[#f59e0b] tracking-widest">Tiêu chí bóc tách sản phẩm:</span>
                <ul className="text-[11px] text-zinc-400 leading-relaxed list-disc list-inside space-y-1">
                  <li>Định hình Vibe cốt lõi: <strong className="text-zinc-200">clean - lifestyle</strong>, nhẹ nhàng nam tính.</li>
                  <li>Dựng phân cảnh quay Storyboard: Cinematic 4K, khung dọc 9:16 trên nền gỗ/thảm phẳng sang trọng.</li>
                  <li>Phát hiện chi tiết: Độ co dãn vải, độ cứng bo cổ, đường may chi tiết và prompt tiếng Anh cho Runway.</li>
                </ul>
              </div>
            </div>

            {/* Cột 2: Panel kết quả Markdown */}
            <div className="flex flex-col gap-5 text-left w-full h-full min-h-[300px]">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">2. Kết quả phân tích (Kịch bản AI)</h3>

              {/* ── Trạng thái bị khóa Muted đếm ngược ── */}
              {isBanned && (
                <div className="w-full flex-grow flex-1 min-h-[300px] border border-red-500/20 bg-red-500/5 p-6 rounded-xl text-center flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-bounce">
                    <ShieldAlert size={32} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-red-400 uppercase tracking-wider">Tài khoản bị tạm khóa tính năng</p>
                    <p className="text-xs text-zinc-350 max-w-xs leading-relaxed mx-auto">
                      {muteErrorMessage || 'Tài khoản của bạn đang bị giới hạn do vi phạm chính sách nội dung.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Thời gian chờ còn lại</span>
                    <span className="text-amber-400 text-3xl font-mono font-bold tracking-widest animate-pulse">
                      {countdownText}
                    </span>
                  </div>
                </div>
              )}

              {/* ── Trạng thái chờ Admin: hiển thị banner thông báo ────────────── */}
              {!isBanned && !result && !errorMsg && pendingAnalysisId && (
                <div className="w-full flex-1 min-h-[250px] border border-[#f59e0b]/20 bg-[#f59e0b]/5 rounded-xl p-5 flex flex-col items-center justify-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center">
                    <Clock size={24} className="text-[#f59e0b] animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-black text-[#f59e0b] uppercase tracking-widest">Đang chờ kiểm duyệt thủ công</p>
                    <p className="text-[10px] text-zinc-400 max-w-xs leading-relaxed">
                      {pendingMessage || 'Ảnh của bạn đang trong hàng đợi kiểm duyệt của Admin. Kết quả sẽ tự động hiển thị tại đây khi sẵn sàng.'}
                    </p>
                  </div>
                  {/* Pulse indicator — socket đang kết nối lắng nghe */}
                  <div className="flex items-center gap-2 text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f59e0b] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f59e0b]" />
                    </span>
                    WebSocket đang lắng nghe realtime...
                  </div>
                  <p className="text-[9px] text-zinc-600 font-mono">ID phân tích: #{pendingAnalysisId}</p>
                </div>
              )}

              {/* ── Trạng thái rỗng: chưa có gì ──────────────────────────────── */}
              {!isBanned && !result && !errorMsg && !pendingAnalysisId && (
                <div className="w-full flex-1 min-h-[250px] border border-[#222226]/40 bg-[#0f0f11]/30 rounded-xl flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <FileText size={32} className="text-zinc-700" />
                  <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">Kịch bản chi tiết dạng Markdown bóc tách từ hình ảnh sản phẩm sẽ xuất hiện tại khu vực này.</p>
                </div>
              )}

              {/* ── Trạng thái lỗi ──────────────────────────────────────────── */}
              {!isBanned && errorMsg && !result && (
                <div className="w-full flex-1 min-h-[250px] border border-red-950/50 bg-red-950/10 rounded-xl p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-red-500">
                     <AlertCircle size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Lỗi xử lý</span>
                  </div>
                  <div className="text-[11px] font-mono text-red-400 bg-black/40 border border-red-900/40 rounded-xl p-3.5 max-h-48 overflow-y-auto select-text whitespace-pre-wrap">
                    {errorMsg}
                  </div>
                  <button type="button" onClick={handleAnalyze} className="w-full py-2 bg-red-950/30 hover:bg-red-900/40 border border-red-900/30 text-red-350 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                    <RefreshCw size={12} />
                    Gửi lại yêu cầu phân tích
                  </button>
                </div>
              )}

              {/* ── Trạng thái thành công: hiển thị kết quả ─────────────────── */}
              {!isBanned && result && (
                <div className="w-full flex-grow flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3 text-[10px] bg-[#0f0f11] border border-[#222226]/40 p-3 rounded-xl text-zinc-400">
                    <div>Tokens đầu vào: <span style={{ padding: '8px' }} className="text-zinc-200 font-bold">{result.input_tokens || 'N/A'}</span></div>
                    <div>Tokens xuất ra: <span style={{ padding: '8px' }} className="text-zinc-200 font-bold">{result.output_tokens || 'N/A'}</span></div>
                  </div>

                  <div className="w-full max-h-[350px] overflow-y-auto bg-[#0f0f11] border border-[#222226] p-5 rounded-xl text-xs font-medium text-zinc-300 leading-relaxed select-text space-y-3 shadow-inner custom-scrollbar">
                    <div className="flex items-center gap-1.5 text-green-500 mb-2 border-b border-[#222226]/40 pb-2">
                      <CheckCircle size={14} />
                      <span className="text-[10px] font-black uppercase tracking-wider">Kịch bản chi tiết (Markdown)</span>
                    </div>
                    <div className="whitespace-pre-wrap text-[11px] text-zinc-300 select-text">
                      {result?.prompt_output}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (result?.prompt_output) {
                        navigator.clipboard.writeText(result.prompt_output)
                          .then(() => {
                            if (toast?.success) {
                              toast.success('Đã sao chép kịch bản thuần! Dán vào CapCut hoặc Facebook thôi bác ơi!');
                            }
                          })
                          .catch(() => {
                            if (toast?.error) {
                              toast.error('Không thể sao chép. Vui lòng sao chép thủ công!');
                            }
                          });
                      }
                    }}
                    className="w-full py-2.5 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    style={{ padding: '8px' }}
                  >
                    Sao chép kịch bản văn bản
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Scroll-to-top button — z-[9999] đảm bảo hiển thị trên mọi overlay */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`!fixed !bottom-6 !right-6 !z-[9999] !block bg-amber-500 text-black p-3 rounded-full shadow-lg hover:bg-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-all duration-200 ${
          showScrollTop ? '!h-11 !w-11 opacity-100' : '!h-0 !w-0 opacity-0 pointer-events-none overflow-hidden'
        }`}
        title="Cuộn về đầu trang"
      >
        ▲
      </button>
    </div>
  );
}