import React, { useEffect, useState } from 'react';
import { userService } from '../../services/user.service';
import { MoreVertical, Search, Edit2, Ban, CheckCircle, X } from 'lucide-react';
import CreditModal from './CreditModal';

const UserTable = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusTab, setStatusTab] = useState('all'); // 'all' | 'active' | 'banned'

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    userService.getUsers(searchTerm, currentPage, 10).then(res => {
      if (res && res.users) {
        setUsers(res.users);
        setTotalPages(res.totalPages || 1);
      } else {
        setUsers([]);
        setTotalPages(1);
      }
    }).catch(err => {
      console.error('[FETCH USERS] Failed:', err.message);
    });
  }, [currentPage, searchTerm]);

  const handleToggleStatus = (user) => {
    const newStatus = user.status === 'Active' ? 'Banned' : 'Active';
    userService.updateStatus(user.id, newStatus).then(() => {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    }).catch(err => {
      console.error('[STATUS UPDATE] Failed:', err.message);
      alert(err.response?.data?.message || err.message || 'Cập nhật trạng thái thất bại.');
    });
  };

  // Tab-filtered list — pure client-side filter on top of server-fetched page data
  const filteredUsers = users.filter((u) => {
    if (statusTab === 'active') return u.status === 'Active';
    if (statusTab === 'banned') return u.status === 'Banned';
    return true;
  });

  // Badge counts per tab (from current page)
  const countAll    = users.length;
  const countActive = users.filter((u) => u.status === 'Active').length;
  const countBanned = users.filter((u) => u.status === 'Banned').length;

  return (
    <div className="admin-card p-0 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-admin-border flex justify-between items-center">
        <h2 className="text-lg font-semibold">Danh Sách Người Dùng</h2>
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="admin-input pl-10 pr-9 py-1.5 text-sm w-64 bg-[#0e0e11] border border-admin-border rounded-lg text-admin-text outline-none transition-all focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 text-admin-text-muted hover:text-white transition-all cursor-pointer p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-0 flex items-center gap-2 border-b border-admin-border bg-slate-50/60 dark:bg-[#111115]/60">

        {/* Tab: Tất cả */}
        <button
          onClick={() => setStatusTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            statusTab === 'all'
              ? 'border-admin-primary text-white bg-admin-primary/10'
              : 'border-transparent text-admin-text-muted hover:text-admin-text hover:bg-admin-card/40'
          }`}
        >
          Tất cả
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusTab === 'all' ? 'bg-admin-primary/20 text-admin-primary' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {countAll}
          </span>
        </button>

        {/* Tab: Đang hoạt động (Active) */}
        <button
          onClick={() => setStatusTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            statusTab === 'active'
              ? 'border-green-500 text-green-400 bg-green-500/10'
              : 'border-transparent text-admin-text-muted hover:text-green-400 hover:bg-green-500/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0 animate-pulse"></span>
          Đang hoạt động
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusTab === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {countActive}
          </span>
        </button>

        {/* Tab: Đã chặn (Banned) */}
        <button
          onClick={() => setStatusTab('banned')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all select-none border-b-2 ${
            statusTab === 'banned'
              ? 'border-red-500 text-red-400 bg-red-500/10'
              : 'border-transparent text-admin-text-muted hover:text-red-400 hover:bg-red-500/5'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
          Đã chặn
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            statusTab === 'banned' ? 'bg-red-500/20 text-red-400' : 'bg-admin-card text-admin-text-muted'
          }`}>
            {countBanned}
          </span>
        </button>

      </div>
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-sm text-admin-text-muted">
          <thead className="text-xs uppercase bg-admin-bg/50 border-b border-admin-border">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Credits</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="text-3xl">
                      {statusTab === 'active' ? '🟢' : statusTab === 'banned' ? '🔴' : '👥'}
                    </span>
                    <p className="text-sm text-admin-text-muted font-semibold">
                      {statusTab === 'active' ? 'Không có tài khoản đang hoạt động' :
                       statusTab === 'banned' ? 'Không có tài khoản nào bị chặn' :
                       'Chưa có người dùng nào.'}
                    </p>
                  </div>
                </td>
              </tr>
            ) : filteredUsers.map(user => (
              <tr key={user.id} className="border-b border-admin-border hover:bg-admin-bg/30 transition-colors">
                <td className="px-6 py-4">#{user.id}</td>
                <td className="px-6 py-4 font-medium text-admin-text">{user.name}</td>
                <td className="px-6 py-4">{user.email}</td>
                <td className="px-6 py-4 font-medium text-admin-primary">{user.credits}</td>
                <td className="px-6 py-4">
                  {user.status === 'Active' 
                    ? <span className="flex items-center gap-1 text-green-500 text-xs"><CheckCircle size={14}/> {user.status}</span>
                    : <span className="flex items-center gap-1 text-red-500 text-xs"><Ban size={14}/> {user.status}</span>
                  }
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button 
                    onClick={() => setSelectedUser(user)}
                    className="text-admin-text-muted hover:text-admin-primary p-1"
                    title="Chỉnh sửa Credit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleToggleStatus(user)}
                    className={`p-1 ${user.status === 'Active' ? 'text-admin-text-muted hover:text-admin-danger' : 'text-admin-danger hover:text-green-500'}`}
                    title={user.status === 'Active' ? "Khoá Tài Khoản" : "Mở Khoá Tài Khoản"}
                  >
                    {user.status === 'Active' ? <Ban size={16} /> : <CheckCircle size={16} />}
                  </button>
                  <button className="text-admin-text-muted hover:text-admin-text p-1">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Thanh Phân Trang */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-800 w-full px-6 pb-6 bg-slate-100 dark:bg-[#0e0e11] rounded-b-lg">
        {/* Phía bên trái (Thông tin trang) */}
        <div className="text-gray-400 dark:text-gray-500 text-xs">
          Trang {currentPage} trên {totalPages} (Hiển thị {users.length} dòng)
        </div>

        {/* Phía bên phải (Hệ thống nút bấm) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            className={`px-3 py-1.5 text-xs rounded transition-colors font-medium cursor-pointer ${
              currentPage === 1 
                ? 'bg-gray-200/40 dark:bg-[#1a1a24]/40 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                : 'bg-gray-200 dark:bg-[#1a1a24] hover:bg-gray-300 dark:hover:bg-[#2b2b36] text-gray-700 dark:text-white'
            }`}
          >
            &lt; Trước
          </button>

          {/* Render các nút số trang */}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              onClick={() => setCurrentPage(pageNum)}
              className={`px-2.5 py-1 text-xs rounded transition-colors font-medium cursor-pointer ${
                currentPage === pageNum
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-gray-200 dark:bg-[#1a1a24] hover:bg-gray-300 dark:hover:bg-[#2b2b36] text-gray-500 dark:text-gray-300 dark:hover:text-white'
              }`}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            className={`px-3 py-1.5 text-xs rounded transition-colors font-medium cursor-pointer ${
              (currentPage === totalPages || totalPages === 0)
                ? 'bg-gray-200/40 dark:bg-[#1a1a24]/40 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                : 'bg-gray-200 dark:bg-[#1a1a24] hover:bg-gray-300 dark:hover:bg-[#2b2b36] text-gray-700 dark:text-white'
            }`}
          >
            Sau &gt;
          </button>
        </div>
      </div>

      {selectedUser && (
        <CreditModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          onSuccess={(userId, newCredits) => {
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, credits: newCredits } : u));
          }}
        />
      )}
    </div>
  );
};

export default UserTable;
