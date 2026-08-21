import React from 'react';
import { Card, Space, Tag } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import { DBHistoryRecord } from '../types';

const BACKEND_URL = 'http://localhost:8000';

interface HistoryLogsProps {
  backendConnected: boolean;
  dbHistory: DBHistoryRecord[];
  isDarkMode: boolean;
}

export const HistoryLogs: React.FC<HistoryLogsProps> = ({
  backendConnected,
  dbHistory,
  isDarkMode,
}) => {
  return (
    <Card 
      title={
        <Space>
          <DatabaseOutlined className="text-emerald-500" />
          <span>Persistent Database History (SQLite)</span>
        </Space>
      }
      className={`shadow-lg border-0 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'}`}
    >
      <div className="h-40 overflow-y-auto font-mono text-xs space-y-3 pr-2">
        {!backendConnected ? (
          <div className="text-slate-500 text-center py-12">
            Backend disconnected. Running in simulated offline mode.
          </div>
        ) : dbHistory.length === 0 ? (
          <div className="text-slate-500 text-center py-12">No database records found yet.</div>
        ) : (
          dbHistory.map((record) => {
            const timeStr = new Date(record.timestamp * 1000).toLocaleTimeString();
            const isSuccess = record.status.includes('Good') || record.status.includes('Excellent') || record.status.includes('No Tremor') || record.status.includes('Perfect');
            return (
              <div key={record.id} className="border-b border-slate-800/40 pb-2.5 last:border-b-0">
                <div className="flex justify-between items-center mb-1">
                  <Space size="small">
                    <Tag color="purple" className="m-0 border-0 text-[10px] px-1 py-0 leading-none">ID: {record.id}</Tag>
                    <Tag color="blue" className="m-0 border-0 text-[10px] px-1 py-0 leading-none uppercase">{record.mode}</Tag>
                    <span className="text-[10px] text-slate-500">{timeStr}</span>
                  </Space>
                  <Tag color={isSuccess ? 'success' : 'warning'} className="m-0 border-0 text-[10px] px-1 py-0 leading-none font-semibold">
                    {record.status}
                  </Tag>
                </div>
                <div className="text-[10px] text-slate-400 pl-1.5 flex gap-3 justify-between">
                  <div className="flex gap-3">
                    <span>{record.metric_1.name}: <strong>{record.metric_1.value}</strong></span>
                    <span>|</span>
                    <span>{record.metric_2.name}: <strong>{record.metric_2.value}</strong></span>
                  </div>
                  {record.video_path && (
                    <a href={`${BACKEND_URL}/${record.video_path}`} target="_blank" rel="noreferrer">
                      <Tag color="cyan" className="m-0 border-0 scale-90 cursor-pointer hover:opacity-85">
                        PLAY VIDEO
                      </Tag>
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
