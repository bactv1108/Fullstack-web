import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { KeyRound, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // 💡 TỰ ĐỘNG BÓC TÁCH MÃ TOKEN TỪ URL GMAIL GỬI VỀ
    const tokenFromUrl = searchParams.get('token');
    console.log('[FRONTEND RESET] Token bóc từ URL:', tokenFromUrl);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showP1, setShowP1] = useState(false);
    const [showP2, setShowP2] = useState(false);

    // Trạng thái xử lý API (Loading, Lỗi, Thành công)
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [strength, setStrength] = useState({ score: 0, text: 'Trống', color: '#27272a' });

    useEffect(() => {
        if (!password) {
            setStrength({ score: 0, text: 'Trống', color: '#27272a' });
            return;
        }
        let s = 0;
        if (password.length >= 8) s++;
        if (/[A-Z]/.test(password)) s++;
        if (/[0-9]/.test(password)) s++;
        if (/[^A-Za-z0-9]/.test(password)) s++;

        let cfg = { score: s, text: 'Yếu', color: '#f43f5e' };
        if (s === 2) cfg = { score: s, text: 'Trung bình', color: '#f59e0b' };
        if (s >= 3) cfg = { score: s, text: 'Mạnh', color: '#10b981' };
        setStrength(cfg);
    }, [password]);

    // =========================================================
    // 🔥 HÀM KÍCH NỔ API BẮN DATA VÀO DATABASE BACKEND
    // =========================================================
        const handleSubmit = async (e) => {
            e.preventDefault();
            setError('');

            // Chốt chặn validate an toàn tại Frontend
            if (password.length < 8) {
                setError('Mật khẩu mới phải có ít nhất 8 ký tự!');
                return;
            }
            if (password !== confirmPassword) {
                setError('Mật khẩu xác nhận không khớp nhau!');
                return;
            }
            if (!tokenFromUrl) {
                setError('Mã xác thực (Token) không hợp lệ hoặc đã hết hạn từ Gmail!');
                return;
            }

            setLoading(true);

            try {
                // Sử dụng thư viện Axios gửi yêu cầu POST bất đồng bộ lên cổng backend 3000
                const response = await axios.post('http://localhost:3000/api/auth/reset-password', {
                    token: tokenFromUrl,
                    newPassword: password,
                });

                // Axios trả về dữ liệu tự động đã được phân tích cú pháp trong thuộc tính data
                const responseData = response.data;

                if (responseData && responseData.success) {
                    setSuccess(true);
                    setTimeout(() => {
                        navigate('/login');
                    }, 2000);
                } else {
                    throw new Error(responseData.message || 'Cập nhật database thất bại!');
                }

            } catch (apiError) {
                const errorResponseData = apiError.response?.data;
                const errorMessage = errorResponseData?.message || apiError.message || 'Lỗi kết nối hệ thống server Backend!';
                if (errorMessage === 'Mật khẩu mới không được trùng với mật khẩu cũ.') {
                    setError('Mật khẩu hiện tại đã được sử dụng, vui lòng nhập mật khẩu mới');
                } else {
                    setError(errorMessage);
                }
            } finally {
                setLoading(false);
            }
        };

    return (
        <div style={{ backgroundColor: '#0b0b0e', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>

            <div style={{ backgroundColor: '#111115', border: '1px solid #1f1f23', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 style={{ color: '#f4f4f5', fontSize: '22px', fontWeight: 'bold', margin: '0 0 8px 0' }}>Đặt lại mật khẩu</h2>
                    <p style={{ color: '#71717a', fontSize: '13px', margin: 0 }}>Nhập mật khẩu mới để bảo mật tài khoản</p>
                </div>

                {/* HIỂN THỊ TRẠNG THÁI THÀNH CÔNG BOX GREEN VIP */}
                {success ? (
                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '13px', borderRadius: '10px', padding: '16px', textAlign: 'center', fontWeight: '500', lineHeight: '1.6' }}>
                        🎉 ĐỒNG BỘ DATABASE THÀNH CÔNG!<br />
                        <span style={{ color: '#71717a', fontSize: '11px' }}>Hệ thống đang đưa bạn quay lại trang đăng nhập...</span>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* THÔNG BÁO HỘP LỖI BOX RED VIP */}
                        {error && (
                            <div style={{ backgroundColor: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: '#fb7185', fontSize: '12px', borderRadius: '10px', padding: '12px', fontWeight: 'bold', textAlign: 'center' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {/* TRƯỜNG 1: MẬT KHẨU MỚI */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '500' }}>Mật khẩu mới</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <div style={{ position: 'absolute', left: '14px', color: '#52525b', display: 'flex' }}>
                                    <KeyRound style={{ width: '16px', height: '16px' }} />
                                </div>
                                <input
                                    type={showP1 ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                    style={{ width: '100%', backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '10px', padding: '12px 40px 12px 40px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                                <button type="button" onClick={() => setShowP1(!showP1)} style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex', padding: 0 }}>
                                    {showP1 ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                                </button>
                            </div>

                            {password && (
                                <div style={{ marginTop: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', marginBottom: '4px' }}>
                                        <span style={{ color: '#52525b' }}>ĐỘ BẢO MẬT:</span>
                                        <span style={{ color: strength.color }}>{strength.text.toUpperCase()}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px', height: '4px' }}>
                                        {[1, 2, 3, 4].map((n) => (
                                            <div key={n} style={{ flex: 1, backgroundColor: strength.score >= n ? strength.color : '#1f1f23', borderRadius: '10px', transition: '0.3s' }} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* TRƯỜNG 2: XÁC NHẬN MẬT KHẨU */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: '500' }}>Xác nhận mật khẩu</label>
                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <div style={{ position: 'absolute', left: '14px', color: '#52525b', display: 'flex' }}>
                                    <ShieldCheck style={{ width: '16px', height: '16px' }} />
                                </div>
                                <input
                                    type={showP2 ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    disabled={loading}
                                    style={{ width: '100%', backgroundColor: '#09090b', border: confirmPassword && password !== confirmPassword ? '1px solid #ef4444' : '1px solid #27272a', borderRadius: '10px', padding: '12px 40px 12px 40px', color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                />
                                <button type="button" onClick={() => setShowP2(!showP2)} style={{ position: 'absolute', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', display: 'flex', padding: 0 }}>
                                    {showP2 ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                                </button>
                            </div>
                            {confirmPassword && password !== confirmPassword && (
                                <span style={{ color: '#f43f5e', fontSize: '11px', fontWeight: '500' }}>⚠️ Mật khẩu không trùng khớp</span>
                            )}
                        </div>

                        {/* NÚT CẬP NHẬT TRẠNG THÁI LOADING */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{ width: '100%', backgroundColor: loading ? '#d97706' : '#f59e0b', color: '#09090b', fontWeight: 'bold', fontSize: '14px', padding: '14px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '10px', transition: '0.2s', opacity: loading ? 0.7 : 1 }}
                        >
                            <span>{loading ? 'Đang cập nhật DB...' : 'Cập nhật mật khẩu'}</span>
                            {!loading && <ArrowRight style={{ width: '16px', height: '16px' }} />}
                        </button>

                    </form>
                )}

            </div>
        </div>
    );
}