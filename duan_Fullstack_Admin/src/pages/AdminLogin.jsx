import React, { useState } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldCheck, Smartphone } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [userId2FA, setUserId2FA] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  
  const { login, verify2FALogin } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await login({ email, password });
      if (result && result.require2FA === true) {
        setShow2FA(true);
        setUserId2FA(result.userId);
        setOtpCode('');
        setOtpError('');
        setLoading(false);
        return;
      }
      navigate('/Dashboard');
    } catch (err) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.length !== 6) {
      setOtpError('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    setLoading(true);
    setOtpError('');
    try {
      await verify2FALogin(userId2FA, otpCode);
      navigate('/Dashboard');
    } catch (err) {
      setOtpError(err.message || 'Mã xác thực không chính xác.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.1)_0%,transparent_50%)]"></div>
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-6">
          <div className="bg-admin-primary/10 p-3 rounded-2xl border border-admin-primary/20">
            <ShieldCheck size={48} className="text-admin-primary" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-admin-text">
          Admin Studio
        </h2>
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-admin-text-muted">
          Hệ thống quản trị VideoAI
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white dark:bg-[#181b21] py-8 px-4 shadow-2xl sm:rounded-xl sm:px-10 border border-slate-200 dark:border-admin-border">
          
          {error && !show2FA && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-lg mb-6 text-center">
              {error}
            </div>
          )}

          {otpError && show2FA && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-3 rounded-lg mb-6 text-center">
              {otpError}
            </div>
          )}

          <form className="space-y-6" onSubmit={show2FA ? handle2FASubmit : handleSubmit}>
            {!show2FA ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-admin-text-muted mb-2">
                    Email quản trị
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-admin-text-muted" />
                    </div>
                    <input
                      type="email"
                      required
                      className="admin-input pl-10"
                      style={{ paddingLeft: '2.75rem' }}
                      placeholder="admin@system.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-admin-text-muted mb-2">
                    Mật khẩu
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-admin-text-muted" />
                    </div>
                    <input
                      type="password"
                      required
                      className="admin-input pl-10"
                      style={{ paddingLeft: '2.75rem' }}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-admin-text-muted mb-2">
                  Mã xác thực 2FA
                </label>
                <p className="text-xs text-admin-text-muted mb-3">
                  Nhập mã 6 chữ số từ ứng dụng Google Authenticator
                </p>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Smartphone className="h-5 w-5 text-admin-text-muted" />
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    className="admin-input pl-10 text-center text-2xl tracking-[0.5em] font-mono"
                    style={{ paddingLeft: '2.75rem' }}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-500 dark:text-admin-text-muted hover:text-admin-primary mt-2 cursor-pointer bg-transparent border-none"
                  onClick={() => { setShow2FA(false); setOtpCode(''); setOtpError(''); }}
                >
                  ← Quay lại đăng nhập
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full admin-btn admin-btn-primary"
            >
              {loading ? 'Đang xác thực...' : (show2FA ? 'Xác thực 2FA' : 'Đăng nhập vào hệ thống')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
