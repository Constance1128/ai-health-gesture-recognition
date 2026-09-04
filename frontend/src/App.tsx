import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { AuthCard } from './components/AuthCard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { DoctorDashboard } from './components/dashboard/DoctorDashboard';
import { PendingVerification } from './components/dashboard/PendingVerification';
import { PatientDashboard } from './components/dashboard/PatientDashboard';
import { NotificationProvider } from './contexts/NotificationContext';

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Authentication State & Handlers
  const {
    currentUser,
    authView,
    setAuthView,
    resetEmail,
    handleLogin,
    handleRegister,
    handleRegisterDoctor,
    handleForgotPassword,
    handleResetPassword,
    handleChangePassword,
    handleLogout
  } = useAuth();

  if (!currentUser) {
    return (
      <AuthCard
        authView={authView}
        setAuthView={setAuthView}
        handleLogin={handleLogin}
        handleRegister={handleRegister}
        handleRegisterDoctor={handleRegisterDoctor}
        handleForgotPassword={handleForgotPassword}
        handleResetPassword={handleResetPassword}
        resetEmail={resetEmail}
        isDarkMode={isDarkMode}
      />
    );
  }

  if (currentUser.role === 'admin') {
    return (
      <NotificationProvider userId={currentUser.id}>
        <AdminDashboard
          currentUser={currentUser}
          handleLogout={handleLogout}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
        />
      </NotificationProvider>
    );
  }

  if (currentUser.role === 'professional') {
    if (currentUser.is_verified !== 1) {
      return (
        <PendingVerification
          currentUser={currentUser}
          handleLogout={handleLogout}
          isDarkMode={isDarkMode}
        />
      );
    }
    return (
      <NotificationProvider userId={currentUser.id}>
        <DoctorDashboard
          currentUser={currentUser}
          handleLogout={handleLogout}
          isDarkMode={isDarkMode}
        />
      </NotificationProvider>
    );
  }

  // Default is PatientDashboard (role is 'general user' or fallback)
  return (
    <NotificationProvider userId={currentUser.id}>
      <PatientDashboard
        currentUser={currentUser}
        handleLogout={handleLogout}
        handleChangePassword={handleChangePassword}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
      />
    </NotificationProvider>
  );
}
