import React from 'react';
import { Save } from 'lucide-react';

const PlanConfig = () => {
  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold mb-6">Cấu Hình Gói Cước</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free Plan */}
        <div className="bg-admin-bg p-5 rounded-lg border border-admin-border">
          <h3 className="text-md font-medium text-admin-text mb-4">Gói Miễn Phí (Free)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-admin-text-muted mb-1">Tín dụng ban đầu</label>
              <input type="number" defaultValue={50} className="admin-input" />
            </div>
            <div>
              <label className="block text-sm text-admin-text-muted mb-1">Giới hạn Video/Tháng</label>
              <input type="number" defaultValue={5} className="admin-input" />
            </div>
          </div>
        </div>

        {/* Pro Plan */}
        <div className="bg-admin-bg p-5 rounded-lg border border-admin-primary">
          <h3 className="text-md font-medium text-admin-primary mb-4">Gói Chuyên Nghiệp (Pro)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-admin-text-muted mb-1">Giá ($/Tháng)</label>
              <input type="number" defaultValue={19.99} className="admin-input" />
            </div>
            <div>
              <label className="block text-sm text-admin-text-muted mb-1">Tín dụng mỗi tháng</label>
              <input type="number" defaultValue={1000} className="admin-input" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="admin-btn admin-btn-primary">
          <Save size={18} /> Lưu Cấu Hình
        </button>
      </div>
    </div>
  );
};

export default PlanConfig;
