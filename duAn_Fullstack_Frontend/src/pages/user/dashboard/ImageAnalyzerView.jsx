import React, { useState, useEffect } from 'react';
import { Eye, Sparkles, Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

export default function ImageAnalyzerView({ toast }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const handleScroll = () => { setShowScrollTop(window.scrollY > 300); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB đồng bộ hoàn toàn với cấu hình Multer Backend

  // 🌟 TÍNH NĂNG VIP: Lắng nghe sự kiện Paste ảnh (Ctrl + V)
  useEffect(() => {
    const handlePasteEvent = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (file.size > MAX_FILE_SIZE) {
              toast?.error ? toast.error("Kích thước ảnh vượt quá 20MB.") : alert("Kích thước ảnh vượt quá 20MB.");
              return;
            }
            setSelectedFile(file);
            setImagePreview(URL.createObjectURL(file));
            setResult(null);
            setErrorMsg(null);
            if (toast?.success) toast.success("📋 Đã nạp hình ảnh sản phẩm từ bộ nhớ tạm!");
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePasteEvent);
    return () => window.removeEventListener('paste', handlePasteEvent);
  }, [toast]);

  const validateAndSetFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      if (toast?.error) {
        toast.error("Kích thước ảnh vượt quá 20MB. Vui lòng chọn tệp nhỏ hơn.");
      } else {
        alert("Kích thước ảnh vượt quá 20MB.");
      }
      return;
    }
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
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
      if (toast?.error) toast.error("Chỉ chấp nhận các tập tin định dạng hình ảnh!");
      return;
    }
    validateAndSetFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      if (toast?.error) toast.error("Vui lòng tải hoặc Ctrl+V hình ảnh sản phẩm trước!");
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append('productImage', selectedFile);

    try {
      if (toast?.info) toast.info("📥 Đang tải ảnh lên và phân tích qua Gemini AI...");

      const res = await axiosClient.post('/image-analyzer/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Hỗ trợ bóc tách linh hoạt dữ liệu trả về từ axiosClient wrapper
      const responseData = res.success ? res.data : (res.data || res);
      if (responseData && responseData.prompt_output) {
        setResult(responseData);
        if (toast?.success) toast.success("🎉 Phân tích sản phẩm thành công!");
      } else {
        throw new Error(res.message || "Không nhận được dữ liệu kịch bản hợp lệ.");
      }
    } catch (err) {
      console.error("[IMAGE ANALYZER VIEW ERROR]", err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || "Lỗi kết nối API Mắt Thần.";
      setErrorMsg(errMsg);
      if (toast?.error) toast.error("❌ Phân tích hình ảnh thất bại!");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="!w-full !min-h-[calc(100vh-65px)] !bg-[#09090b] text-white !py-8 !px-4 sm:!px-6 lg:!px-8 !block !clear-both">
      <div className="!max-w-7xl !mx-auto !w-full !flex !flex-col !gap-6 md:!gap-8 !items-stretch">
        
        {/* KHU VỰC TIÊU ĐỀ TRANG */}
        <div className="!flex !flex-col !gap-1 !w-full">
          <div className="flex items-center gap-3 border-b border-[#222226] pb-4 w-full">
            <div className="p-2 bg-[#f59e0b]/10 text-[#f59e0b] rounded-xl border border-[#f59e0b]/10">
              <Eye size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">Mắt Thần AI (Phân Tích Sản Phẩm)</h2>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Tải ảnh lên hoặc bấm Ctrl + V tại đây để tự động trích xuất cấu trúc kịch bản và prompt cinematic 4K 9:16 chuẩn lifestyle.</p>
            </div>
          </div>
        </div>

        <div className="!bg-[#111114] !border !border-[#222226] !rounded-2xl p-5 sm:p-6 md:p-8 !w-full !shadow-2xl flex flex-col gap-6 relative">

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
                      {analyzing && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-3 border-[#f59e0b] border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-[#f59e0b] text-[10px] font-bold tracking-widest uppercase animate-pulse">Đang quét ảnh & sinh kịch bản...</p>
                          </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button type="button" style={{padding:'8px'}} onClick={() => { setSelectedFile(null); setImagePreview(null); }} disabled={analyzing} className="flex-1 py-2.5 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226]/60 rounded-xl text-xs font-bold text-zinc-300 transition-all cursor-pointer disabled:opacity-40">
                        Chọn ảnh khác
                      </button>
                      <button type="button" onClick={handleAnalyze} disabled={analyzing} className="flex-1 py-2.5 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 border-none">
                        <Sparkles size={14} className="text-black" />
                        {analyzing ? "Đang phân tích..." : "BẮT ĐẦU PHÂN TÍCH NGAY - 20 CREDITS"}
                      </button>
                    </div>
                  </div>
              )}

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

              {!result && !errorMsg ? (
                  <div className="w-full flex-1 min-h-[250px] border border-[#222226]/40 bg-[#0f0f11]/30 rounded-xl flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <FileText size={32} className="text-zinc-700" />
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">Kịch bản chi tiết dạng Markdown bóc tách từ hình ảnh sản phẩm sẽ xuất hiện tại khu vực này.</p>
                  </div>
              ) : errorMsg ? (
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
              ) : (
                  <div className="w-full flex-grow flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-3 text-[10px] bg-[#0f0f11] border border-[#222226]/40 p-3 rounded-xl text-zinc-400">
                      <div>Tokens đầu vào: <span style={{padding:'8px'}} className="text-zinc-200 font-bold">{result.input_tokens || 'N/A'}</span></div>
                      <div>Tokens xuất ra: <span style={{padding:'8px'}} className="text-zinc-200 font-bold">{result.output_tokens || 'N/A'}</span></div>
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
                            navigator.clipboard.writeText(result.prompt_output);
                            toast?.success ? toast.success("Đã sao chép kịch bản thành công!") : alert("Đã sao chép!");
                          }
                        }}
                        className="w-full py-2.5 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                        style={{padding:'8px'}}>
                      Sao chép kịch bản văn bản
                    </button>
                  </div>
              )}
            </div>
          </div>

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