import React from 'react';
import { Form, Input, Button, Typography } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface LoginViewProps {
  handleLogin: (values: any) => any;
  setAuthView: (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ handleLogin, setAuthView }) => {
  return (
    <Form
      name="login"
      layout="vertical"
      onFinish={handleLogin}
      requiredMark={false}
    >
      <Form.Item
        name="email"
        label={<span className="text-xs font-semibold">Email Address</span>}
        rules={[
          { required: true, message: 'Please enter your email' },
          { type: 'email', message: 'Please enter a valid email' }
        ]}
      >
        <Input prefix={<MailOutlined className="text-slate-400" />} placeholder="john@example.com" allowClear />
      </Form.Item>

      <Form.Item
        name="password"
        label={<span className="text-xs font-semibold">Password</span>}
        rules={[{ required: true, message: 'Please enter your password' }]}
        className="mb-2"
      >
        <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" allowClear />
      </Form.Item>

      <div className="flex justify-end mb-4 mt-1">
        <a 
          onClick={() => setAuthView('forgot-password')} 
          className="text-xs text-emerald-500 hover:text-emerald-400 cursor-pointer font-semibold transition-colors"
        >
          Forgot Password?
        </a>
      </div>

      <Form.Item className="mb-2">
        <Button type="primary" htmlType="submit" block size="large" className="bg-emerald-600 hover:bg-emerald-500 border-0">
          Log In
        </Button>
      </Form.Item>

      <div className="text-center mt-4">
        <Text className="text-xs text-slate-500">
          Don't have an account?{' '}
          <a onClick={() => setAuthView('register')} className="text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer">
            Register
          </a>
        </Text>
      </div>
    </Form>
  );
};
