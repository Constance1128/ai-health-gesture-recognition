import React from 'react';
import { Form, Input, Button, Typography } from 'antd';
import { MailOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ForgotPasswordViewProps {
  handleForgotPassword: (values: any) => any;
  setAuthView: (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ handleForgotPassword, setAuthView }) => {
  return (
    <Form
      name="forgot-password"
      layout="vertical"
      onFinish={handleForgotPassword}
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

      <Form.Item className="mb-2">
        <Button type="primary" htmlType="submit" block size="large" className="bg-emerald-600 hover:bg-emerald-500 border-0">
          Reset Password
        </Button>
      </Form.Item>

      <div className="text-center mt-4">
        <Text className="text-xs text-slate-500">
          Back to{' '}
          <a onClick={() => setAuthView('login')} className="text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer">
            Log In
          </a>
        </Text>
      </div>
    </Form>
  );
};
