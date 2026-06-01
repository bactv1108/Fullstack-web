import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, KeyRound, CreditCard, Save, Lock, X, Coins, History, Camera, Trash2, CheckCircle2, Sliders, Eye, EyeOff } from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

const packageMeta = {
  free: {
    badge: 'Free Tier',
    badgeClass: 'text-zinc-500',
    description: 'Trải nghiệm ban đầu các tính năng tạo video & giọng nói AI cơ bản.',
    priceSuffix: 'vĩnh viễn',
    cardClass: 'bg-[#0f0f11] p-5 rounded-xl border border-[#222226]/60 flex flex-col justify-between gap-4 text-left',
    titleColorClass: 'text-white',
    checkColorClass: 'text-emerald-500',
    features: (credits) => [
      `Tặng sẵn ${credits} Credits hệ thống`,
      'Chất lượng xuất video SD'
    ]
  },
  basic: {
    badge: 'Creator Choice',
    badgeClass: 'text-[#f59e0b]',
    description: 'Phù hợp nhu cầu cá nhân sáng tạo nội dung hàng tuần chuyên nghiệp.',
    priceSuffix: 'gói',
    cardClass: 'bg-[#0f0f11] p-5 rounded-xl border border-[#f59e0b]/30 bg-gradient-to-b from-[#f59e0b]/5 to-transparent flex flex-col justify-between gap-4 text-left',
    titleColorClass: 'text-white',
    checkColorClass: 'text-[#f59e0b]',
    features: (credits) => [
      `Cộng thêm ${credits} Credits vào ví`,
      'Chất lượng kết xuất video HD',
      'Truy cập mọi kho giọng đọc AI'
    ]
  },
  premium: {
    badge: 'Agency Pro',
    badgeClass: 'text-purple-400',
    description: 'Giải pháp toàn diện tối ưu cho Studio & Agency chuyên nghiệp.',
    priceSuffix: 'gói',
    cardClass: 'bg-[#0f0f11] p-5 rounded-xl border border-[#222226]/60 flex flex-col justify-between gap-4 text-left',
    titleColorClass: 'text-white',
    checkColorClass: 'text-emerald-500',
    features: (credits) => [
      `Cộng mạnh ${credits} Credits vào ví`,
      'Kết xuất video chất lượng cao 4K',
      'Ưu tiên xử lý kết xuất nhanh'
    ]
  }
};

