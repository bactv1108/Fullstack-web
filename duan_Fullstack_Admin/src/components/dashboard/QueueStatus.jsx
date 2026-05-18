import React, { useEffect, useState } from 'react';
import { systemService } from '../../services/system.service';
import { Activity, Clock, AlertCircle } from 'lucide-react';

const QueueStatus = () => {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    systemService.getQueueStatus().then(setQueue);
  }, []);

  return (
    <div className="admin-card p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity size={20} className="text-admin-primary" />
          Hàng Đợi Render
        </h2>
        <span className="bg-admin-primary/10 text-admin-primary px-3 py-1 rounded-full text-sm font-medium">
          {queue.length} Tasks
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {queue.map(task => (
          <div key={task.id} className="bg-admin-bg border border-admin-border rounded-lg p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-medium text-admin-text">{task.video}</h3>
                <p className="text-xs text-admin-text-muted mt-1">ID: #{task.id}</p>
              </div>
              {task.status === 'Rendering' && <span className="text-blue-400 text-xs flex items-center gap-1"><Activity size={14}/> Rendering</span>}
              {task.status === 'Pending' && <span className="text-yellow-500 text-xs flex items-center gap-1"><Clock size={14}/> Pending</span>}
              {task.status === 'Failed' && <span className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={14}/> Failed</span>}
            </div>
            
            {task.status === 'Rendering' && (
              <div className="w-full bg-admin-border rounded-full h-2">
                <div 
                  className="bg-admin-primary h-2 rounded-full transition-all duration-500" 
                  style={{ width: `${task.progress}%` }}
                ></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueueStatus;
