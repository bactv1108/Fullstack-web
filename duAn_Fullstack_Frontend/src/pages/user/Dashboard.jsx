import React from 'react';
import useDashboard from './dashboard/useDashboard';
import VideoView from './dashboard/VideoView';
import TtsView from './dashboard/TtsView';
import HistoryView from './dashboard/HistoryView';
import SettingsView from './dashboard/SettingsView';
import Toast from '../../components/ui/Toast';

export default function Dashboard() {
  const dashboardState = useDashboard();
  const { currentMenu, activeMediaType, setActiveMediaType, activeVideoUrl, setActiveVideoUrl, activeJobId, toastState, closeToast } = dashboardState;

  const renderView = () => {
    switch (currentMenu) {
      case 'video':
        return <VideoView {...dashboardState} />;
      case 'tts':
        return <TtsView {...dashboardState} />;
      case 'history':
        return <HistoryView {...dashboardState} />;
      case 'settings':
        return <SettingsView {...dashboardState} />;
      default:
        return <VideoView {...dashboardState} />;
    }
  };

  return (
    <div className="relative min-h-full w-full">
      {renderView()}

      {/* Dynamic Video Media Preview Modal Safeguard */}
      {activeMediaType === 'video' && activeVideoUrl && (
        <div className="fixed inset-0 z-[999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in select-none">
          <div className="bg-[#18181c] border border-zinc-800 rounded-2xl overflow-hidden max-w-2xl w-full shadow-2xl relative text-left">
            <div className="flex justify-between items-center px-5 py-4 border-b border-zinc-800/80">
              <h3 className="text-sm font-bold text-zinc-200">Xem thử Video AI (Tác vụ #{activeJobId})</h3>
              <button 
                type="button"
                onClick={() => {
                  setActiveMediaType(null);
                  setActiveVideoUrl(null);
                }}
                className="text-zinc-400 hover:text-zinc-200 text-xs font-bold bg-transparent border-none cursor-pointer p-1"
              >
                Đóng
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <video 
                src={activeVideoUrl} 
                controls 
                autoPlay 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-4 bg-zinc-950/40 text-center">
              <p className="text-[10px] text-zinc-500 font-medium">Bản trình chiếu xem thử video được kết xuất trực tiếp từ kho lưu trữ đám mây.</p>
            </div>
          </div>
        </div>
      )}

      {/* Unified Global Toast Notification */}
      <Toast 
        show={toastState.show} 
        message={toastState.message} 
        type={toastState.type} 
        onClose={closeToast} 
      />
    </div>
  );
}