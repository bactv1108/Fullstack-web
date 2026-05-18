import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, Settings } from 'lucide-react';

const Sidebar = () => {
  const navItems = [
    { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { path: '/dashboard/videos', icon: <Video size={20} />, label: 'My Videos' },
    { path: '/dashboard/settings', icon: <Settings size={20} />, label: 'Settings' },
  ];

  return (
    <aside style={{ 
      width: '250px', 
      backgroundColor: 'var(--bg-secondary)', 
      borderRight: '1px solid var(--border-color)',
      padding: '1.5rem 1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--border-radius-md)',
            color: isActive ? 'white' : 'var(--text-secondary)',
            backgroundColor: isActive ? 'var(--accent-color)' : 'transparent',
            textDecoration: 'none',
            transition: 'all var(--transition-speed) ease'
          })}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </aside>
  );
};

export default Sidebar;
