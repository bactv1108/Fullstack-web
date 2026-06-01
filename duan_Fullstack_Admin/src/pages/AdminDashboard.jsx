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

const AdminDashboard = ({ tab }) => {
  
  // Render Tab Content based on the route
  const renderContent = () => {
    switch(tab) {
      case 'billing':
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-admin-text mb-6">Quản Lý Gói Cước & Tín Dụng</h1>
            <PlanConfig />
            <BillingView />
          </div>
        );
      case 'api':
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-admin-text mb-6">Tài Nguyên Hệ Thống & API</h1>
            <ApiKeysForm />
            <AssetManager />
          </div>
        );
      case 'moderation':
        return (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-admin-text mb-6">Kiểm Duyệt Nội Dung</h1>
            <BlacklistWord />
            <VideoModerator />
          </div>
        );
      case 'users':
        return (
          <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
            <h1 className="text-2xl font-bold text-admin-text mb-2 flex-shrink-0">Quản Lý Người Dùng</h1>
            <UserTable />
          </div>
        );
      case 'image-analyses':
        return (
          <div className="space-y-6 animate-fade-in h-[calc(100vh-8rem)] flex flex-col">
            <h1 className="text-2xl font-bold text-admin-text mb-2 flex-shrink-0">Quản Lý Lịch Sử Mắt Thần</h1>
            <ImageAnalysesTable />
          </div>
        );
      default:
        // Default Dashboard View
        return (
          <div className="animate-fade-in">
            <h1 className="text-2xl font-bold text-admin-text mb-6">Tổng Quan Hệ Thống</h1>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <CreditStats />
              </div>
              <div className="lg:col-span-1">
                <ApiCostCard />
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
