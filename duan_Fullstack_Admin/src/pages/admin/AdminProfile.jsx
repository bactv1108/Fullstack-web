import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getSocket } from '../../services/socketService';
import { 
  User, Shield, ShieldCheck, KeyRound, Monitor, Smartphone, 
  Terminal, Palette, Check, Save, Lock, LogOut, ArrowLeft, Camera, Trash2, X, ArrowUp 
} from 'lucide-react';

export default function AdminProfile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // States for interactive controls
  const [fullname, setFullname] = useState('Trần Văn Bắc');
  const [tel, setTel] = useState('+84 987 654 321');
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 2FA state
  const [is2FaActive, setIs2FaActive] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [tempSecret, setTempSecret] = useState('');
  const [twoFAToken, setTwoFAToken] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFASuccess, setTwoFASuccess] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);

  // Webhook states
  const [webhookUrl, setWebhookUrl] = useState('https://api.telegram.org/bot724391:AAH-u58.../sendMessage');
  const [isAlertCostActive, setIsAlertCostActive] = useState(true);

  // Theme states - initialize from localStorage
  const [activeTheme, setActiveTheme] = useState(() => localStorage.getItem('admin_theme') || 'dark'); // 'dark' | 'light'

  // Avatar State
  const [avatar, setAvatar] = useState(localStorage.getItem('admin_avatar') || '');

  // Active Sessions — real data from API
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');

  // Messages / feedback states
  const [identityMsg, setIdentityMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [webhookMsg, setWebhookMsg] = useState('');

  // Scroll-to-Top State & Effect
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ── URL cấu hình ──────────────────────────────────────────────
  // VITE_API_URL = http://localhost:3000/api/admin
  // BASE_API    = http://localhost:3000/api  (strip /admin suffix)
  // SERVER_ROOT = http://localhost:3000
  const rawApi = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const BASE_API = rawApi.replace(/\/admin\/?$/, '');        // http://localhost:3000/api
  const SERVER_ROOT = BASE_API.replace(/\/api\/?$/, '');     // http://localhost:3000
  // alias cho các API cũ giữ nguyên
  const apiBase = BASE_API;

  const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') return ['1', 'true', 'yes'].includes(value.toLowerCase());
    return false;
  };

  const saveAuthTokens = (data) => {
    const accessToken = data?.access_token || data?.accessToken || data?.token;
    const refreshToken = data?.refresh_token || data?.refreshToken;

    if (accessToken) {
      localStorage.setItem('admin_access_token', accessToken);
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('Access_token', accessToken);
      localStorage.setItem('token', accessToken);
    }

    if (refreshToken) {
      localStorage.setItem('admin_refresh_token', refreshToken);
      localStorage.setItem('refresh_token', refreshToken);
    }
  };

  useEffect(() => {
    const handleScroll = (e) => {
      const scrollPos = e.target.scrollTop || 0;
      if (scrollPos > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Lấy token trực tiếp (getValidToken chưa được khai báo ở đây)
        const token = localStorage.getItem('admin_access_token');
        if (!token) return;

        // Profile endpoint: GET http://localhost:3000/api/user/profile
        const res = await axios.get(`${BASE_API}/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const profile = res.data?.user || res.data?.data || res.data;

        if (profile) {
          setFullname(profile.name || '');
          setAvatar(profile.avatar || localStorage.getItem('admin_avatar') || '');
          setIs2FaActive(toBoolean(profile.is_two_factor_enabled));
          if (!localStorage.getItem('admin_theme') && profile.theme_preference) {
            setActiveTheme(profile.theme_preference);
          }
        }
      } catch (err) {
        console.error('[ADMIN PROFILE] Load profile failed:', err.response?.data?.message || err.message);
      }
    };

    fetchProfile();
  }, []);

  // ── Fetch sessions + lắng nghe SESSION_LIST_CHANGED real-time ──────────────────
  useEffect(() => {
    // Lần đầu: load danh sách phiên ngay
    fetchSessions();

    // Lấy socket singleton (đã được khởi tạo và xác thực bởi AdminLayout)
    const socket = getSocket();

    // Khi có thiết bị mới login hoặc 1 phiên bị revoke → tự động reload danh sách
    const handleSessionListChanged = () => {
      console.log('[SOCKET] SESSION_LIST_CHANGED — đang tải lại danh sách phiên...');
      fetchSessions();
    };

    socket.on('SESSION_LIST_CHANGED', handleSessionListChanged);

    // Cleanup: gỡ listener khi component unmount
    return () => {
      socket.off('SESSION_LIST_CHANGED', handleSessionListChanged);
    };
  }, []);

  // Sync theme to DOM and localStorage whenever activeTheme changes
  useEffect(() => {
    if (activeTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('admin_theme', activeTheme);
  }, [activeTheme]);

  const scrollToTop = () => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveIdentity = async (e) => {
    e.preventDefault();
    try {
      setIdentityMsg('Đang lưu thông tin...');
      const token = localStorage.getItem('admin_access_token');
      const res = await axios.put(`${apiBase}/user/update-profile`, {
        name: fullname,
        phone: tel,
        theme_preference: activeTheme
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIdentityMsg(res.data?.message || 'Cập nhật thông tin danh tính thành công!');
    } catch (err) {
      setIdentityMsg(err.response?.data?.message || 'Cập nhật thất bại.');
    } finally {
      setTimeout(() => setIdentityMsg(''), 3000);
    }
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMsg('Vui lòng điền đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    setPasswordMsg('Mật khẩu của bạn đã được cập nhật thành công!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordMsg(''), 3000);
  };

  const handleSaveWebhook = (e) => {
    e.preventDefault();
    setWebhookMsg('Cấu hình Webhook đã được cập nhật!');
    setTimeout(() => setWebhookMsg(''), 3000);
  };

  // ── Helper: lấy token (placeholder, trả về token hiện tại) ──────────────
  const getValidToken = async () => {
    return localStorage.getItem('admin_access_token') || null;
  };

  // ── Helper: axios với auto-refresh khi nhận 401 ──────────────────────────
  const axiosWithRefresh = async (config) => {
    try {
      return await axios(config);
    } catch (err) {
      if (err.response?.status !== 401) throw err;

      // Access token hết hạn → thử refresh
      const refreshToken =
        localStorage.getItem('admin_refresh_token') ||
        localStorage.getItem('refresh_token');
      if (!refreshToken) throw err;

      try {
        const refreshRes = await axios.post(
          `${SERVER_ROOT}/api/auth/refresh`,
          { refresh_token: refreshToken }
        );
        const newAccessToken =
          refreshRes.data?.access_token || refreshRes.data?.accessToken;
        const newRefreshToken =
          refreshRes.data?.refresh_token || refreshRes.data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem('admin_access_token', newAccessToken);
          localStorage.setItem('access_token', newAccessToken);
        }
        if (newRefreshToken) {
          localStorage.setItem('admin_refresh_token', newRefreshToken);
          localStorage.setItem('refresh_token', newRefreshToken);
        }

        // Retry request gốc với token mới
        const retryConfig = {
          ...config,
          headers: { ...config.headers, Authorization: `Bearer ${newAccessToken}` },
        };
        return await axios(retryConfig);
      } catch (refreshErr) {
        console.error('[TOKEN] Refresh thất bại, cần đăng nhập lại.');
        throw refreshErr;
      }
    }
  };

  // ── Fetch sessions from API ──────────────────────────────────────────────
  // URL chính xác: GET http://localhost:3000/api/v1/auth/sessions
  const fetchSessions = async () => {
    try {
      setSessionsLoading(true);
      setSessionsError('');
      const token = localStorage.getItem('admin_access_token');
      if (!token) return;

      const res = await axiosWithRefresh({
        method: 'get',
        url: `${SERVER_ROOT}/api/v1/auth/sessions`,
        headers: { Authorization: `Bearer ${token}` },
      });
      setSessions(res.data?.sessions || []);
    } catch (err) {
      console.error('[ADMIN PROFILE] fetchSessions failed:', err.response?.data?.message || err.message);
      setSessionsError('Không thể tải danh sách phiên. Vui lòng thử lại.');
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId) => {
    try {
      const token = localStorage.getItem('admin_access_token');
      // URL chính xác: POST http://localhost:3000/api/v1/auth/sessions/revoke
      await axiosWithRefresh({
        method: 'post',
        url: `${SERVER_ROOT}/api/v1/auth/sessions/revoke`,
        data: { sessionId },
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchSessions();
    } catch (err) {
      console.error('[ADMIN PROFILE] revokeSession failed:', err.response?.data?.message || err.message);
      setSessionsError(err.response?.data?.message || 'Đăng xuất phiên thất bại.');
      setTimeout(() => setSessionsError(''), 3000);
    }
  };


  // Avatar Handlers
  const handleAvatarClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Vui lòng chọn một file ảnh hợp lệ.');
        return;
      }
      // Read file as base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        localStorage.setItem('admin_avatar', base64Data);
        setAvatar(base64Data);
        // Dispatch event to sync with Header in real-time
        window.dispatchEvent(new Event('admin-avatar-changed'));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = (e) => {
    e.stopPropagation(); // Avoid triggering file upload click
    localStorage.removeItem('admin_avatar');
    setAvatar('');
    window.dispatchEvent(new Event('admin-avatar-changed'));
  };

  const handle2FAToggle = async () => {
    if (is2FaActive) {
      setIsDisabling(true);
      setShow2FAModal(true);
      setTwoFAToken('');
      setTwoFAError('');
    } else {
      setIsDisabling(false);
      setIs2FALoading(true);
      try {
        const token = localStorage.getItem('admin_access_token');
        const res = await axios.get(`${apiBase}/auth/2fa/generate`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = res.data;
        setQrCode(data.qrCode || '');
        setTempSecret(data.secret || '');
        setShow2FAModal(true);
        setTwoFAToken('');
        setTwoFAError('');
      } catch (err) {
        setTwoFAError(err.response?.data?.message || 'Không thể tạo mã QR.');
      } finally {
        setIs2FALoading(false);
      }
    }
  };

  const handleConfirm2FA = async () => {
    if (twoFAToken.length !== 6) return;
    setIs2FALoading(true);
    setTwoFAError('');
    try {
      const token = localStorage.getItem('admin_access_token');
      if (isDisabling) {
        const res = await axios.post(`${apiBase}/auth/2fa/disable`, { token: twoFAToken }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        saveAuthTokens(res.data);
        setIs2FaActive(false);
        setTwoFASuccess('Đã tắt bảo mật hai lớp (2FA).');
      } else {
        const res = await axios.post(`${apiBase}/auth/2fa/enable`, { secret: tempSecret, token: twoFAToken }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        saveAuthTokens(res.data);
        setIs2FaActive(true);
        setTwoFASuccess('Đã kích hoạt bảo mật hai lớp (2FA) thành công!');
      }
      setShow2FAModal(false);
      setQrCode('');
      setTempSecret('');
      setTwoFAToken('');
    } catch (err) {
      setTwoFAError(err.response?.data?.message || 'Xác thực thất bại.');
    } finally {
      setIs2FALoading(false);
    }
  };

  const handleClose2FAModal = () => {
    setShow2FAModal(false);
    setQrCode('');
    setTempSecret('');
    setTwoFAToken('');
    setTwoFAError('');
    setIsDisabling(false);
  };

  return (
    <div className="min-h-screen  bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 md:p-6 lg:p-8 flex flex-col gap-6 md:gap-8 select-none overflow-y-auto">
      
      {/* Page Title & Breadcrumb & Exit button */}
      <div className=" flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-3">
            <Shield className="text-amber-500" size={24} />
            Hồ Sơ & Trung Tâm Bảo Mật Admin
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Quản lý thông tin tài khoản root, thay đổi chính sách bảo mật hệ thống và cấu hình webhook giám sát.
          </p>
        </div>

        {/* Exit Icon X */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-800 shrink-0 hover:scale-[1.05] active:scale-[0.95]"
          title="Thoát hồ sơ"
        >
          <X size={18} />
        </button>
      </div>

      {/* ─── MODULE 1: ADMIN IDENTITY INFO ─── */}
      <section className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/50 pb-3">
          <User className="text-amber-500" size={20} />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Thông tin tài khoản quản trị
          </h2>
        </div>

        {/* Avatar Uploader Section */}
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border-slate-200 dark:border-slate-800/40">
          <div 
            onClick={handleAvatarClick}
            className="w-20 h-20 rounded-full bg-[#854d0e] text-white flex items-center justify-center font-bold text-xl cursor-pointer relative group overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0"
          >
            {avatar ? (
              <img src={avatar} alt="Admin Avatar" className="w-full h-full object-cover" />
            ) : (
              <span>VB</span>
            )}
            
            {/* Overlay Camera Icon on Hover */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-200">
              <Camera size={18} className="text-white" />
              <span className="text-[8px] font-black uppercase text-white tracking-widest mt-1">Đổi ảnh</span>
            </div>

            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Ảnh đại diện Quản trị viên</h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
              Nhấp trực tiếp vào biểu tượng vòng tròn để tải lên tệp ảnh cá nhân (.png, .jpg). Dung lượng đề xuất dưới 2MB.
            </p>
            {avatar && (
              <button 
                type="button"
                onClick={handleRemoveAvatar}
                className="text-[9px] font-bold text-red-400 hover:text-red-300 flex items-center justify-center sm:justify-start gap-1 mt-1 cursor-pointer bg-transparent border-none w-fit"
              >
                <Trash2 size={10} />
                Xoá ảnh hiện tại
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleSaveIdentity} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            
            {/* Họ và tên */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Họ và tên Quản trị viên
              </label>
              <input 
                type="text" 
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                required
              />
            </div>

            {/* Cấp bậc hệ thống */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Cấp bậc hệ thống
              </label>
              <div className="flex items-center h-[46px]">
                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 text-xs font-bold rounded-full tracking-wider">
                  SUPER ADMIN / ROOT
                </span>
              </div>
            </div>

            {/* Email Quản trị */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Email Quản trị
              </label>
              <input 
                type="email" 
                value="admin.bac@aistudio.vn"
                disabled
                className="w-full bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700/60 rounded-lg px-4 py-3 text-sm text-slate-400 dark:text-slate-500 cursor-not-allowed"
              />
            </div>

            {/* Số điện thoại liên hệ */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Số điện thoại liên hệ
              </label>
              <input 
                type="text" 
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                required
              />
            </div>

          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
            <span className="text-xs font-bold text-green-400">
              {identityMsg}
            </span>
            <button 
              type="submit"
              className="w-full md:w-auto py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              LƯU THAY ĐỔI DANH TÍNH
            </button>
          </div>
        </form>
      </section>

      {/* ─── MODULE 2: PASSWORD MUTATION CENTER ─── */}
      <section className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/50 pb-3">
          <KeyRound className="text-amber-500" size={20} />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Thay đổi mật khẩu định kỳ
          </h2>
        </div>

        <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            
            {/* Mật khẩu hiện tại */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Mật khẩu hiện tại
              </label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              />
            </div>

            {/* Mật khẩu mới */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Mật khẩu mới
              </label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              />
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Xác nhận mật khẩu mới
              </label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              />
            </div>

          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
            <span className={`text-xs font-bold ${passwordMsg.includes('không') || passwordMsg.includes('đầy đủ') ? 'text-red-400' : 'text-green-400'}`}>
              {passwordMsg}
            </span>
            <button 
              type="submit"
              className="w-full md:w-auto py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock size={14} />
              CẬP NHẬT MẬT KHẨU MỚI
            </button>
          </div>
        </form>
      </section>

      {/* ─── MODULE 3: TWO-FACTOR AUTHENTICATION (2FA) ─── */}
      <section className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/50 pb-3">
          <ShieldCheck className="text-amber-500" size={20} />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Bảo vệ hai lớp cấp cao (2FA)
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border-slate-200 dark:border-slate-800/40">
          <div className="flex flex-col gap-1 text-left">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
              Kích hoạt mã bảo mật OTP (Google Authenticator)
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Yêu cầu nhập mã xác minh gồm 6 chữ số từ thiết bị di động cá nhân của bạn mỗi khi đăng nhập vào quản trị hệ thống.
            </p>
            {twoFASuccess && <span className="text-[10px] font-bold text-green-400 mt-1">{twoFASuccess}</span>}
          </div>

          {/* Switch Toggle */}
          <button 
            type="button"
            disabled={is2FALoading}
            onClick={handle2FAToggle}
            className={`w-12 h-6 rounded-full p-1 transition-all duration-350 cursor-pointer ${is2FALoading ? 'opacity-50' : ''} ${is2FaActive ? 'bg-[#10b981]' : 'bg-zinc-800'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-350 shadow-md ${is2FaActive ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>

      {/* ── 2FA QR Modal ── */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl max-w-md w-full p-6 relative flex flex-col gap-4 text-center select-none shadow-2xl">
            <button
              onClick={handleClose2FAModal}
              className="absolute right-4 top-4 p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-all border border-slate-200 dark:border-slate-800 cursor-pointer hover:scale-[1.05] active:scale-[0.95]"
            >
              <X size={16} />
            </button>

            <h3 className="text-md font-black uppercase tracking-wider text-white mt-2">
              {isDisabling ? 'Tắt bảo mật 2FA' : 'Kích hoạt bảo mật 2FA'}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-2">
              {isDisabling
                ? 'Nhập mã 6 số từ Google Authenticator để xác nhận tắt 2FA.'
                : 'Quét mã QR bằng Google Authenticator, sau đó nhập mã 6 số để xác nhận.'
              }
            </p>

            {!isDisabling && qrCode && (
              <div className="mx-auto bg-white p-3 rounded-lg w-52 h-52 flex items-center justify-center border border-slate-200 dark:border-slate-800 mt-1 shadow-inner">
                <img src={qrCode} alt="QR Code 2FA" className="w-full h-full object-contain" />
              </div>
            )}

            {!isDisabling && tempSecret && (
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border-slate-200 dark:border-slate-800/40 text-left text-xs">
                <span className="text-slate-500 dark:text-slate-400">Hoặc nhập mã thủ công:</span>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono font-bold text-amber-500 text-xs break-all">{tempSecret}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(tempSecret); alert('Đã sao chép mã secret!'); }}
                    className="text-amber-500 hover:underline cursor-pointer bg-transparent border-none text-[10px] font-bold shrink-0"
                  >
                    Sao chép
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 text-left">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Mã xác thực 6 số</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={twoFAToken}
                onChange={(e) => { setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6)); setTwoFAError(''); }}
                placeholder="000000"
                className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all text-center text-2xl tracking-[0.5em] font-mono"
              />
              {twoFAError && <span className="text-[10px] text-red-500 font-bold">{twoFAError}</span>}
            </div>

            <button
              type="button"
              disabled={is2FALoading || twoFAToken.length !== 6}
              onClick={handleConfirm2FA}
              className="w-full py-3 px-6 bg-amber-500 hover:bg-amber-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed border-none"
            >
              {is2FALoading ? 'Đang xác thực...' : (isDisabling ? 'TẮT 2FA' : 'KÍCH HOẠT 2FA')}
            </button>
          </div>
        </div>
      )}

      {/* ─── MODULE 4: ACTIVE SESSIONS MONITORING ─── */}
      <section className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/50 pb-3">
          <Monitor className="text-amber-500" size={20} />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Quản lý các phiên đăng nhập đang hoạt động
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {/* Loading state */}
          {sessionsLoading && (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs text-slate-400 animate-pulse">Đang tải danh sách phiên...</span>
            </div>
          )}

          {/* Error state */}
          {sessionsError && !sessionsLoading && (
            <div className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              {sessionsError}
            </div>
          )}

          {/* Empty state */}
          {!sessionsLoading && !sessionsError && sessions.length === 0 && (
            <div className="text-center py-6">
              <span className="text-xs text-slate-500 dark:text-slate-400">Không có phiên nào đang hoạt động.</span>
            </div>
          )}

          {/* Sessions list */}
          {!sessionsLoading && sessions.map((session) => {
            // So sánh refresh_token của phiên với token đang dùng trong trình duyệt hiện tại
            const currentRefreshToken = localStorage.getItem('admin_refresh_token') || localStorage.getItem('refresh_token') || '';
            const isCurrentSession = session.refresh_token === currentRefreshToken;
            const ipDisplay = session.ip_address && session.location
              ? `${session.ip_address} (${session.location})`
              : session.ip_address || session.location || 'Không rõ';

            return (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border-slate-200 dark:border-slate-800/40"
              >
                <div className="flex items-center gap-3.5 text-left">
                  <div className="bg-amber-500/10 text-amber-500 p-2.5 rounded-lg border border-amber-500/15">
                    {(session.device_string || '').toLowerCase().includes('mobile') || (session.device_string || '').toLowerCase().includes('iphone') || (session.device_string || '').toLowerCase().includes('android')
                      ? <Smartphone size={18} />
                      : <Monitor size={18} />}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 tracking-wide truncate">
                      {session.device_string || 'Unknown Device'}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">IP Address: {ipDisplay}</p>
                  </div>
                </div>

                {isCurrentSession ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-wider self-start sm:self-center shrink-0">
                    [ PHIÊN HIỆN TẠI ]
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTerminateSession(session.id)}
                    className="w-full sm:w-auto px-3.5 py-2 bg-red-950/40 hover:bg-red-900 border border-red-900/40 text-red-400 font-bold text-[10px] rounded-lg tracking-wider flex items-center justify-center gap-1.5 cursor-pointer uppercase transition-all"
                  >
                    <LogOut size={12} />
                    [ ĐĂNG XUẤT ]
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── MODULE 5: WEBHOOK ADMIN ALERT BOT ─── */}
      <div className="relative opacity-35 cursor-not-allowed select-none transition-all duration-200">
        {/* Lớp phủ trong suốt — chặn tuyệt đối mọi tương tác chuột/bàn phím */}
        <div className="absolute inset-0 z-50 bg-transparent"></div>

        {/* Nhãn "Sắp ra mắt" góc trên phải */}
        <div className="absolute top-4 right-4 z-50 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold px-2.5 py-1 rounded">Sắp ra mắt</div>

        <section className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/50 pb-3">
            <Terminal className="text-amber-500" size={20} />
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Cấu hình cảnh báo vận hành hệ thống (Webhook Bot)
            </h2>
          </div>

          <form onSubmit={handleSaveWebhook} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Telegram Bot API Endpoint URL
              </label>
              <input 
                type="text" 
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.telegram.org/bot<TOKEN>/sendMessage"
                className="w-full bg-white dark:bg-slate-800 dark:border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5 mt-2 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border-slate-200 dark:border-slate-800/40">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">Cảnh báo chi phí API vượt ngưỡng</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Nhận tin nhắn khẩn cấp khi mức tiêu dùng API trong ngày chạm ngưỡng 80% hạn mức thanh toán.
                  </span>
                </div>
                
                <button 
                  type="button"
                  onClick={() => setIsAlertCostActive(!isAlertCostActive)}
                  className={`w-12 h-6 rounded-full p-1 transition-all duration-350 cursor-pointer ${isAlertCostActive ? 'bg-[#10b981]' : 'bg-zinc-800'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-350 shadow-md ${isAlertCostActive ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
              <span className="text-xs font-bold text-green-400">
                {webhookMsg}
              </span>
              <button 
                type="submit"
                className="w-full md:w-auto py-3 px-6 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.25)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={14} />
                CẬP NHẬT CẤU HÌNH BOT
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* ─── MODULE 6: NATIVE LIGHT/DARK THEME SELECTOR ─── */}
      <section className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800/50 pb-3">
          <Palette className="text-amber-500" size={20} />
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Cài đặt chủ đề hiển thị hệ thống quản trị
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Card Option A: Dark Theme (Studio Deep Dark) */}
          <div 
            onClick={() => { document.documentElement.classList.add('dark'); setActiveTheme('dark'); }}
            className={`p-5 rounded-xl border flex flex-col gap-3 text-left transition-all cursor-pointer ${activeTheme === 'dark' ? 'border-amber-500/70 bg-amber-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-zinc-400 dark:hover:border-slate-600'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">Chủ đề tối (Studio Deep Dark)</span>
              {activeTheme === 'dark' && <div className="w-5 h-5 bg-amber-500 text-black rounded-full flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Tối ưu cho mắt người sử dụng trong thời gian dài. Giao diện tối hiện đại với các đường viền nhấn nổi bật Hổ Phách.
            </p>
          </div>

          {/* Card Option B: Light Theme (Clean Light mode) */}
          <div 
            onClick={() => { document.documentElement.classList.remove('dark'); setActiveTheme('light'); }}
            className={`p-5 rounded-xl border flex flex-col gap-3 text-left transition-all cursor-pointer ${activeTheme === 'light' ? 'border-amber-500/70 bg-amber-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:border-zinc-400 dark:hover:border-slate-600'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">Chủ đề sáng (Clean Light mode)</span>
              {activeTheme === 'light' && <div className="w-5 h-5 bg-amber-500 text-black rounded-full flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Độ tương phản sáng rõ rệt phù hợp làm việc ban ngày hoặc môi trường nhiều ánh sáng bên ngoài.
            </p>
          </div>

        </div>
      </section>

      {/* Scroll-to-Top Floating Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          type="button"
          className="fixed bottom-6 right-6 z-40 p-3.5 bg-amber-500 hover:bg-amber-600 text-black rounded-full shadow-2xl transition-all cursor-pointer border border-amber-500/70 hover:scale-105 active:scale-95 flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="Quay lại đầu trang"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      )}

    </div>
  );
}
