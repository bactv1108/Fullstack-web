import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Key, ShieldAlert, Users, X } from 'lucide-react';

const AdminSidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const tabs = [
    { name: 'Tổng quan', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Thanh toán & Gói dịch vụ', path: '/billing', icon: <CreditCard size={20} /> },
    { name: 'Tài nguyên API', path: '/api-resources', icon: <Key size={20} /> },
    { name: 'Kiểm duyệt', path: '/moderation', icon: <ShieldAlert size={20} /> },
    { name: 'Người dùng', path: '/users', icon: <Users size={20} /> },
  ];

  const handleLogoClick = () => {
    navigate('/dashboard');
    if (setIsOpen) setIsOpen(false);
  };

  return (
    <aside 
      className={`fixed inset-y-0 left-0 w-64 bg-[#13161c] border-r border-admin-border flex flex-col h-full z-30 transition-transform duration-300 transform ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="p-6 flex items-center justify-between">
        <div 
          onClick={handleLogoClick}
          className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="bg-admin-primary text-white p-1.5 rounded-md text-xs font-black">AI</span>
          <span className="text-base font-bold text-white tracking-wide">Studio Admin</span>
        </div>
        
        {/* Close button inside sidebar */}
        <button 
          onClick={() => setIsOpen(false)}
          className="text-admin-text-muted hover:text-white p-1 rounded-lg hover:bg-admin-card transition-colors cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>
      
      <nav className="flex-1 px-4 flex flex-col gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            onClick={() => setIsOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive 
                  ? 'bg-admin-primary text-white font-medium shadow-md shadow-blue-900/20' 
                  : 'text-admin-text-muted hover:bg-admin-card hover:text-white'
              }`
            }
          >
            {tab.icon}
            {tab.name}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-admin-border text-xs text-admin-text-muted text-center">
        v1.0.0-admin
      </div>
    </aside>
  );
};

export default AdminSidebar;
