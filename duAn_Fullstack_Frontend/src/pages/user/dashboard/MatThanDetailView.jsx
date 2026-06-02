import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Image as ImageIcon, FileText, CheckCircle } from 'lucide-react';
import { userService } from '../../../services/user.service';

const getFullImageUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  let baseUrl = 'http://localhost:3000';
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    baseUrl = envUrl.replace(/\/api\/?$/, '');
  }
  return `${baseUrl}${path}`;
};

export default function MatThanDetailView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    userService.getAnalysisDetail(id)
      .then(res => {
        if (res && res.success && res.data) {
          setAnalysis(res.data);
        } else {
          setError('Không tìm thấy bản ghi phân tích ảnh này.');
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('[DETAIL GET FAILED]', err);
        setError(err.response?.data?.message || err.message || 'Lỗi hệ thống khi tải chi tiết.');
        setLoading(false);
      });
  }, [id]);

  const handleCopy = () => {
    if (!analysis || !analysis.prompt_output) return;
    navigator.clipboard.writeText(analysis.prompt_output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#0f0f13] flex items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#f59e0b]"></div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#f59e0b]">Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen w-full bg-[#0f0f13] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#18181c] border border-red-900/30 rounded-2xl p-6 text-center shadow-2xl">
          <p className="text-red-400 font-bold text-sm mb-4">⚠️ {error || 'Không tìm thấy dữ liệu.'}</p>
          <button 
            onClick={() => navigate(-1)} 
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer border-none"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className=" !min-h-[calc(100vh-65px)] w-full py-8 px-4 sm:px-6 lg:px-8 bg-[#0f0f13] flex flex-col items-center overflow-y-auto text-left">
      <div className="w-full max-w-6xl flex flex-col gap-6 animate-fade-in">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#18181b]/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2.5 bg-[#0f0f11] hover:bg-zinc-850 border border-[#222226] text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title="Quay lại Lịch sử"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className=" text-xl font-black text-white uppercase tracking-widest">
                CHI TIẾT KỊCH BẢN MẮT THẦN AI (MÃ SỐ #{analysis.id})
              </h2>
              <p className="text-[10px] text-zinc-500 font-medium mt-1">
                Tạo lúc: {new Date(analysis.createdAt || analysis.created_at).toLocaleString('vi-VN')}
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-950/30 border border-green-500/20 text-green-400 rounded-full text-[10px] font-black uppercase tracking-wider">
            Thành công
          </span>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Product Image (1/3) */}
          <div className=" lg:col-span-1 flex flex-col gap-4 bg-[#18181b]/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-md h-fit">
            <div className="!p-3 flex items-center gap-2 border-b border-zinc-900 pb-3">
              <div className="p-1.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg">
                <ImageIcon size={14} />
              </div>
              <h3 className=" text-xs font-black text-zinc-200 uppercase tracking-wider">
                Hình ảnh sản phẩm gốc
              </h3>
            </div>
            
            <div className="w-full aspect-square bg-[#0f0f11] border border-[#222226] rounded-xl overflow-hidden flex items-center justify-center relative shadow-inner">
              <img 
                src={getFullImageUrl(analysis.image_path || analysis.image_url)} 
                alt={analysis.image_name || "Product"} 
                className="max-h-full max-w-full object-contain p-2 hover:scale-[1.02] transition-transform duration-350"
              />
            </div>
            
            <div className="!p-3 flex flex-col gap-2 text-[10px] text-zinc-500 bg-[#0f0f11] p-3.5 border border-[#222226] rounded-xl font-medium">
              <p className="flex justify-between">
                <span>Tên tệp:</span>
                <strong className="text-zinc-300 font-bold truncate max-w-[150px]">{analysis.image_name}</strong>
              </p>
              <p className="flex justify-between">
                <span>Kích thước:</span>
                <strong className="text-zinc-300 font-bold">{(analysis.file_size / 1024).toFixed(1)} KB</strong>
              </p>
              <p className="flex justify-between">
                <span>Định dạng:</span>
                <strong className="text-zinc-300 font-bold">{analysis.mime_type}</strong>
              </p>
            </div>
          </div>

          {/* Right Column: Scenario Content (2/3) */}
          <div className="!p-4 lg:col-span-2 flex flex-col gap-4 bg-[#18181b]/60 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#f59e0b]/10 text-[#f59e0b] rounded-lg">
                  <FileText size={14} />
                </div>
                <h3 className="text-xs font-black text-zinc-200 uppercase tracking-wider">
                  Nội dung kịch bản & Prompt AI
                </h3>
              </div>
              
              <button 
                type="button"
                onClick={handleCopy}
                className="py-1.5 px-3 bg-[#0f0f11] hover:bg-zinc-800 border border-[#222226] hover:border-zinc-700 text-zinc-300 hover:text-white rounded-lg flex items-center gap-1.5 transition-all text-[10px] font-black cursor-pointer uppercase tracking-wider"
              >
                {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép nhanh'}</span>
              </button>
            </div>

            {/* Markdown Prompt Output box */}
            <div className="w-full bg-[#0f0f11] border border-[#222226] p-5 rounded-xl text-xs font-semibold text-zinc-300 leading-relaxed whitespace-pre-wrap select-text shadow-inner overflow-y-auto max-h-[500px]">
              {analysis.prompt_output}
            </div>

            <div className="mt-2">
              <button 
                type="button" 
                onClick={handleCopy} 
                className="!p-3 w-full py-3 bg-[#f59e0b] hover:bg-amber-600 text-black font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer border-none uppercase tracking-wider shadow-lg shadow-amber-500/10 active:scale-[0.99]"
              >
                <Copy size={14} />
                <span>Sao chép toàn bộ kịch bản</span>
              </button>
            </div>
          </div>

        </div>

        {/* Mini Copy Toast Safeguard notification */}
        {copied && (
          <div className="!p-3 fixed bottom-6 right-6 z-50 bg-[#18181c] border border-green-500/30 text-green-400 font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fade-in">
            <CheckCircle size={14} />
            <span>Sao chép kịch bản vào clipboard thành công!</span>
          </div>
        )}

      </div>
    </div>
  );
}
