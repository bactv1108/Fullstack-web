import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Sidebar from './Sidebar';

const MainLayout = () => {
  const [currentMenu, setCurrentMenu] = useState('video');
  const [credits, setCredits] = useState(140);
  const [activeModal, setActiveModal] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }} className="relative">
      <Header credits={credits} onOpenModal={setActiveModal} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} className="relative">
        {/* Backdrop for mobile/tablet when sidebar is open */}
        {isSidebarOpen && (
          <div 
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/55 backdrop-blur-xs z-25 cursor-pointer"
          />
        )}
        <Sidebar currentMenu={currentMenu} setCurrentMenu={setCurrentMenu} onOpenModal={setActiveModal} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
        <main style={{ flex: 1, padding: '0', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
          <Outlet context={{ currentMenu, setCurrentMenu, credits, setCredits, activeModal, setActiveModal }} />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
