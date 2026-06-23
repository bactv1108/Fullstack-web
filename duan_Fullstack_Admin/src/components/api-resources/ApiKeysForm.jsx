import React, { useEffect, useState } from 'react';
import { configService } from '../../services/config.service';
import { Eye, EyeOff, Save } from 'lucide-react';

const ApiKeysForm = () => {
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [falApiKey, setFalApiKey] = useState('');
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');

  const [show, setShow] = useState({ openai: false, elevenlabs: false, gemini: false, fal: false, openrouter: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    configService.getSystemConfigs().then(res => {
      if (res) {
        const data = res.data || res;
        setOpenaiApiKey(data.openai_api_key || '');
        setElevenlabsApiKey(data.elevenlabs_api_key || '');
        setGeminiApiKey(data.gemini_api_key || '');
        setFalApiKey(data.fal_api_key || '');
        setOpenrouterApiKey(data.openrouter_api_key || '');
      }
    }).catch(err => {
      console.error('[API KEYS] Load failed:', err.message);
      setErrorMsg('Không thể tải cấu hình API Keys.');
    });
  }, []);

  const toggleShow = (provider) => {
    setShow({ ...show, [provider]: !show[provider] });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMsg('');

    try {
      const payload = {
        openai_api_key: openaiApiKey,
        gemini_api_key: geminiApiKey,
        elevenlabs_api_key: elevenlabsApiKey,
        fal_api_key: falApiKey,
        openrouter_api_key: openrouterApiKey,
      };
      await configService.updateSystemConfigs(payload);
      setMessage('🎉 Cập nhật khóa API hệ thống thành công!');
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
              id="openai_api_key"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
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
              value={elevenlabsApiKey}
              onChange={(e) => setElevenlabsApiKey(e.target.value)}
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

        <div>
          <label className="block text-sm font-medium text-admin-text-muted mb-2">Gemini API Key</label>
          <div className="relative">
            <input 
              type={show.gemini ? "text" : "password"} 
              name="gemini"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              className="admin-input pr-10" 
            />
            <button 
              type="button" 
              onClick={() => toggleShow('gemini')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-white"
            >
              {show.gemini ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-admin-text-muted mb-2">Fal API Key</label>
          <div className="relative">
            <input 
              type={show.fal ? "text" : "password"} 
              name="fal"
              id="fal_api_key"
              value={falApiKey}
              onChange={(e) => setFalApiKey(e.target.value)}
              placeholder="fal-..."
              className="admin-input pr-10" 
            />
            <button 
              type="button" 
              onClick={() => toggleShow('fal')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-white"
            >
              {show.fal ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-admin-text-muted mb-2">OpenRouter API Key</label>
          <div className="relative">
            <input 
              type={show.openrouter ? "text" : "password"} 
              name="openrouter"
              id="openrouter_api_key"
              value={openrouterApiKey}
              onChange={(e) => setOpenrouterApiKey(e.target.value)}
              placeholder="sk-or-..."
              className="admin-input pr-10" 
            />
            <button 
              type="button" 
              onClick={() => toggleShow('openrouter')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-white"
            >
              {show.openrouter ? <EyeOff size={18} /> : <Eye size={18} />}
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
