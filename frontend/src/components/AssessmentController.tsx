import React from 'react';
import { Select, Button, Upload } from 'antd';
import { SlidersOutlined, PlayCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { AnalysisResult, ScreenState } from '../types';

interface AssessmentControllerProps {
  activeMode: string;
  setActiveMode: (mode: string) => void;
  screenState: ScreenState;
  setScreenState: (state: ScreenState) => void;
  setAnalysisResult: (res: AnalysisResult | null) => void;
  handleVideoUpload: (info: any) => void;
  uploading: boolean;
}

export const AssessmentController: React.FC<AssessmentControllerProps> = ({
  activeMode,
  setActiveMode,
  screenState,
  setScreenState,
  setAnalysisResult,
  handleVideoUpload,
  uploading,
}) => {
  return (
    <div className="mt-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 space-y-4">
      <h4 className="text-sm font-semibold flex items-center gap-2 m-0 text-slate-300">
        <SlidersOutlined className="text-emerald-500" /> Assessment Workflow Controller
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Select Assessment</label>
          <Select 
            className="w-full"
            value={activeMode} 
            onChange={(value) => {
              setActiveMode(value);
              setScreenState('IDLE');
              setAnalysisResult(null);
            }}
            disabled={screenState === 'SCREENING' || screenState === 'PREPARATION' || screenState === 'COUNTDOWN'}
            options={[
              { value: 'full', label: 'Comprehensive Scan' },
              { value: 'posture', label: 'Posture Analysis' },
              { value: 'tremor', label: 'Tremor Assessment' },
              { value: 'gait', label: 'Gait Analysis' },
              { value: 'exercise', label: 'Physical Therapy Exercises' }
            ]}
          />
        </div>

        <div className="flex flex-col gap-2">
          {screenState === 'IDLE' && (
            <Button 
              type="primary" 
              icon={<PlayCircleOutlined />} 
              onClick={() => setScreenState('INSTRUCTION')}
              className="bg-emerald-600 hover:bg-emerald-500 border-0 shadow"
            >
              Start Live Screening
            </Button>
          )}
          {(screenState === 'SCREENING' || screenState === 'PREPARATION' || screenState === 'INSTRUCTION' || screenState === 'COUNTDOWN') && (
            <Button 
              danger 
              onClick={() => {
                setScreenState('IDLE');
                setAnalysisResult(null);
              }}
            >
              Cancel Assessment
            </Button>
          )}
          {screenState === 'FINISHED' && (
            <Button 
              type="primary" 
              onClick={() => {
                setScreenState('IDLE');
                setAnalysisResult(null);
              }}
            >
              New Assessment
            </Button>
          )}
        </div>

        <div>
          <Upload 
            beforeUpload={() => false} 
            onChange={handleVideoUpload}
            showUploadList={false}
            accept="video/*"
            disabled={screenState === 'SCREENING' || screenState === 'PREPARATION' || screenState === 'COUNTDOWN' || uploading}
          >
            <Button icon={<UploadOutlined />} className="w-full">
              Upload Video File
            </Button>
          </Upload>
        </div>
      </div>
    </div>
  );
};
