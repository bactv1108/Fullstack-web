import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { systemService } from '../../services/system.service';

const PlanConfig = () => {
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const adminToken = localStorage.getItem('admin_access_token' || 'token') || localStorage.getItem('token') || localStorage.getItem('Access_token');
    systemService.getBillingPlans(adminToken)
      .then(res => {
        // Support both { success: true, plans: {...} } and direct plans object
        const plansData = res && res.plans ? res.plans : res;
        setPlans(plansData || {
          free: { credits: 60, price: 0 },
          basic: { credits: 200, price: 150000 },
          premium: { credits: 1000, price: 500000 }
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('[PLANS] Load failed:', err.message);
        setErrorMsg('Không thể tải cấu hình gói cước.');
        setLoading(false);
      });
  }, []);

  const handleChange = (planName, field, value) => {
    setPlans(prev => ({
      ...prev,
      [planName]: {
        ...prev[planName],
        [field]: Number(value)
      }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setErrorMsg('');
    try {
      const adminToken = localStorage.getItem('admin_access_token' || 'token') || localStorage.getItem('token');
      
      const formattedPlans = {};
      Object.keys(plans).forEach(key => {
        formattedPlans[key] = {
          credits: Math.round(Number(plans[key].credits)),
          price: Math.round(Number(plans[key].price))
        };
      });

      await systemService.updateBillingPlans(formattedPlans, adminToken);
      setMessage('Cấu hình gói cước đã được cập nhật đồng bộ vào cả hai bảng dữ liệu thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('[PLANS] Save failed:', err.message);
      setErrorMsg(err.response?.data?.message || err.message || 'Lưu cấu hình gói cước thất bại.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="admin-card p-6">Đang tải cấu hình gói cước...</div>;
  }

  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold mb-6">Cấu Hình Gói Cước</h2>

      {message && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-sm">
          {message}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}
      
      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.keys(plans).map((planName) => (
            <div 
              key={planName} 
              className={`bg-admin-bg p-5 rounded-lg border ${
                planName === 'basic' ? 'border-admin-primary' : 'border-admin-border'
              }`}
            >
              <h3 className={`text-md font-medium mb-4 ${
                planName === 'basic' ? 'text-admin-primary' : 'text-admin-text'
              }`}>
                Gói {planName.charAt(0).toUpperCase() + planName.slice(1)}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-admin-text-muted mb-1">Giá (VNĐ / Gói)</label>
                  <input 
                    type="number" 
                    value={plans[planName].price} 
                    onChange={(e) => handleChange(planName, 'price', e.target.value)}
                    className="admin-input" 
                    min="0"
                    step="1"
                    disabled={planName === 'free'}
                  />
                </div>
                <div>
                  <label className="block text-sm text-admin-text-muted mb-1">Tín dụng (Credits)</label>
                  <input 
                    type="number" 
                    value={plans[planName].credits} 
                    onChange={(e) => handleChange(planName, 'credits', e.target.value)}
                    className="admin-input" 
                    min="0"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={saving} className="admin-btn admin-btn-primary flex items-center gap-2">
            <Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu Cấu Hình'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PlanConfig;
