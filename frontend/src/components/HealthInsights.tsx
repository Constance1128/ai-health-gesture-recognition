import React from 'react';
import { Card, Space, Tag, Progress } from 'antd';
import { DashboardOutlined, SyncOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { AnalysisResult } from '../types';

interface HealthInsightsProps {
  analysisResult: AnalysisResult | null;
  isDarkMode: boolean;
}

export const HealthInsights: React.FC<HealthInsightsProps> = ({
  analysisResult,
  isDarkMode,
}) => {
  return (
    <Card 
      title={
        <Space>
          <DashboardOutlined className="text-emerald-500" />
          <span>Real-Time Health Insights</span>
        </Space>
      }
      className={`shadow-lg border-0 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'}`}
    >
      {!analysisResult ? (
        <div className="py-12 text-center text-slate-400">
          <SyncOutlined spin className="text-3xl text-emerald-500 mb-3" />
          <p>Awaiting screening coordinates data...</p>
          <p className="text-xs text-slate-500 mt-1">Start a live screening or upload a video file above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          
          <div className="flex justify-between items-center">
            <span className="font-semibold text-base">Diagnostic Assessment</span>
            <Tag color={
              analysisResult.status.includes('Good') || analysisResult.status.includes('Excellent') || analysisResult.status.includes('No Tremor') || analysisResult.status.includes('Perfect')
                ? 'success' : 'warning'
            } className="font-semibold px-3 py-0.5 border-0 rounded text-xs uppercase">
              {analysisResult.status}
            </Tag>
          </div>

          <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10 space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>Overall Assessment Score</span>
                <span className="font-semibold">{analysisResult.score}/100</span>
              </div>
              <Progress 
                percent={analysisResult.score} 
                showInfo={false}
                strokeColor={analysisResult.score > 75 ? '#10b981' : (analysisResult.score > 50 ? '#f59e0b' : '#ef4444')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              {Object.entries(analysisResult.metrics).map(([name, val]) => (
                <div key={name} className="p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 text-center">
                  <div className="text-xl font-bold text-emerald-500">{val}</div>
                  <div className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">{name.replace('_', ' ')}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 rounded bg-slate-800/40 border border-slate-700/30 flex gap-2">
            <CheckCircleOutlined className="text-emerald-500 mt-1" />
            <div>
              <div className="text-xs font-semibold text-slate-300">AI Clinical Recommendation</div>
              <p className="text-xs text-slate-400 m-0">{analysisResult.recommendation}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
