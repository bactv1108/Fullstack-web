import React, { useEffect, useState } from 'react';
import axiosAdminClient from '../../services/axiosAdminClient';
import { Search, Eye, AlertCircle, FileText, Calendar, Shield, Cpu, RefreshCw, X } from 'lucide-react';

const ImageAnalysesTable = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  const fetchAnalyses = async () => {
    setLoading(true);
    try {
      const data = await axiosAdminClient.get('/image-analyses');
      setAnalyses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[MAT THAN ADMIN] Failed to fetch image analyses history:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const filteredAnalyses = analyses.filter(item => 
    (item.image_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.owner?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.owner?.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Thành công
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Đang quét
          </span>
        );
    }
  };

  return (
    <div className="admin-card p-0 overflow-hidden flex flex-col h-full bg-[#18181b]/50 border border-admin-border/60 rounded-xl relative">
      
      {/* Table Header Controls */}
      <div className="p-6 border-b border-admin-border flex justify-between items-center bg-[#131317]/40">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Nhật Ký Quét "Mắt Thần AI"</h2>
          <button 
            onClick={fetchAnalyses}
            disabled={loading}
            className="p-1.5 hover:bg-admin-card text-admin-text-muted hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-text-muted" />
          <input 
            type="text" 
            placeholder="Tìm theo tên ảnh, người dùng..." 
            className="admin-input pl-10 py-1.5 text-sm w-80 bg-[#0f0f13] border border-admin-border focus:border-admin-primary outline-none text-white rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {/* Table Body */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-admin-text-muted border-collapse">
          <thead className="text-xs uppercase bg-[#111115]/80 border-b border-admin-border sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Người thực hiện</th>
              <th className="px-6 py-4">Tên ảnh</th>
              <th className="px-6 py-4">Kích thước</th>
              <th className="px-6 py-4">Trạng thái</th>
              <th className="px-6 py-4">Tokens (In/Out)</th>
              <th className="px-6 py-4">Thời gian</th>
              <th className="px-6 py-4 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {filteredAnalyses.map(item => (
              <tr key={item.id} className="border-b border-admin-border hover:bg-admin-card/20 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">#{item.id}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-white text-xs">{item.owner?.name || 'Hệ thống'}</span>
                    <span className="text-[10px] text-zinc-500">{item.owner?.email || 'admin@aistudio.vn'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-medium text-admin-text max-w-xs truncate">{item.image_name}</td>
                <td className="px-6 py-4 font-mono text-xs">{formatBytes(item.file_size)}</td>
                <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                <td className="px-6 py-4 font-mono text-xs text-admin-primary">
                  {item.status === 'success' ? (
                    <span>{item.input_tokens || 0} / {item.output_tokens || 0}</span>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 text-xs font-mono">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '-'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => setSelectedAnalysis(item)}
                    className="p-1.5 hover:bg-admin-card text-admin-text-muted hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center inline-block"
                    title="Xem chi tiết"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
            
            {filteredAnalyses.length === 0 && !loading && (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-zinc-500">
                  Không tìm thấy nhật ký phân tích nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Dialog Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#18181c] border border-admin-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative text-left flex flex-col gap-4 text-admin-text">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-admin-border/50">
              <div className="flex items-center gap-2">
                <Shield className="text-[#f59e0b]" size={18} />
                <h3 className="text-sm font-black uppercase text-white tracking-wider">
                  Chi Tiết Tác Vụ Mắt Thần #{selectedAnalysis.id}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAnalysis(null)}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-admin-card transition-all cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-4 text-[11px] bg-zinc-950/40 p-4 border border-admin-border rounded-xl">
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold">Người gửi:</span>
                <span className="text-white">{selectedAnalysis.owner?.name || 'System Admin'} ({selectedAnalysis.owner?.email || 'admin@system.com'})</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold">Tên tệp tin:</span>
                <span className="text-white truncate">{selectedAnalysis.image_name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold">Thời gian:</span>
                <span className="text-white">{new Date(selectedAnalysis.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 font-bold">Dung lượng & Định dạng:</span>
                <span className="text-white">{formatBytes(selectedAnalysis.file_size)} | {selectedAnalysis.mime_type}</span>
              </div>
            </div>

            {/* Status Section */}
            <div className="flex items-center justify-between bg-zinc-950/20 p-3.5 border border-admin-border rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500">Trạng thái:</span>
                {getStatusBadge(selectedAnalysis.status)}
              </div>
              
              {selectedAnalysis.status === 'success' && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-zinc-400">
                    <Cpu size={14} />
                    <span>Tokens: {selectedAnalysis.input_tokens || 0} input / {selectedAnalysis.output_tokens || 0} output</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Output / Error Messages */}
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-xs font-bold text-zinc-500">Nội dung kết quả / Thông báo lỗi:</span>
              
              {selectedAnalysis.status === 'failed' ? (
                <div className="bg-red-950/10 border border-red-900/30 text-red-400 rounded-xl p-4 text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto select-text">
                  <div className="flex items-center gap-1.5 text-red-500 mb-2 font-bold">
                    <AlertCircle size={14} />
                    <span>LỖI CHI TIẾT</span>
                  </div>
                  {selectedAnalysis.error_message}
                </div>
              ) : selectedAnalysis.status === 'success' ? (
                <div className="bg-zinc-950 border border-admin-border rounded-xl p-4 text-[11px] text-zinc-300 leading-relaxed font-semibold max-h-56 overflow-y-auto select-text whitespace-pre-wrap">
                  <div className="flex items-center gap-1.5 text-green-500 mb-2 font-bold border-b border-admin-border pb-1">
                    <FileText size={14} />
                    <span>KỊCH BẢN PHÂN TÍCH</span>
                  </div>
                  {selectedAnalysis.prompt_output}
                </div>
              ) : (
                <div className="bg-amber-950/10 border border-amber-900/30 text-amber-500 rounded-xl p-4 text-[11px] text-center font-bold">
                  Hình ảnh đang được AI phân tích xử lý ngầm. Vui lòng quay lại sau!
                </div>
              )}
            </div>

            {/* Footer Control */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedAnalysis(null)}
                className="px-5 py-2.5 bg-admin-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none shadow-md"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageAnalysesTable;
