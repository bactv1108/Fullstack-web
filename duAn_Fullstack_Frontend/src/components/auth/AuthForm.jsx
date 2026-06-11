import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/auth.service';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './AuthForm.css';

const AuthForm = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [showUnverifiedAlert, setShowUnverifiedAlert] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendLoading, setResendLoading] = useState(false);

  // 2FA state
  const [show2FAInput, setShow2FAInput] = useState(false);
  const [userId2FA, setUserId2FA] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, verify2FALogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Per-field validation errors
  const [fieldErrors, setFieldErrors] = useState({});
  // Track which fields have been touched (blurred)
  const [touched, setTouched] = useState({});

  // Detect ?verified=true from email verification redirect
  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      setSuccess('Email đã xác thực thành công! Bạn có thể đăng nhập ngay.');
      setMode('login');
    } else if (verified === 'already') {
      setSuccess('Email đã được xác thực trước đó. Bạn có thể đăng nhập.');
      setMode('login');
    }
  }, [searchParams]);

  // ── Validation Helpers ──
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateField = (name, value) => {
    switch (name) {
      case 'name':
        if (mode === 'register' && !value.trim()) return 'Vui lòng nhập họ và tên.';
        return '';
      case 'email':
        if (!value.trim()) return 'Vui lòng nhập email.';
        if (!emailRegex.test(value)) return 'Email sai định dạng.';
        return '';
      case 'password':
        if (!value) return 'Vui lòng nhập mật khẩu.';
        if (mode === 'register' && value.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
        if (mode === 'register' && !/[A-Z]/.test(value)) return 'Cần ít nhất 1 chữ hoa.';
        if (mode === 'register' && !/[a-z]/.test(value)) return 'Cần ít nhất 1 chữ thường.';
        if (mode === 'register' && !/[0-9]/.test(value)) return 'Cần ít nhất 1 chữ số.';
        if (mode === 'register' && !/[^A-Za-z0-9]/.test(value)) return 'Cần ít nhất 1 ký tự đặc biệt.';
        return '';
      case 'confirmPassword':
        if (mode === 'register' && !value) return 'Vui lòng xác nhận mật khẩu.';
        if (mode === 'register' && value !== formData.password) return 'Mật khẩu xác nhận không khớp.';
        return '';
      default:
        return '';
    }
  };

  // ── Password Strength ──
  const getPasswordStrength = (pw) => {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[A-Z]/.test(pw)) s++;
    if (/[a-z]/.test(pw)) s++;
    if (/[0-9]/.test(pw)) s++;
    if (/[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  };

  const passwordStrength = mode === 'register' ? getPasswordStrength(formData.password) : 0;
  const strengthLabels = ['', 'Yếu', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'];
  const strengthColors = ['', '#ef4444', '#ef4444', '#f59e0b', '#f59e0b', '#10b981'];

  // ── Handlers ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Live validation if already touched
    if (touched[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
    }

    // Re-validate confirmPassword when password changes
    if (name === 'password' && touched.confirmPassword && mode === 'register') {
      const confirmErr = formData.confirmPassword && formData.confirmPassword !== value
        ? 'Mật khẩu xác nhận không khớp.' : '';
      setFieldErrors(prev => ({ ...prev, confirmPassword: confirmErr }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({ ...prev, [name]: validateField(name, value) }));
  };

  // Block copy/paste on password fields
  const blockCopyPaste = (e) => e.preventDefault();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setServerError('');
    setSuccess('');
    setShowUnverifiedAlert(false);

    // Validate all visible fields
    const fieldsToValidate = [];
    if (mode === 'register') fieldsToValidate.push('name', 'email', 'password', 'confirmPassword');
    else if (mode === 'login') fieldsToValidate.push('email', 'password');
    else if (mode === 'forgot') fieldsToValidate.push('email');

    const newErrors = {};
    let hasError = false;
    for (const field of fieldsToValidate) {
      const err = validateField(field, formData[field]);
      if (err) { newErrors[field] = err; hasError = true; }
    }

    // Mark all as touched
    const allTouched = {};
    fieldsToValidate.forEach(f => allTouched[f] = true);
    setTouched(prev => ({ ...prev, ...allTouched }));
    setFieldErrors(prev => ({ ...prev, ...newErrors }));

    if (hasError) {
      setLoading(false);
      return;
    }

    try {
      if (mode === 'login') {
        const data = await login({ email: formData.email, password: formData.password });
        if (data && data.require2FA === true) {
          setShow2FAInput(true);
          setUserId2FA(data.userId);
          setOtpCode('');
          setOtpError('');
          setLoading(false);
          return;
        }
        navigate('/dashboard');

      } else if (mode === 'register') {
        await authService.register({ name: formData.name, email: formData.email, password: formData.password });
        setSuccess('Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.');
        setMode('login');
        setFormData({ name: '', email: formData.email, password: '', confirmPassword: '' });
        setTouched({});
        setFieldErrors({});

      } else if (mode === 'forgot') {
        await authService.forgotPassword(formData.email);
        setSuccess('Đã gửi link đặt lại mật khẩu đến email của bạn.');
      }

    } catch (err) {
      const responseData = err.response?.data || err;
      const msg = responseData?.message || err.message || 'Có lỗi xảy ra';

      // Special handling for unverified email
      if (responseData?.code === 'EMAIL_NOT_VERIFIED') {
        setShowUnverifiedAlert(true);
        setUnverifiedEmail(formData.email);
      } else {
        if (mode === 'login') {
          if (msg === 'Mật khẩu không chính xác.') {
            setServerError('vui lòng kiểm tra lại mật khẩu');
          } else if (msg === 'Email không tồn tại trên hệ thống.') {
            setServerError('vui lòng kiểm tra lại tài khoản');
          } else {
            setServerError(msg);
          }
        } else {
          setServerError(msg);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      await authService.resendVerification(unverifiedEmail);
      setSuccess('Đã gửi lại email xác thực. Vui lòng kiểm tra hộp thư.');
      setShowUnverifiedAlert(false);
    } catch (err) {
      setServerError(err.response?.data?.message || 'Không thể gửi lại email xác thực.');
    } finally {
      setResendLoading(false);
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
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Mã xác thực không chính xác.';
      setOtpError(msg);
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setServerError('');
    setSuccess('');
    setFieldErrors({});
    setTouched({});
    setShowUnverifiedAlert(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFormData({ name: '', email: formData.email, password: '', confirmPassword: '' });
  };

  // ── Field validity helpers ──
  const isFieldValid = (name) => touched[name] && !fieldErrors[name] && formData[name];
  const isFieldError = (name) => touched[name] && !!fieldErrors[name];

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Ambient glow */}
        <div className="auth-glow"></div>

        <div className="auth-content">
          {/* ── Header ── */}
          <div className="auth-header">
            <h2>
              {mode === 'login' && 'Chào mừng trở lại'}
              {mode === 'register' && 'Tạo tài khoản mới'}
              {mode === 'forgot' && 'Khôi phục mật khẩu'}
            </h2>
            <p className="auth-subtitle">
              {mode === 'login' && 'Đăng nhập để tiếp tục sử dụng dịch vụ'}
              {mode === 'register' && 'Tham gia với chúng tôi ngay hôm nay'}
              {mode === 'forgot' && 'Nhập email để nhận link đặt lại mật khẩu'}
            </p>
          </div>

          {/* ── Server Alerts ── */}
          {serverError && <div className="auth-alert error animate-fade-in">{serverError}</div>}
          {success && <div className="auth-alert success animate-fade-in">{success}</div>}

          {/* ── Unverified Email Alert Block ── */}
          {showUnverifiedAlert && (
            <div className="auth-alert unverified animate-fade-in">
              <div className="unverified-content">
                <AlertCircle size={20} />
                <div>
                  <p className="unverified-title">Email chưa được xác thực</p>
                  <p className="unverified-desc">Vui lòng kiểm tra hộp thư <strong>{unverifiedEmail}</strong> để xác thực tài khoản trước khi đăng nhập.</p>
                </div>
              </div>
              <button
                type="button"
                className="resend-btn"
                onClick={handleResendVerification}
                disabled={resendLoading}
              >
                {resendLoading ? 'Đang gửi...' : 'Gửi lại Email xác thực'}
              </button>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={show2FAInput ? handle2FASubmit : handleSubmit} className="auth-form animate-fade-in" noValidate>

            {/* Name (Register only) */}
            {mode === 'register' && (
              <div className="input-group">
                <label className="input-label">Họ và tên</label>
                <div className={`input-wrapper ${isFieldError('name') ? 'has-error' : ''} ${isFieldValid('name') ? 'has-valid' : ''}`}>
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    name="name"
                    className="input-field with-icon"
                    placeholder="Nguyễn Văn A"
                    value={formData.name}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="name"
                  />
                  {isFieldValid('name') && <CheckCircle2 className="input-status-icon valid-icon" size={18} />}
                  {isFieldError('name') && <TriangleAlert className="input-status-icon error-icon" size={18} />}
                </div>
                {isFieldError('name') && <span className="field-error">{fieldErrors.name}</span>}
              </div>
            )}

            {/* Email (Login + Register + Forgot) */}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="input-group">
                <label className="input-label">Email</label>
                <div className={`input-wrapper ${isFieldError('email') ? 'has-error' : ''} ${isFieldValid('email') ? 'has-valid' : ''}`}>
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    name="email"
                    className="input-field with-icon"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    autoComplete="email"
                  />
                  {isFieldValid('email') && <CheckCircle2 className="input-status-icon valid-icon" size={18} />}
                  {isFieldError('email') && <TriangleAlert className="input-status-icon error-icon" size={18} />}
                </div>
                {isFieldError('email') && <span className="field-error">{fieldErrors.email}</span>}
              </div>
            )}

            {/* ── 2FA OTP Input (shown after password verified) ── */}
            {show2FAInput && mode === 'login' && (
              <div className="input-group">
                <label className="input-label">Mã xác thực 2FA</label>
                <p style={{ fontSize: '11px', color: '#a1a1aa', marginTop: '-6px', marginBottom: '8px', textAlign: 'left' }}>
                  Nhập mã 6 chữ số từ ứng dụng Google Authenticator
                </p>
                <div className={`input-wrapper ${otpError ? 'has-error' : ''}`}>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    className="input-field with-icon"
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                {otpError && <span className="field-error">{otpError}</span>}
                <button
                  type="button"
                  className="resend-btn"
                  style={{ marginTop: '8px', fontSize: '11px' }}
                  onClick={() => { setShow2FAInput(false); setOtpCode(''); setOtpError(''); }}
                >
                  ← Quay lại đăng nhập
                </button>
              </div>
            )}

            {/* Password (Login + Register) - hidden during 2FA challenge */}
            {!show2FAInput && (mode === 'login' || mode === 'register') && (
              <div className="input-group">
                <label className="input-label">
                  Mật khẩu
                  {mode === 'login' && (
                    <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); switchMode('forgot'); }}>
                      Quên mật khẩu?
                    </a>
                  )}
                </label>
                <div className={`input-wrapper ${isFieldError('password') ? 'has-error' : ''} ${isFieldValid('password') ? 'has-valid' : ''}`}>
                  <Lock className="input-icon" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    className="input-field with-icon with-toggle"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onCopy={blockCopyPaste}
                    onPaste={blockCopyPaste}
                    onCut={blockCopyPaste}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  {isFieldValid('password') && <CheckCircle2 className="input-status-icon valid-icon" size={18} />}
                  {isFieldError('password') && <TriangleAlert className="input-status-icon error-icon" size={18} />}
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(p => !p)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {isFieldError('password') && <span className="field-error">{fieldErrors.password}</span>}

                {/* Password Strength Meter (Register only) */}
                {mode === 'register' && formData.password && (
                  <div className="password-strength-container">
                    <div className="password-strength-bar-group">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className="password-strength-bar"
                          style={{ backgroundColor: passwordStrength >= level ? strengthColors[passwordStrength] : '#3f3f46' }}
                        />
                      ))}
                    </div>
                    <span className="password-strength-label" style={{ color: strengthColors[passwordStrength] }}>
                      {strengthLabels[passwordStrength]}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Confirm Password (Register only) */}
            {mode === 'register' && (
              <div className="input-group">
                <label className="input-label">Xác nhận mật khẩu</label>
                <div className={`input-wrapper ${isFieldError('confirmPassword') ? 'has-error' : ''} ${isFieldValid('confirmPassword') ? 'has-valid' : ''}`}>
                  <Lock className="input-icon" size={18} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    className="input-field with-icon with-toggle"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onCopy={blockCopyPaste}
                    onPaste={blockCopyPaste}
                    onCut={blockCopyPaste}
                    autoComplete="new-password"
                  />
                  {isFieldValid('confirmPassword') && <CheckCircle2 className="input-status-icon valid-icon" size={18} />}
                  {isFieldError('confirmPassword') && <TriangleAlert className="input-status-icon error-icon" size={18} />}
                  <button type="button" className="toggle-password" onClick={() => setShowConfirmPassword(p => !p)} tabIndex={-1}>
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {isFieldError('confirmPassword') && <span className="field-error">{fieldErrors.confirmPassword}</span>}
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" className="btn btn-primary btn-full submit-btn" disabled={loading}>
              {loading ? 'Đang xử lý...' : (
                <>
                  {show2FAInput ? 'Xác thực 2FA' : mode === 'login' ? 'Đăng nhập' : mode === 'register' ? 'Đăng ký' : 'Gửi link đặt lại'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* ── Google OAuth (Login only, hidden during 2FA) ── */}
          {mode === 'login' && !show2FAInput && (
            <>
              <div className="auth-divider">
                <span>Hoặc tiếp tục với</span>
              </div>
              <button type="button" className="btn btn-secondary btn-full google-btn" onClick={handleGoogleLogin}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
            </>
          )}

          {/* ── Footer Links (hidden during 2FA) ── */}
          {!show2FAInput && (
          <div className="auth-footer">
            {mode === 'login' ? (
              <p>Chưa có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('register'); }}>Đăng ký ngay</a></p>
            ) : mode === 'register' ? (
              <p>Đã có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>Đăng nhập</a></p>
            ) : (
              <p><a href="#" onClick={(e) => { e.preventDefault(); switchMode('login'); }}>Quay lại đăng nhập</a></p>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
