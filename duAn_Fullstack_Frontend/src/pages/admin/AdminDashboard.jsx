import React from 'react';
import { Users, Settings, Activity } from 'lucide-react';

const AdminDashboard = () => {
  return (
    <div className="container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'var(--error-color)' }}>Bảng Điều Khiển Quản Trị</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Tổng quan hệ thống</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--border-radius-md)', color: 'var(--accent-color)' }}>
            <Users size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Tổng Người Dùng</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>1,245</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 'var(--border-radius-md)', color: 'var(--success-color)' }}>
            <Activity size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Video Đã Tạo</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>8,432</p>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--border-radius-md)', color: 'var(--error-color)' }}>
            <Settings size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Trạng Thái Server</h3>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Hoạt động</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
