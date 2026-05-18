import React from 'react';
import { Play, Check, X, AlertTriangle } from 'lucide-react';

const VideoModerator = () => {
  const videos = [
    { id: 'VID-001', user: 'Alice Smith', thumbnail: 'https://via.placeholder.com/150', status: 'Pending Review', risk: 'High' },
    { id: 'VID-002', user: 'Bob Jones', thumbnail: 'https://via.placeholder.com/150', status: 'Pending Review', risk: 'Low' },
  ];

  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
        <AlertTriangle size={20} className="text-yellow-500" /> Cần Kiểm Duyệt
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map(video => (
          <div key={video.id} className="bg-admin-bg rounded-lg border border-admin-border overflow-hidden">
            <div className="relative group cursor-pointer">
              <img src={video.thumbnail} alt="Video Thumbnail" className="w-full h-32 object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity">
                <Play size={32} className="text-white" />
              </div>
              {video.risk === 'High' && (
                <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded shadow">
                  Rủi ro cao
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-sm text-admin-text-muted mb-1">Bởi: {video.user}</p>
              <h3 className="font-medium text-admin-text mb-4">{video.id}</h3>
              <div className="flex gap-2">
                <button className="flex-1 admin-btn bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white px-2 py-1.5 text-sm">
                  <Check size={16} /> Duyệt
                </button>
                <button className="flex-1 admin-btn bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-2 py-1.5 text-sm">
                  <X size={16} /> Từ chối
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VideoModerator;
