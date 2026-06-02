import React from 'react';
import useDashboard from './dashboard/useDashboard';
import VideoView from './dashboard/VideoView';
import TtsView from './dashboard/TtsView';
import ImageAnalyzerView from './dashboard/ImageAnalyzerView';
import HistoryView from './dashboard/HistoryView';
import SettingsView from './dashboard/SettingsView';
import Toast from '../../components/ui/Toast';

export default function Dashboard() {
  const dashboardState = useDashboard();
  const {
    currentMenu,
    activeMediaType,
    setActiveMediaType,
    activeVideoUrl,
    setActiveVideoUrl,
    activeJobId,
    toastState,
    closeToast,
    deleteModalOpen,
    jobToDelete,
    confirmDeleteHistory,
    cancelDeleteHistory
  } = dashboardState;

  const renderView = () => {
    switch (currentMenu) {
      case 'video':
        return <VideoView {...dashboardState} />;
      case 'tts':
        return <TtsView {...dashboardState} />;
      case 'image-analyzer':
        return <ImageAnalyzerView {...dashboardState} />;
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

      {/* Delete Confirmation Modal Dialog */}
      {deleteModalOpen && jobToDelete && (
        <div className="fixed inset-0 z-[1000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in select-none">
          <div className="!p-8 bg-[#18181c] border border-zinc-800 rounded-2xl overflow-hidden max-w-md w-full shadow-2xl relative text-left">
            <div className="p-6 flex flex-col gap-4">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Xác nhận xóa tác vụ</h3>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Bạn có thực sự muốn xóa {jobToDelete.type === 'Video' || jobToDelete.type === 'video' || jobToDelete.type === 'render_task' ? 'video' : 'âm thanh'} <strong className="text-[#f59e0b]">"{jobToDelete.title}"</strong> không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={cancelDeleteHistory}
                  className="!p-3 px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteHistory}
                  className="!p-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
                >
                  Xác nhận xóa
                </button>
              </div>
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