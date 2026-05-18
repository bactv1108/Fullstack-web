import React, { useEffect, useState } from 'react';
import { configService } from '../../services/config.service';
import { Eye, EyeOff, Save } from 'lucide-react';

const ApiKeysForm = () => {
  const [keys, setKeys] = useState({ openai: '', elevenlabs: '' });
  const [show, setShow] = useState({ openai: false, elevenlabs: false });

  useEffect(() => {
    configService.getApiKeys().then(setKeys);
  }, []);

  const handleChange = (e) => {
    setKeys({ ...keys, [e.target.name]: e.target.value });
  };

  const toggleShow = (provider) => {
    setShow({ ...show, [provider]: !show[provider] });
  };

  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold mb-6">Quản Lý API Keys</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-admin-text-muted mb-2">OpenAI API Key</label>
          <div className="relative">
            <input 
              type={show.openai ? "text" : "password"} 
              name="openai"
              value={keys.openai}
              onChange={handleChange}
              className="admin-input pr-10" 
            />
            <button 
              type="button" 
              onClick={() => toggleShow('openai')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-white"
            >
              {show.openai ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-admin-text-muted mb-2">ElevenLabs API Key</label>
          <div className="relative">
            <input 
              type={show.elevenlabs ? "text" : "password"} 
              name="elevenlabs"
              value={keys.elevenlabs}
              onChange={handleChange}
              className="admin-input pr-10" 
            />
            <button 
              type="button" 
              onClick={() => toggleShow('elevenlabs')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-white"
            >
              {show.elevenlabs ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button className="admin-btn admin-btn-primary">
          <Save size={18} /> Lưu Thay Đổi
        </button>
      </div>
    </div>
  );
};

export default ApiKeysForm;
