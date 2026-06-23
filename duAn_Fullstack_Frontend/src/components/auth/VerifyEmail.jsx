import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import './AuthForm.css'; // Tái sử dụng các lớp CSS chung để đồng bộ giao diện tối (Dark Mode)

const VerifyEmail = () => {
  const [searchParameters] = useSearchParams();
  const navigate = useNavigate();

  const [verificationLoadingState, setVerificationLoadingState] = useState(true);
  const [verificationSuccessState, setVerificationSuccessState] = useState(false);
  const [verificationErrorMessage, setVerificationErrorMessage] = useState('');

  const verificationToken = searchParameters.get('token');

  useEffect(() => {
    const executeEmailVerification = async () => {
      if (!verificationToken) {
        setVerificationLoadingState(false);
        setVerificationErrorMessage('Mã xác thực tài khoản không tồn tại hoặc đường dẫn không đúng cấu trúc.');
        return;
      }

      try {
        // Gửi yêu cầu API xác thực bất đồng bộ lên máy chủ Backend
        const apiResponse = await axios.get(`http://localhost:3000/api/auth/verify-email?token=${verificationToken}`);
        
        if (apiResponse.status === 200) {
          setVerificationSuccessState(true);
        } else {
          setVerificationErrorMessage(apiResponse.data?.message || 'Không thể xác thực tài khoản vào lúc này.');
        }
      } catch (apiError) {
        const errorData = apiError.response?.data;
        setVerificationErrorMessage(errorData?.message || 'Đường truyền mạng bị gián đoạn hoặc máy chủ gặp sự cố.');
      } finally {
        setVerificationLoadingState(false);
      }
    };

    executeEmailVerification();
  }, [verificationToken]);

  const handleNavigateToLogin = () => {
    navigate('/login?verified=true');
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Lớp phủ phát sáng dịu nhẹ của giao diện tối */}
        <div className="auth-glow"></div>

        <div className="auth-content" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div className="auth-header" style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '24px', fontShift: '10px', fontWeight: '800', letterSpacing: '0.05em', color: '#f59e0b', display: 'block', marginBottom: '16px' }}>
              FULLSTACK APP
            </span>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fafaf9' }}>
              Xác thực tài khoản
            </h2>
          </div>

          {verificationLoadingState && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', margin: '32px 0' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '3px solid #27272a',
                borderTopColor: '#f59e0b',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Hệ thống đang tiến hành xác thực tài khoản của bạn, vui lòng đợi trong giây lát...</p>
            </div>
          )}

          {!verificationLoadingState && verificationSuccessState && (
            <div className="animate-fade-in" style={{ margin: '32px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '16px' }}>
                <CheckCircle2 size={36} />
              </div>
              <p style={{ color: '#d4d4d8', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px' }}>
                Chúc mừng bạn! Địa chỉ email đã được xác minh thành công. Tài khoản của bạn đã được kích hoạt hoàn toàn trên hệ thống.
              </p>
              <button 
                type="button" 
                className="btn btn-primary btn-full" 
                onClick={handleNavigateToLogin}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Đăng nhập ngay
                <ArrowRight size={18} />
              </button>
            </div>
          )}

          {!verificationLoadingState && !verificationSuccessState && (
            <div className="animate-fade-in" style={{ margin: '32px 0' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', marginBottom: '16px' }}>
                <AlertCircle size={36} />
              </div>
              <p style={{ color: '#f43f5e', fontSize: '15px', lineHeight: '1.6', marginBottom: '24px', fontWeight: '500' }}>
                {verificationErrorMessage}
              </p>
              <button 
                type="button" 
                className="btn btn-secondary btn-full" 
                onClick={() => navigate('/login')}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Quay lại đăng nhập
              </button>
            </div>
          )}

          {/* Keyframe animation for spinner */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}} />
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
