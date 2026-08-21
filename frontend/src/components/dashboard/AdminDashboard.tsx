import React, { useEffect, useState } from 'react';
import { Layout, Table, Tag, Button, Typography, Space, Card, Tabs, message } from 'antd';
import { CheckCircleOutlined, FileTextOutlined, LogoutOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { User } from '../../types';
import * as adminApi from '../../api/admin.api';

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface AdminDashboardProps {
  currentUser: User;
  handleLogout: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  handleLogout,
  isDarkMode,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAllUsers(currentUser.email);
      setUsers(data);
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleVerifyDoctor = async (doctorId: number, action: 'approve' | 'reject') => {
    try {
      await adminApi.verifyDoctor({
        email: currentUser.email,
        doctor_id: doctorId,
        action: action
      });
      message.success(`Doctor successfully ${action}d`);
      fetchUsers();
    } catch (e: any) {
      console.error(e);
      message.error(e.message || `Failed to ${action} doctor`);
    }
  };

  const filteredUsers = users.filter(u => {
    if (activeTab === 'pending') {
      return u.role === 'professional' && u.is_verified === 0;
    }
    return true;
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: User) => (
        <Space>
          <UserOutlined className="text-slate-400" />
          <span className="font-semibold">{text}</span>
          {record.role === 'admin' && <Tag color="purple">Admin</Tag>}
          {record.role === 'professional' && <Tag color="cyan">Professional</Tag>}
          {(record.role === 'general user' || !record.role) && <Tag color="blue">Patient</Tag>}
        </Space>
      )
    },
    {
      title: 'Email Address',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Specialty / License',
      key: 'specialty',
      render: (_: any, record: User) => {
        if (record.role === 'professional') {
          return (
            <div>
              <Text style={{ display: 'block' }} className="text-xs font-semibold">{record.specialization}</Text>
              <Text style={{ display: 'block' }} className="text-[10px] text-slate-500">License: {record.medical_license}</Text>
            </div>
          );
        }
        return <span className="text-slate-400">-</span>;
      }
    },
    {
      title: 'Document',
      dataIndex: 'verification_document',
      key: 'document',
      render: (text: string, record: User) => {
        if (record.role === 'professional' && text) {
          return (
            <Button 
              type="link" 
              icon={<FileTextOutlined />} 
              href={`http://localhost:8000${text}`} 
              target="_blank" 
              className="p-0 text-emerald-500 hover:text-emerald-400"
            >
              View Certificate
            </Button>
          );
        }
        return <span className="text-slate-400">-</span>;
      }
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: User) => {
        if (record.role === 'professional') {
          return record.is_verified === 1 ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>Verified</Tag>
          ) : (
            <Tag color="warning" className="animate-pulse">Pending Verification</Tag>
          );
        }
        return <Tag color="default">Active</Tag>;
      }
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: User) => {
        if (record.role === 'professional' && record.is_verified === 0) {
          return (
            <Button 
              type="primary" 
              size="small" 
              icon={<SafetyCertificateOutlined />} 
              onClick={() => handleVerifyDoctor(record.id, 'approve')}
              className="bg-emerald-600 hover:bg-emerald-500 border-0"
            >
              Approve & Verify
            </Button>
          );
        }
        return null;
      }
    }
  ];

  return (
    <Layout className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      <Header className={`px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <Space size="middle">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <SafetyCertificateOutlined className="text-xl" />
          </div>
          <div>
            <Title level={4} className={`m-0 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              AI Health Guard - Admin Control Panel
            </Title>
            <Paragraph className="text-[10px] text-slate-400 m-0 leading-none">
              Role: System Administrator
            </Paragraph>
          </div>
        </Space>
        <Button 
          type="text" 
          danger 
          icon={<LogoutOutlined />} 
          onClick={handleLogout}
          className="hover:bg-red-500/10"
        >
          Log Out
        </Button>
      </Header>

      <Content className="p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Title level={3} className="m-0">User & Practitioner Directory</Title>
            <Paragraph className="text-slate-400 m-0">
              Manage system access and verify clinical healthcare professional credentials.
            </Paragraph>
          </div>
          <Button type="primary" onClick={fetchUsers} className="bg-emerald-600 hover:bg-emerald-500 border-0">
            Refresh Directory
          </Button>
        </div>

        <Card className={`border-0 shadow-lg ${isDarkMode ? 'bg-slate-900/80 border border-slate-800/50' : 'bg-white/90'}`}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} className="mb-4">
            <Tabs.TabPane tab="All Users" key="all" />
            <Tabs.TabPane tab={`Pending Verifications (${users.filter(u => u.role === 'professional' && u.is_verified === 0).length})`} key="pending" />
          </Tabs>

          <Table 
            dataSource={filteredUsers} 
            columns={columns} 
            rowKey="id" 
            loading={loading}
            pagination={{ pageSize: 10 }}
            className={`border-0 ${isDarkMode ? 'dark-table' : ''}`}
          />
        </Card>
      </Content>
    </Layout>
  );
};
