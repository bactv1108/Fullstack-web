import React, { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Link2, Sparkles, Loader2, Copy, Check, ShoppingBag,
  Tag, Star, Palette, ChevronRight, ExternalLink, Zap,
  FileText, Hash, MessageSquare
} from 'lucide-react';
import axiosClient from '../../../services/axiosClient';

// ─── Chuỗi hiệu ứng loading mô phỏng 4 bước hệ thống ───
const LOADING_STEPS = [
  { icon: '🔍', text: 'Đang phân tích link sản phẩm...',       sub: 'Kiểm tra bộ nhớ đệm hệ thống' },
  { icon: '🤖', text: 'Khởi động Stealth Crawler...',           sub: 'Vượt tường lửa Anti-Bot & thu thập dữ liệu' },
  { icon: '🧠', text: 'Gửi dữ liệu đến Gemini 2.0 Flash...',  sub: 'AI đang sáng tạo kịch bản & bài viết' },
  { icon: '✨', text: 'Hoàn tất! Đang chuẩn bị kết quả...',    sub: 'Tối ưu hóa nội dung đầu ra' },
];

export default function AffiliateAssistant() {
  const context = useOutletContext();
  const credits = context?.credits || 0;

  // ─── State chính ───
  const [productUrl, setProductUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeTab, setActiveTab] = useState('tiktok');
  const [copiedField, setCopiedField] = useState(null);

  const inputRef = useRef(null);
  const resultRef = useRef(null);
  const stepTimerRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-scroll to results when data arrives
  useEffect(() => {
    if (resultData && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [resultData]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, []);

  // ─── Copy to clipboard handler ───
  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  // ─── Submit handler ───
  const handleSubmit = async () => {
    if (!productUrl.trim()) {
      setErrorMsg('Vui lòng dán link sản phẩm vào ô bên trên!');
      return;
    }

    // Basic URL validation
    try {
      new URL(productUrl.trim());
    } catch {
      setErrorMsg('Link không hợp lệ. Vui lòng kiểm tra lại URL sản phẩm!');
      return;
    }

    setErrorMsg('');
    setResultData(null);
    setIsProcessing(true);
    setCurrentStep(0);

    // Animate through loading steps
    let step = 0;
    stepTimerRef.current = setInterval(() => {
      step++;
      if (step < LOADING_STEPS.length - 1) {
        setCurrentStep(step);
      } else {
        clearInterval(stepTimerRef.current);
      }
    }, 2800);

    try {
      const response = await axiosClient.post('/affiliate/process', {
        productUrl: productUrl.trim()
      });

      clearInterval(stepTimerRef.current);
      setCurrentStep(LOADING_STEPS.length - 1);

      // Short delay for final step animation
      setTimeout(() => {
        if (response.success && response.data) {
          setResultData(response.data);
        } else if (response.data) {
          // axiosClient interceptor already unwraps response.data
          setResultData(response);
        } else {
          setErrorMsg('Phản hồi từ server không hợp lệ.');
        }
        setIsProcessing(false);
      }, 800);
    } catch (err) {
      clearInterval(stepTimerRef.current);
      setIsProcessing(false);
      const serverMsg = err.response?.data?.message || err.message || 'Lỗi không xác định';
      setErrorMsg(`❌ ${serverMsg}`);
      console.error('[AFFILIATE ASSISTANT] Error:', err);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isProcessing) {
      handleSubmit();
    }
  };

  // ─── Tab content mapping ───
  const tabs = [
    { id: 'tiktok',   label: 'Kịch Bản TikTok', icon: FileText },
    { id: 'facebook', label: 'Bài Viết Facebook', icon: MessageSquare },
    { id: 'hashtags', label: 'Hashtags', icon: Hash },
  ];

  const getTabContent = () => {
    if (!resultData) return '';
    switch (activeTab) {
      case 'tiktok':   return resultData.tiktokScript || '';
      case 'facebook': return resultData.facebookPost || '';
      case 'hashtags': return resultData.hashtags || '';
      default: return '';
    }
  };

  const product = resultData?.originalProduct;

  return (
    <div className="w-full min-h-full px-4 py-6 md:px-8 lg:px-12">
      {/* ─── Page Header ─── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/20 flex items-center justify-center">
            <Zap size={20} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
              Trợ Lý Viết Bài Affiliate
            </h1>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">
              Auto Scrape & AI Content Generator
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3 leading-relaxed max-w-2xl">
          Dán link sản phẩm từ <span className="text-amber-500 font-bold">TikTok Shop</span>,{' '}
          <span className="text-amber-500 font-bold">Shopee</span> hoặc{' '}
          <span className="text-amber-500 font-bold">Lazada</span> — Hệ thống sẽ tự động cào thông tin và viết kịch bản bán hàng bằng AI.
        </p>
      </div>

      {/* ─── Input Area ─── */}
      <div className="bg-[#0f0f13] border border-zinc-800/60 rounded-2xl p-5 md:p-6 mb-6 transition-all duration-300 hover:border-amber-500/20">
        <label className="block text-[10px] text-amber-500 font-black uppercase tracking-widest mb-3">
          <Link2 size={12} className="inline mr-1.5 -mt-0.5" />
          Link Sản Phẩm
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="url"
              value={productUrl}
              onChange={(e) => { setProductUrl(e.target.value); setErrorMsg(''); }}
              onKeyDown={handleKeyDown}
              placeholder="https://www.tiktok.com/view/product/..."
              disabled={isProcessing}
              className="w-full bg-[#0a0a0c] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all duration-300 disabled:opacity-50 font-medium"
            />
            {productUrl && !isProcessing && (
              <button
                type="button"
                onClick={() => { setProductUrl(''); setErrorMsg(''); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer bg-transparent border-none text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isProcessing || !productUrl.trim()}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-none flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25"
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Bắt Đầu</span>
              </>
            )}
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="mt-3 px-4 py-2.5 bg-red-950/30 border border-red-900/40 rounded-xl text-xs text-red-400 font-semibold animate-pulse">
            {errorMsg}
          </div>
        )}
      </div>

      {/* ─── Loading Steps Animation ─── */}
      {isProcessing && (
        <div className="bg-[#0f0f13] border border-zinc-800/60 rounded-2xl p-5 md:p-6 mb-6">
          <div className="flex flex-col gap-3">
            {LOADING_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isDone = index < currentStep;

              return (
                <div
                  key={index}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-500 ${
                    isActive
                      ? 'bg-amber-500/10 border border-amber-500/30 scale-[1.01]'
                      : isDone
                        ? 'bg-zinc-900/30 border border-zinc-800/20 opacity-50'
                        : 'bg-transparent border border-transparent opacity-30'
                  }`}
                >
                  <span className={`text-xl transition-all duration-300 ${isActive ? 'animate-bounce' : ''}`}>
                    {isDone ? '✅' : step.icon}
                  </span>
                  <div className="flex-1">
                    <p className={`text-xs font-bold transition-colors duration-300 ${
                      isActive ? 'text-amber-400' : isDone ? 'text-zinc-500' : 'text-zinc-600'
                    }`}>
                      {step.text}
                    </p>
                    <p className={`text-[10px] mt-0.5 transition-colors duration-300 ${
                      isActive ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {step.sub}
                    </p>
                  </div>
                  {isActive && (
                    <Loader2 size={16} className="text-amber-500 animate-spin shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${((currentStep + 1) / LOADING_STEPS.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Results Workspace (2-column) ─── */}
      {resultData && (
        <div ref={resultRef} className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          
          {/* ─── LEFT COLUMN: Content Tabs (3/5 width) ─── */}
          <div className="lg:col-span-3 bg-[#0f0f13] border border-zinc-800/60 rounded-2xl overflow-hidden flex flex-col">
            {/* Tab Navigation */}
            <div className="flex border-b border-zinc-800/60">
              {tabs.map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer border-none ${
                      isActive
                        ? 'bg-amber-500/10 text-amber-400 border-b-2 border-amber-500'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40'
                    }`}
                    style={isActive ? { borderBottom: '2px solid #f59e0b' } : {}}
                  >
                    <TabIcon size={13} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-amber-500 uppercase tracking-wider">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h3>
                <button
                  type="button"
                  onClick={() => handleCopy(getTabContent(), activeTab)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer border-none ${
                    copiedField === activeTab
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-amber-400'
                  }`}
                >
                  {copiedField === activeTab ? (
                    <>
                      <Check size={11} />
                      <span>Đã Copy!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="flex-1 bg-[#0a0a0c] border border-zinc-800/40 rounded-xl p-4 overflow-y-auto max-h-[420px] select-text">
                <pre className="text-[12px] text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans">
                  {getTabContent() || 'Không có dữ liệu.'}
                </pre>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Product Info (2/5 width) ─── */}
          <div className="lg:col-span-2 bg-[#0f0f13] border border-zinc-800/60 rounded-2xl p-5 flex flex-col gap-4">
            {/* Product Header */}
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-800/40">
              <ShoppingBag size={14} className="text-amber-500" />
              <h3 className="text-xs font-black text-amber-500 uppercase tracking-wider">
                Thông Tin Sản Phẩm
              </h3>
            </div>

            {product ? (
              <>
                {/* Product Title */}
                <div className="bg-[#0a0a0c] border border-zinc-800/40 rounded-xl p-3.5">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Tên sản phẩm</p>
                  <p className="text-sm text-zinc-200 font-semibold leading-relaxed">{product.title || 'N/A'}</p>
                </div>

                {/* Price */}
                <div className="bg-[#0a0a0c] border border-zinc-800/40 rounded-xl p-3.5">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">Giá bán</p>
                  <p className="text-xl font-black text-amber-400">{product.price || 'N/A'}</p>
                </div>

                {/* Variants */}
                {product.variants && product.variants.length > 0 && (
                  <div className="bg-[#0a0a0c] border border-zinc-800/40 rounded-xl p-3.5">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">
                      <Palette size={10} className="inline mr-1 -mt-0.5" />
                      Biến thể
                    </p>
                    <div className="flex flex-col gap-2">
                      {product.variants.map((variant, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="text-[10px] text-amber-500/80 font-bold uppercase">
                            {variant.thuoc_tinh || variant.attribute || `Option ${idx + 1}`}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(variant.lua_chon || variant.options || []).map((opt, oidx) => (
                              <span
                                key={oidx}
                                className="px-2 py-1 bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-[10px] text-zinc-300 font-semibold"
                              >
                                {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {product.feedback && (
                  <div className="bg-[#0a0a0c] border border-zinc-800/40 rounded-xl p-3.5">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1.5">
                      <Star size={10} className="inline mr-1 -mt-0.5" />
                      Đánh giá nổi bật
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed italic">"{product.feedback}"</p>
                  </div>
                )}

                {/* Copy All button */}
                <button
                  type="button"
                  onClick={() => {
                    const allContent = [
                      '═══ KỊCH BẢN TIKTOK ═══',
                      resultData.tiktokScript,
                      '',
                      '═══ BÀI VIẾT FACEBOOK ═══',
                      resultData.facebookPost,
                      '',
                      '═══ HASHTAGS ═══',
                      resultData.hashtags
                    ].join('\n');
                    handleCopy(allContent, 'all');
                  }}
                  className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer border-none ${
                    copiedField === 'all'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-400 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/20'
                  }`}
                >
                  {copiedField === 'all' ? (
                    <>
                      <Check size={13} />
                      <span>Đã Copy Tất Cả!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Toàn Bộ Nội Dung</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-zinc-500 italic">Không có thông tin sản phẩm.</p>
              </div>
            )}

            {/* Source link */}
            {productUrl && (
              <a
                href={productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-[10px] text-zinc-500 hover:text-amber-500 transition-colors duration-300 font-semibold mt-auto"
              >
                <ExternalLink size={11} />
                <span className="truncate">{productUrl.substring(0, 60)}...</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─── Empty State (when no results and not processing) ─── */}
      {!resultData && !isProcessing && (
        <div className="flex flex-col items-center justify-center py-16 opacity-40">
          <div className="w-20 h-20 rounded-2xl bg-zinc-900/50 border border-zinc-800/30 flex items-center justify-center mb-4">
            <ShoppingBag size={32} className="text-zinc-600" />
          </div>
          <p className="text-sm text-zinc-500 font-bold mb-1">Chưa có kết quả nào</p>
          <p className="text-[11px] text-zinc-600">Dán link sản phẩm phía trên và nhấn "Bắt Đầu" để bắt đầu</p>
        </div>
      )}
    </div>
  );
}
