import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { systemService } from '../../services/system.service';

const TransactionList = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    systemService.getBillingTransactions(1, 20)
      .then(res => {
        setTransactions(res.transactions || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('[TRANSACTIONS] Load failed:', err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="admin-card p-6">Đang tải lịch sử giao dịch...</div>;
  }

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
              <th className="px-6 py-3">User Email</th>
              <th className="px-6 py-3">Type</th>
              <th className="px-6 py-3">Amount</th>
              <th className="px-6 py-3">Credits</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-4 text-center">Không có giao dịch nào.</td>
              </tr>
            ) : (
              transactions.map((trx) => (
                <tr key={trx.id} className="border-b border-admin-border hover:bg-admin-bg/30">
                  <td className="px-6 py-4 font-medium text-admin-text">TRX-{String(trx.id).padStart(3, '0')}</td>
                  <td className="px-6 py-4">{trx.email}</td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1 text-green-500">
                      <ArrowUpRight size={14} /> Mua
                    </span>
                  </td>
                  <td className="px-6 py-4">${trx.amount}</td>
                  <td className="px-6 py-4 font-medium text-admin-text">+{trx.credits}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${
                      trx.status?.toLowerCase() === 'success' || trx.status?.toLowerCase() === 'completed'
                        ? 'bg-green-500/10 text-green-500'
                        : 'bg-red-500/10 text-red-500'
                    }`}>
                      {trx.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(trx.date).toLocaleString('vi-VN')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
