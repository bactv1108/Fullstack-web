import React from 'react';
import useDashboard from './dashboard/useDashboard';
import VideoView from './dashboard/VideoView';
import TtsView from './dashboard/TtsView';
import HistoryView from './dashboard/HistoryView';
import SettingsView from './dashboard/SettingsView';

export default function Dashboard() {
  const dashboardState = useDashboard();
  const { currentMenu } = dashboardState;

  switch (currentMenu) {
    case 'video':
      return <VideoView {...dashboardState} />;
    case 'tts':
      return <TtsView {...dashboardState} />;
    case 'history':
      return <HistoryView {...dashboardState} />;
    case 'settings':
      return <SettingsView {...dashboardState} />;
    default:
      return <VideoView {...dashboardState} />;
  }
}