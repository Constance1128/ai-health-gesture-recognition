import React from 'react';
import { Card, Space, Button, Typography } from 'antd';
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';

import { InstructionGuideProps } from '../types';

const { Paragraph } = Typography;

export const InstructionGuide: React.FC<InstructionGuideProps> = ({
  activeMode,
  setScreenState,
  isDarkMode,
}) => {
  return (
    <Card 
      title={
        <Space>
          <InfoCircleOutlined className="text-emerald-500" />
          <span>Clinical Instruction Guide</span>
        </Space>
      }
      className={`shadow-lg border-0 ${isDarkMode ? 'bg-slate-900/50' : 'bg-white'}`}
    >
      <div className="space-y-4">
        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 text-center">
          {activeMode === 'posture' && (
            <>
              <div className="text-3xl mb-2">🧘‍♂️</div>
              <h3 className="text-base font-bold mb-1">Spinal Posture Screening</h3>
              <Paragraph className="text-xs text-slate-400 m-0">
                Position yourself sitting or standing straight. Keep your chest up. When the timer starts, slowly tilt your head forward, hold, and return to an upright position.
              </Paragraph>
            </>
          )}
          {activeMode === 'tremor' && (
            <>
              <div className="text-3xl mb-2">✋</div>
              <h3 className="text-base font-bold mb-1">Parkinson's Tremor Quantification</h3>
              <Paragraph className="text-xs text-slate-400 m-0">
                Extend your right hand flat, palm facing downward, directly in front of the camera. Hold it as still as possible during the 2-minute screening window.
              </Paragraph>
            </>
          )}
          {activeMode === 'exercise' && (
            <>
              <div className="text-3xl mb-2">💪</div>
              <h3 className="text-base font-bold mb-1">Kinesiological Exercise Tracking</h3>
              <Paragraph className="text-xs text-slate-400 m-0">
                Stand back 1.5 - 2 meters so your full upper body is visible. Perform bicep curls at a steady, controlled rate (approx. 3-4 seconds per repetition).
              </Paragraph>
            </>
          )}
        </div>

        <div className="p-3 rounded bg-amber-500/5 border border-amber-500/10 flex gap-2">
          <WarningOutlined className="text-amber-500 mt-1" />
          <div>
            <div className="text-xs font-semibold">Preparation Requirements</div>
            <p className="text-xs text-slate-400 m-0">Ensure your room is well-lit and your body is fully aligned with the camera guide box.</p>
          </div>
        </div>

        <Button 
          type="primary" 
          block 
          size="large"
          onClick={() => setScreenState('PREPARATION')}
          className="bg-emerald-600 hover:bg-emerald-500 border-0"
        >
          I'm Ready, Start Alignment (5s Prep)
        </Button>
      </div>
    </Card>
  );
};
