import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem 2rem', 
      backgroundColor: 'var(--bg-secondary)', 
      borderBottom: '1px solid var(--border-color)' 
    }}>
      <div style={{ fontWeight: '600', fontSize: '1.25rem', color: 'var(--accent-color)' }}>
        VideoAI Studio
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <User size={18} />
          <span>{user?.name || 'User'}</span>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
          <LogOut size={16} />
          Đăng xuất
        </button>
      </div>
    </header>
  );
};

export default Header;
