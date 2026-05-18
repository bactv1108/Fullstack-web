import React, { useState } from 'react';
import { Sparkles, Video } from 'lucide-react';

const Dashboard = () => {
  const [prompt, setPrompt] = useState('');

  const handleGenerate = () => {
    if (!prompt) return;
    alert(`Đang tạo video cho prompt: "${prompt}"`);
  };

  return (
    <div className="container animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Trang chủ</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Chào mừng bạn. Hãy nhập prompt để AI tạo video cho bạn.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={20} color="var(--accent-color)" />
          Tạo Video AI Mới
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <textarea 
            className="input-field" 
            rows={4} 
            placeholder="Mô tả video bạn muốn tạo (ví dụ: Một chú mèo đang chơi đàn piano trong không gian...)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            style={{ resize: 'vertical', minHeight: '100px' }}
          ></textarea>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={handleGenerate}>
            Tạo Video
          </button>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Video size={20} />
          Video Gần Đây
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '150px' }}>
              <Video size={40} color="var(--border-color)" />
              <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Video {item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
