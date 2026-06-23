import React, { useState, useEffect } from 'react';
import axiosClient from '../../services/axiosClient';

const ApiLogsView = () => {
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await axiosClient.get(`/admin/detailed-logs?page=${currentPage}&limit=20&provider=${selectedProvider}`);
      const responseData = res?.data?.data !== undefined ? res.data : res;
      if (responseData?.success) {
        setLogs(responseData.data);
        setTotalPages(responseData.pagination.totalPages);
        setTotalItems(responseData.pagination.totalItems);
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu Logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [currentPage, selectedProvider]);

  // Hàm helper để xác định màu huy hiệu theo Provider
  const getProviderBadgeColor = (providerName) => {
    const colors = {
      'Fal': '!bg-blue-500/10 !text-blue-400',
      'OpenRouter': '!bg-purple-500/10 !text-purple-400',
      'Gemini': '!bg-green-500/10 !text-green-400',
      'ElevenLabs': '!bg-pink-500/10 !text-pink-400',
    };
    return colors[providerName] || '!bg-zinc-800 !text-zinc-400';
  };

  return (
    <div className="!w-full !max-w-[1920px] !mx-auto !px-4 sm:!px-6 lg:!px-8 !py-6 !bg-black !min-h-screen">
      {/* Thanh Tiêu Đề Điều Hướng */}
      <div className="!flex !items-center !justify-between !mb-6 !border-b !border-zinc-850 !pb-4">
        <div>
          <h1 className="!text-xl !md:text-2xl !font-black !text-white !tracking-wide">LỊCH SỬ LOGS CHI PHÍ NGOẠI VI</h1>
          <p className="!text-xs !text-zinc-500 !mt-1">Tra cứu chi tiết từng request tiêu tốn USD của hệ thống</p>
        </div>
        
        {/* Bộ lọc nhanh theo Đối tác */}
        <select 
          value={selectedProvider}
          onChange={(e) => { setSelectedProvider(e.target.value); setCurrentPage(1); }}
          className="!bg-zinc-900 !text-sm !text-zinc-200 !border !border-zinc-800 !rounded-xl !px-4 !py-2 focus:!outline-none focus:!border-amber-500 !cursor-pointer"
        >
          <option value="">Tất cả nhà cung cấp</option>
          <option value="Fal">Fal.ai</option>
          <option value="OpenRouter">OpenRouter</option>
          <option value="Gemini">Gemini</option>
          <option value="ElevenLabs">ElevenLabs</option>
        </select>
      </div>

      {/* Bảng Dữ Liệu Hiển Thị Đậm Chất Scannable */}
      <div className="!bg-zinc-900 !border !border-zinc-850 !rounded-2xl !overflow-hidden">
        <div className="!overflow-x-auto">
          <table className="!w-full !text-left !border-collapse">
            <thead>
              <tr className="!bg-zinc-950 !border-b !border-zinc-850 !text-xs !font-bold !text-zinc-400 !uppercase !tracking-wider">
                <th className="!p-4">Mã Log</th>
                <th className="!p-4">User ID</th>
                <th className="!p-4">Đối Tác</th>
                <th className="!p-4">Hành Động Tác Vụ</th>
                <th className="!p-4">Chi Phí (USD)</th>
                <th className="!p-4">Thời Gian</th>
              </tr>
            </thead>
            <tbody className="!text-sm !divide-y !divide-zinc-850 !text-zinc-300">
              {logs.map((log) => (
                <tr key={log.id} className="hover:!bg-zinc-850/40 !transition-all">
                  <td className="!p-4 !font-mono !text-xs !text-zinc-500">#{log.id}</td>
                  <td className="!p-4 !font-medium">{log.userId}</td>
                  <td className="!p-4">
                    <span className={`!px-2.5 !py-0.5 !rounded-md !text-xs !font-bold ${getProviderBadgeColor(log.provider_name)}`}>
                      {log.provider_name}
                    </span>
                  </td>
                  <td className="!p-4 !text-zinc-400 !max-w-xs !truncate">{log.action_type}</td>
                  <td className="!p-4 !font-bold !text-red-400">${Number(log.amount).toFixed(3)}</td>
                  <td className="!p-4 !text-xs !text-zinc-500">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trạng thái trống */}
        {logs.length === 0 && !isLoading && (
          <p className="!text-center !text-zinc-500 !py-12 !text-sm">Chưa có dữ liệu log chi tiết nào.</p>
        )}

        {/* Thanh Điều Hướng Phân Trang */}
        <div className="!p-4 !bg-zinc-950 !border-t !border-zinc-850 !flex !items-center !justify-between">
          <span className="!text-xs !text-zinc-500">
            Hiển thị {logs.length} / {totalItems} bản ghi (Trang {currentPage}/{totalPages})
          </span>
          <div className="!flex !items-center !gap-2">
            <button
              type="button"
              disabled={currentPage === 1 || isLoading}
              onClick={() => setCurrentPage(p => p - 1)}
              className="!px-3 !py-1.5 !text-xs !font-bold !bg-zinc-900 !text-zinc-300 !rounded-lg !border !border-zinc-800 disabled:!opacity-40 disabled:!cursor-not-allowed hover:!bg-zinc-800"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={currentPage === totalPages || isLoading}
              onClick={() => setCurrentPage(p => p + 1)}
              className="!px-3 !py-1.5 !text-xs !font-bold !bg-zinc-900 !text-zinc-300 !rounded-lg !border !border-zinc-800 disabled:!opacity-40 disabled:!cursor-not-allowed hover:!bg-zinc-800"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiLogsView;
