import React, { useEffect, useState, useRef } from 'react';
import axiosAdminClient from '../../services/axiosAdminClient';
import { X, Plus, Loader2, AlertCircle, ShieldAlert } from 'lucide-react';

const BlacklistWord = () => {
  const [words, setWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingWord, setRemovingWord] = useState(null); // track which word is being removed
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  // ── Fetch danh sách từ khóa cấm khi mount ─────────────────────────────────
  useEffect(() => {
    const fetchBlacklist = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await axiosAdminClient.get('/moderation/blacklist');
        // API trả về mảng string hoặc mảng object
        setWords(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[BLACKLIST] fetchBlacklist error:', err);
        setError('Không thể tải danh sách từ khóa cấm. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };
    fetchBlacklist();
  }, []);

  // ── Thêm từ khóa mới ──────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = newWord.trim();
    if (!trimmed) return;

    // Kiểm tra trùng lặp ở client trước khi gọi API
    if (words.includes(trimmed)) {
      setError(`Từ khóa "${trimmed}" đã có trong danh sách.`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setAdding(true);
      setError('');
      const response = await axiosAdminClient.post('/moderation/blacklist', { word: trimmed });
      // API trả về { success, blacklist: string[] }
      const updatedList = response?.blacklist;
      if (Array.isArray(updatedList)) {
        setWords(updatedList);
      } else {
        // Fallback: optimistic update nếu API không trả về list mới
        setWords(prev => [...prev, trimmed]);
      }
      setNewWord('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('[BLACKLIST] addWord error:', err);
      const msg = err?.response?.data?.message || 'Thêm từ khóa thất bại.';
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } finally {
      setAdding(false);
    }
  };

  // ── Xóa từ khóa ──────────────────────────────────────────────────────────
  const handleRemove = async (word) => {
    if (removingWord === word) return; // tránh double-click

    try {
      setRemovingWord(word);
      setError('');
      const response = await axiosAdminClient.delete(
        `/moderation/blacklist?word=${encodeURIComponent(word)}`
      );
      // API trả về { success, blacklist: string[] }
      const updatedList = response?.blacklist;
      if (Array.isArray(updatedList)) {
        setWords(updatedList);
      } else {
        // Fallback: optimistic remove
        setWords(prev => prev.filter(w => w !== word));
      }
    } catch (err) {
      console.error('[BLACKLIST] removeWord error:', err);
      setError(`Xóa từ khóa "${word}" thất bại. Vui lòng thử lại.`);
      setTimeout(() => setError(''), 4000);
    } finally {
      setRemovingWord(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="admin-card p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <ShieldAlert size={20} className="text-admin-danger" />
        <h2 className="text-lg font-semibold">Từ Khóa Cấm (Blacklist)</h2>
        {!loading && (
          <span className="ml-auto text-xs text-admin-text-muted bg-admin-bg border border-admin-border px-2 py-0.5 rounded-full">
            {words.length} từ khóa
          </span>
        )}
      </div>

      {/* Input Row */}
      <div className="flex gap-2 mb-4">
        <input
          ref={inputRef}
          type="text"
          value={newWord}
          onChange={(e) => setNewWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập từ khóa cần cấm rồi nhấn Enter..."
          className="admin-input flex-1"
          disabled={adding || loading}
        />
        <button
          onClick={handleAdd}
          disabled={adding || loading || !newWord.trim()}
          className="admin-btn admin-btn-primary flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {adding ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Plus size={16} />
          )}
          Thêm
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 mb-4">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-admin-text-muted">
          <Loader2 size={20} className="animate-spin mr-2" />
          <span className="text-sm">Đang tải danh sách từ khóa...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && words.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-8 text-admin-text-muted">
          <ShieldAlert size={32} className="mb-2 opacity-40" />
          <p className="text-sm">Chưa có từ khóa cấm nào. Hãy thêm từ khóa đầu tiên.</p>
        </div>
      )}

      {/* Keyword Tags */}
      {!loading && words.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {words.map((word) => (
            <span
              key={word}
              className="bg-admin-bg border border-admin-danger/30 text-admin-text px-3 py-1.5 rounded-full flex items-center gap-2 text-sm transition-all"
            >
              {word}
              <button
                onClick={() => handleRemove(word)}
                disabled={removingWord === word}
                className="text-admin-danger hover:text-red-400 disabled:opacity-40 flex items-center"
                title={`Xóa từ khóa "${word}"`}
              >
                {removingWord === word ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <X size={14} />
                )}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlacklistWord;
