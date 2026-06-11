import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldOff, Copy, CheckCircle, X, Loader2, Smartphone } from 'lucide-react';
import axios from 'axios';

const API_AUTH_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api/admin')
  .replace(/\/admin\/?$/, '/auth');

/**
 * TwoFactorModal
 * Props:
 *   mode       : 'enable' | 'disable'
 *   onSuccess  : () => void   — called when 2FA is successfully toggled
 *   onClose    : () => void   — called to close the modal
 */
const TwoFactorModal = ({ mode, onSuccess, onClose }) => {
  const [step, setStep] = useState(mode === 'enable' ? 'loading' : 'verify'); // 'loading'|'scan'|'verify'|'done'
  const [qrCode, setQrCode]   = useState('');
  const [secret, setSecret]   = useState('');
  const [otp, setOtp]         = useState('');
  const [error, setError]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied]   = useState(false);
  const inputRefs = useRef([]);

  // ── Load QR when enabling ────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'enable') return;

    const token = localStorage.getItem('admin_access_token');
    axios.get(`${API_AUTH_BASE}/2fa/generate`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setQrCode(res.data.qrCode);
        setSecret(res.data.secret);
        setStep('scan');
      })
      .catch(err => {
        setError(err.response?.data?.message || 'Không thể tạo mã QR. Vui lòng thử lại.');
        setStep('scan');
      });
  }, [mode]);

  // ── OTP input: 6 individual digit boxes ─────────────────────────
  const [digits, setDigits] = useState(Array(6).fill(''));

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value.slice(-1);
    setDigits(newDigits);
    setOtp(newDigits.join(''));
    setError('');
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newDigits = Array(6).fill('');
    pasted.split('').forEach((ch, i) => { newDigits[i] = ch; });
    setDigits(newDigits);
    setOtp(pasted);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Submit OTP ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length !== 6) {
      setError('Vui lòng nhập đủ 6 chữ số.');
      return;
    }
    setSubmitting(true);
    setError('');

    const token = localStorage.getItem('admin_access_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      if (mode === 'enable') {
        await axios.post(`${API_AUTH_BASE}/2fa/enable`, { secret, token: code }, { headers });
      } else {
        await axios.post(`${API_AUTH_BASE}/2fa/disable`, { token: code }, { headers });
      }
      setStep('done');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Mã OTP không hợp lệ. Vui lòng thử lại.');
      setDigits(Array(6).fill(''));
      setOtp('');
      inputRefs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-white dark:bg-[#1a1a22] border border-slate-200 dark:border-[#2d2d38] rounded-2xl shadow-2xl w-full max-w-md text-slate-900 dark:text-admin-text animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-[#2d2d38]">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${mode === 'enable' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {mode === 'enable' ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {mode === 'enable' ? 'Kích Hoạt Bảo Vệ 2 Lớp' : 'Tắt Bảo Vệ 2 Lớp'}
              </h3>
              <p className="text-xs text-admin-text-muted mt-0.5">
                {mode === 'enable' ? 'Google Authenticator (TOTP)' : 'Xác nhận tắt 2FA'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 dark:text-admin-text-muted hover:text-slate-700 dark:hover:text-white p-1 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {/* STEP: Loading QR */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="animate-spin text-admin-primary" size={36} />
              <p className="text-sm text-admin-text-muted">Đang tạo mã QR...</p>
            </div>
          )}

          {/* STEP: Scan QR */}
          {step === 'scan' && (
            <div className="space-y-5">
              <div className="flex items-start gap-2">
                <Smartphone size={16} className="text-admin-primary mt-0.5 shrink-0" />
                <p className="text-xs text-admin-text-muted leading-relaxed">
                  Mở ứng dụng <span className="text-white font-semibold">Google Authenticator</span> hoặc <span className="text-white font-semibold">Authy</span>, chọn "Thêm tài khoản" rồi quét mã QR bên dưới.
                </p>
              </div>

              {/* QR Code */}
              {qrCode && (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-xl shadow-lg">
                    <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 block" />
                  </div>
                  <p className="text-xs text-admin-text-muted">Hoặc nhập thủ công mã secret:</p>
                  <div className="w-full flex items-center gap-2 bg-slate-50 dark:bg-[#0f0f13] border border-slate-200 dark:border-admin-border rounded-lg px-3 py-2">
                    <code className="flex-1 text-xs text-yellow-400 break-all font-mono select-all">{secret}</code>
                    <button
                      type="button"
                      onClick={handleCopySecret}
                      className="shrink-0 text-slate-500 dark:text-admin-text-muted hover:text-slate-700 dark:hover:text-white transition-colors"
                      title="Sao chép secret"
                    >
                      {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep('verify')}
                className="w-full bg-admin-primary hover:bg-admin-primary/90 text-white text-sm py-2.5 rounded-lg font-semibold transition-colors"
              >
                Đã quét xong → Nhập mã xác nhận
              </button>
            </div>
          )}

          {/* STEP: Verify OTP */}
          {(step === 'verify') && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-xs text-admin-text-muted text-center leading-relaxed">
                {mode === 'enable'
                  ? 'Nhập mã 6 số từ ứng dụng Authenticator để hoàn tất kích hoạt.'
                  : 'Nhập mã 6 số từ ứng dụng Authenticator để xác nhận TẮT bảo vệ 2 lớp.'}
              </p>

              {/* 6-digit OTP boxes */}
              <div className="flex justify-center gap-2" onPaste={handleDigitPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    className={`w-11 h-13 text-center text-xl font-bold rounded-xl border-2 bg-slate-50 dark:bg-[#0f0f13] text-slate-900 dark:text-white outline-none transition-all ${
                      d ? 'border-admin-primary' : 'border-slate-300 dark:border-admin-border'
                    } focus:border-admin-primary focus:ring-2 focus:ring-admin-primary/30`}
                    style={{ height: '3.25rem' }}
                    autoFocus={i === 0}
                  />
                ))}
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                {mode === 'enable' && (
                  <button
                    type="button"
                    onClick={() => setStep('scan')}
                    className="flex-1 bg-slate-50 dark:bg-[#0f0f13] border border-slate-200 dark:border-admin-border hover:bg-slate-100 dark:hover:bg-admin-card text-slate-700 dark:text-admin-text text-xs py-2.5 rounded-lg font-medium transition-colors"
                  >
                    ← Quay lại QR
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting || digits.join('').length < 6}
                  className={`flex-1 text-sm py-2.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    mode === 'enable'
                      ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/40 text-white'
                      : 'bg-red-600 hover:bg-red-700 disabled:bg-red-600/40 text-white'
                  }`}
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting
                    ? 'Đang xác minh...'
                    : mode === 'enable' ? 'Kích hoạt 2FA' : 'Xác nhận tắt 2FA'
                  }
                </button>
              </div>
            </form>
          )}

          {/* STEP: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                mode === 'enable' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}>
                <CheckCircle size={36} />
              </div>
              <div>
                <p className="font-bold text-base mb-1">
                  {mode === 'enable' ? '2FA đã được kích hoạt!' : '2FA đã được tắt!'}
                </p>
                <p className="text-xs text-admin-text-muted">
                  {mode === 'enable'
                    ? 'Từ lần đăng nhập tiếp theo, bạn sẽ cần nhập mã từ ứng dụng Authenticator.'
                    : 'Tài khoản sẽ đăng nhập bình thường mà không cần mã OTP.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorModal;
