import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const TransactionList = () => {
  const transactions = [
    { id: 'TRX-001', user: 'Alice Smith', type: 'Purchase', amount: 19.99, credits: 1000, date: '2026-05-18', status: 'Completed' },
    { id: 'TRX-002', user: 'Bob Jones', type: 'Usage', amount: 0, credits: -50, date: '2026-05-17', status: 'Completed' },
    { id: 'TRX-003', user: 'Charlie', type: 'Purchase', amount: 49.99, credits: 3000, date: '2026-05-16', status: 'Failed' },
  ];

  return (
    <div className="admin-card p-0 overflow-hidden">
      <div className="p-6 border-b border-admin-border">
        <h2 className="text-lg font-semibold">Lịch Sử Giao Dịch</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-admin-text-muted">
          <thead className="text-xs uppercase bg-admin-bg/50 border-b border-admin-border">
            <tr>
              <th className="px-6 py-3">ID</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Credits</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((trx, idx) => (
              <tr key={trx.id} className="border-b border-admin-border hover:bg-admin-bg/30">
                <td className="px-6 py-4 font-medium text-admin-text">{trx.id}</td>
                <td className="px-6 py-4">{trx.user}</td>
                <td className="px-6 py-4">
                  {trx.type === 'Purchase' ? (
                    <span className="flex items-center gap-1 text-green-500"><ArrowUpRight size={14} /> Mua</span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-500"><ArrowDownRight size={14} /> Tiêu</span>
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-admin-text">{trx.credits > 0 ? `+${trx.credits}` : trx.credits}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${trx.status === 'Completed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {trx.status}
                  </span>
                </td>
                <td className="px-6 py-4">{trx.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
