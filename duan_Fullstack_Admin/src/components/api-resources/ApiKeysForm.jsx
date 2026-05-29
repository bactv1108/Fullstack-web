import React, { useEffect, useState } from 'react';
import { configService } from '../../services/config.service';
import { Eye, EyeOff, Save } from 'lucide-react';

const ApiKeysForm = () => {
  const [keys, setKeys] = useState({ openai: '', elevenlabs: '' });
  const [show, setShow] = useState({ openai: false, elevenlabs: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    configService.getApiKeys().then(data => {
      if (data) {
        setKeys({
          openai: data.openai || '',
          elevenlabs: data.elevenlabs || ''
        });
      }
    }).catch(err => {
      console.error('[API KEYS] Load failed:', err.message);
      setErrorMsg('Không thể tải cấu hình API Keys.');
    });
  }, []);

  const handleChange = (e) => {
    setKeys({ ...keys, [e.target.name]: e.target.value });
  };

  const toggleShow = (provider) => {
    setShow({ ...show, [provider]: !show[provider] });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMsg('');

    try {
      await configService.updateApiKeys(keys);
      setMessage('Cập nhật API Keys thành công!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('[API KEYS] Save failed:', err.message);
      setErrorMsg(err.response?.data?.message || err.message || 'Lưu API Keys thất bại.');
      setTimeout(() => setErrorMsg(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-card p-6">
      <h2 className="text-lg font-semibold mb-6">Quản Lý API Keys</h2>
      
      {message && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-lg text-sm">
          {message}
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
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

        <div className="mt-6 flex justify-end">
          <button type="submit" disabled={loading} className="admin-btn admin-btn-primary flex items-center gap-2">
            <Save size={18} /> {loading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ApiKeysForm;

