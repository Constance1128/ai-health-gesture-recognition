import React from 'react';
import { Card, Progress } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { ActiveScreeningHUDProps } from '../types';

export const ActiveScreeningHUD: React.FC<ActiveScreeningHUDProps> = ({
  screenState,
  prepSeconds,
  countdownSeconds,
  screeningSeconds,
  isDarkMode,
}) => {
  return (
    <Card 
      title="Active Screening In Progress"
      className={`shadow-lg border-0 text-center py-6 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'}`}
    >
      <div className="space-y-4">
        <SyncOutlined spin className="text-4xl text-emerald-500 mb-2" />
        
        {screenState === 'PREPARATION' && (
          <div>
            <h3 className="text-base font-bold">Step 1: Alignment Preparation</h3>
            <p className="text-xs text-slate-400">Position your body inside the dashed guide box. Starting in {prepSeconds}s...</p>
          </div>
        )}
        
        {screenState === 'COUNTDOWN' && (
          <div>
            <h3 className="text-base font-bold">Step 2: Commencing Assessment</h3>
            <p className="text-xs text-slate-400">Hold position! Initializing in {countdownSeconds}s...</p>
          </div>
        )}

        {screenState === 'SCREENING' && (
          <div>
            <h3 className="text-base font-bold">Step 3: Active Video Screening</h3>
            <p className="text-xs text-slate-400">Keep moving according to the instructions. Analyzing skeletal coordinates...</p>
            <div className="max-w-xs mx-auto mt-4">
              <Progress 
                percent={Math.round(((60 - screeningSeconds) / 60) * 100)} 
                status="active"
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
