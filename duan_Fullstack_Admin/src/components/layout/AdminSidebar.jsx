import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Key, ShieldAlert, Users } from 'lucide-react';

const AdminSidebar = () => {
  const tabs = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Billing & Plans', path: '/billing', icon: <CreditCard size={20} /> },
    { name: 'API Resources', path: '/api-resources', icon: <Key size={20} /> },
    { name: 'Moderation', path: '/moderation', icon: <ShieldAlert size={20} /> },
    { name: 'Users', path: '/users', icon: <Users size={20} /> },
  ];

  return (
    <aside className="w-64 bg-[#13161c] border-r border-admin-border flex flex-col h-full">
      <div className="p-6">
        <h1 className="text-xl font-bold text-admin-primary flex items-center gap-2">
          <span className="bg-admin-primary text-white p-1 rounded-md text-sm">AI</span>
          Admin Studio
        </h1>
      </div>
      
      <nav className="flex-1 px-4 flex flex-col gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
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
