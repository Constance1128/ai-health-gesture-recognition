import React, { useEffect, useState } from 'react';
import { Layout, Table, Tag, Button, Typography, Space, Card, Tabs, message, Avatar, Divider, Badge, List, Empty } from 'antd';
import { 
  CheckCircleOutlined, FileTextOutlined, LogoutOutlined, 
  SafetyCertificateOutlined, UserOutlined, SettingOutlined, BellOutlined,
  HistoryOutlined, VideoCameraOutlined, MessageOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { User, ScreenState } from '../../types';
import * as adminApi from '../../api/admin.api';
import * as chatApi from '../../api/chat.api';
import { useAssessmentData } from '../../hooks/useAssessmentData';
import { LiveDetectionPanel } from '../LiveDetectionPanel';
import { SessionHistoryTab } from '../SessionHistoryTab';
import { DoctorPatientChat } from './DoctorPatientChat';
import { AdminContentTab } from './AdminContentTab';
import { AdminAuditLogsTab } from './AdminAuditLogsTab';

const { Header, Sider, Content } = Layout;
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
  
  // Navigation State
  const [activeNav, setActiveNavState] = useState<'directory' | 'chat' | 'live' | 'history' | 'content' | 'audit'>(() => {
    const saved = sessionStorage.getItem('admin_dashboard_nav');
    return saved ? (saved as any) : 'directory';
  });
  const setActiveNav = (nav: 'directory' | 'chat' | 'live' | 'history' | 'content' | 'audit') => {
    sessionStorage.setItem('admin_dashboard_nav', nav);
    setActiveNavState(nav);
  };
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<string>('all');
  
  // Chat State
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);

  // Live Detection / History State
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [activeMode, setActiveMode] = useState<'posture' | 'tremor' | 'gait' | 'full'>('full');

  const {
    backendConnected,
    analysisResult,
    setAnalysisResult,
    diagnosisReport,
    setDiagnosisReport,
    dbHistory,
    uploading,
    fetchHistory
  } = useAssessmentData(currentUser, activeMode, setScreenState);

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

  const fetchUnreadCounts = async () => {
    try {
      const counts = await chatApi.getUnreadCounts(currentUser.email);
      setUnreadCounts(counts);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUnreadCounts();
    const interval = setInterval(() => {
      fetchUnreadCounts();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser.email]);

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

  const handleSelectUserForChat = async (user: User) => {
    setSelectedUserForChat(user);
    try {
      await chatApi.markMessagesRead({ email: currentUser.email, sender_id: user.id });
      setUnreadCounts(prev => ({ ...prev, [user.id]: 0 }));
    } catch (e) {
      console.error(e);
    }
  };

  const filteredUsers = users.filter(u => {
    if (activeDirectoryTab === 'pending') {
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

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // Chat Directory sorted by unread
  const chatUsers = [...users].sort((a, b) => {
    const unreadA = unreadCounts[a.id] || 0;
    const unreadB = unreadCounts[b.id] || 0;
    return unreadB - unreadA;
  });

  return (
    <Layout className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      {/* Top Header */}
      <Header className={`px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} h-16`}>
        <Space size="middle" className="align-middle">
          <div className="flex items-center justify-center h-10 w-10">
            <img src="/logo.png" alt="HealthMove AI Logo" className="h-full w-full object-contain rounded-xl" />
          </div>
          <div>
            <Title level={4} className={`m-0 font-bold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>
              HealthMove AI
            </Title>
            <Paragraph className="text-[10px] text-slate-400 m-0 leading-none">
              Admin Control Panel
            </Paragraph>
          </div>
        </Space>

        <Space size="large" className="align-middle">
          <Divider type="vertical" className={isDarkMode ? 'border-slate-800' : 'border-slate-200'} />
          <Space className="cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors dark:hover:bg-slate-800">
            <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}`} className="bg-emerald-100 text-emerald-600 font-bold">
              {getInitials(currentUser.name)}
            </Avatar>
            <div className="text-left hidden sm:block">
              <Text style={{ display: 'block' }} className="text-xs font-semibold leading-none">{currentUser.name}</Text>
              <Text className="text-[10px] text-slate-400 leading-none">System Administrator</Text>
            </div>
          </Space>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            className="hover:bg-red-500/10 text-xs font-semibold"
          >
            Log Out
          </Button>
        </Space>
      </Header>

      <Layout>
        {/* Left Sidebar Menu */}
        <Sider
          width={240}
          theme={isDarkMode ? 'dark' : 'light'}
          className={`border-r ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <div className="flex flex-col h-full justify-between py-4">
            <div className="space-y-6">
              <div className="px-3 space-y-1">
                <Button 
                  type="text" 
                  block 
                  onClick={() => { setActiveNav('directory'); setSelectedUserForChat(null); }}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'directory' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30'
                  }`}
                >
                  <SafetyCertificateOutlined /> <span className="font-semibold text-sm">User Directory</span>
                </Button>
                
                <Button 
                  type="text" 
                  block 
                  onClick={() => setActiveNav('chat')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'chat' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30'
                  }`}
                >
                  <MessageOutlined /> 
                  <span className="font-semibold text-sm">Chat Center</span>
                  {totalUnread > 0 && (
                    <Badge count={totalUnread} />
                  )}
                </Button>
                
                <Button 
                  type="text" 
                  block 
                  onClick={() => { setActiveNav('live'); setSelectedUserForChat(null); }}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'live' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30'
                  }`}
                >
                  <VideoCameraOutlined /> <span className="font-semibold text-sm">Live Detection</span>
                </Button>
                
                <Button 
                  type="text" 
                  block 
                  onClick={() => { setActiveNav('history'); setSelectedUserForChat(null); }}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'history' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30'
                  }`}
                >
                  <HistoryOutlined /> <span className="font-semibold text-sm">Session History</span>
                </Button>
                <Button 
                  type="text" 
                  block 
                  onClick={() => setActiveNav('content')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'content' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30'
                  }`}
                >
                  <FileTextOutlined /> <span className="text-sm font-semibold">Content Manager</span>
                </Button>
                <Button 
                  type="text" 
                  block 
                  onClick={() => setActiveNav('audit')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'audit' ? 'text-emerald-600 bg-emerald-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/30'
                  }`}
                >
                  <SafetyCertificateOutlined /> <span className="text-sm font-semibold">Audit Logs</span>
                </Button>
              </div>
            </div>
          </div>
        </Sider>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-[calc(100vh-64px)] min-w-0">
          <Content className="flex flex-col h-full bg-transparent">
            <div className="p-6 h-full flex flex-col">
              {activeNav === 'directory' && (
                <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
                  <div className="flex justify-between items-center mb-6">
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

                  <div className="mb-4">
                    <Tabs activeKey={activeDirectoryTab} onChange={setActiveDirectoryTab} size="large">
                      <Tabs.TabPane tab="All Users" key="all" />
                      <Tabs.TabPane tab={`Pending Verifications (${users.filter(u => u.role === 'professional' && u.is_verified === 0).length})`} key="pending" />
                    </Tabs>
                  </div>

                  <Card className={`border-0 shadow-lg flex-1 overflow-hidden flex flex-col ${isDarkMode ? 'bg-slate-900/80 border border-slate-800/50' : 'bg-white/90'}`} bodyStyle={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <Table 
                      dataSource={filteredUsers} 
                      columns={columns} 
                      rowKey="id" 
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                      className={`border-0 flex-1 overflow-y-auto ${isDarkMode ? 'dark-table' : ''}`}
                    />
                  </Card>
                </div>
              )}

              {activeNav === 'live' && (
                <div className="flex-1 min-h-0 relative max-w-7xl mx-auto w-full">
                  <LiveDetectionPanel
                    currentUser={currentUser}
                    isDarkMode={isDarkMode}
                    activeMode={activeMode}
                    setActiveMode={setActiveMode}
                    screenState={screenState}
                    setScreenState={setScreenState}
                    backendConnected={backendConnected}
                    analysisResult={analysisResult}
                    setAnalysisResult={setAnalysisResult}
                    diagnosisReport={diagnosisReport}
                    setDiagnosisReport={setDiagnosisReport}
                    dbHistory={dbHistory}
                    fetchHistory={fetchHistory}
                    uploading={uploading}
                  />
                </div>
              )}

              {activeNav === 'history' && (
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#0d1117', borderRadius: 24, padding: '24px 32px' }}>
                  <SessionHistoryTab dbHistory={dbHistory} isDarkMode={true} />
                </div>
              )}

              {activeNav === 'chat' && (
                <div className="flex h-full w-full">
                  {!selectedUserForChat ? (
                    <div className="w-full h-full flex flex-col">
                      <Title level={3} className="m-0 mb-6">Chat Center</Title>
                      <Card className={`border shadow-sm rounded-2xl flex-1 flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`} bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div className={`p-4 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                          <Title level={5} className="!m-0">All Users</Title>
                        </div>
                        {chatUsers.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center">
                            <Empty description={<span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>No users found</span>} />
                          </div>
                        ) : (
                          <List
                            className="overflow-y-auto pr-2 custom-scrollbar flex-1"
                            itemLayout="horizontal"
                            dataSource={chatUsers}
                            renderItem={(user) => {
                              const unread = unreadCounts[user.id] || 0;
                              return (
                                <List.Item
                                  className={`cursor-pointer transition-colors border-b ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'}`}
                                  style={{ padding: '16px 24px' }}
                                  onClick={() => handleSelectUserForChat(user)}
                                >
                                  <List.Item.Meta
                                    avatar={
                                      <Avatar size={40} className="bg-emerald-100 text-emerald-600 font-bold text-base">
                                        {getInitials(user.name)}
                                      </Avatar>
                                    }
                                    title={<span className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{user.name}</span>}
                                    description={<span className="text-xs text-slate-500">{user.role || 'Patient'} • {user.email}</span>}
                                  />
                                  {unread > 0 && (
                                    <Badge count={unread} />
                                  )}
                                </List.Item>
                              );
                            }}
                          />
                        )}
                      </Card>
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col relative max-w-4xl mx-auto">
                      <DoctorPatientChat
                        currentUser={currentUser}
                        selectedPatient={selectedUserForChat}
                        onBack={() => setSelectedUserForChat(null)}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeNav === 'content' && (
                <div className="flex-1 min-h-0 overflow-y-auto w-full">
                  <AdminContentTab userId={currentUser.id!} isDarkMode={isDarkMode} />
                </div>
              )}

              {activeNav === 'audit' && (
                <div className="flex-1 min-h-0 overflow-y-auto w-full">
                  <AdminAuditLogsTab email={currentUser.email} isDarkMode={isDarkMode} />
                </div>
              )}
            </div>
          </Content>
        </div>
      </Layout>
    </Layout>
  );
};
