import React, { useState } from 'react';
import { Form, Input, Button, Row, Col, Select, InputNumber, DatePicker, Typography, Upload, Checkbox, message } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, UploadOutlined } from '@ant-design/icons';

const { Text, Paragraph } = Typography;

interface RegisterProfessionalViewProps {
  handleRegisterDoctor: (formData: FormData) => any;
  setAuthView: (view: 'login' | 'register' | 'forgot-password' | 'reset-password' | 'doctor-register') => void;
  isDarkMode: boolean;
}

export const RegisterProfessionalView: React.FC<RegisterProfessionalViewProps> = ({
  handleRegisterDoctor,
  setAuthView,
  isDarkMode,
}) => {
  const [fileList, setFileList] = useState<any[]>([]);
  const [certified, setCertified] = useState<boolean>(false);

  const onDoctorSubmit = (values: any) => {
    if (fileList.length === 0) {
      message.error("Please upload your Medical License or Professional Certificate.");
      return;
    }
    if (!certified) {
      message.error("Please certify that the information and documents provided are authentic and valid.");
      return;
    }

    const birthdayStr = values.birthday ? values.birthday.format('YYYY-MM-DD') : '';

    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("gender", values.gender);
    formData.append("age", values.age.toString());
    formData.append("birthday", birthdayStr);
    formData.append("email", values.email);
    formData.append("password", values.password);
    formData.append("specialization", values.specialization);
    formData.append("medical_license", values.medical_license);
    
    const fileObj = fileList[0].originFileObj || fileList[0];
    formData.append("file", fileObj);

    handleRegisterDoctor(formData);
  };

  return (
    <Form
      name="doctor-register"
      layout="vertical"
      onFinish={onDoctorSubmit}
      requiredMark={false}
    >
      <div className="flex justify-between items-center mb-4">
        <a onClick={() => setAuthView('login')} className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold cursor-pointer">
          &lt; Back to Login
        </a>
      </div>

      <div className="border-b border-emerald-500/20 pb-1 mb-3">
        <Text className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Step 1: Account & Professional Info</Text>
      </div>

      <Form.Item
        name="name"
        label={<span className="text-xs font-semibold">Full Name</span>}
        rules={[{ required: true, message: 'Please enter your name' }]}
      >
        <Input prefix={<UserOutlined className="text-slate-400" />} placeholder="Dr. John Doe" allowClear />
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
        label={<span className="text-xs font-semibold">Official Email</span>}
        rules={[
          { required: true, message: 'Please enter your email' },
          { type: 'email', message: 'Please enter a valid email' }
        ]}
      >
        <Input prefix={<MailOutlined className="text-slate-400" />} placeholder="john@hospital.com" allowClear />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
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
        </Col>
        <Col span={12}>
          <Form.Item
            name="confirmPassword"
            label={<span className="text-xs font-semibold">Confirm Password</span>}
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined className="text-slate-400" />} placeholder="••••••••" allowClear />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="specialization"
            label={<span className="text-xs font-semibold">Specialization</span>}
            rules={[{ required: true, message: 'Select Specialty' }]}
          >
            <Select placeholder="Select Specialty">
              <Select.Option value="Cardiologist">Cardiologist</Select.Option>
              <Select.Option value="Neurologist">Neurologist</Select.Option>
              <Select.Option value="Orthopedic">Orthopedic Surgeon</Select.Option>
              <Select.Option value="Clinician">Clinician</Select.Option>
              <Select.Option value="General Practitioner">General Practitioner</Select.Option>
              <Select.Option value="Physiotherapist">Physiotherapist</Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="medical_license"
            label={<span className="text-xs font-semibold">Medical License</span>}
            rules={[{ required: true, message: 'Enter license number' }]}
          >
            <Input placeholder="LIC-12345" allowClear />
          </Form.Item>
        </Col>
      </Row>

      <div className="border-b border-emerald-500/20 pb-1 mb-3 mt-4">
        <Text className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Step 2: Credential Verification</Text>
      </div>

      <Paragraph className="text-slate-400 text-[11px] mb-2 leading-relaxed">
        Please upload a digital copy of your Medical License or Professional Certificate for account verification.
      </Paragraph>

      <Form.Item required className="mb-2">
        <Upload
          maxCount={1}
          beforeUpload={() => false}
          fileList={fileList}
          onChange={({ fileList }) => setFileList(fileList)}
          accept=".jpg,.jpeg,.png"
        >
          <Button block icon={<UploadOutlined />} className={`flex items-center justify-center border-dashed ${isDarkMode ? 'border-slate-700 bg-slate-950/40 text-slate-300' : 'border-slate-300 bg-slate-50 text-slate-600'} py-6 h-auto`}>
            Upload Certificate (JPG, JPEG, PNG - Max 5MB)
          </Button>
        </Upload>
      </Form.Item>

      <Form.Item className="mb-3">
        <Checkbox 
          checked={certified} 
          onChange={(e) => setCertified(e.target.checked)}
          className="text-slate-400 text-[11px]"
        >
          I certify that the information and documents provided are authentic and valid.
        </Checkbox>
      </Form.Item>

      <Form.Item className="mb-2">
        <Button type="primary" htmlType="submit" block size="large" className="bg-emerald-600 hover:bg-emerald-500 border-0">
          Submit For Verification
        </Button>
      </Form.Item>
    </Form>
  );
};