export default function SettingsView({ setUserName, setAvatarImage, setCredits, credits }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const [fullname, setFullname] = useState('Trần Văn Bắc');
  const [email, setEmail] = useState('tranvanbac2003@gmail.com');
  const [avatar, setAvatar] = useState(localStorage.getItem('user_avatar') || '');
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const [transactions, setTransactions] = useState([
    { id: 'TRX-001', package: 'Gói Basic', type: 'Thanh toán', amount: '150.000 đ', credits: '+600', status: 'Thành công', date: '14:25:34 31/05/2026' },
    { id: 'TRX-002', package: 'Gói Free', type: 'Hệ thống tặng', amount: '0 đ', credits: '+60', status: 'Thành công', date: '09:12:05 01/05/2026' }
  ]);

  const [packages, setPackages] = useState([]);
  
  // Modal states for VietQR dynamically loaded payments
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState(null);

  // Load profile data, dynamic packages and transactions history on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const profileRes = await axiosClient.get('/user/profile');
        if (profileRes) {
          setFullname(profileRes.name || '');
          setEmail(profileRes.email || '');
          setAvatar(profileRes.avatar || '');
          if (setUserName) setUserName(profileRes.name || '');
          if (setAvatarImage) setAvatarImage(profileRes.avatar || '');
          if (setCredits) setCredits(profileRes.credits || 0);
        }
      } catch (err) {
        console.error('[SETTINGS] Error fetching profile:', err);
      }

      try {
        const transRes = await axiosClient.get('/profile/transactions');
        if (transRes && transRes.success && transRes.data && transRes.data.length > 0) {
          const mapped = transRes.data.map(tx => ({
            id: tx.id,
            package: tx.package?.name || tx.package_id || 'Gói cước',
            type: tx.amount > 0 ? 'Thanh toán' : 'Hệ thống tặng',
            amount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount).replace('₫', 'đ'),
            credits: `+${tx.credits_added}`,
            status: tx.status === 'success' ? 'Thành công' : tx.status === 'pending' ? 'Chờ xử lý' : 'Thất bại',
            date: new Date(tx.createdAt).toLocaleString('vi-VN')
          }));
          setTransactions(mapped);
        }
      } catch (err) {
        console.error('[SETTINGS] Error fetching transactions:', err);
      }

      try {
        const pkgRes = await axiosClient.get('/user/packages');
        if (pkgRes && pkgRes.length > 0) {
          setPackages(pkgRes);
        } else if (pkgRes && pkgRes.data && pkgRes.data.length > 0) {
          setPackages(pkgRes.data);
        }
      } catch (err) {
        console.error('[SETTINGS] Error fetching packages:', err);
      }
    };

    fetchUserData();
  }, []);

  // Polling check for transaction status
  useEffect(() => {
    let timer = null;

    if (isModalOpen && activeTransaction?.id) {
      timer = setInterval(async () => {
        try {
          const res = await axiosClient.get(`/user/payment/status/${activeTransaction.id}`);
          if (res && res.status === 'success') {
            clearInterval(timer);
            setIsModalOpen(false);
            alert(`🎉 Chúc mừng bạn đã nạp tiền và thanh toán thành công! Hệ thống đã cộng thêm ${activeTransaction.credits} Credits vào ví của bạn.`);
            
            // Refetch profile data to update UI and header states dynamically without reload
            try {
              const profileRes = await axiosClient.get('/user/profile');
              if (profileRes) {
                setFullname(profileRes.name || '');
                setEmail(profileRes.email || '');
                setAvatar(profileRes.avatar || '');
                if (setUserName) setUserName(profileRes.name || '');
                if (setAvatarImage) setAvatarImage(profileRes.avatar || '');
                if (setCredits) setCredits(profileRes.credits || 0);
              }

              // Also refetch transaction list
              const transRes = await axiosClient.get('/profile/transactions');
              if (transRes && transRes.success && transRes.data && transRes.data.length > 0) {
                const mapped = transRes.data.map(tx => ({
                  id: tx.id,
                  package: tx.package?.name || tx.package_id || 'Gói cước',
                  type: tx.amount > 0 ? 'Thanh toán' : 'Hệ thống tặng',
                  amount: new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tx.amount).replace('₫', 'đ'),
                  credits: `+${tx.credits_added}`,
                  status: tx.status === 'success' ? 'Thành công' : tx.status === 'pending' ? 'Chờ xử lý' : 'Thất bại',
                  date: new Date(tx.createdAt).toLocaleString('vi-VN')
                }));
                setTransactions(mapped);
              }
            } catch (err) {
              console.error('[SETTINGS] Profile refetch error:', err);
            }
            
            setActiveTransaction(null);
          } else if (res && res.status === 'failed') {
            clearInterval(timer);
            setIsModalOpen(false);
            alert('❌ Đơn nạp tiền này đã bị thất bại hoặc bị hủy bỏ.');
            setActiveTransaction(null);
          }
        } catch (err) {
          console.error('[SETTINGS] Polling transaction error:', err);
        }
      }, 3000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isModalOpen, activeTransaction, setCredits, setUserName, setAvatarImage]);

  // Hash route scroll management
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.substring(1);
      const element = document.getElementById(targetId);
      if (element) {
        setTimeout(() => { element.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
      }
    }
  }, [location.hash]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setProfileMsg('Đang lưu thông tin...');
      const response = await axiosClient.put('/user/update-profile', { fullname, avatar });
      setProfileMsg(response?.message || 'Cập nhật thông tin hồ sơ thành công!');
      if (setUserName) setUserName(fullname);
      if (setAvatarImage) setAvatarImage(avatar);
    } catch (err) {
      console.error('[SETTINGS] Save profile error:', err);
      setProfileMsg(err.response?.data?.message || err.message || 'Cập nhật thông tin hồ sơ thất bại.');
    } finally {
      setTimeout(() => setProfileMsg(''), 3000);
    }
  };

  const getPasswordStrength = (p) => {
    if (!p) return { score: 0, label: '', color: '' };
    if (p.length < 6) return { score: 1, label: 'Yếu', color: 'bg-red-500' };

    const hasLetters = /[a-zA-Z]/.test(p);
    const hasNumbers = /[0-9]/.test(p);
    const hasSpecial = /[^a-zA-Z0-9]/.test(p);

    // Only letters or only numbers
    if ((hasLetters && !hasNumbers && !hasSpecial) || (hasNumbers && !hasLetters && !hasSpecial)) {
      return { score: 2, label: 'Trung bình', color: 'bg-amber-500' };
    }

    // Letters, numbers and special characters
    if (hasLetters && hasNumbers && hasSpecial) {
      return { score: 4, label: 'Mạnh', color: 'bg-emerald-500' };
    }

    // Letters and numbers only (no special character)
    return { score: 3, label: 'Trung bình', color: 'bg-yellow-500' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleSavePassword = async (e) => {
    e.preventDefault();
    
    // Reset errors
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
    setPasswordMsg('');

    let hasError = false;

    if (!currentPassword) {
      setCurrentPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      hasError = true;
    }
    if (!newPassword) {
      setNewPasswordError('Vui lòng nhập mật khẩu mới.');
      hasError = true;
    }
    if (!confirmPassword) {
      setConfirmPasswordError('Vui lòng nhập xác nhận mật khẩu mới.');
      hasError = true;
    }

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      setConfirmPasswordError('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      hasError = true;
    }

    if (currentPassword && newPassword && newPassword === currentPassword) {
      setNewPasswordError('Mật khẩu mới không được trùng với mật khẩu cũ!');
      setPasswordMsg('Mật khẩu mới không được trùng với mật khẩu cũ!');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    try {
      setPasswordMsg('Đang cập nhật mật khẩu...');
      const response = await axiosClient.put('/user/change-password', {
        currentPassword,
        newPassword
      });
      setPasswordMsg(response?.message || 'Mật khẩu đã được thay đổi và cập nhật thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('[SETTINGS] Change password error:', err);
      const serverMsg = err.response?.data?.message || err.message || 'Mật khẩu hiện tại không chính xác.';
      setPasswordMsg(serverMsg);
      if (serverMsg.includes('hiện tại không chính xác') || serverMsg.includes('không chính xác')) {
        setCurrentPasswordError('Mật khẩu hiện tại không chính xác.');
      } else if (serverMsg.includes('trùng')) {
        setNewPasswordError('Mật khẩu mới không được trùng với mật khẩu cũ!');
      }
    }
  };

  const handleAvatarClick = () => { if (fileInputRef.current) fileInputRef.current.click(); };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) { alert('Vui lòng chọn một file ảnh hợp lệ.'); return; }
      const reader = new FileReader();
      reader.onloadend = () => { const base64Data = reader.result; localStorage.setItem('user_avatar', base64Data); setAvatar(base64Data); };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = (e) => { 
    e.stopPropagation(); 
    localStorage.removeItem('user_avatar'); 
    setAvatar(''); 
    if (setAvatarImage) setAvatarImage('');
  };

  const handlePurchasePackage = async (packageId) => {
    try {
      const response = await axiosClient.post('/user/payment/create', { packageId });
      if (response) {
        setActiveTransaction({
          id: response.id,
          amount: response.amount,
          credits: response.credits,
          memo: response.memo
        });
        setIsModalOpen(true);
      }
    } catch (err) {
      console.error('[SETTINGS] Error creating payment order:', err);
      alert(err.response?.data?.message || err.message || 'Khởi tạo giao dịch nạp tiền thất bại.');
    }
  };

  return (
    <div className="min-h-screen bg-[#131316] text-[#e2e8f0] p-4 md:p-6 lg:p-8 flex flex-col gap-6 md:gap-8 select-none overflow-y-auto w-full">
      <div className="flex items-center justify-between border-b border-[#222226] pb-4 w-full">
        <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3 text-left">
          <Sliders className="text-[#f59e0b]" size={24} /> Cài đặt hệ thống
        </h1>
        <button onClick={() => navigate('/dashboard')} className="p-2 bg-[#18181c] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer border border-[#222226] shrink-0 hover:scale-[1.05] active:scale-[0.95]">
          <X size={18} />
        </button>
      </div>

      <section id="profile-section" className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5 w-full text-left">
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-3">
          <User className="text-[#f59e0b]" size={20} />
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Hồ sơ cá nhân & Bảo mật</h2>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-[#0f0f11] p-4 rounded-xl border border-[#222226]/40 w-full">
          <div onClick={handleAvatarClick} className="w-20 h-20 rounded-full bg-[#854d0e] text-white flex items-center justify-center font-bold text-xl cursor-pointer relative group overflow-hidden border border-[#222226] shrink-0">
            {avatar ? <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" /> : <span>TB</span>}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity duration-200">
              <Camera size={18} className="text-white" />
              <span className="text-[8px] font-black uppercase text-white tracking-widest mt-1">Đổi ảnh</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
          </div>
          <div className="flex flex-col gap-1.5 text-center sm:text-left">
            <h3 className="text-xs font-bold text-white uppercase tracking-wide">Ảnh đại diện người dùng</h3>
            <p className="text-[10px] text-zinc-400 leading-relaxed max-w-md">Hỗ trợ định dạng JPG, PNG, WEBP. Dung lượng tối đa không vượt quá 2MB để đảm bảo tối ưu hóa lưu trữ Cloud DB.</p>
            {avatar && <button type="button" onClick={handleRemoveAvatar} className="text-[9px] font-bold text-red-400 hover:text-red-300 flex items-center justify-center mx-auto text-center w-full sm:w-auto sm:justify-start sm:mx-0 gap-1 mt-1 cursor-pointer bg-transparent border-none"><Trash2 size={10} /> Xoá ảnh đại diện hiện tại</button>}
          </div>
        </div>
        <form onSubmit={handleSaveProfile} className="flex flex-col gap-5 w-full">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Họ và tên thành viên</label>
              <input type="text" value={fullname} onChange={(e) => setFullname(e.target.value)} className="w-full bg-[#131316] border border-[#222226] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all" required />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Địa chỉ Email (Không thể thay đổi)</label>
              <input type="email" value={email} disabled className="w-full bg-[#1b1b22] border border-[#222226]/60 rounded-lg px-4 py-3 text-sm text-zinc-500 cursor-not-allowed" />
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-[#222226]/30 pt-4">
            <span className="text-xs font-bold text-green-400">{profileMsg}</span>
            <button type="submit" className="w-full md:w-auto py-3 px-6 bg-[#f59e0b] hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"><Save size={14} /> LƯU THAY ĐỔI HỒ SƠ</button>
          </div>
        </form>
        <div className="flex items-center gap-3 border-b border-[#222226]/50 pb-2 mt-4">
          <KeyRound className="text-[#f59e0b]" size={16} />
          <h3 className="text-xs font-black text-white uppercase tracking-wider">Thay đổi mật khẩu định kỳ</h3>
        </div>
        <form onSubmit={handleSavePassword} className="flex flex-col gap-5 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Mật khẩu hiện tại</label>
              <div className="relative">
                <input 
                  type={showCurrentPass ? "text" : "password"} 
                  value={currentPassword} 
                  onChange={(e) => { setCurrentPassword(e.target.value); setCurrentPasswordError(''); }} 
                  placeholder="••••••••" 
                  className={`w-full bg-[#131316] border ${currentPasswordError ? 'border-red-500' : 'border-[#222226]'} rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all`} 
                />
                <button 
                  type="button" 
                  onClick={() => setShowCurrentPass(!showCurrentPass)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none"
                >
                  {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {currentPasswordError && <span className="text-[10px] text-red-500 font-bold mt-1 text-left">{currentPasswordError}</span>}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Mật khẩu mới</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => { setNewPassword(e.target.value); setNewPasswordError(''); }} 
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                placeholder="••••••••" 
                className={`w-full bg-[#131316] border ${newPasswordError ? 'border-red-500' : 'border-[#222226]'} rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all`} 
              />
              {newPasswordError && <span className="text-[10px] text-red-500 font-bold mt-1 text-left">{newPasswordError}</span>}
              
              {/* Password Strength Meter */}
              <div>
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  <div className={`h-1 rounded transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-[#222226]'}`}></div>
                  <div className={`h-1 rounded transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-[#222226]'}`}></div>
                  <div className={`h-1 rounded transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-[#222226]'}`}></div>
                  <div className={`h-1 rounded transition-all duration-300 ${strength.score >= 4 ? strength.color : 'bg-[#222226]'}`}></div>
                </div>
                {strength.label && (
                  <div className="text-right mt-1">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      strength.score === 1 ? 'text-red-500' :
                      strength.score === 2 ? 'text-amber-500' :
                      strength.score === 3 ? 'text-yellow-500' : 'text-emerald-500'
                    }`}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <input 
                  type={showConfirmPass ? "text" : "password"} 
                  value={confirmPassword} 
                  onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(''); }} 
                  placeholder="••••••••" 
                  className={`w-full bg-[#131316] border ${confirmPasswordError ? 'border-red-500' : 'border-[#222226]'} rounded-lg pl-4 pr-10 py-3 text-sm text-white focus:outline-none focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b] transition-all`} 
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPass(!showConfirmPass)} 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none"
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPasswordError && <span className="text-[10px] text-red-500 font-bold mt-1 text-left">{confirmPasswordError}</span>}
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-t border-[#222226]/30 pt-4">
            <span className={`text-xs font-bold ${passwordMsg.includes('không') || passwordMsg.includes('đầy đủ') || passwordMsg.includes('thất bại') || passwordMsg.includes('xác') || passwordMsg.includes('trùng') || passwordMsg.includes('chính xác') ? 'text-red-400' : 'text-green-400'}`}>{passwordMsg}</span>
            <button type="submit" className="w-full md:w-auto py-3 px-6 bg-[#f59e0b] hover:bg-amber-600 text-black font-black uppercase text-xs tracking-wider rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"><Lock size={14} /> CẬP NHẬT MẬT KHẨU MỚI</button>
          </div>
        </form>
      </section>

      <section id="billing-section" className="bg-[#18181c] border border-[#222226] rounded-xl p-5 md:p-6 flex flex-col gap-5 w-full text-left">
        <div className="flex items-center justify-between border-b border-[#222226]/50 pb-3">
          <div className="flex items-center gap-3"><CreditCard className="text-[#f59e0b]" size={20} /> <h2 className="text-sm font-black text-white uppercase tracking-wider">Ví Credit & Quản lý gói cước dịch vụ SAAS</h2></div>
          <div className="flex items-center gap-2 bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 px-4 py-1.5 rounded-full"><Coins size={14} /> <span className="text-xs font-black uppercase tracking-wide">Tín dụng: {credits ?? 0} Credits</span></div>
        </div>
        <div className="flex flex-col gap-2 mt-1">
          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Cấu hình gói cước hệ thống</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-2">
            {packages?.map((pkg) => {
              const meta = packageMeta[pkg.id] || {
                badge: 'Sponsor',
                badgeClass: 'text-cyan-400',
                description: 'Gói cước mở rộng hệ thống.',
                priceSuffix: 'gói',
                cardClass: 'bg-[#0f0f11] p-5 rounded-xl border border-[#222226]/60 flex flex-col justify-between gap-4 text-left',
                titleColorClass: 'text-white',
                checkColorClass: 'text-cyan-400',
                features: (credits) => [`Cộng thêm ${credits} Credits vào ví`]
              };
              const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(pkg.price).replace('₫', 'đ');

              return (
                <div key={pkg.id} className={meta.cardClass}>
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] uppercase font-black tracking-widest ${meta.badgeClass}`}>{meta.badge}</span>
                    <h4 className={`text-sm font-black uppercase ${meta.titleColorClass}`}>{pkg.name}</h4>
                    <p className="text-[10px] text-zinc-400 mt-1">{meta.description}</p>
                  </div>
                  <div className="flex flex-col gap-3 mt-2">
                    <div className="text-xl font-black text-white">
                      {formattedPrice} <span className="text-[10px] font-medium text-zinc-500">/ {meta.priceSuffix}</span>
                    </div>
                    <div className="space-y-1.5 border-t border-[#222226] pt-3 text-[10px] text-zinc-400">
                      {meta.features(pkg.credits)?.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-left">
                          <CheckCircle2 size={12} className={meta.checkColorClass} />
                          {feat}
                        </div>
                      ))}
                    </div>
                    {pkg.id !== 'free' ? (
                      <button 
                        onClick={() => handlePurchasePackage(pkg.id)}
                        className="w-full mt-3 py-2.5 px-4 bg-[#f59e0b] hover:bg-amber-600 text-black font-black uppercase text-[10px] tracking-wider rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 border-none"
                      >
                        Nạp gói ngay
                      </button>
                    ) : (
                      <button 
                        disabled 
                        className="w-full mt-3 py-2.5 px-4 bg-[#1b1b22] text-zinc-500 border border-[#222226]/40 font-black uppercase text-[10px] tracking-wider rounded-lg cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        Gói mặc định
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <div className="flex items-center gap-2 border-b border-[#222226]/30 pb-2"><History size={14} className="text-zinc-400" /><h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Lịch sử giao dịch nạp tiền</h3></div>
          <div className="w-full overflow-x-auto rounded-xl border border-[#222226]/60 mt-2 bg-[#0f0f11]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#18181c] border-b border-[#222226] text-zinc-400 font-bold uppercase tracking-wider"><th className="p-3">Mã giao dịch</th><th className="p-3">Gói cước</th><th className="p-3">Phân loại</th><th className="p-3">Số tiền</th><th className="p-3 text-amber-500">Tín dụng</th><th className="p-3">Trạng thái</th><th className="p-3">Thời gian</th></tr>
              </thead>
              <tbody className="divide-y divide-[#222226]/40 text-white font-medium">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#131316]/50 transition-colors"><td className="p-3 font-mono text-zinc-500">{tx.id}</td><td className="p-3 font-bold">{tx.package}</td><td className="p-3 text-zinc-400">{tx.type}</td><td className="p-3">{tx.amount}</td><td className="p-3 text-[#f59e0b] font-black">{tx.credits}</td><td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      tx.status === 'Thành công' || tx.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : tx.status === 'Chờ xử lý' || tx.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {tx.status}
                    </span>
                  </td><td className="p-3 text-zinc-500">{tx.date}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Dynamic VietQR Payment Modal */}
      {isModalOpen && activeTransaction && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#18181c] border border-[#222226] text-[#e2e8f0] rounded-xl max-w-md w-full p-6 relative flex flex-col gap-4 text-center select-none shadow-2xl">
            <button 
              onClick={() => { setIsModalOpen(false); setActiveTransaction(null); }}
              className="absolute right-4 top-4 p-1.5 bg-[#18181c] hover:bg-[#222226] text-zinc-400 hover:text-white rounded-lg transition-all border border-[#222226] cursor-pointer hover:scale-[1.05] active:scale-[0.95]"
            >
              <X size={16} />
            </button>

            <h3 className="text-md font-black uppercase tracking-wider text-white mt-2">Thanh toán chuyển khoản VietQR</h3>
            <p className="text-[10px] text-zinc-400 -mt-2">Quét mã QR dưới đây bằng ứng dụng Ngân hàng (Mobile Banking) để nạp Credits tự động</p>

            <div className="mx-auto bg-white p-3 rounded-lg w-52 h-52 flex items-center justify-center border border-[#222226] mt-1 shadow-inner">
              <img 
                src={`https://img.vietqr.io/image/Techcombank-19037672173010-compact2.png?amount=${activeTransaction.amount}&addInfo=${encodeURIComponent(activeTransaction.memo)}&accountName=TRAN%20VAN%20BAC`}
                alt="VietQR dynamic payment code"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="flex flex-col gap-3 mt-1 bg-[#0f0f11] p-4 rounded-xl border border-[#222226]/40 text-left text-xs">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Chủ tài khoản:</span>
                <span className="font-bold text-white uppercase">Trần Văn Bắc</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Số tài khoản:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                  <span>19037672173010</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText('19037672173010'); alert('Đã sao chép số tài khoản!'); }}
                    className="text-[#f59e0b] hover:underline cursor-pointer bg-transparent border-none text-[10px] font-bold"
                  >
                    Sao chép
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Số tiền nạp:</span>
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(activeTransaction.amount).replace('₫', 'đ')}</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(activeTransaction.amount.toString()); alert('Đã sao chép số tiền!'); }}
                    className="text-[#f59e0b] hover:underline cursor-pointer bg-transparent border-none text-[10px] font-bold"
                  >
                    Sao chép
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Nội dung chuyển khoản:</span>
                <div className="flex items-center gap-1.5 font-mono font-bold text-[#f59e0b]">
                  <span>{activeTransaction.memo}</span>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(activeTransaction.memo); alert('Đã sao chép nội dung chuyển khoản!'); }}
                    className="text-[#f59e0b] hover:underline cursor-pointer bg-transparent border-none text-[10px] font-bold"
                  >
                    Sao chép
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 mt-1 py-1">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent border-[#f59e0b]"></div>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Hệ thống đang chờ ngân hàng xác nhận chuyển khoản tự động...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
