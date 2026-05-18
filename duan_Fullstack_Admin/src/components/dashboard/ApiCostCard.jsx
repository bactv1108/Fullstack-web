import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/system.service';
import { DollarSign, TrendingUp } from 'lucide-react';

const ApiCostCard = () => {
  const [costs, setCosts] = useState({ total: 0, providers: [] });

  useEffect(() => {
    systemService.getApiCosts().then(setCosts);
  }, []);

  return (
    <div className="admin-card p-6 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="p-3 bg-green-500/10 rounded-lg">
            <DollarSign className="text-green-500" size={24} />
          </div>
          <span className="flex items-center gap-1 text-green-500 text-sm font-medium bg-green-500/10 px-2 py-1 rounded">
            <TrendingUp size={14} /> +12%
          </span>
        </div>
        <h3 className="text-admin-text-muted text-sm font-medium">Tổng Chi Phí API (Tháng)</h3>
        <p className="text-3xl font-bold text-white mt-1">${costs.total.toFixed(2)}</p>
      </div>

      <div className="mt-6 space-y-3">
        {costs.providers.map(provider => (
          <div key={provider.name} className="flex justify-between items-center text-sm">
            <span className="text-admin-text-muted">{provider.name}</span>
            <span className="font-medium">${provider.cost.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ApiCostCard;
