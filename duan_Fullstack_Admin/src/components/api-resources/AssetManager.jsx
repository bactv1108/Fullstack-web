import React from 'react';
import { Mic, Image, Plus } from 'lucide-react';

const AssetManager = () => {
  return (
    <div className="admin-card p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Tài Nguyên Asset (Giọng đọc & Style)</h2>
        <button className="admin-btn admin-btn-primary text-sm px-3 py-1.5">
          <Plus size={16} /> Thêm Asset
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-admin-bg p-4 rounded-lg border border-admin-border flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
            <Mic size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">Giọng Nam Trầm (VN)</h3>
            <p className="text-sm text-admin-text-muted mt-1">ID: vi-VN-Standard-A</p>
          </div>
          <button className="text-admin-text-muted hover:text-white">Sửa</button>
        </div>

        <div className="bg-admin-bg p-4 rounded-lg border border-admin-border flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
            <Image size={24} />
          </div>
          <div className="flex-1">
            <h3 className="font-medium">Phong Cách Anime</h3>
            <p className="text-sm text-admin-text-muted mt-1">Prompt modifier</p>
          </div>
          <button className="text-admin-text-muted hover:text-white">Sửa</button>
        </div>
      </div>
    </div>
  );
};

export default AssetManager;
