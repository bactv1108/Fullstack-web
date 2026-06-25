import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosAdminClient from '../../services/axiosAdminClient';
import { getSocket } from '../../services/socketService';
import { Search, Eye, AlertCircle, FileText, Calendar, Shield, Cpu, RefreshCw, X, Image as ImageIcon } from 'lucide-react';

const ImageManagement = () => {
  const [searchParams] = useSearchParams();
  const queryId = searchParams.get('search');

  // ── State Management ──
  const [imageJobs, setImageJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState(queryId || '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(queryId || '');
  const [selectedJob, setSelectedJob] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);

  // ── Filter configuration ──
  const [statusFilter, setStatusFilter] = useState('all');
  const limit = 10; // Khóa cứng 10 dòng/trang

  // ── Tab badge counts (from backend) ──
  const [tabCounts, setTabCounts] = useState({ 
    all: 0, 
    success: 0, 
    failed: 0, 
    processing: 0, 
    queueing: 0
  });

  // ── Debounce searchQuery -> debouncedSearchQuery ──
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery]);

  // Auto-fill queryId from URL
  useEffect(() => {
    if (queryId) {
      setSearchQuery(queryId);
      setDebouncedSearchQuery(queryId);
    }
  }, [queryId]);

  // ── Fetch Data Function ──
  const fetchImageJobsData = useCallback(async () => {
    setIsLoading(true);
    try {
      let statusParam = '';
      if (['all', 'success', 'failed', 'processing', 'queueing'].includes(statusFilter)) {
        statusParam = statusFilter;
      }

      const response = await axiosAdminClient.get(
        `/image-jobs?page=${currentPage}&limit=${limit}&status=${statusParam}&search=${encodeURIComponent(debouncedSearchQuery)}`
      );

      if (response && response.success && response.pagination && Array.isArray(response.data)) {
        setImageJobs(response.data);
        const p = response.pagination;
        setTotalPages(p.totalPages || 1);
        setTotalItems(p.totalItems || 0);
        
        const c = p.counts || {};
        setTabCounts({
          all:        c.all        ?? 0,
          success:    c.success    ?? 0,
          failed:     c.failed     ?? 0,
          processing: c.processing ?? 0,
          queueing:   c.queueing   ?? 0
        });
      } else {
        // Fallback in case of legacy payload format
        const arr = Array.isArray(response) ? response : [];
        setImageJobs(arr);
        setTotalPages(1);
        setTotalItems(arr.length);
        setTabCounts({
          all: arr.length,
          success: arr.filter(i => i.status === 'success').length,
          failed: arr.filter(i => i.status === 'failed').length,
          processing: arr.filter(i => i.status === 'processing').length,
          queueing: arr.filter(i => i.status === 'queueing').length
        });
      }
    } catch (err) {
      console.error('[IMAGE ADMIN] Failed to fetch image jobs history:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, debouncedSearchQuery]);

  // Re-fetch when page, status filter, or search changes
  useEffect(() => {
    fetchImageJobsData();
  }, [fetchImageJobsData]);

  // ── Socket.io: Real-time update listener ──
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleImageJobUpdate = (data) => {
      console.log('[SOCKET.IO] Received image job update, reloading data:', data);
      fetchImageJobsData();
    };

    socket.on('image_job:created', handleImageJobUpdate);
    socket.on('image_job:updated', handleImageJobUpdate);
    socket.on('UPDATE_IMAGE_JOB', handleImageJobUpdate);

    return () => {
      socket.off('image_job:created', handleImageJobUpdate);
      socket.off('image_job:updated', handleImageJobUpdate);
      socket.off('UPDATE_IMAGE_JOB', handleImageJobUpdate);
    };
  }, [fetchImageJobsData]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const pad = (num) => String(num).padStart(2, '0');
    
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
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
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <RefreshCw size={12} className="animate-spin text-amber-500" />
            Đang xử lý
          </span>
        );
      case 'queueing':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            Trong hàng đợi
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Không rõ
          </span>
        );
    }
  };

  const handleTabClick = (filter) => {
    setStatusFilter(filter);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-2 flex-shrink-0">QUẢN LÝ LỊCH SỬ ẢNH AI</h1>

      <div className="admin-card p-0 overflow-hidden flex flex-col h-full bg-white dark:bg-[#18181b]/50 border border-slate-200 dark:border-admin-border/60 rounded-xl relative">
        
        {/* Table Header Controls */}
        <div className="p-6 border-b border-slate-200 dark:border-admin-border flex justify-between items-center bg-slate-50/80 dark:bg-[#131317]/40">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Danh Sách Lịch Sử Ảnh AI</h2>
            <button 
              onClick={fetchImageJobsData}
              disabled={isLoading}
              className="p-1.5 hover:bg-admin-card text-admin-text-muted hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent"
              title="Tải lại dữ liệu"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Tìm theo người dùng, id ảnh"
              className="admin-input pl-10 pr-9 py-1.5 text-sm w-80 bg-white dark:bg-[#0f0f13] border border-slate-200 dark:border-admin-border rounded-lg text-slate-900 dark:text-white outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-admin-text-muted hover:text-white transition-all cursor-pointer p-0.5"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar Filters */}
        <div className="px-6 pt-4 pb-0 flex items-center gap-2 border-b border-admin-border bg-slate-50/60 dark:bg-[#111115]/60 overflow-x-auto select-none scrollbar-none">
          
          {/* Tab: Tất cả */}
          <button
            onClick={() => handleTabClick('all')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200 select-none border-b-2 ${
              statusFilter === 'all'
                ? 'border-admin-primary text-white bg-admin-primary/10'
                : 'border-transparent text-admin-text-muted hover:text-admin-text hover:bg-admin-card/40'
            }`}
          >
            Tất cả
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === 'all' ? 'bg-admin-primary/20 text-admin-primary' : 'bg-admin-card text-admin-text-muted'
            }`}>
              {tabCounts.all}
            </span>
          </button>

          {/* Tab: Thành công */}
          <button
            onClick={() => handleTabClick('success')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200 select-none border-b-2 ${
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
              {tabCounts.success}
            </span>
          </button>

          {/* Tab: Thất bại */}
          <button
            onClick={() => handleTabClick('failed')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200 select-none border-b-2 ${
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
              {tabCounts.failed}
            </span>
          </button>

          {/* Tab: Đang xử lý */}
          <button
            onClick={() => handleTabClick('processing')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200 select-none border-b-2 ${
              statusFilter === 'processing'
                ? 'border-amber-500 text-amber-400 bg-amber-500/10'
                : 'border-transparent text-admin-text-muted hover:text-amber-400 hover:bg-amber-500/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
            Đang xử lý
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === 'processing' ? 'bg-amber-500/20 text-amber-400' : 'bg-admin-card text-admin-text-muted'
            }`}>
              {tabCounts.processing}
            </span>
          </button>

          {/* Tab: Trong hàng đợi */}
          <button
            onClick={() => handleTabClick('queueing')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all duration-200 select-none border-b-2 ${
              statusFilter === 'queueing'
                ? 'border-sky-500 text-sky-400 bg-sky-500/10'
                : 'border-transparent text-admin-text-muted hover:text-sky-400 hover:bg-sky-500/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0"></span>
            Trong hàng đợi
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === 'queueing' ? 'bg-sky-500/20 text-sky-400' : 'bg-admin-card text-admin-text-muted'
            }`}>
              {tabCounts.queueing}
            </span>
          </button>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm text-admin-text-muted border-collapse">
            <thead className="text-xs uppercase bg-gray-50/80 dark:bg-[#111115]/80 border-b border-slate-200 dark:border-admin-border sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Người thực hiện</th>
                <th className="px-6 py-4">Ý tưởng (Prompt)</th>
                <th className="px-6 py-4">Mô hình & Tỷ lệ</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="animate-spin text-admin-primary" size={24} />
                      <p className="text-sm text-admin-text-muted font-semibold">Đang tải lịch sử ảnh...</p>
                    </div>
                  </td>
                </tr>
              ) : imageJobs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <span className="text-3xl">
                        {statusFilter === 'success' ? '🟢' : statusFilter === 'failed' ? '🔴' : '🔍'}
                      </span>
                      <p className="text-sm text-admin-text-muted font-semibold">
                        Không có bản ghi nào phù hợp với bộ lọc.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                imageJobs.map((item) => (
                  <tr key={item.id} className="border-b border-admin-border hover:bg-admin-bg/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">#{item.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 dark:text-white text-xs">{item.owner?.name || 'Hệ thống'}</span>
                        <span className="text-[10px] text-zinc-500">{item.owner?.email || 'admin@aistudio.vn'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-admin-text max-w-xs truncate" title={item.prompt}>
                      {item.prompt && item.prompt.length > 60 ? `${item.prompt.substring(0, 60)}...` : item.prompt}
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-admin-primary">
                      Flux Schnell ({item.aspect_ratio || '1:1'})
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                    <td className="px-6 py-4 text-xs font-mono">
                      {formatTime(item.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedJob(item)}
                        className="p-1.5 hover:bg-admin-card text-admin-text-muted hover:text-white rounded-lg transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center inline-block"
                        title="Xem chi tiết"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 w-full px-6 pb-6 bg-slate-100 dark:bg-[#0e0e11] rounded-b-lg">
          {/* Phía bên trái (Thông tin trang) */}
          <div className="text-gray-400 dark:text-gray-500 text-xs">
            Trang {currentPage} trên {totalPages} (Hiển thị {imageJobs.length} dòng)
          </div>

          {/* Phía bên phải (Hệ thống nút bấm) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
        {selectedJob && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#18181c] border border-slate-200 dark:border-admin-border rounded-2xl p-6 w-full max-w-2xl shadow-2xl relative text-left flex flex-col gap-4 text-slate-900 dark:text-admin-text max-h-[90vh] overflow-y-auto">
              
              {/* Header */}
              <div className="flex justify-between items-center pb-3 border-b border-admin-border/50">
                <div className="flex items-center gap-2">
                  <ImageIcon className="text-blue-500" size={18} />
                  <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                    Chi Tiết Tác Vụ Ảnh AI #{selectedJob.id}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="text-zinc-500 hover:text-slate-900 dark:hover:text-white p-1 rounded dark:hover:bg-admin-card transition-all cursor-pointer border-none bg-transparent"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Information Grid */}
              <div className="grid grid-cols-2 gap-4 text-[11px] bg-gray-50 dark:bg-zinc-950/40 p-4 border border-slate-200 dark:border-admin-border rounded-xl">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400 font-bold">Người gửi:</span>
                  <span className="text-slate-900 dark:text-white">
                    {selectedJob.owner?.name || 'Hệ thống'} ({selectedJob.owner?.email || 'admin@aistudio.vn'})
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400 font-bold">Mô hình & Provider:</span>
                  <span className="text-slate-900 dark:text-white">
                    Flux Schnell (Fal.ai)
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400 font-bold">Thời gian tạo:</span>
                  <span className="text-slate-900 dark:text-white">{formatTime(selectedJob.createdAt)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-500 dark:text-zinc-400 font-bold">Tỷ lệ & Chi phí:</span>
                  <span className="text-slate-900 dark:text-white">
                    {selectedJob.aspect_ratio || '1:1'} | {selectedJob.credits_used || 2} Credits
                  </span>
                </div>
              </div>

              {/* Status Section */}
              <div className="flex items-center justify-between bg-gray-50 dark:bg-zinc-950/20 p-3.5 border border-slate-200 dark:border-admin-border rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Trạng thái:</span>
                  {getStatusBadge(selectedJob.status)}
                </div>
              </div>

              {/* Output Image Section */}
              {selectedJob.status === 'success' && (selectedJob.result_url || selectedJob.output_url || selectedJob.image_url || selectedJob.imageUrl) ? (
                <div className="flex flex-col gap-2 animate-fade-in">
                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Ảnh kết quả (Click để xem kích thước lớn):</span>
                  <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-admin-border bg-slate-100 dark:bg-zinc-900 flex items-center justify-center max-h-72">
                    <img 
                      src={selectedJob.result_url || selectedJob.output_url || selectedJob.image_url || selectedJob.imageUrl} 
                      alt="Output Result" 
                      className="max-h-72 max-w-full object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => setIsZoomed(true)}
                    />
                  </div>
                </div>
              ) : selectedJob.status === 'failed' ? (
                <div className="bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 rounded-xl p-4 text-[11px] font-mono whitespace-pre-wrap max-h-56 overflow-y-auto select-text">
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 mb-2 font-bold">
                    <AlertCircle size={14} />
                    <span>THÔNG BÁO LỖI HỆ THỐNG</span>
                  </div>
                  Tác vụ tạo ảnh đã thất bại. Vui lòng kiểm tra lại cấu hình hoặc logs hệ thống Fal.ai Flux Schnell.
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 text-amber-700 dark:text-amber-500 rounded-xl p-4 text-[11px] text-center font-bold">
                  Ảnh đang được xếp hàng đợi hoặc đang render từ Fal.ai. Vui lòng làm mới sau!
                </div>
              )}

              {/* Prompt Output */}
              <div className="flex-grow flex flex-col gap-2">
                <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Ý tưởng (Prompt):</span>
                <div className="bg-gray-50 dark:bg-zinc-950 border border-slate-200 dark:border-admin-border rounded-xl p-4 text-[11px] text-slate-700 dark:text-zinc-300 leading-relaxed font-semibold max-h-40 overflow-y-auto select-text whitespace-pre-wrap">
                  {selectedJob.prompt}
                </div>
              </div>

              {/* Footer Control */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="px-5 py-2.5 bg-admin-primary hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none shadow-md"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Zoom Overlay */}
      {isZoomed && selectedJob && (selectedJob.result_url || selectedJob.output_url || selectedJob.image_url || selectedJob.imageUrl) && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center cursor-zoom-out p-4 animate-fade-in"
          onClick={() => setIsZoomed(false)}
        >
          <img 
            src={selectedJob.result_url || selectedJob.output_url || selectedJob.image_url || selectedJob.imageUrl} 
            alt="Zoomed preview" 
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
          <button 
            onClick={(e) => { e.stopPropagation(); setIsZoomed(false); }}
            className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full cursor-pointer transition-all border border-white/20"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageManagement;
