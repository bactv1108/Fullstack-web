import React, { useEffect, useState } from 'react';
import { userService } from '../../services/user.service';
import { MoreVertical, Search, Edit2, Ban, CheckCircle } from 'lucide-react';
import CreditModal from './CreditModal';

const UserTable = () => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    userService.getUsers().then(setUsers);
  }, []);

  const handleToggleStatus = (user) => {
    const newStatus = user.status === 'Active' ? 'Banned' : 'Active';
    userService.updateStatus(user.id, newStatus).then(() => {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    }).catch(err => {
      console.error('[STATUS UPDATE] Failed:', err.message);
      alert(err.response?.data?.message || err.message || 'Cập nhật trạng thái thất bại.');
    });
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-card p-0 overflow-hidden flex flex-col h-full">
      <div className="p-6 border-b border-admin-border flex justify-between items-center">
        <h2 className="text-lg font-semibold">Danh Sách Người Dùng</h2>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-text-muted" />
          <input 
            type="text" 
            placeholder="Tìm kiếm..." 
            className="admin-input pl-10 py-1.5 text-sm w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
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
            {filteredUsers.map(user => (
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
