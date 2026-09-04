import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Card, Avatar, Typography, Button, Progress, Tag, Space, Divider, Select, Empty, message, Upload, Modal, Radio, Descriptions, Badge } from 'antd';
import {
  VideoCameraOutlined, HistoryOutlined, LineChartOutlined,
  CheckCircleOutlined, SettingOutlined, FilePdfOutlined, InfoCircleOutlined,
  WarningOutlined, ReloadOutlined, LogoutOutlined, UploadOutlined, MessageOutlined, DeleteOutlined, CloseCircleFilled, FileTextOutlined
} from '@ant-design/icons';
import { User, ScreenState } from '../../types';
import * as sharedApi from '../../api/shared.api';
import * as analysisApi from '../../api/analysis.api';
import * as chatApi from '../../api/chat.api';
import { downloadPDFReport } from '../../utils/pdfGenerator';
import { useAssessmentData } from '../../hooks/useAssessmentData';
import { SkeletalFeed } from '../SkeletalFeed';
import { LiveDetectionPanel } from '../LiveDetectionPanel';
import { PatientDoctorDirectory } from './PatientDoctorDirectory';
import { PostureResultsCard } from '../PostureResultsCard';
import { SessionHistoryTab } from '../SessionHistoryTab';
import { LearnAndFaqTab } from './LearnAndFaqTab';
import { generateDiagnosis, DiagnosisReport } from '../../utils/postureDiagnosis';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
          <h2>Something went wrong rendering the results.</h2>
          <pre style={{ fontSize: 11 }}>{this.state.error?.toString()}</pre>
          <pre style={{ fontSize: 11 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

interface PatientDashboardProps {
  currentUser: User;
  handleLogout: () => void;
  handleChangePassword: (values: any) => Promise<boolean>;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  currentUser,
  handleLogout,
  isDarkMode,
}) => {
  const [activeTab, setActiveTabState] = useState<'screening' | 'history' | 'doctors' | 'learn'>(() => {
    const saved = sessionStorage.getItem('patient_dashboard_tab');
    return saved ? (saved as any) : 'screening';
  });
  
  const setActiveTab = (tab: 'screening' | 'history' | 'doctors' | 'learn') => {
    sessionStorage.setItem('patient_dashboard_tab', tab);
    setActiveTabState(tab);
  };
  const [localName, setLocalName] = useState(currentUser.name);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeMode, setActiveModeState] = useState<'posture' | 'tremor' | 'gait' | 'full'>(() => {
    const saved = sessionStorage.getItem('dashboard_activeMode');
    return saved ? (saved as any) : 'full';
  });
  const setActiveMode = React.useCallback((mode: 'posture' | 'tremor' | 'gait' | 'full') => {
    sessionStorage.setItem('dashboard_activeMode', mode);
    setActiveModeState(mode);
  }, []);
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');

  const {
    backendConnected,
    analysisResult,
    setAnalysisResult,
    diagnosisReport,
    setDiagnosisReport,
    dbHistory,
    uploading,
    fetchHistory,
    handleVideoUpload,
    clearData
  } = useAssessmentData(currentUser, activeMode, setScreenState);

  // Helper to get initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const [totalUnread, setTotalUnread] = useState(0);

  const fetchTotalUnread = async () => {
    try {
      const counts = await chatApi.getUnreadCounts(currentUser.email);
      setTotalUnread(Object.values(counts).reduce((a, b) => a + b, 0));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTotalUnread();
    const interval = setInterval(fetchTotalUnread, 5000);
    return () => clearInterval(interval);
  }, [currentUser.email]);

  return (
    <Layout className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>

      {/* Top Header */}
      <Header className={`px-3 sm:px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} h-16`}>
        <Space size="middle" className="align-middle">
          <div className="flex items-center justify-center h-10 w-10">
            <img src="/logo.png" alt="HealthMove AI Logo" className="h-full w-full object-contain rounded-xl" />
          </div>
          <div>
            <Title level={4} className={`m-0 font-bold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>
              HealthMove AI
            </Title>
            <Paragraph className="text-[10px] text-slate-400 m-0 leading-none hidden sm:block">
              Gesture & Movement Recognition System
            </Paragraph>
          </div>
        </Space>

        <Space size="small" className="align-middle">
          <div className="flex items-center gap-1 sm:gap-3 cursor-pointer hover:bg-slate-100 p-1 sm:p-2 rounded-lg transition-colors dark:hover:bg-slate-800" onClick={() => setIsSettingsModalOpen(true)}>
            <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}?t=${avatarKey}`} className="bg-blue-100 text-blue-600 font-bold">
              {getInitials(localName)}
            </Avatar>
            <div className="text-left hidden sm:flex sm:flex-col sm:justify-center">
              <Text style={{ display: 'block' }} className="text-xs font-semibold leading-tight">{localName}</Text>
              <Text className="text-[10px] text-slate-400 leading-tight">Patient / General User</Text>
            </div>
          </div>
          <Divider type="vertical" className={`mx-1 sm:mx-3 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`} />
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              clearData();
              handleLogout();
            }}
            className="hover:bg-red-500/10 text-xs font-semibold px-2 sm:px-4"
          >
            <span className="hidden sm:inline">Log Out</span>
          </Button>
        </Space>
      </Header>

      <Layout>
        {/* Left Sidebar Menu */}
        <Sider
          width={240}
          theme={isDarkMode ? 'dark' : 'light'}
          breakpoint="md"
          collapsedWidth="0"
          className={`border-r z-20 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <div className="flex flex-col h-full justify-between py-4">
            <div className="space-y-6">
              {/* Navigation Menu */}
              <div className="px-3 space-y-1">
                <Button
                  type="text"
                  block
                  onClick={() => setActiveTab('screening')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'screening'
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-400 hover:text-blue-600'
                    }`}
                >
                  <VideoCameraOutlined /> <span className="text-sm font-semibold">Live Detection</span>
                </Button>
                <Button
                  type="text"
                  block
                  onClick={() => setActiveTab('history')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'history'
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-400 hover:text-blue-600'
                    }`}
                >
                  <HistoryOutlined /> <span className="text-sm font-semibold">History</span>
                </Button>
                <Button
                  type="text"
                  block
                  onClick={() => setActiveTab('doctors')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'doctors'
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-400 hover:text-blue-600'
                    }`}
                >
                  <MessageOutlined /> 
                  <span className="text-sm font-semibold">Doctor Directory</span>
                  {totalUnread > 0 && (
                    <Badge count={totalUnread} />
                  )}
                </Button>
                <Button
                  type="text"
                  block
                  onClick={() => setActiveTab('learn')}
                  className={`flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'learn'
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-400 hover:text-blue-600'
                    }`}
                >
                  <FileTextOutlined /> <span className="text-sm font-semibold">Learn & FAQs</span>
                </Button>
              </div>
            </div>
          </div>
        </Sider>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-[calc(100vh-64px)] min-w-0">
          {/* Fixed Patient Profile Bar */}
          <div className="px-3 sm:px-6 pt-3 sm:pt-6 pb-2 z-10 shrink-0">
            <div className="max-w-7xl mx-auto w-full">
              <Card className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                  <Col xs={24} sm={16}>
                    <Space size="middle" align="start">
                      <Avatar size={48} className="bg-blue-100 text-blue-600 font-bold text-lg shrink-0">
                        {getInitials(currentUser.name)}
                      </Avatar>
                      <div>
                        <Title level={4} className="m-0 font-bold">{currentUser.name}</Title>
                        <Space split={<Divider type="vertical" />} wrap className="text-xs text-slate-400 mt-1">
                          <span>Patient ID: #P-2026-{String(currentUser.id).padStart(4, '0')}</span>
                          <span>Age: {currentUser.age}</span>
                          <span>Gender: {currentUser.gender}</span>
                        </Space>
                      </div>
                    </Space>
                  </Col>
                  <Col xs={24} sm={8} className="flex justify-start sm:justify-end mt-2 sm:mt-0">
                    <Space wrap>
                      {screenState === 'SCREENING' ? (
                        <Tag color="error" className="px-3 py-1 rounded-full border-0 font-semibold animate-pulse">
                          Active Assessment
                        </Tag>
                      ) : (
                        <Tag color="success" icon={<CheckCircleOutlined />} className="px-3 py-1 rounded-full border-0 font-semibold">
                          Ready for Screening
                        </Tag>
                      )}
                      <Tag color="blue" className="px-3 py-1 rounded-full border-0 font-semibold uppercase">
                        {activeMode} Mode
                      </Tag>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </div>
          </div>

          <Content className="px-3 sm:px-6 pb-6 pt-4 relative flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto w-full lg:h-full flex flex-col lg:min-h-0">

              {/* TAB 1: Live Detection (Webcam + 4 Steps Workflow) */}
              {activeTab === 'screening' && (
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
              )}

              {/* TAB 2: Health History & Trends (Figure 4.23) */}
              {activeTab === 'history' && (
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#0d1117', borderRadius: 24, padding: '24px 32px' }}>
                  <SessionHistoryTab dbHistory={dbHistory} isDarkMode={true} />
                </div>
              )}

              {/* TAB 3: Learning Module */}
              {activeTab === 'learn' && (
                <div className="flex-1 min-h-0 overflow-y-auto max-w-7xl mx-auto w-full">
                  <LearnAndFaqTab isDarkMode={isDarkMode} />
                </div>
              )}

              {/* TAB 4: Doctor Directory & Chat */}
              {activeTab === 'doctors' && (
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1">
                  <PatientDoctorDirectory currentUser={currentUser} isDarkMode={isDarkMode} />
                </div>
              )}

            </div>
          </Content>
        </div>
      </Layout>
      <Modal
        title="Patient Profile Settings"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={null}
      >
        <div className="flex flex-col items-center py-6">
          <Badge
            offset={[-15, 100]}
            count={
              <CloseCircleFilled
                style={{ fontSize: '24px', color: '#ff4d4f', cursor: 'pointer', backgroundColor: 'white', borderRadius: '50%' }}
                onClick={(e) => {
                  e.stopPropagation();
                  sharedApi.deleteProfilePicture(currentUser.id).then(() => {
                    message.success("Profile picture removed!");
                    setAvatarKey(Date.now());
                  }).catch(err => {
                    message.error("Failed to remove picture");
                  });
                }}
              />
            }
          >
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                const formData = new FormData();
                formData.append('email', currentUser.email);
                formData.append('file', file);
                sharedApi.uploadProfilePicture(formData).then(() => {
                  message.success("Profile picture updated!");
                  setAvatarKey(Date.now());
                }).catch(err => {
                  message.error("Failed to upload picture");
                });
                return false;
              }}
            >
              <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}?t=${avatarKey}`} size={120} className="bg-blue-100 text-blue-600 font-bold text-4xl shadow-md cursor-pointer hover:opacity-80 transition-opacity">
                {getInitials(localName)}
              </Avatar>
            </Upload>
          </Badge>

          <div className="w-full mt-8 text-left">
            <Descriptions title="Profile Information" column={1} bordered size="small" className="bg-white rounded-lg overflow-hidden shadow-sm">
              <Descriptions.Item label="Name" className="font-semibold text-slate-800">
                <Text
                  editable={{
                    onChange: (newName) => {
                      if (!newName.trim()) return;
                      sharedApi.updateProfileName(currentUser.id, newName).then(() => {
                        message.success("Name updated successfully!");
                        // Update local storage so the new name persists across reloads
                        const savedUser = localStorage.getItem('user');
                        if (savedUser) {
                          try {
                            const parsed = JSON.parse(savedUser);
                            parsed.name = newName;
                            localStorage.setItem('user', JSON.stringify(parsed));
                          } catch (e) { }
                        }
                        setLocalName(newName);
                      }).catch(err => message.error("Failed to update name"));
                    }
                  }}
                  className="m-0"
                >
                  {localName}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Email">{currentUser.email}</Descriptions.Item>
              <Descriptions.Item label="Gender" className="capitalize">{currentUser.gender}</Descriptions.Item>
              <Descriptions.Item label="Age">{currentUser.age} years old</Descriptions.Item>
              <Descriptions.Item label="Birthday">{new Date(currentUser.birthday).toLocaleDateString()}</Descriptions.Item>
              <Descriptions.Item label="Role" className="capitalize">{currentUser.role || 'General User'}</Descriptions.Item>
            </Descriptions>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};
