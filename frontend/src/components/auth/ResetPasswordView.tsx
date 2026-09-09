import React from 'react';
import { Form, Input, Button, Typography } from 'antd';
import { LockOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface ResetPasswordViewProps {
  handleResetPassword: (values: any) => any;
  setAuthView: (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ handleResetPassword, setAuthView }) => {
  return (
    <Form
      name="reset-password"
      layout="vertical"
      onFinish={handleResetPassword}
      requiredMark={false}
    >
      <Form.Item
        name="password"
        label={<span className="text-xs font-semibold">New Password</span>}
        rules={[
          { required: true, message: 'Please enter your new password' },
          { min: 6, message: 'Password must be at least 6 characters' }
        ]}
      >
        <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" allowClear />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label={<span className="text-xs font-semibold">Confirm New Password</span>}
        dependencies={['password']}
        rules={[
          { required: true, message: 'Please confirm your new password' },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) {
                return Promise.resolve();
              }
              return Promise.reject(new Error('The two passwords do not match!'));
            },
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" allowClear />
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
