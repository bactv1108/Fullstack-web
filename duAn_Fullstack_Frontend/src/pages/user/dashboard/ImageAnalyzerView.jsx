import React, { useState } from 'react';
import { Eye, Sparkles, Upload, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

export default function ImageAnalyzerView({ toast }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      if (toast?.error) {
        toast.error("Kích thước ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.");
      } else {
        alert("Kích thước ảnh vượt quá 5MB.");
      }
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      if (toast?.error) {
        toast.error("Chỉ chấp nhận các tập tin định dạng hình ảnh!");
      }
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (toast?.error) {
        toast.error("Kích thước ảnh vượt quá 5MB.");
      }
      return;
    }

    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setResult(null);
    setErrorMsg(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      if (toast?.error) {
        toast.error("Vui lòng tải lên hình ảnh sản phẩm trước!");
      }
      return;
    }

    setAnalyzing(true);
    setErrorMsg(null);
    setResult(null);

    const formData = new FormData();
    formData.append('productImage', selectedFile);

    try {
      if (toast?.info) {
        toast.info("📥 Đang tải ảnh lên và phân tích qua Gemini AI...");
      }

      const res = await axiosClient.post('/image-analyzer/analyze-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.success || res.data) {
        const data = res.data || res;
        setResult(data);
        if (toast?.success) {
          toast.success("🎉 Phân tích sản phẩm thành công!");
        }
      } else {
        throw new Error("Không nhận được phản hồi thành công.");
      }
    } catch (err) {
      console.error("[IMAGE ANALYZER VIEW ERROR]", err);
      const errMsg = err.response?.data?.error || err.message || "Lỗi không xác định khi gọi API.";
      setErrorMsg(errMsg);
      if (toast?.error) {
        toast.error("❌ Phân tích hình ảnh thất bại!");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const resetAnalyzer = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setResult(null);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#131316] text-[#e2e8f0] p-4 md:p-6 lg:p-8 flex flex-col gap-6 md:gap-8 overflow-y-auto w-full text-left relative animate-fade-in select-none">
      
      {/* Outer Card block wrapper */}
      <div className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-6 w-full text-left shadow-2xl backdrop-blur-md relative">
        
        {/* Header section info */}
        <div className="flex flex-col gap-1.5 border-b border-[#222226]/60 pb-4 text-left">
          <div className="flex items-center gap-2.5">
            <Eye size={22} className="text-[#f59e0b]" />
            <h2 className="text-xl font-black text-white uppercase tracking-widest">Mắt Thần AI (Phân Tích Sản Phẩm)</h2>
          </div>
          <p className="text-xs text-zinc-400">Tải lên hình ảnh sản phẩm của bạn để AI tự động bóc tách chất liệu, phom dáng và dựng kịch bản quảng cáo 4K 9:16 đỉnh cao.</p>
        </div>

        {/* Content Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          
          {/* Cấu hình / Upload ảnh */}
          <div className="flex flex-col gap-5 text-left w-full">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">1. Hình ảnh sản phẩm</h3>
            
            {/* Dropzone container */}
            {!imagePreview ? (
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('productImageInput').click()}
                className="w-full aspect-video border-2 border-dashed border-[#222226] hover:border-[#f59e0b] rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer bg-[#0f0f11] hover:bg-[#f59e0b]/5 transition-all group"
              >
                <input 
                  type="file" 
                  id="productImageInput" 
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 bg-[#18181c] border border-[#222226]/40 group-hover:bg-[#f59e0b]/10 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-[#f59e0b] transition-all">
                  <Upload size={20} />
                </div>
                <div className="text-center px-4">
                  <p className="text-xs font-bold text-zinc-300">Kéo thả hình ảnh vào đây hoặc nhấp để chọn file</p>
                  <p className="text-[10px] text-zinc-500 mt-1">Hỗ trợ các định dạng PNG, JPG, JPEG, WEBP (Tối đa 5MB)</p>
                </div>
              </div>
            ) : (
              <div className="w-full flex flex-col gap-3">
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-[#222226] bg-[#0f0f11] relative flex items-center justify-center">
                  <img src={imagePreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                  
                  {analyzing && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#f59e0b] border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[#f59e0b] text-[10px] font-bold tracking-widest uppercase">Đang quét ảnh & sinh kịch bản...</p>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={resetAnalyzer}
                    disabled={analyzing}
                    className="flex-1 py-2.5 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226]/60 rounded-xl text-xs font-bold text-zinc-350 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Chọn ảnh khác
                  </button>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="flex-1 py-2.5 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 border-none"
                  >
                    <Sparkles size={14} className="text-black animate-pulse" />
                    {analyzing ? "Đang phân tích..." : "Bắt đầu phân tích"}
                  </button>
                </div>
              </div>
            )}

            {/* AI Criteria list inside standard inner card style */}
            <div className="bg-[#0f0f11] border border-[#222226]/40 rounded-xl p-4 flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase text-[#f59e0b] tracking-widest">Tiêu chí phân tích:</span>
              <ul className="text-[11px] text-zinc-400 leading-relaxed list-disc list-inside space-y-1">
                <li>Định hình Vibe chủ đạo: <strong className="text-zinc-200">clean - lifestyle</strong>, tinh tế, nam tính nhẹ nhàng.</li>
                <li>Mô tả góc quay: Dựng phân cảnh cinematic 4K, khung hình dọc 9:16.</li>
                <li>Bóc tách chất liệu sản phẩm (loại vải, độ bo tay, đường khâu, cổ áo).</li>
                <li>Đề xuất hiệu ứng camera (Zoom chậm, Focus bắt nét, quay xoay tròn 360 độ).</li>
              </ul>
            </div>
          </div>

          {/* Kết quả phân tích */}
          <div className="flex flex-col gap-5 text-left w-full h-full min-h-[300px]">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">2. Kết quả phân tích (Kịch bản AI)</h3>
            
            {!result && !errorMsg ? (
              <div className="w-full flex-1 min-h-[250px] border border-[#222226]/40 bg-[#0f0f11]/30 rounded-xl flex flex-col items-center justify-center gap-2 p-6 text-center">
                <FileText size={32} className="text-zinc-700" />
                <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">Sau khi bạn tải ảnh lên và nhấn nút bắt đầu phân tích, kịch bản dựng cảnh chi tiết dạng Markdown sẽ xuất hiện tại đây.</p>
              </div>
            ) : errorMsg ? (
              <div className="w-full flex-1 min-h-[250px] border border-red-950/50 bg-red-950/10 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertCircle size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Lỗi hệ thống</span>
                </div>
                <div className="text-[11px] font-mono text-red-400 bg-black/40 border border-red-900/40 rounded-xl p-3.5 max-h-48 overflow-y-auto select-text whitespace-pre-wrap">
                  {errorMsg}
                </div>
                <button 
                  onClick={handleAnalyze}
                  className="w-full py-2 bg-red-950/30 hover:bg-red-955/50 border border-red-900/30 text-red-350 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw size={12} />
                  Thử lại phân tích
                </button>
              </div>
            ) : (
              <div className="w-full flex-grow flex flex-col gap-4">
                
                {/* Panel Info (Tokens count) */}
                {(result?.input_tokens || result?.output_tokens) && (
                  <div className="grid grid-cols-2 gap-3 text-[10px] bg-[#0f0f11] border border-[#222226]/40 p-3 rounded-xl text-zinc-400">
                    <div>Tokens đầu vào: <span className="text-zinc-200 font-bold">{result.input_tokens || 0}</span></div>
                    <div>Tokens đầu ra: <span className="text-zinc-200 font-bold">{result.output_tokens || 0}</span></div>
                  </div>
                )}

                {/* Kết quả Prompt Văn bản */}
                <div className="w-full max-h-[350px] overflow-y-auto bg-[#0f0f11] border border-[#222226] p-5 rounded-xl text-xs font-medium text-zinc-300 leading-relaxed select-text space-y-3 shadow-inner custom-scrollbar">
                  <div className="flex items-center gap-1.5 text-green-500 mb-2 border-b border-[#222226]/40 pb-2">
                    <CheckCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-wider">Kịch bản chi tiết (Markdown)</span>
                  </div>
                  <div className="whitespace-pre-wrap text-[11px] text-zinc-300">
                    {result?.prompt_output}
                  </div>
                </div>
                
                {/* Nút copy kịch bản */}
                <button
                  type="button"
                  onClick={() => {
                    if (result?.prompt_output) {
                      navigator.clipboard.writeText(result.prompt_output);
                      toast?.success?.("Đã sao chép kịch bản vào bộ nhớ tạm!");
                    }
                  }}
                  className="w-full py-2.5 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  Sao chép kịch bản
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
