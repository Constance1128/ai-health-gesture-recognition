import React from 'react';
import { Card, Typography, ConfigProvider, theme } from 'antd';
import { HeartOutlined } from '@ant-design/icons';

// Import Modular Authentication Views
import { LoginView } from './auth/LoginView';
import { RegisterPatientView } from './auth/RegisterPatientView';
import { RegisterProfessionalView } from './auth/RegisterProfessionalView';
import { ForgotPasswordView } from './auth/ForgotPasswordView';
import { ResetPasswordView } from './auth/ResetPasswordView';

const { Title, Paragraph } = Typography;

interface AuthCardProps {
  authView: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register';
  setAuthView: (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => void;
  handleLogin: (values: any) => Promise<boolean>;
  handleRegister: (values: any) => Promise<boolean>;
  handleRegisterDoctor: (formData: FormData) => Promise<boolean>;
  handleForgotPassword: (values: any) => Promise<boolean | void>;
  handleResetPassword: (values: any) => Promise<boolean | void>;
  resetEmail: string;
  isDarkMode: boolean;
}

export const AuthCard: React.FC<AuthCardProps> = ({
  authView,
  setAuthView,
  handleLogin,
  handleRegister,
  handleRegisterDoctor,
  handleForgotPassword,
  handleResetPassword,
  resetEmail,
  isDarkMode,
}) => {
  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#10b981',
          borderRadius: 8,
        },
      }}
    >
      <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <Card 
          className={`w-full max-w-md shadow-2xl border-0 z-10 ${isDarkMode ? 'bg-slate-900/85 border border-slate-800/60' : 'bg-white/90 border border-slate-200/60'} backdrop-blur-md`}
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-0 rounded-2xl mb-3">
              <img src="/logo.png" alt="HealthMove AI Logo" className="h-16 w-16 object-contain rounded-2xl" />
            </div>
            <Title level={3} className="m-0 tracking-tight">
              {authView === 'login' && "Welcome to AI Health Guard"}
              {authView === 'register' && "Create your Account"}
              {authView === 'forgot-password' && "Reset your Password"}
              {authView === 'reset-password' && "Set New Password"}
              {authView === 'doctor-register' && "Healthcare Professional Registration (e.g. Doctor)"}
            </Title>
            <Paragraph className="text-slate-400 text-xs mt-1">
              {authView === 'login' && "Log in to access live screening & diagnostic history"}
              {authView === 'register' && "Register to start your clinical movement assessments"}
              {authView === 'forgot-password' && "Enter your email to receive a password reset link"}
              {authView === 'reset-password' && `Setting a new password for ${resetEmail}`}
              {authView === 'doctor-register' && "Register for a clinical account to monitor patient metrics"}
            </Paragraph>
          </div>

          {authView === 'login' && (
            <LoginView handleLogin={handleLogin} setAuthView={setAuthView} />
          )}

          {authView === 'register' && (
            <RegisterPatientView handleRegister={handleRegister} setAuthView={setAuthView} />
          )}

          {authView === 'doctor-register' && (
            <RegisterProfessionalView 
              handleRegisterDoctor={handleRegisterDoctor} 
              setAuthView={setAuthView} 
              isDarkMode={isDarkMode} 
            />
          )}

          {authView === 'forgot-password' && (
            <ForgotPasswordView handleForgotPassword={handleForgotPassword} setAuthView={setAuthView} />
          )}

          {authView === 'reset-password' && (
            <ResetPasswordView handleResetPassword={handleResetPassword} setAuthView={setAuthView} />
          )}
        </Card>
      </div>
    </ConfigProvider>
  );
};
