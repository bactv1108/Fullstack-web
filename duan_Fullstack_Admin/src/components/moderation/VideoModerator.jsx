import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import axiosAdminClient from '../../services/axiosAdminClient';
import { getSocket } from '../../services/socketService';
import {
  Check, X, AlertTriangle, Loader2, AlertCircle,
  RefreshCw, User as UserIcon, Clock, CheckCircle2,
  XCircle, ImageOff, ZoomIn, ShieldAlert
} from 'lucide-react';

// ── Cấu hình URL gốc server (bypass axiosAdminClient vì endpoint nằm ở /api/v1/admin) ──
const SERVER_ROOT = (() => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin';
  // Lấy gốc server: bỏ "/api/admin" hoặc "/api" ở cuối
  return apiUrl.replace(/\/api(\/admin)?\/?$/, '');
})();

const API_BASE = `${SERVER_ROOT}/api/v1/admin/moderation`;

// Lấy token admin từ localStorage
const getAuthHeader = () => {
  const token = localStorage.getItem('admin_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Xây dựng URL đầy đủ cho ảnh từ image_path tương đối lưu trong DB.
 * Ví dụ: "uploads/analyses/abc.jpg" → "http://localhost:3000/uploads/analyses/abc.jpg"
 */
const buildImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
  const cleaned = imagePath.replace(/^\/+/, '');
  return `${SERVER_ROOT}/${cleaned}`;
};

/**
 * Format thời gian tương đối kiểu "X phút trước"
 */
const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s trước`;
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
};

/**
 * Format dung lượng file
 */
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// ── Lightbox Component ────────────────────────────────────────────────────────

const Lightbox = ({ imageUrl, imageName, onClose }) => {
  // Đóng khi nhấn Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Nút đóng */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center border border-white/20 transition-all"
          title="Đóng (Esc)"
        >
          <X size={14} />
        </button>

        {/* Ảnh phóng to */}
        <img
          src={imageUrl}
          alt={imageName || 'Ảnh phân tích'}
          className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10"
        />

        {/* Tên file */}
        {imageName && (
          <p className="text-white/60 text-xs text-center truncate max-w-md">
            {imageName}
          </p>
        )}
        <p className="text-white/30 text-[10px]">Nhấn Esc hoặc click bên ngoài để đóng</p>
      </div>
    </div>
  );
};

// ── ImageModerator Component (file vẫn giữ tên VideoModerator.jsx) ─────────────

const VideoModerator = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Map itemId → 'approved' | 'rejected'  (trạng thái xử lý per-card)
  const [actionLoading, setActionLoading] = useState({});
  // Lightbox state
  const [lightbox, setLightbox] = useState(null); // { url, name } | null

  const showToast = (message, type = 'success') => {
    setError(message);
    setTimeout(() => setError(''), 5000);
  };

  // ── Fetch hàng đợi kiểm duyệt ảnh ─────────────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`${API_BASE}/queue`, {
        headers: getAuthHeader()
      });
      setItems(Array.isArray(response.data?.items) ? response.data.items : []);
    } catch (err) {
      console.error('[IMAGE MODERATOR] fetchQueue error:', err);
      const msg = err?.response?.data?.message || 'Không thể tải hàng đợi kiểm duyệt. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ── Real-time: Lắng nghe ảnh vi phạm mới bơm thẳng vào Grid ─────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewModerationItem = (newItem) => {
      console.log('[GRID RECEIVE] 📡 Nhận ảnh vi phạm real-time mới (NEW_MODERATION_ITEM):', newItem);
      fetchQueue();
    };

    const handleUpdateMatThanJob = (data) => {
      console.log('[GRID RECEIVE] 📡 Nhận tín hiệu UPDATE_MAT_THAN_JOB:', data);
      fetchQueue();
    };

    const handleNewModerationJob = (data) => {
      console.log('[GRID RECEIVE] 📡 Nhận tín hiệu NEW_MODERATION_JOB:', data);
      fetchQueue();
      // Phát âm thanh cảnh báo ngắn
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (soundErr) {
        console.warn('Không thể phát âm thanh thông báo:', soundErr);
      }
    };

    socket.on('NEW_MODERATION_ITEM', handleNewModerationItem);
    socket.on('UPDATE_MAT_THAN_JOB', handleUpdateMatThanJob);
    socket.on('NEW_MODERATION_JOB', handleNewModerationJob);

    // Dọn dẹp khi Admin rời trang — chống tràn RAM
    return () => {
      socket.off('NEW_MODERATION_ITEM', handleNewModerationItem);
      socket.off('UPDATE_MAT_THAN_JOB', handleUpdateMatThanJob);
      socket.off('NEW_MODERATION_JOB', handleNewModerationJob);
    };
  }, [fetchQueue]);

  // ── Xử lý Duyệt / Từ chối ────────────────────────────────────────────────
  const handleReview = async (itemId, action) => {
    if (actionLoading[itemId]) return; // tránh double-click

    try {
      setActionLoading(prev => ({ ...prev, [itemId]: action }));

      if (action === 'rejected') {
        // Gửi ngay một request POST sử dụng axiosAdminClient xuống endpoint /moderation/reject truyền kèm { imageId: item.id }
        const res = await axiosAdminClient.post('/moderation/reject', { imageId: itemId });
        
        if (res?.success) {
          // Chỉ thực hiện lọc mảng trên giao diện (xóa card ảnh khỏi State màn hình) sau khi nhận được phản hồi res.success === true từ Server gửi về
          setItems(prev => prev.filter(item => item.id !== itemId));
          showToast('Đã xác nhận ảnh vi phạm chính sách thành công!', 'success');
        }
      } else {
        await axios.post(
          `${API_BASE}/review`,
          { itemId, action },
          { headers: { ...getAuthHeader(), 'Content-Type': 'application/json' } }
        );
        // Xóa card khỏi state ngay lập tức (optimistic remove)
        setItems(prev => prev.filter(item => item.id !== itemId));
      }
    } catch (err) {
      console.error(`[IMAGE MODERATOR] review(${action}) #${itemId} error:`, err);
      const msg = err?.response?.data?.message || err?.message || `Xử lý ảnh #${itemId} thất bại. Vui lòng thử lại.`;
      showToast(msg, 'error');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Lightbox Portal */}
      {lightbox && (
        <Lightbox
          imageUrl={lightbox.url}
          imageName={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}

      <div className="admin-card p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <AlertTriangle size={20} className="text-yellow-500" />
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Kiểm Duyệt Ảnh Mắt Thần
            <span className="text-xs font-normal text-admin-text-muted">(Hình ảnh vi phạm / nghi vấn)</span>
          </h2>
          {!loading && (
            <span className="ml-2 text-xs text-admin-text-muted bg-admin-bg border border-admin-border px-2 py-0.5 rounded-full">
              {items.length} ảnh
            </span>
          )}
          <button
            onClick={fetchQueue}
            disabled={loading}
            className="ml-auto admin-btn text-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Tải lại hàng đợi"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Tải lại
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 mb-4">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-admin-text-muted">
            <Loader2 size={24} className="animate-spin mr-3" />
            <span className="text-sm">Đang tải hàng đợi kiểm duyệt ảnh...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-admin-text-muted">
            <CheckCircle2 size={40} className="mb-3 text-green-500/50" />
            <p className="text-sm font-medium">Không có ảnh nào cần kiểm duyệt.</p>
            <p className="text-xs mt-1 opacity-60">
              Tất cả ảnh đã được xử lý hoặc chưa có ảnh vi phạm mới.
            </p>
          </div>
        )}

        {/* Cards Grid */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const imageUrl = buildImageUrl(item.image_path);
              const isActing = !!actionLoading[item.id];
              const currentAction = actionLoading[item.id];

              return (
                <div
                  key={item.id}
                  className={`bg-admin-bg rounded-lg border border-admin-border overflow-hidden flex flex-col transition-all duration-300 ${
                    isActing ? 'opacity-60 scale-[0.98]' : 'hover:border-yellow-500/40'
                  }`}
                >
                  {/* ── Vùng ảnh ── */}
                  <div className="relative group bg-slate-900">
                    {imageUrl ? (
                      <>
                        <img
                          src={imageUrl}
                          alt={item.image_name || `Ảnh #${item.id}`}
                          className="w-full h-48 object-cover rounded-t-lg transition-all duration-200 group-hover:brightness-75"
                          onError={(e) => {
                            // Fallback khi ảnh không load được
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                        {/* Placeholder ẩn — hiện khi ảnh lỗi */}
                        <div
                          className="w-full h-48 flex-col items-center justify-center text-admin-text-muted hidden"
                          style={{ display: 'none' }}
                        >
                          <ImageOff size={36} className="opacity-30 mb-2" />
                          <span className="text-xs opacity-50">Không tải được ảnh</span>
                        </div>
                        {/* Overlay Zoom khi hover */}
                        <button
                          onClick={() => setLightbox({ url: imageUrl, name: item.image_name })}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-transparent border-none cursor-zoom-in"
                          title="Xem ảnh phóng to"
                        >
                          <div className="bg-black/60 rounded-full p-2.5 shadow-lg">
                            <ZoomIn size={22} className="text-white" />
                          </div>
                        </button>
                      </>
                    ) : (
                      /* Không có image_path */
                      <div className="w-full h-48 flex flex-col items-center justify-center text-admin-text-muted">
                        <ImageOff size={36} className="opacity-30 mb-2" />
                        <span className="text-xs opacity-50">Không có ảnh</span>
                      </div>
                    )}

                    {/* Badge vi phạm */}
                    <div className="absolute top-2 left-2 bg-red-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex items-center gap-1 shadow">
                      <ShieldAlert size={10} />
                      Vi phạm
                    </div>

                    {/* Badge định dạng file */}
                    {item.mime_type && (
                      <div className="absolute top-2 right-2 bg-black/60 text-white/80 text-[9px] font-mono px-1.5 py-0.5 rounded uppercase">
                        {item.mime_type.split('/')[1] || item.mime_type}
                      </div>
                    )}
                  </div>

                  {/* ── Card Body ── */}
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    {/* Tên file */}
                    <h3
                      className="font-medium text-admin-text text-sm leading-snug line-clamp-1"
                      title={item.image_name}
                    >
                      {item.image_name || `Ảnh phân tích #${item.id}`}
                    </h3>

                    {/* Thông báo lỗi / lý do vi phạm */}
                    {item.error_message && (
                      <p
                        className="text-[10px] text-red-400/80 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 line-clamp-2"
                        title={item.error_message}
                      >
                        {item.error_message}
                      </p>
                    )}

                    {/* Thông tin người dùng */}
                    <div className="flex items-center gap-2 text-xs text-admin-text-muted">
                      {item.user?.avatar ? (
                        <img
                          src={item.user.avatar}
                          alt={item.user.name}
                          className="w-5 h-5 rounded-full object-cover border border-admin-border"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-admin-border flex items-center justify-center shrink-0">
                          <UserIcon size={10} />
                        </div>
                      )}
                      <span className="truncate">
                        {item.user?.name || item.user?.email || 'Người dùng ẩn danh'}
                      </span>
                    </div>

                    {/* Meta: ID · Dung lượng · Thời gian */}
                    <div className="flex items-center justify-between text-[10px] text-admin-text-muted">
                      <span className="font-mono flex items-center gap-1">
                        <span className="opacity-50">#</span>{item.id}
                        {item.file_size ? (
                          <span className="ml-1.5 opacity-60">· {formatFileSize(item.file_size)}</span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {timeAgo(item.created_at)}
                      </span>
                    </div>

                    {/* ── Action Buttons ── */}
                    <div className="flex gap-2 mt-auto pt-1">
                      {/* Nút Duyệt — ảnh hợp lệ */}
                      <button
                        onClick={() => handleReview(item.id, 'approved')}
                        disabled={isActing}
                        className="flex-1 admin-btn bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white px-2 py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {currentAction === 'approved' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} />
                        )}
                        {currentAction === 'approved' ? 'Đang duyệt...' : 'Hợp lệ'}
                      </button>

                      {/* Nút Từ chối — xác nhận vi phạm */}
                      <button
                        onClick={() => handleReview(item.id, 'rejected')}
                        disabled={isActing}
                        className="flex-1 admin-btn bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-2 py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {currentAction === 'rejected' ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <XCircle size={13} />
                        )}
                        {currentAction === 'rejected' ? 'Đang xử lý...' : 'Vi phạm'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default VideoModerator;
