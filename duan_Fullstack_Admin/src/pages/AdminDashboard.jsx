import React from 'react';
import QueueStatus from '../components/dashboard/QueueStatus';
import ApiCostCard from '../components/dashboard/ApiCostCard';
import CreditStats from '../components/dashboard/CreditStats';
import PlanConfig from '../components/billing/PlanConfig';
import BillingView from '../components/billing/BillingView';
import ApiKeysForm from '../components/api-resources/ApiKeysForm';
import AssetManager from '../components/api-resources/AssetManager';
import BlacklistWord from '../components/moderation/BlacklistWord';
import VideoModerator from '../components/moderation/VideoModerator';
import UserTable from '../components/users/UserTable';
import ImageAnalysesTable from '../components/image-analyses/ImageAnalysesTable';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const weeklyMockData = [
  { name: 'Thứ 2', spend: 0.04, tasks: 2 },
  { name: 'Thứ 3', spend: 0.08, tasks: 4 },
  { name: 'Thứ 4', spend: 0.02, tasks: 1 },
  { name: 'Thứ 5', spend: 0.12, tasks: 6 },
  { name: 'Thứ 6', spend: 0.06, tasks: 3 },
  { name: 'Thứ 7', spend: 0.15, tasks: 7 },
  { name: 'Chủ Nhật', spend: 0.02, tasks: 1 },
];

const AdminDashboard = ({ tab }) => {
  
  // Render Tab Content based on the route
  const renderContent = () => {
    switch(tab) {
      case 'billing':
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-6">Quản Lý Gói Cước & Tín Dụng</h1>
            <PlanConfig />
            <BillingView />
          </div>
        );
      case 'api':
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-6">Tài Nguyên Hệ Thống & API</h1>
            <ApiKeysForm />
            <AssetManager />
          </div>
        );
      case 'moderation':
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-6">Kiểm Duyệt Nội Dung</h1>
            <BlacklistWord />
            <VideoModerator />
          </div>
        );
      case 'users':
        return (
          <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-2 flex-shrink-0">Quản Lý Người Dùng</h1>
            <UserTable />
          </div>
        );
      case 'image-analyses':
        return (
          <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-2 flex-shrink-0">Quản Lý Lịch Sử Mắt Thần</h1>
            <ImageAnalysesTable />
          </div>
        );
      default:
        // Default Dashboard View
        return (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-admin-text mb-6">Tổng Quan Hệ Thống</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <CreditStats />
              </div>
              <div className="lg:col-span-1">
                <ApiCostCard />
              </div>
            </div>
            <div className="mb-6 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-400 mb-4">Thống Kê Chi Phí Theo Tuần (Từng Ngày)</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyMockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="spend" name="Chi phí ($)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorSpend)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="h-96">
              <QueueStatus />
            </div>
          </div>
        );
    }
  };

  return (
    <>
      {renderContent()}
    </>
  );
};

export default AdminDashboard;
