import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/system.service';

const ApiCostCard = () => {
  const [providerStats, setProviderStats] = useState([]);

  useEffect(() => {
    systemService.getApiCosts().then((res) => {
      if (res && res.success && Array.isArray(res.data)) {
        setProviderStats(res.data);
      } else if (Array.isArray(res)) {
        setProviderStats(res);
      } else if (res && Array.isArray(res.data)) {
        setProviderStats(res.data);
      } else {
        setProviderStats([]);
      }
    });
  }, []);

  return (
    <div className="!bg-zinc-900 !border !border-zinc-850 !rounded-2xl !p-5 !w-full">
      <div className="!flex !items-center !justify-between !mb-4">
        <h3 className="!text-base !font-bold !text-white">Chi Phí Nhà Cung Cấp (Tháng Này)</h3>
        <span className="!text-xs !text-zinc-500 !font-medium">Đơn vị: USD</span>
      </div>

      {/* Khung chứa danh sách có thanh cuộn dọc tự động kích hoạt nếu vượt quá 10 dòng */}
      <div className="!max-h-[320px] !overflow-y-auto !pr-1 !space-y-3 custom-scrollbar">
        {providerStats && providerStats.map((provider, index) => (
          <div 
            key={index} 
            className="!flex !items-center !justify-between !p-3 !bg-zinc-950 !rounded-xl !border !border-zinc-900"
          >
            {/* Bên trái: Tên đối tác API + Số lượt gọi key */}
            <div className="!flex !items-center !gap-3">
              <span className="!text-sm !font-semibold !text-zinc-200">
                {provider.provider_name || provider.provider}
              </span>
              <span className="!text-[10px] !font-bold !bg-zinc-800 !text-amber-400 !px-2 !py-0.5 !rounded-md">
                {provider.total_calls} lượt gọi
              </span>
            </div>

            {/* Bên phải: Tổng số tiền nảy số đã làm tròn 2 chữ số thập phân */}
            <span className="!text-sm !font-black !text-red-400">
              ${Number(provider.total_spend || provider.cost || 0).toFixed(2)}
            </span>
          </div>
        ))}

        {(!providerStats || providerStats.length === 0) && (
          <p className="!text-xs !text-center !text-zinc-500 !py-8">Chưa phát sinh chi phí API trong tháng.</p>
        )}
      </div>
      
      {/* Đường link dẫn xuống trang logs chi tiết hệ thống */}
      <div className="!mt-4 !pt-3 !border-t !border-zinc-850 !text-right">
        <a href="/admin/logs" className="!text-xs !font-bold !text-amber-500 hover:!text-amber-400 !transition-all">
          Xem chi tiết lịch sử logs →
        </a>
      </div>
    </div>
  );
};

export default ApiCostCard;
