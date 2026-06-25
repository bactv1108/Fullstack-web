import React, { useEffect, useState, useCallback } from 'react';
import io from 'socket.io-client';
import axiosAdminClient from '../../services/axiosAdminClient';
import { Search, Eye, AlertCircle, FileText, Calendar, Shield, Cpu, RefreshCw, X } from 'lucide-react';

const ImageAnalysesTable = () => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [socket, setSocket] = useState(null);

  // ── Status filter & Pagination state ──
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10; // KHÓA CỨNG 10 dòng/trang

  // ── Tab badge counts (from backend) ──
  const [counts, setCounts] = useState({ all: 0, success: 0, failed: 0 });

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await axiosAdminClient.get(
        `/image-analyses?page=${currentPage}&limit=${limit}&status=${statusFilter}`
      );
      // Backend trả về { rows, totalPages, counts: { all, success, failed }, countAll, countSuccess, countFailed }
      if (data && typeof data === 'object' && Array.isArray(data.rows)) {
        setAnalyses(data.rows);
        setTotalPages(data.totalPages || 1);
        // Ưu tiên 1: data.counts object — Ưu tiên 2: flat fields — Ưu tiên 3: totalItems
        const c = data.counts;
        setCounts({
          all:     c?.all     ?? data.countAll     ?? data.totalItems ?? 0,
          success: c?.success ?? data.countSuccess  ?? 0,
          failed:  c?.failed  ?? data.countFailed   ?? 0,
        });
      } else {
        // Fallback nếu backend trả mảng thuần (legacy)
        const arr = Array.isArray(data) ? data : [];
        setAnalyses(arr);
        setTotalPages(1);
        setCounts({
          all: arr.length,
          success: arr.filter(i => i.status === 'success').length,
          failed: arr.filter(i => i.status === 'failed').length,
        });
      }
    } catch (err) {
      console.error('[MAT THAN ADMIN] Failed to fetch image analyses history:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  // Re-fetch khi page hoặc filter thay đổi
  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  // Set up Socket.io connection for real-time updates
  // Empty deps [] so socket is created ONCE — no reconnect on modal open/close
  useEffect(() => {
    // Connect to backend Socket.io server
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 
      (import.meta.env.VITE_API_URL 
        ? import.meta.env.VITE_API_URL.replace(/\/admin\/?$/, '').replace(/\/api\/?$/, '') 
        : null) || 
      'http://localhost:3000';
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity
    });

    // Listen for image analysis updates
    socketInstance.on('image_analysis:updated', (updatedData) => {
      console.log('[SOCKET.IO] Received image_analysis:updated:', updatedData);
      
      // Update the state: replace existing record OR prepend if new
      setAnalyses(prevAnalyses => {
        const exists = prevAnalyses.some(item => item.id === updatedData.id);
        if (exists) {
          return prevAnalyses.map(item => 
            item.id === updatedData.id ? updatedData : item
          );
        } else {
          // New record arrived before table refreshed — prepend it
          return [updatedData, ...prevAnalyses];
        }
      });

      // If the updated record is currently selected, update the modal
      // Use functional setter to avoid stale closure on selectedAnalysis
      setSelectedAnalysis(prev => {
        if (prev && prev.id === updatedData.id) return updatedData;
        return prev;
      });

      // Log the update for debugging
      console.log(`[ADMIN] Analysis ID ${updatedData.id} status updated to: ${updatedData.status}`);
    });

    // Clean up connection on unmount
    socketInstance.on('disconnect', () => {
      console.log('[SOCKET.IO] Disconnected from server');
    });

    socketInstance.on('connect', () => {
      console.log('[SOCKET.IO] Connected to server');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []); // ← Empty deps: socket created ONCE, no reconnect on every modal open

  // ── Lắng nghe sự kiện UPDATE_MAT_THAN_JOB ──
  useEffect(() => {
    if (!socket) return;

    const handleUpdateMatThanJob = (data) => {
      console.log('[SOCKET.IO] Nhận được tín hiệu UPDATE_MAT_THAN_JOB:', data);
      fetchAnalyses();
    };

    socket.on('UPDATE_MAT_THAN_JOB', handleUpdateMatThanJob);

    return () => {
      socket.off('UPDATE_MAT_THAN_JOB', handleUpdateMatThanJob);
    };
  }, [socket, fetchAnalyses]);

  // Client-side search filter (trên dữ liệu đã phân trang từ server)
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

  // ── Tab click handler ──
  const handleTabClick = (filter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  return (
    <div className="admin-card p-0 overflow-hidden flex flex-col h-full bg-white dark:bg-[#18181b]/50 border border-slate-200 dark:border-admin-border/60 rounded-xl relative">
      
      {/* Table Header Controls */}
      <div className="p-6 border-b border-slate-200 dark:border-admin-border flex justify-between items-center bg-slate-50/80 dark:bg-[#131317]/40">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Nhật Ký Quét "Mắt Thần AI"</h2>
          <button 
            onClick={fetchAnalyses}
            disabled={loading}
            className="p-1.5 hover:bg-admin-card text-admin-text-muted hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Tìm theo người dùng,ảnh..."
            className="admin-input pl-10 pr-9 py-1.5 text-sm w-80 bg-white dark:bg-[#0f0f13] border border-slate-200 dark:border-admin-border rounded-lg text-slate-900 dark:text-white outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 text-admin-text-muted hover:text-white transition-all cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar — Đồng bộ 100% cấu trúc UserTable ─────────────── */}
      <div className="px-6 pt-4 pb-0 flex items-center gap-2 border-b border-admin-border bg-slate-50/60 dark:bg-[#111115]/60">

        {/* Tab: Tất cả */}
        <button
          onClick={() => handleTabClick('all')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            statusFilter === 'all'
              ? 'border-admin-primary text-white bg-admin-primary/10'
              : 'border-transparent text-admin-text-muted hover:text-admin-text hover:bg-admin-card/40'
          }`}
        >
          Tất cả
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'all' ? 'bg-admin-primary/20 text-admin-primary' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {counts.all}
          </span>
        </button>

        {/* Tab: Thành công */}
        <button
          onClick={() => handleTabClick('success')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            statusFilter === 'success'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              : 'border-transparent text-admin-text-muted hover:text-emerald-400 hover:bg-emerald-500/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          Thành công
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {counts.success}
          </span>
        </button>

        {/* Tab: Thất bại */}
        <button
          onClick={() => handleTabClick('failed')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            statusFilter === 'failed'
              ? 'border-rose-500 text-rose-400 bg-rose-500/10'
              : 'border-transparent text-admin-text-muted hover:text-rose-400 hover:bg-rose-500/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          Thất bại
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusFilter === 'failed' ? 'bg-rose-500/20 text-rose-400' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {counts.failed}
          </span>
        </button>

      </div>
      
      {/* Table Body */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-admin-text-muted border-collapse">
          <thead className="text-xs uppercase bg-gray-50/80 dark:bg-[#111115]/80 border-b border-slate-200 dark:border-admin-border sticky top-0 z-10">
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
            {filteredAnalyses.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="text-3xl">
                      {statusFilter === 'success' ? '🟢' : statusFilter === 'failed' ? '🔴' : '🔍'}
                    </span>
                    <p className="text-sm text-admin-text-muted font-semibold">
                      {statusFilter === 'success' ? 'Không có bản ghi thành công nào.' :
                       statusFilter === 'failed' ? 'Không có bản ghi thất bại nào.' :
                       'Không tìm thấy nhật ký phân tích nào.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredAnalyses.map(item => (
              <tr key={item.id} className="border-b border-admin-border hover:bg-admin-bg/30 transition-colors">
                <td className="px-6 py-4 font-mono text-xs">#{item.id}</td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-900 dark:text-white text-xs">{item.owner?.name || 'Hệ thống'}</span>
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
          </tbody>
        </table>
      </div>

      {/* ── Thanh Phân Trang — Đồng bộ 100% cấu trúc UserTable ────── */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 w-full px-6 pb-6 bg-slate-100 dark:bg-[#0e0e11] rounded-b-lg">
        {/* Phía bên trái (Thông tin trang) */}
        <div className="text-gray-400 dark:text-gray-500 text-xs">
          Trang {currentPage} trên {totalPages} (Hiển thị {analyses.length} dòng)
        </div>

        {/* Phía bên phải (Hệ thống nút bấm) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className={`px-3 py-1.5 text-xs rounded transition-colors font-medium cursor-pointer ${
              currentPage === 1
                ? 'bg-gray-200/40 dark:bg-[#1a1a24]/40 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-gray-200 dark:bg-[#1a1a24] hover:bg-gray-300 dark:hover:bg-[#2b2b36] text-gray-700 dark:text-white'
            }`}
          >
            &lt; Trước
          </button>

          {/* Render các nút số trang */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setCurrentPage(pageNum)}
              className={`px-2.5 py-1 text-xs rounded transition-colors font-medium cursor-pointer ${
                currentPage === pageNum
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-gray-200 dark:bg-[#1a1a24] hover:bg-gray-300 dark:hover:bg-[#2b2b36] text-gray-500 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className={`px-3 py-1.5 text-xs rounded transition-colors font-medium cursor-pointer ${
              (currentPage === totalPages || totalPages === 0)
                ? 'bg-gray-200/40 dark:bg-[#1a1a24]/40 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-gray-200 dark:bg-[#1a1a24] hover:bg-gray-300 dark:hover:bg-[#2b2b36] text-gray-700 dark:text-white'
            }`}
          >
            Sau &gt;
          </button>
        </div>
      </div>

      {/* Detail Dialog Modal */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18181c] border border-slate-200 dark:border-admin-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative text-left flex flex-col gap-4 text-slate-900 dark:text-admin-text">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-admin-border/50">
              <div className="flex items-center gap-2">
                <Shield className="text-amber-500" size={18} />
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  Chi Tiết Tác Vụ Mắt Thần #{selectedAnalysis.id}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedAnalysis(null)}
                className="text-zinc-500 hover:text-slate-900 dark:hover:text-white p-1 rounded dark:hover:bg-admin-card transition-all cursor-pointer border-none bg-transparent"
              >
                <X size={16} />
              </button>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-2 gap-4 text-[11px] bg-gray-50 dark:bg-zinc-950/40 p-4 border border-slate-200 dark:border-admin-border rounded-xl">
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400 font-bold">Người gửi:</span>
                <span className="text-slate-900 dark:text-white">{selectedAnalysis.owner?.name || 'System Admin'} ({selectedAnalysis.owner?.email || 'admin@system.com'})</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400 font-bold">Tên tệp tin:</span>
                <span className="text-slate-900 dark:text-white truncate">{selectedAnalysis.image_name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400 font-bold">Thời gian:</span>
                <span className="text-slate-900 dark:text-white">{new Date(selectedAnalysis.createdAt).toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-zinc-500 dark:text-zinc-400 font-bold">Dung lượng & Định dạng:</span>
                <span className="text-slate-900 dark:text-white">{formatBytes(selectedAnalysis.file_size)} | {selectedAnalysis.mime_type}</span>
              </div>
            </div>

            {/* Status Section */}
            <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-950/20 p-3.5 border border-slate-200 dark:border-admin-border rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Trạng thái:</span>
                {getStatusBadge(selectedAnalysis.status)}
              </div>
              
              {selectedAnalysis.status === 'success' && (
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
                    <Cpu size={14} />
                    <span>Tokens: {selectedAnalysis.input_tokens || 0} input / {selectedAnalysis.output_tokens || 0} output</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prompt Output / Error Messages */}
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Nội dung kết quả / Thông báo lỗi:</span>
              
              {selectedAnalysis.status === 'failed' ? (
                <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl p-4 text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto select-text">
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2 font-bold">
                    <AlertCircle size={14} />
                    <span>LỖI CHI TIẾT</span>
                  </div>
                  {selectedAnalysis.error_message}
                </div>
              ) : selectedAnalysis.status === 'success' ? (
                <div className="bg-gray-50 dark:bg-zinc-950 border border-slate-200 dark:border-admin-border rounded-xl p-4 text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed font-semibold max-h-56 overflow-y-auto select-text whitespace-pre-wrap">
                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 mb-2 font-bold border-b border-slate-200 dark:border-admin-border pb-1">
                    <FileText size={14} />
                    <span>KỊCH BẢN PHÂN TÍCH</span>
                  </div>
                  {selectedAnalysis.prompt_output}
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-500 rounded-xl p-4 text-[11px] text-center font-bold">
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
