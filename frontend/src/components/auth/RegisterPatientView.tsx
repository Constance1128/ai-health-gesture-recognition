import React from 'react';
import { Form, Input, Button, Row, Col, Select, InputNumber, DatePicker, Typography } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface RegisterPatientViewProps {
  handleRegister: (values: any) => any;
  setAuthView: (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => void;
}

export const RegisterPatientView: React.FC<RegisterPatientViewProps> = ({ handleRegister, setAuthView }) => {
  return (
    <Form
      name="register"
      layout="vertical"
      onFinish={handleRegister}
      requiredMark={false}
    >
      <Form.Item
        name="name"
        label={<span className="text-xs font-semibold">Full Name</span>}
        rules={[{ required: true, message: 'Please enter your name' }]}
      >
        <Input prefix={<UserOutlined className="text-slate-400" />} placeholder="John Doe" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="gender"
            label={<span className="text-xs font-semibold">Gender</span>}
            rules={[{ required: true, message: 'Select gender' }]}
          >
            <Select placeholder="Select">
              <Select.Option value="Male">Male</Select.Option>
              <Select.Option value="Female">Female</Select.Option>
              <Select.Option value="Other">Other</Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="age"
            label={<span className="text-xs font-semibold">Age</span>}
            rules={[{ required: true, message: 'Enter age' }]}
          >
            <InputNumber min={1} max={120} className="w-full" placeholder="Age" />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="birthday"
        label={<span className="text-xs font-semibold">Birthday</span>}
        rules={[{ required: true, message: 'Please select your birthday' }]}
      >
        <DatePicker className="w-full" format="YYYY-MM-DD" placeholder="YYYY-MM-DD" />
      </Form.Item>

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
        rules={[
          { required: true, message: 'Please enter a password' },
          { min: 6, message: 'Password must be at least 6 characters' }
        ]}
      >
        <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" allowClear />
      </Form.Item>

      <Form.Item
        name="confirmPassword"
        label={<span className="text-xs font-semibold">Confirm Password</span>}
        dependencies={['password']}
        rules={[
          { required: true, message: 'Please confirm your password' },
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
          Register Account
        </Button>
      </Form.Item>

      <div className="text-center mt-4">
        <Text className="text-xs text-slate-500">
          Already have an account?{' '}
          <a onClick={() => setAuthView('login')} className="text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer">
            Log In
          </a>
        </Text>
      </div>

      <div className="text-center mt-3 pt-3 border-t border-slate-800/20">
        <a onClick={() => setAuthView('doctor-register')} className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer">
          Are you a Doctor? [ SWITCH TO PROFESSIONAL REGISTRATION ]
        </a>
      </div>
    </Form>
  );
};
