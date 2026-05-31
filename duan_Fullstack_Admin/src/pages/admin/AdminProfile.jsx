import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [is2FaActive, setIs2FaActive] = useState(true);

  // Webhook states
  const [webhookUrl, setWebhookUrl] = useState('https://api.telegram.org/bot724391:AAH-u58.../sendMessage');
  const [isAlertCostActive, setIsAlertCostActive] = useState(true);

  // Theme states
  const [activeTheme, setActiveTheme] = useState('dark'); // 'dark' | 'light'

  // Avatar State
  const [avatar, setAvatar] = useState(localStorage.getItem('admin_avatar') || '');

  // Active Sessions
  const [sessions, setSessions] = useState([
    { id: 1, device: 'Chrome Browser — Windows 11 OS', ip: '14.232.122.18 (Hà Nội, Việt Nam)', active: true },
    { id: 2, device: 'Safari Browser — macOS Sequoia OS', ip: '115.79.208.43 (TP. Hồ Chí Minh, Việt Nam)', active: false },
    { id: 3, device: 'Chrome Mobile — iOS 18 (iPhone 15 Pro)', ip: '27.72.93.104 (Đà Nẵng, Việt Nam)', active: false }
  ]);

  // Messages / feedback states
  const [identityMsg, setIdentityMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [webhookMsg, setWebhookMsg] = useState('');

  // Scroll-to-Top State & Effect
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  const scrollToTop = () => {
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSaveIdentity = (e) => {
    e.preventDefault();
    setIdentityMsg('Cập nhật thông tin danh tính thành công!');
    setTimeout(() => setIdentityMsg(''), 3000);
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

  const handleTerminateSession = (id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
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

  return (
    <div className="min-h-screen bg-[#131316] text-[#e2e8f0] p-4 md:p-6 lg:p-8 flex flex-col gap-6 md:gap-8 select-none overflow-y-auto">
      
      {/* Page Title & Breadcrumb & Exit button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#222226] pb-4">
        <div className="flex flex-col gap-1 text-left">
          <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
            <Shield className="text-[#f59e0b]" size={24} />
            Hồ Sơ & Trung Tâm Bảo Mật Admin
          </h1>
          <p className="text-xs text-admin-text-muted">
            Quản lý thông tin tài khoản root, thay đổi chính sách bảo mật hệ thống và cấu hình webhook giám sát.
          </p>
        </div>

        {/* Exit Icon X */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="p-2 bg-[#18181c] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer border border-[#222226] shrink-0 hover:scale-[1.05] active:scale-[0.95]"
          title="Thoát hồ sơ"
        >
          <X size={18} />
        </button>
      </div>

      {/* ─── MODULE 1: ADMIN IDENTITY INFO ─── */}
      <section className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <User className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Thông tin tài khoản quản trị
          </h2>
        </div>

        {/* Avatar Uploader Section */}
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#0f0f11] p-4 rounded-xl border border-[#222226]/40">
          <div 
            onClick={handleAvatarClick}
            className="w-20 h-20 rounded-full bg-[#854d0e] text-white flex items-center justify-center font-bold text-xl cursor-pointer relative group overflow-hidden border border-[#222226] shrink-0"
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
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Ảnh đại diện Quản trị viên</h3>
            <p className="text-[10px] text-admin-text-muted leading-relaxed max-w-md">
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
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
                Họ và tên Quản trị viên
              </label>
              <input 
                type="text" 
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
                required
              />
            </div>

            {/* Cấp bậc hệ thống */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
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
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
                Email Quản trị
              </label>
              <input 
                type="email" 
                value="admin.bac@aistudio.vn"
                disabled
                className="w-full bg-[#1b1b22] border border-[#222226]/60 rounded-lg px-4 py-3 text-sm text-zinc-500 cursor-not-allowed"
              />
            </div>

            {/* Số điện thoại liên hệ */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
                Số điện thoại liên hệ
              </label>
              <input 
                type="text" 
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
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
              className="w-full md:w-auto py-3 px-6 bg-[#f59e0b] hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              LƯU THAY ĐỔI DANH TÍNH
            </button>
          </div>
        </form>
      </section>

      {/* ─── MODULE 2: PASSWORD MUTATION CENTER ─── */}
      <section className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <KeyRound className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Thay đổi mật khẩu định kỳ
          </h2>
        </div>

        <form onSubmit={handleSavePassword} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            
            {/* Mật khẩu hiện tại */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
                Mật khẩu hiện tại
              </label>
              <input 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
              />
            </div>

            {/* Mật khẩu mới */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
                Mật khẩu mới
              </label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
              />
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
                Xác nhận mật khẩu mới
              </label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
              />
            </div>

          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
            <span className={`text-xs font-bold ${passwordMsg.includes('không') || passwordMsg.includes('đầy đủ') ? 'text-red-400' : 'text-green-400'}`}>
              {passwordMsg}
            </span>
            <button 
              type="submit"
              className="w-full md:w-auto py-3 px-6 bg-[#f59e0b] hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Lock size={14} />
              CẬP NHẬT MẬT KHẨU MỚI
            </button>
          </div>
        </form>
      </section>

      {/* ─── MODULE 3: TWO-FACTOR AUTHENTICATION (2FA) ─── */}
      <section className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <ShieldCheck className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Bảo vệ hai lớp cấp cao (2FA)
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-[#0f0f11] p-4 rounded-xl border border-[#222226]/40">
          <div className="flex flex-col gap-1 text-left">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">
              Kích hoạt mã bảo mật OTP (Google Authenticator)
            </h3>
            <p className="text-[10px] text-admin-text-muted leading-relaxed">
              Yêu cầu nhập mã xác minh gồm 6 chữ số từ thiết bị di động cá nhân của bạn mỗi khi đăng nhập vào quản trị hệ thống.
            </p>
          </div>

          {/* Switch Toggle */}
          <button 
            type="button"
            onClick={() => setIs2FaActive(!is2FaActive)}
            className={`w-12 h-6 rounded-full p-1 transition-all duration-350 cursor-pointer ${is2FaActive ? 'bg-[#10b981]' : 'bg-zinc-800'}`}
          >
            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-350 shadow-md ${is2FaActive ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>
      </section>

      {/* ─── MODULE 4: ACTIVE SESSIONS MONITORING ─── */}
      <section className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <Monitor className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Quản lý các phiên đăng nhập đang hoạt động
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <div 
              key={session.id}
              className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-[#0f0f11] rounded-xl border border-[#222226]/40"
            >
              <div className="flex items-center gap-3.5 text-left">
                <div className="bg-[#f59e0b]/10 text-[#f59e0b] p-2.5 rounded-lg border border-[#f59e0b]/15">
                  {session.device.includes('Mobile') ? <Smartphone size={18} /> : <Monitor size={18} />}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <h4 className="text-xs font-bold text-white tracking-wide truncate">{session.device}</h4>
                  <p className="text-[10px] text-admin-text-muted">IP Address: {session.ip}</p>
                </div>
              </div>

              {session.active ? (
                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 text-[9px] font-black rounded-full uppercase tracking-wider self-start sm:self-center shrink-0">
                  Phiên hiện tại
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTerminateSession(session.id)}
                  className="w-full sm:w-auto px-3.5 py-2 bg-red-950/40 hover:bg-red-900 border border-red-900/40 text-red-400 font-bold text-[10px] rounded-lg tracking-wider flex items-center justify-center gap-1.5 cursor-pointer uppercase transition-all"
                >
                  <LogOut size={12} />
                  Đăng xuất
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── MODULE 5: WEBHOOK ADMIN ALERT BOT ─── */}
      <section className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <Terminal className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Cấu hình cảnh báo vận hành hệ thống (Webhook Bot)
          </h2>
        </div>

        <form onSubmit={handleSaveWebhook} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-admin-text-muted uppercase tracking-wide">
              Telegram Bot API Endpoint URL
            </label>
            <input 
              type="text" 
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://api.telegram.org/bot<TOKEN>/sendMessage"
              className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5 mt-2 bg-[#0f0f11] p-4 rounded-xl border border-[#222226]/40">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 text-left">
                <span className="text-xs font-bold text-white uppercase tracking-wide">Cảnh báo chi phí API vượt ngưỡng</span>
                <span className="text-[10px] text-admin-text-muted leading-relaxed">
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
              className="w-full md:w-auto py-3 px-6 bg-[#f59e0b] hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save size={14} />
              CẬP NHẬT CẤU HÌNH BOT
            </button>
          </div>
        </form>
      </section>

      {/* ─── MODULE 6: NATIVE LIGHT/DARK THEME SELECTOR ─── */}
      <section className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <Palette className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">
            Cài đặt chủ đề hiển thị hệ thống quản trị
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Card Option A: Dark Theme (Studio Deep Dark) */}
          <div 
            onClick={() => setActiveTheme('dark')}
            className={`p-5 rounded-xl border flex flex-col gap-3 text-left transition-all cursor-pointer ${activeTheme === 'dark' ? 'border-[#f59e0b] bg-[#f59e0b]/5 shadow-md shadow-amber-500/5' : 'border-[#222226] bg-[#0f0f11]/50 hover:border-zinc-800'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white uppercase tracking-wide">Chủ đề tối (Studio Deep Dark)</span>
              {activeTheme === 'dark' && <div className="w-5 h-5 bg-[#f59e0b] text-black rounded-full flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>}
            </div>
            <p className="text-[10px] text-admin-text-muted leading-relaxed">
              Tối ưu cho mắt người sử dụng trong thời gian dài. Giao diện tối hiện đại với các đường viền nhấn nổi bật Hổ Phách.
            </p>
          </div>

          {/* Card Option B: Light Theme (Clean Light mode) */}
          <div 
            onClick={() => setActiveTheme('light')}
            className={`p-5 rounded-xl border flex flex-col gap-3 text-left transition-all cursor-pointer ${activeTheme === 'light' ? 'border-[#f59e0b] bg-[#f59e0b]/5 shadow-md shadow-amber-500/5' : 'border-[#222226] bg-[#0f0f11]/50 hover:border-zinc-800'}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-white uppercase tracking-wide">Chủ đề sáng (Clean Light mode)</span>
              {activeTheme === 'light' && <div className="w-5 h-5 bg-[#f59e0b] text-black rounded-full flex items-center justify-center"><Check size={12} strokeWidth={3} /></div>}
            </div>
            <p className="text-[10px] text-admin-text-muted leading-relaxed">
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
          className="fixed bottom-6 right-6 z-40 p-3.5 bg-[#f59e0b] hover:bg-amber-600 text-black rounded-full shadow-2xl transition-all cursor-pointer border border-[#f59e0b] hover:scale-105 active:scale-95 flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-300"
          title="Quay lại đầu trang"
        >
          <ArrowUp size={18} strokeWidth={2.5} />
        </button>
      )}

    </div>
  );
}
