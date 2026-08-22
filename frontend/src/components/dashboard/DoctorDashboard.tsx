import React, { useEffect, useState } from 'react';
import { Layout, Row, Col, Card, Input, Avatar, Typography, Button, Progress, Tag, Space, Divider, message, Empty, Tabs, Modal, Form, DatePicker, TimePicker, Badge, Upload } from 'antd';
import { 
  UserOutlined, SearchOutlined, LogoutOutlined, 
  FilePdfOutlined, HistoryOutlined, LineChartOutlined, VideoCameraOutlined, 
  CheckCircleOutlined, HeartOutlined, SettingOutlined, EyeOutlined,
  ShareAltOutlined, FileTextOutlined, BellOutlined
} from '@ant-design/icons';
import { User, DBHistoryRecord, AnalysisResult, Appointment } from '../../types';
import { downloadPDFReport } from '../../utils/pdfGenerator';
import { DoctorPatientChat } from './DoctorPatientChat';
// dayjs unused
import * as doctorApi from '../../api/doctor.api';
import * as chatApi from '../../api/chat.api';
import * as sharedApi from '../../api/shared.api';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

interface DoctorDashboardProps {
  currentUser: User;
  handleLogout: () => void;
  isDarkMode: boolean;
}

interface Patient extends User {
  latest_status?: string;
  latest_timestamp?: number;
  latest_mode?: string;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  currentUser,
  handleLogout,
  isDarkMode,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientHistory, setPatientHistory] = useState<DBHistoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<string>('current');
  const [activePatientView, setActivePatientView] = useState<'clinical' | 'chat'>('clinical');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [isAppointmentsModalOpen, setIsAppointmentsModalOpen] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});
  
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [overrideForm] = Form.useForm();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedChatPatient, setSelectedChatPatient] = useState<any>(null);

  const fetchDashboardData = async () => {
    try {
      const notifs = await sharedApi.getNotifications(currentUser.email);
      setNotifications(notifs);

      const overridesData = await doctorApi.getScheduleOverrides(currentUser.email);
      setOverrides(overridesData);
    } catch (e) {
      console.error(e);
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

  const handleAddOverride = async (values: any) => {
    try {
      await doctorApi.addScheduleOverride({
        email: currentUser.email,
        date: values.date.format('YYYY-MM-DD'),
        start_time: values.timeRange[0].format('HH:mm'),
        end_time: values.timeRange[1].format('HH:mm'),
        reason: values.reason || ''
      });
      message.success('Time off added');
      overrideForm.resetFields();
      setIsOverrideModalOpen(false);
      fetchDashboardData();
    } catch (e: any) {
      message.error(e.message || 'Failed to add time off');
    }
  };

  const handleDeleteOverride = async (id: number) => {
    try {
      await doctorApi.deleteScheduleOverride(currentUser.email, id);
      message.success('Time off deleted');
      fetchDashboardData();
    } catch (e: any) {
      message.error(e.message || 'Failed to delete time off');
    }
  };

  const fetchAppointments = async () => {
    try {
      const data = await doctorApi.getDoctorAppointments(currentUser.email);
      setAppointments(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAppointment = async (id: number, status: string) => {
    try {
      await doctorApi.updateAppointmentStatus({
        appointment_id: id,
        status: status
      });
      message.success(`Appointment ${status}`);
      fetchAppointments();
    } catch (e: any) {
      message.error(e.message || "Failed to update appointment");
    }
  };

  const handleSaveSettings = async (values: any) => {
    try {
      await doctorApi.updateDoctorProfile({
        email: currentUser.email,
        bio: values.bio || '',
        clinic_name: values.clinic_name || '',
        consultation_hours: values.consultation_hours || ''
      });
      message.success("Profile updated successfully");
      setIsSettingsModalOpen(false);
    } catch (e: any) {
      message.error(e.message || "Failed to update profile");
    }
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await doctorApi.getDoctorPatients(currentUser.email);
      setPatients(data);
    } catch (e) {
      console.error(e);
      message.error("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientHistory = async (patientEmail: string) => {
    try {
      setHistoryLoading(true);
      const data = await doctorApi.getPatientHistory(currentUser.email, patientEmail);
      setPatientHistory(data);
    } catch (e: any) {
      console.error(e);
      message.error(e.message || "No permission to view this patient's records");
      setPatientHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 5000);
    return () => clearInterval(interval);
  }, []);

  // handleChatOpen removed

  const handleSelectPatient = async (patient: any) => {
    setSelectedPatient(patient);
    fetchPatientHistory(patient.email);
    try {
      await chatApi.markMessagesRead({ email: currentUser.email, other_user_id: patient.id });
      setUnreadCounts(prev => ({ ...prev, [patient.id]: 0 }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportPDF = () => {
    if (!selectedPatient || patientHistory.length === 0) return;
    
    const latestRecord = patientHistory[0];
    const mockAnalysisResult: AnalysisResult = {
      mode: latestRecord.mode,
      status: latestRecord.status,
      score: latestRecord.metric_1.value * 100,
      recommendation: latestRecord.recommendation,
      landmarks: [],
      metrics: {
        [latestRecord.metric_1.name]: latestRecord.metric_1.value,
        [latestRecord.metric_2.name]: latestRecord.metric_2.value,
      },
      timestamp: latestRecord.timestamp
    };

    downloadPDFReport(mockAnalysisResult, patientHistory);
    message.success(`PDF report exported for ${selectedPatient.name}`);
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const latestRecord = patientHistory.length > 0 ? patientHistory[0] : null;

  // Helper to get initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Layout className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* Top Header */}
      <Header className={`px-6 flex justify-between items-center border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} h-16`}>
        <Space size="middle" className="align-middle">
          <div className="p-2 bg-blue-600 text-white rounded-xl flex items-center justify-center">
            <LineChartOutlined className="text-xl" />
          </div>
          <div>
            <Title level={4} className={`m-0 font-bold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-950'}`}>
              HealthMove AI
            </Title>
            <Paragraph className="text-[10px] text-slate-400 m-0 leading-none">
              Gesture & Movement Recognition System
            </Paragraph>
          </div>
        </Space>

        <Space size="large" className="align-middle">
          <Badge count={notifications.filter(n => !n.is_read).length} size="small">
            <Button 
              type="text" 
              icon={<BellOutlined className="text-slate-400" />} 
              onClick={() => {
                fetchDashboardData();
                setIsNotificationsModalOpen(true);
              }}
            />
          </Badge>
          <Button 
            type="text" 
            icon={<SettingOutlined className="text-slate-400" />} 
            onClick={() => {
              fetchDashboardData();
              setIsSettingsModalOpen(true);
            }} 
          />
          <Button 
            type="text" 
            icon={<FileTextOutlined className="text-slate-400" />} 
            onClick={() => {
              fetchAppointments();
              setIsAppointmentsModalOpen(true);
            }} 
          />

          <Divider type="vertical" className={isDarkMode ? 'border-slate-800' : 'border-slate-200'} />
          <Space className="cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors dark:hover:bg-slate-800" onClick={() => setIsSettingsModalOpen(true)}>
            <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}`} className="bg-blue-100 text-blue-600 font-bold">
              {getInitials(currentUser.name)}
            </Avatar>
            <div className="text-left hidden sm:block">
              <Text style={{ display: 'block' }} className="text-xs font-semibold leading-none">{currentUser.name}</Text>
              <Text className="text-[10px] text-slate-400 leading-none">{currentUser.specialization || "Clinician"}</Text>
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
        {/* Left Sidebar Menu & Patient Directory */}
        <Sider 
          width={240} 
          theme={isDarkMode ? 'dark' : 'light'} 
          className={`border-r ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
        >
          <div className="flex flex-col h-full justify-between py-4">
            <div className="space-y-6">
              {/* Navigation Menu */}
              <div className="px-3 space-y-1">
                <Button type="text" block className="text-left flex items-center gap-3 px-3 py-5 text-slate-400 hover:text-blue-600">
                  <VideoCameraOutlined /> <span className="font-semibold text-sm">Live Detection</span>
                </Button>
                <Button type="text" block className="text-left flex items-center gap-3 px-3 py-5 text-blue-600 bg-blue-50/50 hover:text-blue-600">
                  <UserOutlined /> <span className="font-semibold text-sm">Patients</span>
                </Button>
                <Button type="text" block className="text-left flex items-center gap-3 px-3 py-5 text-slate-400 hover:text-blue-600">
                  <LineChartOutlined /> <span className="font-semibold text-sm">Analytics</span>
                </Button>
                <Button type="text" block className="text-left flex items-center gap-3 px-3 py-5 text-slate-400 hover:text-blue-600">
                  <FileTextOutlined /> <span className="font-semibold text-sm">Reports</span>
                </Button>
                <Button type="text" block className="text-left flex items-center gap-3 px-3 py-5 text-slate-400 hover:text-blue-600">
                  <HistoryOutlined /> <span className="font-semibold text-sm">History</span>
                </Button>
              </div>

              <Divider className="my-0" />

              {/* Active Patients Directory */}
              <div className="px-4">
                <Text className="text-xs font-bold text-slate-400 block mb-3 uppercase tracking-wider">Active Patients</Text>
                <Input
                  prefix={<SearchOutlined className="text-slate-400" />}
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3 bg-slate-50 border-slate-200"
                  size="small"
                />
                
                <div className="space-y-1 max-h-[calc(100vh-420px)] overflow-y-auto">
                  {filteredPatients.map((patient) => {
                    const isSelected = selectedPatient?.id === patient.id;
                    const unread = unreadCounts[patient.id] || 0;
                    return (
                      <div
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-blue-50 text-blue-600 font-semibold' 
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <UserOutlined className="text-xs" />
                          <span className="text-xs truncate">{patient.name}</span>
                        </div>
                        {unread > 0 && (
                          <Badge count={unread} size="small" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </Sider>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-[calc(100vh-64px)] min-w-0">
          {selectedPatient ? (
            <>
              {/* Fixed Doctor Profile Bar */}
              <div className="px-6 pt-6 pb-2 z-10 shrink-0">
                <div className="max-w-7xl mx-auto w-full">
                  <Card className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <Row justify="space-between" align="middle" gutter={[16, 16]}>
                      <Col>
                        <Space size="middle">
                          <Avatar size={48} className="bg-blue-100 text-blue-600 font-bold text-lg">
                            {getInitials(currentUser.name)}
                          </Avatar>
                          <div>
                            <Title level={4} className="m-0 font-bold">Dr. {currentUser.name}</Title>
                            <Space split={<Divider type="vertical" />} className="text-xs text-slate-400">
                              <span>License: {currentUser.medical_license || 'Pending'}</span>
                              <span>Specialization: {currentUser.specialization || 'General Practitioner'}</span>
                              <span>Clinic: {currentUser.clinic_name || 'Not assigned'}</span>
                            </Space>
                          </div>
                        </Space>
                      </Col>
                      <Col>
                        <Space>
                          <Tag color="success" icon={<CheckCircleOutlined />} className="px-3 py-1 rounded-full border-0 font-semibold">
                            Available for Consult
                          </Tag>
                          <Tag color="blue" className="px-3 py-1 rounded-full border-0 font-semibold uppercase">
                            Pro Mode
                          </Tag>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                </div>
              </div>

              <Content className="px-6 pb-6 pt-4 overflow-y-auto relative flex-1">
                <div className="space-y-6 max-w-7xl mx-auto w-full">
                  
                  {/* Selected Patient Profile Bar */}
                  <Card className={`sticky top-0 z-50 border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <Row justify="space-between" align="middle" gutter={[16, 16]}>
                      <Col>
                        <Space size="middle">
                          <Avatar size={48} className="bg-blue-100 text-blue-600 font-bold text-lg">
                            {getInitials(selectedPatient.name)}
                          </Avatar>
                          <div>
                            <Title level={4} className="m-0 font-bold">{selectedPatient.name}</Title>
                            <Space split={<Divider type="vertical" />} className="text-xs text-slate-400">
                              <span>Patient ID: #P-2026-{String(selectedPatient.id).padStart(4, '0')}</span>
                              <span>Age: {selectedPatient.age}</span>
                              <span>Gender: {selectedPatient.gender}</span>
                            </Space>
                          </div>
                        </Space>
                      </Col>
                      <Col>
                        <Space>
                          <Tag color="success" icon={<CheckCircleOutlined />} className="px-3 py-1 rounded-full border-0 font-semibold flex items-center gap-1">
                            Active Session
                          </Tag>
                          <Tag color="blue" className="px-3 py-1 rounded-full border-0 font-semibold uppercase">
                            {latestRecord ? `${latestRecord.mode} Monitoring` : 'No Active Monitoring'}
                          </Tag>
                        </Space>
                      </Col>
                    </Row>
                  </Card>

                  {/* View Toggle */}
                  <div className="mb-4">
                    <Tabs 
                      activeKey={activePatientView} 
                      onChange={(k) => setActivePatientView(k as 'clinical' | 'chat')}
                      className="mb-0"
                    >
                      <Tabs.TabPane tab="Clinical Diagnostics" key="clinical" />
                      <Tabs.TabPane tab="Patient Chat" key="chat" />
                    </Tabs>
                  </div>

                  {activePatientView === 'clinical' ? (
                    <>
                      <Row gutter={[24, 24]}>
                      {/* Left Column - Live Video & AI Detections */}
                      <Col xs={24} lg={15} className="space-y-6">
                      
                      {/* Live Camera Feed Card */}
                      <Card 
                        title={
                          <Space>
                            <VideoCameraOutlined className="text-blue-600" />
                            <span className="font-bold">Live Camera Feed</span>
                          </Space>
                        }
                        className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                        extra={
                          <Button type="primary" icon={<VideoCameraOutlined />} className="bg-slate-950 hover:bg-slate-900 border-0 rounded-lg text-xs font-semibold h-8">
                            Start Recording
                          </Button>
                        }
                      >
                        <Paragraph className="text-slate-400 text-xs -mt-2 mb-4">
                          Real-time gesture and movement tracking
                        </Paragraph>

                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[#0f172a] border border-slate-800 flex items-center justify-center">
                          {latestRecord && latestRecord.video_path ? (
                            <video 
                              src={`http://localhost:8000/${latestRecord.video_path}`}
                              controls
                              className="w-full h-full object-cover"
                              poster="/uploads/video_poster.jpg"
                            />
                          ) : (
                            <div className="text-center space-y-3">
                              <div className="text-5xl animate-pulse text-blue-500/20">
                                <LineChartOutlined />
                              </div>
                              <div className="text-xs text-slate-500 font-semibold tracking-wider uppercase">Camera Feed Placeholder</div>
                            </div>
                          )}
                          
                          {/* Overlay Info bar */}
                          <div className="absolute bottom-4 left-4 right-4 flex justify-between text-[10px] text-slate-400 bg-slate-950/70 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                            <span className="flex items-center gap-1">
                              <HistoryOutlined /> 00:05:32
                            </span>
                            <span>30 FPS • 1920x1080</span>
                          </div>
                        </div>

                        <div className="flex gap-4 mt-4">
                          <Button className="flex-1 text-xs font-semibold rounded-lg">Snapshot</Button>
                          <Button className="flex-1 text-xs font-semibold rounded-lg">Camera Settings</Button>
                        </div>
                      </Card>

                      {/* AI Detection Results Card */}
                      <Card 
                        title={
                          <Space>
                            <EyeOutlined className="text-blue-600" />
                            <span className="font-bold">AI Detection Results</span>
                          </Space>
                        }
                        className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                      >
                        <Paragraph className="text-slate-400 text-xs -mt-2 mb-4">
                          Real-time health condition analysis
                        </Paragraph>

                        <Tabs activeKey={activeTab} onChange={setActiveTab} className="border-b-0">
                          <Tabs.TabPane tab="Current Session" key="current">
                            <div className="space-y-4 pt-2">
                              {patientHistory.length > 0 ? (
                                patientHistory.slice(0, 3).map((record) => {
                                  // Map mode to title
                                  let title = "Movement Issue";
                                  let severity = "Mild";
                                  let color = "blue";
                                  let val = record.metric_1.value;

                                  if (record.mode === 'tremor') {
                                    title = "Tremor Detected";
                                    severity = record.status.toLowerCase().includes('moderate') ? "Moderate" : record.status.toLowerCase().includes('severe') ? "High" : "Mild";
                                    color = severity === "High" ? "red" : severity === "Moderate" ? "amber" : "blue";
                                  } else if (record.mode === 'posture') {
                                    title = "Gait Abnormality";
                                    severity = record.status.toLowerCase().includes('moderate') ? "Moderate" : record.status.toLowerCase().includes('severe') ? "High" : "Mild";
                                    color = severity === "High" ? "red" : severity === "Moderate" ? "amber" : "blue";
                                  } else if (record.mode === 'exercise') {
                                    title = "Balance Issue";
                                    severity = record.status.toLowerCase().includes('moderate') ? "Moderate" : record.status.toLowerCase().includes('severe') ? "High" : "Mild";
                                    color = severity === "High" ? "red" : severity === "Moderate" ? "amber" : "blue";
                                  }

                                  const confidence = Math.round(val * 100);

                                  return (
                                    <div key={record.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                      <div className="flex justify-between items-center mb-2">
                                        <Space>
                                          <span className="font-bold text-sm text-slate-800">{title}</span>
                                          <Tag color={color} className="text-[10px] rounded-full border-0 px-2.5 font-semibold">{severity}</Tag>
                                        </Space>
                                        <div className="text-right">
                                          <Text className="text-[10px] text-slate-400 block">Confidence</Text>
                                          <span className="font-extrabold text-slate-800 text-lg">{confidence}%</span>
                                        </div>
                                      </div>
                                      <Progress percent={confidence} showInfo={false} strokeColor="#000" trailColor="#e2e8f0" strokeWidth={6} className="m-0" />
                                      <Text className="text-[10px] text-slate-400 mt-2 block">
                                        Detected {new Date(record.timestamp * 1000).toLocaleTimeString()}
                                      </Text>
                                    </div>
                                  );
                                })
                              ) : (
                                <Empty description="No screening records found." />
                              )}
                            </div>
                          </Tabs.TabPane>
                          <Tabs.TabPane tab="Trend Analysis" key="trend">
                            <div className="p-8 text-center text-slate-400 text-xs">
                              Detailed trend analysis chart of patient kinesiology metrics will be rendered here.
                            </div>
                          </Tabs.TabPane>
                        </Tabs>
                      </Card>

                    </Col>

                    {/* Right Column - Vital Metrics & History */}
                    <Col xs={24} lg={9} className="space-y-6">
                      
                      {/* Vital Metrics Card */}
                      <Card 
                        title={
                          <Space>
                            <HeartOutlined className="text-blue-600" />
                            <span className="font-bold">Vital Metrics</span>
                          </Space>
                        }
                        className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                      >
                        <div className="space-y-5">
                          {latestRecord ? (
                            <>
                              <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                  <span className="text-slate-500 font-semibold">Movement Score</span>
                                  <span className="font-bold text-slate-800">{(latestRecord.metric_1.value * 100).toFixed(0)}/100</span>
                                </div>
                                <Progress percent={Math.round(latestRecord.metric_1.value * 100)} showInfo={false} strokeColor="#000" strokeWidth={6} />
                              </div>

                              <div>
                                <div className="flex justify-between text-xs mb-1.5">
                                  <span className="text-slate-500 font-semibold">Stability Index</span>
                                  <span className="font-bold text-slate-800">{(latestRecord.metric_2.value * 10).toFixed(1)}/10</span>
                                </div>
                                <Progress percent={Math.round(latestRecord.metric_2.value * 100)} showInfo={false} strokeColor="#000" strokeWidth={6} />
                              </div>
                            </>
                          ) : (
                            <div className="text-center py-4 text-slate-400 text-xs">No metrics recorded</div>
                          )}

                          <Divider className="my-3" />

                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Session Duration</span>
                              <span className="font-semibold text-slate-800">00:05:32</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Frames Analyzed</span>
                              <span className="font-semibold text-slate-800">9,960</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Gestures Detected</span>
                              <span className="font-semibold text-slate-800">247</span>
                            </div>
                          </div>
                        </div>
                      </Card>

                      {/* Recent Sessions Card */}
                      <Card 
                        title={
                          <Space>
                            <HistoryOutlined className="text-blue-600" />
                            <span className="font-bold">Recent Sessions</span>
                          </Space>
                        }
                        className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                      >
                        <div className="space-y-3">
                          {patientHistory.slice(0, 3).map((record) => (
                            <div key={record.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-xs text-slate-800">
                                  {new Date(record.timestamp * 1000).toLocaleDateString()} {new Date(record.timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                                <Tag color="blue" className="text-[9px] rounded-full border-0 px-2 font-semibold uppercase">{record.mode}</Tag>
                              </div>
                              <div className="flex justify-between text-[10px] text-slate-400">
                                <span>Duration: 12 min</span>
                                <span>{record.status}</span>
                              </div>
                            </div>
                          ))}

                          {patientHistory.length > 3 && (
                            <Button type="text" block className="text-xs text-blue-600 font-bold mt-2">
                              View All Sessions
                            </Button>
                          )}
                        </div>
                      </Card>

                    </Col>

                  </Row>

                  {/* Bottom Action Bar */}
                  <div className={`p-4 rounded-2xl border border-slate-100 flex flex-wrap justify-between items-center gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                    <Space>
                      <Button 
                        type="primary" 
                        icon={<FilePdfOutlined />} 
                        disabled={patientHistory.length === 0}
                        onClick={handleExportPDF}
                        className="bg-slate-950 hover:bg-slate-900 border-0 rounded-xl font-semibold text-xs px-6 py-4 flex items-center h-auto"
                      >
                        Generate Report
                      </Button>
                      <Button icon={<LineChartOutlined />} className="rounded-xl text-xs font-semibold py-4 flex items-center h-auto">
                        View Analytics
                      </Button>
                      <Button icon={<ShareAltOutlined />} className="rounded-xl text-xs font-semibold py-4 flex items-center h-auto">
                        Share with Team
                      </Button>
                    </Space>
                    <Button type="text" icon={<SettingOutlined className="text-slate-400 text-lg" />} />
                  </div>
                </>
              ) : (
                <DoctorPatientChat currentUser={currentUser} selectedPatient={selectedPatient} isDarkMode={isDarkMode} />
              )}
                </div>
              </Content>
            </>
          ) : (
            <Content className="p-6 flex items-center justify-center flex-1">
              <Empty
                image={<LineChartOutlined style={{ fontSize: 64, color: isDarkMode ? '#334155' : '#cbd5e1' }} />}
                description={
                  <span className={`text-lg font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    Select a patient from the list to view details
                  </span>
                }
              />
            </Content>
          )}
        </div>
      </Layout>
      <Modal
        title="Doctor Profile & Timetable"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={null}
        width={700}
      >
        <Tabs defaultActiveKey="profile">
          <Tabs.TabPane tab="Profile Details" key="profile">
            <div className="mb-6 flex flex-col items-center">
              <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}`} size={80} className="mb-2 bg-blue-100 text-blue-600 font-bold text-2xl">
                {getInitials(currentUser.name)}
              </Avatar>
              <Upload 
                showUploadList={false} 
                beforeUpload={(file) => {
                  const formData = new FormData();
                  formData.append('email', currentUser.email);
                  formData.append('file', file);
                  sharedApi.uploadProfilePicture(formData).then(() => {
                    message.success("Profile picture updated!");
                    window.location.reload();
                  }).catch(err => {
                    message.error("Failed to upload picture");
                  });
                  return false;
                }}
              >
                <Button size="small">Change Picture</Button>
              </Upload>
            </div>
            <Form
              form={settingsForm}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={{
                bio: (currentUser as any).bio || '',
                clinic_name: (currentUser as any).clinic_name || '',
                consultation_hours: (currentUser as any).consultation_hours || ''
              }}
            >
              <Form.Item label="Bio / Description" name="bio">
                <Input.TextArea rows={4} placeholder="Describe your expertise and background..." />
              </Form.Item>
              <Form.Item label="Clinic Name" name="clinic_name">
                <Input placeholder="E.g., City Health Clinic" />
              </Form.Item>
              <Form.Item label="Consultation Hours & Links" name="consultation_hours">
                <Input.TextArea rows={4} placeholder="E.g. Mon-Fri: 9am - 5pm\nZoom Link: https://..." />
              </Form.Item>
              <Button type="primary" htmlType="submit" block>Save Changes</Button>
            </Form>
          </Tabs.TabPane>
          <Tabs.TabPane tab="Schedule Overrides (Surgery/Breaks)" key="timetable">
            <div className="space-y-6">
              <Card title="Add Surgery / Blocked Time" size="small">
                <Form form={overrideForm} layout="vertical" onFinish={handleAddOverride}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="Date" name="date" rules={[{ required: true }]}>
                        <DatePicker className="w-full" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Time Range" name="timeRange" rules={[{ required: true }]}>
                        <TimePicker.RangePicker format="HH:mm" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="Reason" name="reason">
                        <Input placeholder="E.g. Surgery" />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Button type="primary" htmlType="submit">Block Time</Button>
                </Form>
              </Card>

              <Card title="Current Blocked Times" size="small">
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {overrides.length === 0 ? (
                    <Empty description="No blocked times." />
                  ) : (
                    overrides.map(ovr => (
                      <div key={ovr.id} className="flex justify-between items-center p-3 border rounded-lg bg-red-50/50">
                        <div>
                          <Typography.Text className="font-semibold">{ovr.date}</Typography.Text>
                          <br />
                          <Typography.Text className="text-xs text-slate-500">{ovr.start_time} - {ovr.end_time} ({ovr.reason})</Typography.Text>
                        </div>
                        <Button danger size="small" onClick={() => handleDeleteOverride(ovr.id)}>Remove</Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </Tabs.TabPane>
        </Tabs>
      </Modal>

      <Modal
        title="Appointments"
        open={isAppointmentsModalOpen}
        onCancel={() => setIsAppointmentsModalOpen(false)}
        footer={null}
        width={700}
      >
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {appointments.length === 0 ? (
            <Empty description="No appointments scheduled." />
          ) : (
            appointments.map(appt => (
              <Card key={appt.id} size="small" className="border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <Typography.Title level={5} className="!m-0">{appt.patient_name}</Typography.Title>
                    <Typography.Text className="text-xs text-slate-500 block">{appt.date} at {appt.time}</Typography.Text>
                    {appt.notes && <Typography.Text className="text-sm mt-2 block">{appt.notes}</Typography.Text>}
                  </div>
                  <div>
                    {appt.status === 'pending' ? (
                      <Space>
                              <Button type="link" size="small" onClick={() => handleUpdateAppointment(appt.id, 'confirmed')} className="text-emerald-600 font-semibold p-0">Accept</Button>
                              <Button type="link" size="small" onClick={() => handleUpdateAppointment(appt.id, 'cancelled')} className="text-rose-600 font-semibold p-0">Decline</Button>
                      </Space>
                    ) : (
                      <Tag color={appt.status === 'confirmed' ? 'green' : appt.status === 'cancelled' ? 'red' : 'default'}>
                        {appt.status.toUpperCase()}
                      </Tag>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Modal>



      <Modal
        title="Notifications"
        open={isNotificationsModalOpen}
        onCancel={() => setIsNotificationsModalOpen(false)}
        footer={null}
      >
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <Empty description="No notifications." />
          ) : (
            notifications.map(notif => (
              <div key={notif.id} className={`p-3 border-b ${notif.is_read ? 'opacity-60' : 'bg-blue-50'}`}>
                <Typography.Text className="font-bold block">{notif.title}</Typography.Text>
                <Typography.Text className="text-sm">{notif.message}</Typography.Text>
                <Typography.Text className="text-xs text-slate-400 block mt-1">
                  {new Date(notif.timestamp * 1000).toLocaleString()}
                </Typography.Text>
              </div>
            ))
          )}
        </div>
      </Modal>
    </Layout>
  );
};
