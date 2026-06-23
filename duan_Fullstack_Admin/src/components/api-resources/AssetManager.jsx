import React, { useState, useEffect, useContext } from 'react';
import { Mic, Image, Plus, X, Save, Edit3, Trash2 } from 'lucide-react';
import { AdminAuthContext } from '../../contexts/AdminAuthContext';

const AssetManager = () => {
  // Luôn ưu tiên lấy token từ AdminAuthContext, fallback sang localStorage
  const { isAuthenticated } = useContext(AdminAuthContext);

  /**
   * Lấy Admin JWT token.
   * Ưu tiên: admin_access_token (key chuẩn của hệ thống Admin)
   * KHÔNG dùng 'token' vì đó là key của user thường (Frontend)
   */
  const getAdminToken = () => {
    const token = localStorage.getItem('admin_access_token');
    if (!token) {
      console.warn('[ASSET MANAGER] ⚠️ Không tìm thấy admin_access_token trong localStorage!');
    }
    return token;
  };

  const [assets, setAssets] = useState([]);
  const [assetToXoa, setAssetToXoa] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Add form states matching backend schema definitions
  const [name, setName] = useState('');
  const [type, setType] = useState('voice');
  const [identifier, setIdentifier] = useState('');
  const [status, setStatus] = useState('active');

  // Edit form states
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('voice');
  const [editIdentifier, setEditIdentifier] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  // GET danh sách assets — không cần auth (route public), nhưng vẫn gửi token nếu có
  const fetchAssets = async () => {
    try {
      const token = getAdminToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:3000/api/assets', { headers });

      if (!response.ok) {
        console.error(`[ASSET MANAGER] GET /api/assets thất bại: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setAssets(data.assets);
      }
    } catch (err) {
      console.error('[ASSET MANAGER] Fetch failed:', err.message);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !identifier) {
      alert('Vui lòng nhập đầy đủ Tên và Key định danh.');
      return;
    }
    setLoading(true);

    try {
      // FIX: Luôn dùng admin_access_token, KHÔNG dùng 'token' của user thường
      const token = getAdminToken();

      if (!token) {
        alert('❌ Lỗi xác thực: Không tìm thấy token Admin. Vui lòng đăng xuất và đăng nhập lại.');
        setLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch('http://localhost:3000/api/assets', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name, type, status, identifier })
      });

      // Kiểm tra HTTP status code trước khi parse JSON
      if (response.status === 401) {
        alert('❌ Lỗi 401 Unauthorized: Token Admin không hợp lệ hoặc đã hết hạn. Vui lòng đăng xuất và đăng nhập lại.');
        setLoading(false);
        return;
      }
      if (response.status === 403) {
        alert('❌ Lỗi 403 Forbidden: Tài khoản của bạn không có quyền Admin để thực hiện thao tác này.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setIsModalOpen(false);
        // Làm mới danh sách ngay sau khi thêm thành công
        fetchAssets();
        // Reset form
        setName('');
        setType('voice');
        setIdentifier('');
        setStatus('active');
      } else {
        alert(`❌ Thêm asset thất bại: ${data.message || 'Lỗi không xác định từ server.'}`);
      }
    } catch (err) {
      console.error('[ASSET MANAGER] Create failed:', err);
      alert(`❌ Lỗi kết nối đến server: ${err.message || 'Vui lòng kiểm tra kết nối mạng.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (assetId) => {
    setLoading(true);

    try {
      // FIX: Luôn dùng admin_access_token
      const token = getAdminToken();

      if (!token) {
        alert('❌ Lỗi xác thực: Không tìm thấy token Admin. Vui lòng đăng xuất và đăng nhập lại.');
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:3000/api/assets/${assetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        alert('❌ Lỗi 401 Unauthorized: Token Admin không hợp lệ hoặc đã hết hạn.');
        setLoading(false);
        return;
      }
      if (response.status === 403) {
        alert('❌ Lỗi 403 Forbidden: Bạn không có quyền xóa tài nguyên này.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        fetchAssets();
        setAssetToXoa(null);
      } else {
        alert(`❌ Xóa asset thất bại: ${data.message || 'Lỗi không xác định.'}`);
      }
    } catch (err) {
      console.error('[ASSET MANAGER] Delete failed:', err);
      alert(`❌ Lỗi kết nối đến server: ${err.message || 'Vui lòng kiểm tra kết nối mạng.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (asset) => {
    setEditingAssetId(asset.id);
    setEditName(asset.name);
    setEditType(asset.type);
    setEditIdentifier(asset.identifier);
    setEditStatus(asset.status);
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editName || !editIdentifier) {
      alert('Vui lòng nhập đầy đủ Tên và Key định danh.');
      return;
    }
    setLoading(true);

    try {
      // FIX: Luôn dùng admin_access_token
      const token = getAdminToken();

      if (!token) {
        alert('❌ Lỗi xác thực: Không tìm thấy token Admin. Vui lòng đăng xuất và đăng nhập lại.');
        setLoading(false);
        return;
      }

      const response = await fetch(`http://localhost:3000/api/assets/${editingAssetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          type: editType,
          identifier: editIdentifier,
          status: editStatus
        })
      });

      if (response.status === 401) {
        alert('❌ Lỗi 401 Unauthorized: Token Admin không hợp lệ hoặc đã hết hạn.');
        setLoading(false);
        return;
      }
      if (response.status === 403) {
        alert('❌ Lỗi 403 Forbidden: Bạn không có quyền chỉnh sửa tài nguyên này.');
        setLoading(false);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setIsEditModalOpen(false);
        fetchAssets();
      } else {
        alert(`❌ Cập nhật asset thất bại: ${data.message || 'Lỗi không xác định.'}`);
      }
    } catch (err) {
      console.error('[ASSET MANAGER] Update failed:', err);
      alert(`❌ Lỗi kết nối đến server: ${err.message || 'Vui lòng kiểm tra kết nối mạng.'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Tài Nguyên Asset (Giọng đọc & Style)</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="admin-btn admin-btn-primary text-sm px-3 py-1.5 flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={16} /> Thêm Asset
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assets.map((asset) => (
          <div key={asset.id} className="bg-admin-bg p-4 rounded-lg border border-admin-border flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className={`p-3 rounded-lg shrink-0 ${
                asset.type.toLowerCase() === 'voice' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
              }`}>
                {asset.type.toLowerCase() === 'voice' ? <Mic size={24} /> : <Image size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-slate-800 dark:text-white font-semibold truncate">{asset.name}</h3>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0 ${
                    asset.status.toLowerCase() === 'active' 
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-500 border border-red-500/20'
                  }`}>
                    {asset.status}
                  </span>
                </div>
                <p className="text-sm text-admin-text-muted mt-1 truncate">ID: {asset.identifier}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-admin-text-muted capitalize hidden sm:inline">{asset.type}</span>
              <div className="flex gap-1">
                <button 
                  onClick={() => handleEditClick(asset)}
                  className="p-2 hover:text-blue-400 text-admin-text-muted hover:bg-admin-bg rounded transition-colors cursor-pointer bg-transparent border-none"
                  title="Sửa"
                  disabled={loading}
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => setAssetToXoa(asset)}
                  className="p-2 hover:text-red-400 text-admin-text-muted hover:bg-admin-bg rounded transition-colors cursor-pointer bg-transparent border-none"
                  title="Xóa"
                  disabled={loading}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {assets.length === 0 && (
          <div className="col-span-full text-center py-8 text-admin-text-muted">
            Chưa có tài nguyên nào được tạo. Nhấn "Thêm Asset" để tạo mới.
          </div>
        )}
      </div>

      {/* Add Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-admin-card border border-admin-border rounded-xl p-6 w-96 shadow-2xl text-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Thêm Tài Nguyên Mới</h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-admin-text-muted hover:text-white cursor-pointer" 
                disabled={loading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Tên tài nguyên</label>
                <input 
                  type="text" 
                  className="admin-input" 
                  placeholder="Ví dụ: Giọng Nam Việt Nam"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Loại tài nguyên</label>
                <select 
                  className="admin-input cursor-pointer"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={loading}
                >
                  <option value="voice">Giọng đọc (Voice)</option>
                  <option value="style">Phong cách (Style)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Key định danh (Identifier)</label>
                <input 
                  type="text" 
                  className="admin-input" 
                  placeholder="Ví dụ: vi-VN-NamMinhNeural"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Trạng thái</label>
                <select 
                  className="admin-input cursor-pointer"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={loading}
                >
                  <option value="active">Hoạt động (Active)</option>
                  <option value="inactive">Tạm ngưng (Inactive)</option>
                </select>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-admin-border">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)} 
                  className="admin-btn border border-admin-border hover:bg-admin-bg cursor-pointer" 
                  disabled={loading}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="admin-btn admin-btn-primary flex items-center gap-2 cursor-pointer" 
                  disabled={loading}
                >
                  <Save size={18} /> {loading ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-admin-card border border-admin-border rounded-xl p-6 w-96 shadow-2xl text-left">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-white">Chỉnh Sửa Tài Nguyên</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)} 
                className="text-admin-text-muted hover:text-white cursor-pointer" 
                disabled={loading}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Tên tài nguyên</label>
                <input 
                  type="text" 
                  className="admin-input" 
                  placeholder="Ví dụ: Giọng Nam Việt Nam"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Loại tài nguyên</label>
                <select 
                  className="admin-input cursor-pointer"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  disabled={loading}
                >
                  <option value="voice">Giọng đọc (Voice)</option>
                  <option value="style">Phong cách (Style)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Key định danh (Identifier)</label>
                <input 
                  type="text" 
                  className="admin-input" 
                  placeholder="Ví dụ: vi-VN-NamMinhNeural"
                  value={editIdentifier}
                  onChange={(e) => setEditIdentifier(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-admin-text-muted mb-1">Trạng thái</label>
                <select 
                  className="admin-input cursor-pointer"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  disabled={loading}
                >
                  <option value="active">Hoạt động (Active)</option>
                  <option value="inactive">Tạm ngưng (Inactive)</option>
                </select>
              </div>

              <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-admin-border">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)} 
                  className="admin-btn border border-admin-border hover:bg-admin-bg cursor-pointer" 
                  disabled={loading}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="admin-btn admin-btn-primary flex items-center gap-2 cursor-pointer" 
                  disabled={loading}
                >
                  <Save size={18} /> {loading ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {assetToXoa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-[#181b21] border border-slate-700 p-6 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-scale-in text-left">
            <h3 className="text-lg font-bold text-white mb-4 tracking-wide uppercase">XÁC NHẬN XÓA TÀI NGUYÊN</h3>
            <p className="text-slate-300 mb-6 text-sm leading-relaxed">
              Bạn có chắc chắn muốn xóa tài nguyên <span className="font-semibold text-red-400">{assetToXoa.name}</span> này không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAssetToXoa(null)}
                className="px-4 py-2 bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
                disabled={loading}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleDelete(assetToXoa.id)}
                className="bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                disabled={loading}
              >
                {loading ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetManager;
