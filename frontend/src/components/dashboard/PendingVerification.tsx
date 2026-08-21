import React from 'react';
import { Card, Button, Typography, Result } from 'antd';
import { ClockCircleOutlined, LogoutOutlined } from '@ant-design/icons';
import { User } from '../../types';

const { Title, Paragraph } = Typography;

interface PendingVerificationProps {
  currentUser: User;
  handleLogout: () => void;
  isDarkMode: boolean;
}

export const PendingVerification: React.FC<PendingVerificationProps> = ({
  currentUser,
  handleLogout,
  isDarkMode,
}) => {
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Card 
        className={`w-full max-w-lg shadow-2xl border-0 text-center ${isDarkMode ? 'bg-slate-900/80 border border-slate-800/50' : 'bg-white/90 border border-slate-200/50'} backdrop-blur-md`}
      >
        <Result
          icon={<ClockCircleOutlined className="text-5xl text-amber-500 animate-pulse" />}
          title={
            <Title level={3} className={isDarkMode ? 'text-slate-100' : 'text-slate-800'}>
              Verification Pending
            </Title>
          }
          subTitle={
            <div className="space-y-3 mt-2">
              <Paragraph className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Hello <strong>{currentUser.name}</strong>, your professional account registration is currently under review by our administrative team.
              </Paragraph>
              <Paragraph className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Specialty: <span className="font-semibold">{currentUser.specialization}</span> | License: <span className="font-semibold">{currentUser.medical_license}</span>
              </Paragraph>
              <Paragraph className={`text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                You will be granted access to patient movement diagnostics once your medical license is verified. Please check back later.
              </Paragraph>
            </div>
          }
          extra={[
            <Button 
              key="logout" 
              type="primary" 
              danger 
              icon={<LogoutOutlined />} 
              onClick={handleLogout}
              size="large"
              className="px-8"
            >
              Log Out
            </Button>
          ]}
        />
      </Card>
    </div>
  );
};
