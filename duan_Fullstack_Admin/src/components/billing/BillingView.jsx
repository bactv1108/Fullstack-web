import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
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
  
  // Custom dialog state
  const [dialog, setDialog] = useState({ 
    isOpen: false, 
    type: 'confirm', 
    title: '', 
    message: '', 
    onConfirm: null 
  });

  const limitPerPage = 10;

  const fetchData = (page = currentPage, searchVal = activeSearch) => {
    setLoading(true);
    axiosAdminClient.get(`/transactions?page=${page}&limit=${limitPerPage}&search=${encodeURIComponent(searchVal)}`)
      .then(res => {
        // axiosAdminClient response interceptor returns data field directly
        setTransactions(res.transactions || []);
        setTotalPages(res.totalPages || 1);
        setTotalCount(res.count || 0);
        setLoading(false);
      })
      .catch(err => {
        console.error('[BILLING VIEW] Fetch transactions failed:', err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData(currentPage, activeSearch);
  }, [currentPage, activeSearch]);

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

  return (
    <div className="admin-card p-0 overflow-hidden relative">
      <div className="p-6 border-b border-admin-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold">Lịch Sử Giao Dịch</h2>
          <p className="text-xs text-admin-text-muted mt-1">
            {activeSearch ? `Tìm thấy ${totalCount} kết quả phù hợp` : `Tổng cộng ${totalCount} lượt giao dịch đã thực hiện`}
          </p>
        </div>

        {/* Search Bar Form */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center w-full sm:max-w-xs">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo mã giao dịch hoặc email..."
            className="bg-admin-bg/50 border border-admin-border text-admin-text text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-admin-primary/50 focus:border-admin-primary/50 block w-full pl-3 pr-8 py-2.5 transition-all"
          />
          {searchTerm !== '' && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-admin-text-muted/70 hover:text-admin-text hover:bg-admin-border/30 rounded-full p-0.5 transition-colors cursor-pointer flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </form>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-admin-text-muted">
          <thead className="text-xs uppercase bg-admin-bg/50 border-b border-admin-border">
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
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-admin-primary"></div>
                    <span className="text-admin-text-muted">Đang tải lịch sử giao dịch từ Database...</span>
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-8 text-center text-admin-text-muted">
                  Không tìm thấy giao dịch nào.
                </td>
              </tr>
            ) : (
              transactions.map((trx) => (
                <tr key={trx.id} className="border-b border-admin-border hover:bg-admin-bg/30 transition-colors">
                  <td className="px-6 py-4 font-semibold text-admin-text">{trx.id}</td>
                  <td className="px-6 py-4">{trx.user?.email || 'Khách vãng lai'}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-green-500 font-medium">
                      <ArrowUpRight size={14} /> Mua
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-admin-text">{formatVND(trx.amount)}</td>
                  <td className="px-6 py-4 font-semibold text-green-500">+{trx.credits_added}</td>
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
                          "Duyệt đơn"
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
      {!loading && totalPages > 1 && (
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
          <div className="bg-[#1e1e24] border border-[#2d2d34] text-admin-text rounded-xl shadow-2xl p-6 max-w-sm w-full animate-fade-in relative">
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
