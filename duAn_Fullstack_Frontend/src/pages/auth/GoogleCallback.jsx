import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogleToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = () => {
      const token = searchParams.get('token');
      
      if (token) {
        try {
          loginWithGoogleToken(token);
          window.location.href = '/dashboard';
        } catch (err) {
          setError('Đăng nhập Google thất bại');
          setTimeout(() => navigate('/login'), 2000);
        }
      } else {
        setError('Không tìm thấy token');
        setTimeout(() => navigate('/login'), 2000);
      }
    };
    
    handleCallback();
  }, [searchParams, loginWithGoogleToken, navigate]);

  return (
    <div className="auth-container">
      <div className="auth-card flex flex-col items-center justify-center p-8">
        {!error ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mb-4"></div>
            <h2 className="text-white text-lg font-medium">Đang xác thực...</h2>
            <p className="text-gray-400 text-sm mt-2">Vui lòng đợi trong giây lát</p>
          </>
        ) : (
          <p className="text-red-500 mt-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>
        )}
      </div>
    </div>
  );
};

export default GoogleCallback;
