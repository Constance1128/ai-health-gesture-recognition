import { useState, useEffect } from 'react';
import { message } from 'antd';
import { User } from '../types';
import * as authApi from '../api/auth.api';

export function useAuth(onLogoutCallback?: () => void) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register'>('login');
  const [resetToken, setResetToken] = useState<string>('');
  const [resetEmail, setResetEmail] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const email = params.get('email');
    if (token && email) {
      setResetToken(token);
      setResetEmail(email);
      setAuthView('reset-password');
    }
  }, []);

  const handleLogin = async (values: any) => {
    try {
      const data = await authApi.login(values);
      setCurrentUser(data);
      localStorage.setItem('user', JSON.stringify(data));
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
      setAuthView('login');
      setResetToken('');
      setResetEmail('');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      message.error(err.message || "Failed to reset password.");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('user');
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
