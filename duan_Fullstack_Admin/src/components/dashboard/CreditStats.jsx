import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/system.service';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2 } from 'lucide-react';

const CreditStats = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    systemService.getCreditStats().then(setData);
  }, []);

  return (
    <div className="admin-card p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart2 size={20} className="text-admin-primary" />
          Thống Kê Tín Dụng
        </h2>
      </div>

      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorUsed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPurchased" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#181b21', borderColor: '#334155', color: '#e2e8f0' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Area type="monotone" dataKey="creditsUsed" name="Đã Dùng" stroke="#ef4444" fillOpacity={1} fill="url(#colorUsed)" />
            <Area type="monotone" dataKey="creditsPurchased" name="Đã Mua" stroke="#10b981" fillOpacity={1} fill="url(#colorPurchased)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CreditStats;
