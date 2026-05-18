import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/auth.service';
import { useNavigate } from 'react-router-dom';
import './AuthForm.css';

const AuthForm = () => {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    resetToken: '' // Dùng cho màn reset
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        await login({ email: formData.email, password: formData.password });
        navigate('/dashboard');
      } else if (mode === 'register') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Mật khẩu không khớp');
        }
        await authService.register(formData);
        setSuccess('Đăng ký thành công! Vui lòng đăng nhập.');
        setMode('login');
      } else if (mode === 'forgot') {
        await authService.forgotPassword(formData.email);
        setSuccess('Hướng dẫn khôi phục đã được gửi đến email của bạn.');
        setMode('reset'); // Chuyển sang màn nhập mã reset
      } else if (mode === 'reset') {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Mật khẩu không khớp');
        }
        await authService.resetPassword({
          token: formData.resetToken,
          password: formData.password
        });
        setSuccess('Đặt lại mật khẩu thành công!');
        setMode('login');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Chuyển hướng trình duyệt đến API backend
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Lớp phủ mờ trang trí */}
        <div className="auth-glow"></div>
        
        <div className="auth-content">
          <div className="auth-header">
            <h2>
              {mode === 'login' && 'Chào mừng trở lại'}
              {mode === 'register' && 'Tạo tài khoản mới'}
              {mode === 'forgot' && 'Khôi phục mật khẩu'}
              {mode === 'reset' && 'Đặt lại mật khẩu'}
            </h2>
            <p className="auth-subtitle">
              {mode === 'login' && 'Đăng nhập để tiếp tục sử dụng dịch vụ'}
              {mode === 'register' && 'Tham gia với chúng tôi ngay hôm nay'}
              {mode === 'forgot' && 'Nhập email của bạn để nhận liên kết khôi phục'}
              {mode === 'reset' && 'Nhập mã khôi phục và mật khẩu mới'}
            </p>
          </div>

          {error && <div className="auth-alert error animate-fade-in">{error}</div>}
          {success && <div className="auth-alert success animate-fade-in">{success}</div>}

          <form onSubmit={handleSubmit} className="auth-form animate-fade-in">
            {mode === 'register' && (
              <div className="input-group">
                <label className="input-label">Họ và tên</label>
                <div className="input-wrapper">
                  <User className="input-icon" size={18} />
                  <input
                    type="text"
                    name="name"
                    className="input-field with-icon"
                    placeholder="Nguyễn Văn A"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="input-group">
                <label className="input-label">Email</label>
                <div className="input-wrapper">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    name="email"
                    className="input-field with-icon"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <div className="input-group">
                <label className="input-label">Mã khôi phục</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="text"
                    name="resetToken"
                    className="input-field with-icon"
                    placeholder="Nhập mã từ email"
                    value={formData.resetToken}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div className="input-group">
                <label className="input-label">
                  Mật khẩu
                  {mode === 'login' && (
                    <a href="#" className="forgot-link" onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>
                      Quên mật khẩu?
                    </a>
                  )}
                </label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    name="password"
                    className="input-field with-icon"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            {(mode === 'register' || mode === 'reset') && (
              <div className="input-group">
                <label className="input-label">Xác nhận mật khẩu</label>
                <div className="input-wrapper">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    name="confirmPassword"
                    className="input-field with-icon"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-full submit-btn" disabled={loading}>
              {loading ? 'Đang xử lý...' : (
                <>
                  {mode === 'login' && 'Đăng nhập'}
                  {mode === 'register' && 'Đăng ký'}
                  {mode === 'forgot' && 'Gửi liên kết'}
                  {mode === 'reset' && 'Xác nhận'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {mode === 'login' && (
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

          <div className="auth-footer">
            {mode === 'login' ? (
              <p>Chưa có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); }}>Đăng ký ngay</a></p>
            ) : mode === 'register' ? (
              <p>Đã có tài khoản? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Đăng nhập</a></p>
            ) : (
              <p><a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); }}>Quay lại đăng nhập</a></p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
