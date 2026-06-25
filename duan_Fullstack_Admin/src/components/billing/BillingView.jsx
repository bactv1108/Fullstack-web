import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSocket } from '../../services/socketService';
import { ArrowUpRight, X, Search } from 'lucide-react';
import axiosAdminClient from '../../services/axiosAdminClient';

const BillingView = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [approvingIds, setApprovingIds] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'thu' | 'ban'
  const [socket, setSocket] = useState(null);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const searchCode = searchParams.get('search');
  
  // Custom dialog state
  const [dialog, setDialog] = useState({ 
    isOpen: false, 
    type: 'confirm', 
    title: '', 
    message: '', 
    onConfirm: null 
  });

  const limitPerPage = 10;
  const lastFetchedRef = useRef({ page: null, search: null, type: null });

  const fetchData = (page = currentPage, searchVal = activeSearch, typeVal = activeTab) => {
    // Avoid duplicate fetching with same parameters
    if (
      lastFetchedRef.current.page === page &&
      lastFetchedRef.current.search === searchVal &&
      lastFetchedRef.current.type === typeVal
    ) {
      return;
    }
    lastFetchedRef.current = { page, search: searchVal, type: typeVal };

    setLoading(true);
    axiosAdminClient.get(`/transactions?page=${page}&limit=${limitPerPage}&search=${encodeURIComponent(searchVal)}&type=${typeVal}`)
      .then(res => {
        // axiosAdminClient response interceptor returns data field directly
        setTransactions(res.data || []);
        setTotalPages(res.totalPages || 1);
        setTotalCount(res.totalItems || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error('[BILLING VIEW] Fetch transactions failed:', err.message);
        setLoading(false);
      });
  };

  // Automatically trigger search when searchCode is detected on mount or param change
  useEffect(() => {
    if (searchCode) {
      setSearchTerm(searchCode);
      setActiveSearch(searchCode);
      setCurrentPage(1);
      fetchData(1, searchCode, activeTab);
    }
  }, [searchCode]);

  // Re-fetch whenever page, search, OR active tab changes
  useEffect(() => {
    // If there is searchCode in the URL, wait for the searchCode useEffect to fetch it directly
    if (searchCode && activeSearch !== searchCode) {
      return;
    }
    fetchData(currentPage, activeSearch, activeTab);
  }, [currentPage, activeSearch, activeTab]);

  // Handle automatic popup of approval modal for matched transaction
  useEffect(() => {
    if (searchCode && transactions.length > 0) {
      const targetTransaction = transactions.find(t => t.id === searchCode);
      if (targetTransaction) {
        if (targetTransaction.status === 'pending') {
          handleApproveClick(targetTransaction.id);
        }
      }
      // Remove search param from URL to avoid repeating modal popup on refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('search');
      setSearchParams(newParams);
    }
  }, [searchCode, transactions]);
  
  // Set up Socket.io connection for real-time transaction updates
  useEffect(() => {
    const socketInstance = getSocket();
    setSocket(socketInstance);

    const handleTransactionCreated = (newTransaction) => {
      console.log('[SOCKET.IO] Received transaction:created, reloading data:', newTransaction);
      fetchData(currentPage, activeSearch, activeTab);
    };

    const handleTransactionDeleted = (deletedTransaction) => {
      console.log('[SOCKET.IO] Received transaction:deleted, reloading data:', deletedTransaction);
      fetchData(currentPage, activeSearch, activeTab);
    };

    const handleTransactionUpdated = (updatedTransaction) => {
      console.log('[SOCKET.IO] Received transaction:updated, reloading data:', updatedTransaction);
      fetchData(currentPage, activeSearch, activeTab);
    };

    const handleNewTransaction = (data) => {
      console.log('[SOCKET.IO] Received NEW_TRANSACTION, reloading data:', data);
      fetchData(currentPage, activeSearch, activeTab);
    };

    socketInstance.on('transaction:created', handleTransactionCreated);
    socketInstance.on('transaction:deleted', handleTransactionDeleted);
    socketInstance.on('transaction:updated', handleTransactionUpdated);
    socketInstance.on('NEW_TRANSACTION', handleNewTransaction);

    return () => {
      socketInstance.off('transaction:created', handleTransactionCreated);
      socketInstance.off('transaction:deleted', handleTransactionDeleted);
      socketInstance.off('transaction:updated', handleTransactionUpdated);
      socketInstance.off('NEW_TRANSACTION', handleNewTransaction);
    };
  }, [currentPage, activeSearch, activeTab]);

  // Formatter for VNĐ currency
  const formatVND = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })
      .format(value)
      .replace('₫', 'đ');
  };

  // Helper to generate dynamic status badge
  const renderStatusBadge = (status) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case 'success':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-500/10 text-green-500">
            Thành công
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-500">
            Thất bại
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-500/10 text-yellow-500">
            Chờ xử lý
          </span>
        );
    }
  };

  // Trigger search execution
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    setActiveSearch(searchTerm);
    setCurrentPage(1);
  };

  // Clear search field completely
  const handleClearSearch = () => {
    setSearchTerm('');
    setActiveSearch('');
    setCurrentPage(1);
  };

  // Open confirmation custom dialog modal
  const handleApproveClick = (id) => {
    setDialog({
      isOpen: true,
      type: 'confirm',
      title: 'Xác nhận duyệt giao dịch',
      message: 'Bạn có chắc chắn muốn duyệt thủ công và cộng credits cho giao dịch này?',
      onConfirm: () => executeApproval(id)
    });
  };

  // Execute approval transaction API request
  const executeApproval = async (id) => {
    setApprovingIds(prev => ({ ...prev, [id]: true }));
    try {
      const res = await axiosAdminClient.put(`/transactions/${id}/approve`);
      setDialog({
        isOpen: true,
        type: 'success',
        title: 'Thành Công',
        message: res.message || 'Duyệt giao dịch và cộng credits thành công!',
        onConfirm: null
      });
      fetchData(currentPage, activeSearch);
    } catch (err) {
      console.error('[BILLING VIEW] Approval error:', err.message);
      const errMsg = err.response?.data?.message || 'Lỗi hệ thống khi duyệt giao dịch.';
      setDialog({
        isOpen: true,
        type: 'error',
        title: 'Thất Bại',
        message: errMsg,
        onConfirm: null
      });
    } finally {
      setApprovingIds(prev => ({ ...prev, [id]: false }));
    }
  };

  // Generate page number array for rendering
  const renderPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // ── Helper: determine if a transaction is outflow (Bán) ──────────────────
  const isBan = (trx) =>
    trx.amount > 0 || trx.type === 'Hệ thống tặng' || trx.package_name === 'Gói Free';

  // ── Tab-filtered list (applied on top of the already search-filtered page) ──
  const tabFilteredTransactions = transactions.filter((trx) => {
    if (activeTab === 'thu') return !isBan(trx);  // Nạp tiền / Thu
    if (activeTab === 'ban') return isBan(trx);   // Tiêu dùng / Bán
    return true;                                   // 'all'
  });

  // Tab count badges (computed from current page data)
  const countAll = transactions.length;
  const countThu = transactions.filter((t) => !isBan(t)).length;
  const countBan = transactions.filter((t) => isBan(t)).length;

  return (
    <div className="admin-card p-0 overflow-hidden relative">
      <div className="p-6 border-b border-admin-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">Lịch Sử Giao Dịch</h2>
          <p className="text-xs text-admin-text-muted mt-1">
            {activeSearch ? `Tìm thấy ${totalCount} kết quả phù hợp` : `Tổng cộng ${totalCount} lượt giao dịch đã thực hiện`}
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full sm:max-w-xs">
          <Search size={18} className="absolute left-3 text-admin-text-muted pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo mã giao dịch hoặc email..."
            className="bg-[#0f0f13] border border-admin-border text-admin-text text-xs rounded-lg block w-full pl-10 pr-9 py-2.5 outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchTerm !== '' && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 text-admin-text-muted hover:text-white transition-all cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </form>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0 flex items-center gap-2 border-b border-admin-border bg-slate-50/60 dark:bg-[#111115]/60">
        {/* Tab: Tất cả */}
        <button
          onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            activeTab === 'all'
              ? 'border-admin-primary text-white bg-admin-primary/10'
              : 'border-transparent text-admin-text-muted hover:text-admin-text hover:bg-admin-card/40'
          }`}
        >
          Tất cả
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'all' ? 'bg-admin-primary/20 text-admin-primary' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {countAll}
          </span>
        </button>

        {/* Tab: Nạp tiền (Thu) */}
        <button
          onClick={() => { setActiveTab('thu'); setCurrentPage(1); }}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            activeTab === 'thu'
              ? 'border-green-500 text-green-400 bg-green-500/10'
              : 'border-transparent text-admin-text-muted hover:text-green-400 hover:bg-green-500/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0"></span>
          Nạp tiền (Thu)
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'thu' ? 'bg-green-500/20 text-green-400' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {countThu}
          </span>
        </button>

        {/* Tab: Tiêu dùng (Bán) */}
        <button
          onClick={() => { setActiveTab('ban'); setCurrentPage(1); }}
          className={`relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            activeTab === 'ban'
              ? 'border-red-500 text-red-400 bg-red-500/10'
              : 'border-transparent text-admin-text-muted hover:text-red-400 hover:bg-red-500/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
          Tiêu dùng (Bán)
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'ban' ? 'bg-red-500/20 text-red-400' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {countBan}
          </span>
        </button>
      </div>

      {/* Table wrapper: relative + min-height so layout never collapses during page transitions */}
      <div className="overflow-x-auto relative" style={{ minHeight: '320px' }}>

        {/* ── Overlay spinner: overlays the table WITHOUT collapsing its height ── */}
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0f0f13]/75 backdrop-blur-[2px] rounded-b-xl">
            <div className="animate-spin rounded-full h-9 w-9 border-t-2 border-b-2 border-admin-primary mb-3"></div>
            <span className="text-xs text-admin-text-muted font-medium tracking-wide">
              Đang tải dữ liệu...
            </span>
          </div>
        )}

        <table className="w-full text-left text-sm text-admin-text-muted">
          <thead className="text-xs uppercase bg-admin-bg/50 border-b border-admin-border sticky top-0">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">User Email</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Credits</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Hành động</th>
            </tr>
          </thead>
          <tbody className={loading ? 'opacity-40 pointer-events-none select-none' : ''}>
            {/* Only show empty state when NOT loading and data is truly empty */}
            {!loading && tabFilteredTransactions.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="text-3xl">
                      {activeTab === 'thu' ? '💸' : activeTab === 'ban' ? '🛒' : '📋'}
                    </span>
                    <p className="text-sm text-admin-text-muted font-semibold">
                      {activeTab === 'thu' ? 'Không có giao dịch nạp tiền nào' :
                       activeTab === 'ban' ? 'Không có giao dịch tiêu dùng nào' :
                       'Chưa có lịch sử giao dịch nào.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              tabFilteredTransactions.map((trx) => (
                <tr key={trx.id} className="border-b border-admin-border hover:bg-admin-bg/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-admin-text">{trx.id}</td>
                  <td className="px-6 py-4">{trx.user?.email || 'Khách vãng lai'}</td>
                  <td className="px-6 py-4">
                    {trx.amount > 0 || trx.type === 'Hệ thống tặng' || trx.package_name === 'Gói Free' ? (
                      <span className="flex items-center gap-1 text-red-500 font-medium">
                        ↘ Bán
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-500 font-medium">
                        ↖ Thu
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-admin-text">{formatVND(trx.amount)}</td>
                  <td className="px-6 py-4">
                    {(() => {
                      const isOutflow = trx.amount > 0 || trx.type === 'Hệ thống tặng' || trx.package_name === 'Gói Free';
                      return isOutflow ? (
                        <span className="font-semibold text-red-500">
                          -{Math.abs(trx.credits_added)}
                        </span>
                      ) : (
                        <span className="font-semibold text-green-500">
                          +{Math.abs(trx.credits_added)}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">{renderStatusBadge(trx.status)}</td>
                  <td className="px-6 py-4">
                    {trx.createdAt ? new Date(trx.createdAt).toLocaleString('vi-VN') : 'N/A'}
                  </td>
                  <td className="px-6 py-4">
                    {trx.status === 'pending' ? (
                      <button
                        disabled={approvingIds[trx.id]}
                        onClick={() => handleApproveClick(trx.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-xs px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 cursor-pointer select-none"
                      >
                        {approvingIds[trx.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                            Đang duyệt...
                          </>
                        ) : (
                          'Duyệt đơn'
                        )}
                      </button>
                    ) : (
                      <span className="text-admin-text-muted/50">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-admin-border flex items-center justify-between bg-admin-bg/10">
          <span className="text-xs text-admin-text-muted">
            Trang {currentPage} trên {totalPages} (Hiển thị {transactions.length} dòng)
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 rounded text-xs font-medium border border-admin-border transition-all select-none ${
                currentPage === 1
                  ? 'bg-admin-bg/10 text-admin-text-muted/40 cursor-not-allowed border-admin-border/50'
                  : 'bg-admin-bg/50 text-admin-text hover:bg-admin-bg hover:border-admin-text/25 cursor-pointer'
              }`}
            >
              &lt; Trước
            </button>

            {renderPageNumbers().map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 rounded text-xs font-semibold border transition-all ${
                  currentPage === page
                    ? 'bg-admin-primary border-admin-primary text-white font-bold shadow-sm'
                    : 'bg-admin-bg/50 border-admin-border text-admin-text-muted hover:text-admin-text hover:bg-admin-bg'
                }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1.5 rounded text-xs font-medium border border-admin-border transition-all select-none ${
                currentPage === totalPages
                  ? 'bg-admin-bg/10 text-admin-text-muted/40 cursor-not-allowed border-admin-border/50'
                  : 'bg-admin-bg/50 text-admin-text hover:bg-admin-bg hover:border-admin-text/25 cursor-pointer'
              }`}
            >
              Sau &gt;
            </button>
          </div>
        </div>
      )}

      {/* Custom Dialog Overlay Popup */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e1e24] border border-slate-200 dark:border-[#2d2d34] text-slate-900 dark:text-admin-text rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in relative">
            <div className="flex flex-col items-center text-center">
              {dialog.type === 'success' && (
                <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mb-4 border border-green-500/20">
                  <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {dialog.type === 'confirm' && (
                <div className="w-12 h-12 bg-yellow-500/10 text-yellow-500 rounded-full flex items-center justify-center mb-4 border border-yellow-500/20">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              )}
              {dialog.type === 'error' && (
                <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
              
              <h3 className="text-base font-bold text-admin-text mb-2">{dialog.title}</h3>
              <p className="text-xs text-admin-text-muted mb-6 leading-relaxed">{dialog.message}</p>
              
              <div className="flex gap-3 w-full">
                {dialog.type === 'confirm' ? (
                  <>
                    <button
                      onClick={() => setDialog(prev => ({ ...prev, isOpen: false }))}
                      className="flex-1 bg-admin-bg/50 border border-admin-border hover:bg-admin-bg text-admin-text text-xs py-2.5 px-4 rounded-md font-semibold transition-colors cursor-pointer select-none"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      onClick={() => {
                        setDialog(prev => ({ ...prev, isOpen: false }));
                        if (dialog.onConfirm) dialog.onConfirm();
                      }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2.5 px-4 rounded-md font-semibold transition-colors cursor-pointer select-none"
                    >
                      Xác nhận duyệt
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setDialog(prev => ({ ...prev, isOpen: false }));
                      if (dialog.onConfirm) dialog.onConfirm();
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2.5 px-4 rounded-md font-semibold transition-colors cursor-pointer select-none"
                  >
                    Đóng
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingView;
