import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { userService } from '../../services/user.service';

const CreditModal = ({ user, onClose, onSuccess }) => {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await userService.updateCredits(user.id, amount);
      const newCredits = res?.user ? res.user.credits : (user.credits + amount);
      if (onSuccess) {
        onSuccess(user.id, newCredits);
      }
      onClose();
    } catch (err) {
      console.error('[CREDIT UPDATE] Failed:', err.message);
      alert(err.response?.data?.message || err.message || 'Cập nhật credit thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-admin-card border border-admin-border rounded-xl p-6 w-96 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">Điều chỉnh Credit</h3>
          <button onClick={onClose} className="text-admin-text-muted hover:text-white" disabled={loading}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-admin-text-muted mb-1">Người dùng</p>
            <p className="font-medium text-admin-text">{user.name} ({user.email})</p>
          </div>
          <div>
            <p className="text-sm text-admin-text-muted mb-1">Credit hiện tại</p>
            <p className="text-xl font-bold text-admin-primary">{user.credits}</p>
          </div>
          <div>
            <label className="block text-sm text-admin-text-muted mb-1">Số lượng (+/-)</label>
            <input 
              type="number" 
              className="admin-input" 
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              disabled={loading}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="admin-btn border border-admin-border hover:bg-admin-bg" disabled={loading}>
            Hủy
          </button>
          <button onClick={handleSave} className="admin-btn admin-btn-primary flex items-center gap-2" disabled={loading}>
            <Save size={18} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreditModal;
