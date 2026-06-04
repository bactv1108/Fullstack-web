import React, { useEffect, useState } from 'react';
import { configService } from '../../services/config.service';
import { Eye, EyeOff, Save } from 'lucide-react';

const ApiKeysForm = () => {
  const [huggingfaceToken, setHuggingfaceToken] = useState('');
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');

  const [show, setShow] = useState({ huggingface: false, elevenlabs: false, gemini: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    configService.getSystemConfigs().then(res => {
      if (res) {
        // Đảm bảo lấy đúng trường 'huggingface_token' từ API trả về để gán vào state
        if (res.data && res.data.huggingface_token) {
          setHuggingfaceToken(res.data.huggingface_token);
        }
        const data = res.data || res;
        setElevenlabsApiKey(data.elevenlabs_api_key || '');
        setGeminiApiKey(data.gemini_api_key || '');
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
        gemini_api_key: geminiApiKey,
        elevenlabs_api_key: elevenlabsApiKey,
        huggingface_token: huggingfaceToken // BẮT BUỘC gửi đúng tên trường này lên Backend
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
          <label className="block text-sm font-medium text-admin-text-muted mb-2">Hugging Face Token</label>
          <div className="relative">
            <input 
              type={show.huggingface ? "text" : "password"} 
              name="huggingface"
              value={huggingfaceToken}
              onChange={(e) => setHuggingfaceToken(e.target.value)}
              placeholder="hf_..."
              className="admin-input pr-10" 
            />
            <button 
              type="button" 
              onClick={() => toggleShow('huggingface')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-text-muted hover:text-white"
            >
              {show.huggingface ? <EyeOff size={18} /> : <Eye size={18} />}
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
              className="w-full p-3 bg-zinc-900/50 text-zinc-100 border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm pr-10" 
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
