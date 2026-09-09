import { useState, useEffect } from 'react';
import { message } from 'antd';
import { User } from '../types';
import * as authApi from '../api/auth.api';

export function useAuth(onLogoutCallback?: () => void) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [resetToken, setResetToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || '';
  });
  const [resetEmail, setResetEmail] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('email') || '';
  });

  const [authView, setAuthViewState] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register'>(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    if (token && email) {
      return 'reset-password';
    }
    const saved = sessionStorage.getItem('auth_view');
    if (saved && saved !== 'reset-password') {
      return saved as any;
    }
    return 'login';
  });

  const setAuthView = (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => {
    if (view === 'login') {
      sessionStorage.removeItem('auth_view');
      // Clean query params from URL if any remain
      if (window.location.search) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } else {
      sessionStorage.setItem('auth_view', view);
    }
    setAuthViewState(view);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    if (token && email) {
      setResetToken(token);
      setResetEmail(email);
      setAuthViewState('reset-password');
      // Clean query parameters from URL so subsequent refreshes don't re-lock to reset-password
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogin = async (values: any) => {
    try {
      const data = await authApi.login(values);
      setCurrentUser(data);
      localStorage.setItem('user', JSON.stringify(data));
      sessionStorage.removeItem('auth_view');
      message.success('Login successful!');
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      message.error(error.message || 'Login failed. Please check your credentials.');
      return false;
    }
  };

  const handleRegister = async (values: any) => {
    try {
      const data = await authApi.registerPatient(values);
      message.success(data.message || 'Registration successful! You can now log in.');
      return true;
    } catch (error: any) {
      console.error('Registration error:', error);
      message.error(error.message || 'Registration failed. Please try again.');
      return false;
    }
  };

  const handleRegisterDoctor = async (formData: FormData) => {
    try {
      const data = await authApi.registerProfessional(formData);
      message.success(data.message || 'Registration submitted! Please wait for admin verification.');

      // Automatically log in the registered doctor to redirect them to the PendingVerification screen
      const email = formData.get('email') as string;
      const password = formData.get('password') as string;
      if (email && password) {
        const loginData = await authApi.login({ email, password });
        setCurrentUser(loginData);
        localStorage.setItem('user', JSON.stringify(loginData));
        sessionStorage.removeItem('auth_view');
      }
      return true;
    } catch (error: any) {
      console.error('Registration error:', error);
      message.error(error.message || 'Registration failed. Please try again.');
      return false;
    }
  };

  const handleForgotPassword = async (values: any) => {
    try {
      const data = await authApi.forgotPassword({ email: values.email });
      message.success("Simulated email sent! Redirecting to your reset link...");
      setTimeout(() => {
        window.location.href = data.simulated_link;
      }, 1500);
    } catch (err: any) {
      message.error(err.message || "Failed to initiate password reset.");
    }
  };

  const handleResetPassword = async (values: any) => {
    try {
      await authApi.resetPassword({
        email: resetEmail,
        token: resetToken,
        password: values.password
      });
      message.success("Your password has been successfully reset! You can now log in.");
      setResetToken('');
      setResetEmail('');
      setAuthView('login');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      message.error(err.message || "Failed to reset password.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('user');
    sessionStorage.removeItem('auth_view');
    sessionStorage.removeItem('patient_dashboard_tab');
    sessionStorage.removeItem('doctor_dashboard_nav');
    sessionStorage.removeItem('admin_dashboard_nav');
    sessionStorage.removeItem('dashboard_activeMode');
    setAuthViewState('login');
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    if (onLogoutCallback) {
      onLogoutCallback();
    }
    message.success("Logged out successfully.");
  };

  const handleChangePassword = async (values: any) => {
    if (!currentUser) return false;
    try {
      await authApi.changePassword({
        email: currentUser.email,
        old_password: values.oldPassword,
        new_password: values.newPassword
      });
      message.success("Password changed successfully!");
      return true;
    } catch (err: any) {
      message.error(err.message || "Failed to change password.");
      return false;
    }
  };

  return {
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
  };
}
