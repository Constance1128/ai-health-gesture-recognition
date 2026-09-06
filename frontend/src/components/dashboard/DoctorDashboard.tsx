import React, { useEffect, useState, useRef } from 'react';
import { Layout, Row, Col, Card, Input, Avatar, Typography, Button, Progress, Tag, Space, Divider, message, Empty, Tabs, Modal, Form, DatePicker, TimePicker, Badge, Upload, List, Checkbox, Popover, notification } from 'antd';
import {
  UserOutlined, SearchOutlined, LogoutOutlined,
  FilePdfOutlined, HistoryOutlined, LineChartOutlined, VideoCameraOutlined,
  CheckCircleOutlined, HeartOutlined, SettingOutlined, EyeOutlined,
  ShareAltOutlined, FileTextOutlined, BellOutlined, ArrowLeftOutlined,
  ClockCircleOutlined, InfoCircleOutlined, EditOutlined, CalendarOutlined,
  CloseCircleFilled, AppstoreOutlined
} from '@ant-design/icons';
import { User, DBHistoryRecord, AnalysisResult, Appointment } from '../../types';
import { downloadPDFReport } from '../../utils/pdfGenerator';
import { DoctorPatientChat } from './DoctorPatientChat';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
import { DailyTimeline } from './DailyTimeline';
import * as doctorApi from '../../api/doctor.api';


import * as chatApi from '../../api/chat.api';
import * as sharedApi from '../../api/shared.api';
import { SessionHistoryTab } from '../SessionHistoryTab';
import { LearnAndFaqTab } from './LearnAndFaqTab';
import { useAssessmentData } from '../../hooks/useAssessmentData';
import { LiveDetectionPanel } from '../LiveDetectionPanel';
import { ScreenState } from '../../types';

import { DoctorScheduleTab } from './DoctorScheduleTab';

const DAYS_OF_WEEK = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 }
];

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
  const [activeNav, setActiveNavState] = useState<string>(() => {
    return sessionStorage.getItem('doctor_dashboard_nav') || 'patients';
  });

  const setActiveNav = (nav: string) => {
    sessionStorage.setItem('doctor_dashboard_nav', nav);
    setActiveNavState(nav);
  };
  const [activeTab, setActiveTab] = useState<string>('current');

  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [activeMode, setActiveMode] = useState<'posture' | 'tremor' | 'gait' | 'full'>('full');

  const {
    backendConnected,
    analysisResult,
    setAnalysisResult,
    diagnosisReport,
    setDiagnosisReport,
    dbHistory: doctorDbHistory,
    uploading,
    fetchHistory: fetchDoctorHistory
  } = useAssessmentData(currentUser, activeMode, setScreenState);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isOverrideModalOpen, setIsOverrideModalOpen] = useState(false);
  const [localName, setLocalName] = useState(currentUser.name);
  const [localBio, setLocalBio] = useState((currentUser as any).bio || '');
  const [localClinic, setLocalClinic] = useState((currentUser as any).clinic_name || '');
  const [localHours, setLocalHours] = useState((currentUser as any).consultation_hours || '');
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [settingsForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handleProfessionalUpdate = async (field: 'bio' | 'clinic_name' | 'consultation_hours', val: string) => {
    try {
      const payload = {
        email: currentUser.email,
        bio: field === 'bio' ? val : localBio,
        clinic_name: field === 'clinic_name' ? val : localClinic,
        consultation_hours: field === 'consultation_hours' ? val : localHours
      };
      await doctorApi.updateDoctorProfile(payload);
      message.success("Profile updated successfully!");
      if (field === 'bio') setLocalBio(val);
      if (field === 'clinic_name') setLocalClinic(val);
      if (field === 'consultation_hours') setLocalHours(val);
    } catch (e: any) {
      message.error("Failed to update profile");
    }
  };


  const [unreadCounts, setUnreadCounts] = useState<Record<number, number>>({});

  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedChatPatient, setSelectedChatPatient] = useState<any>(null);

  const [isTodayAgendaOpen, setIsTodayAgendaOpen] = useState(false);
  const [agendaAppointments, setAgendaAppointments] = useState<any[]>([]);
  const [agendaSchedule, setAgendaSchedule] = useState<any[]>([]);
  const [agendaOverrides, setAgendaOverrides] = useState<any[]>([]);
  const [calSelectedDate, setCalSelectedDate] = useState<dayjs.Dayjs>(dayjs());

  const fetchDashboardData = async () => {
    try {
      const notifs = await sharedApi.getNotifications(currentUser.email);
      setNotifications(notifs);

      // Fetch schedule for today's agenda
      const appts = await doctorApi.getDoctorAppointments(currentUser.email);
      const sched = await doctorApi.getDoctorSchedule(currentUser.email);
      const ovrs = await doctorApi.getScheduleOverrides(currentUser.email);
      setAgendaAppointments(appts);
      setAgendaSchedule(sched);
      setAgendaOverrides(ovrs);
    } catch (e) {
      console.error(e);
    }
  };

  const getCurrentAndNextEvents = () => {
    const todayStr = dayjs().format('YYYY-MM-DD');
    const now = dayjs();
    let allEvents: any[] = [];
    
    agendaAppointments.forEach(appt => {
      if (appt.appointment_date === todayStr && appt.status !== 'CANCELLED') {
        allEvents.push({
          type: 'appointment',
          title: `Appt: ${appt.patient_name || appt.patient_email}`,
          start: dayjs(`${todayStr} ${appt.start_time}`),
          end: dayjs(`${todayStr} ${appt.end_time}`)
        });
      }
    });
    
    agendaOverrides.forEach(ovr => {
      if (ovr.date === todayStr) {
        allEvents.push({
          type: 'override',
          title: ovr.reason || 'Blocked',
          start: dayjs(`${todayStr} ${ovr.start_time}`),
          end: dayjs(`${todayStr} ${ovr.end_time}`)
        });
      }
    });
    
    allEvents.sort((a, b) => a.start.valueOf() - b.start.valueOf());
    
    let currentEvent = null;
    let nextEvent = null;
    
    for (const ev of allEvents) {
      if (now.isBetween(ev.start, ev.end, null, '[)')) {
        currentEvent = ev;
      } else if (ev.start.isAfter(now) && !nextEvent) {
        nextEvent = ev;
      }
    }
    
    return { currentEvent, nextEvent };
  };

  const fetchUnreadCounts = async () => {
    try {
      const counts = await chatApi.getUnreadCounts(currentUser.email);
      setUnreadCounts(counts);
    } catch (e) {
      console.error(e);
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
      
      setLocalBio(values.bio || '');
      setLocalClinic(values.clinic_name || '');
      setLocalHours(values.consultation_hours || '');

      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          parsed.bio = values.bio || '';
          parsed.clinic_name = values.clinic_name || '';
          parsed.consultation_hours = values.consultation_hours || '';
          localStorage.setItem('user', JSON.stringify(parsed));
        } catch(e) {}
      }

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

  useEffect(() => {
    if (currentUser) {
      setLocalName(currentUser.name);
      setLocalBio((currentUser as any).bio || '');
      setLocalClinic((currentUser as any).clinic_name || '');
      setLocalHours((currentUser as any).consultation_hours || '');
      settingsForm.setFieldsValue({
        bio: (currentUser as any).bio || '',
        clinic_name: (currentUser as any).clinic_name || '',
        consultation_hours: (currentUser as any).consultation_hours || ''
      });
    }
  }, [currentUser, settingsForm]);

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
    fetchDashboardData();
    fetchPatients();
    fetchUnreadCounts();
    const interval = setInterval(() => {
      fetchPatients();
      fetchUnreadCounts();
    }, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [currentUser.email]);

  // 30-minute reminder: check every minute if next event starts within 30 min
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const checkReminder = () => {
      const todayStr = dayjs().format('YYYY-MM-DD');
      const now = dayjs();
      const allEvents: { key: string; title: string; start: dayjs.Dayjs }[] = [];

      agendaAppointments.forEach(appt => {
        if (appt.appointment_date === todayStr && appt.status !== 'CANCELLED') {
          allEvents.push({
            key: `appt-${appt.id || appt.start_time}`,
            title: `Appointment: ${appt.patient_name || appt.patient_email}`,
            start: dayjs(`${todayStr} ${appt.start_time}`)
          });
        }
      });
      agendaOverrides.forEach(ovr => {
        if (ovr.date === todayStr) {
          allEvents.push({
            key: `blk-${ovr.id || ovr.start_time}`,
            title: `${ovr.reason || 'Blocked'} (Blocked)`,
            start: dayjs(`${todayStr} ${ovr.start_time}`)
          });
        }
      });

      allEvents.forEach(ev => {
        const minutesUntil = ev.start.diff(now, 'minute');
        if (minutesUntil > 0 && minutesUntil <= 30 && !notifiedRef.current.has(ev.key)) {
          notifiedRef.current.add(ev.key);
          notification.info({
            message: 'Upcoming Activity',
            description: `"${ev.title}" starts at ${ev.start.format('HH:mm')} (in ${minutesUntil} min)`,
            placement: 'topRight',
            duration: 8,
            icon: <CalendarOutlined style={{ color: '#1677ff' }} />
          });
        }
      });
    };

    checkReminder(); // Run immediately
    const reminderInterval = setInterval(checkReminder, 60000); // Every minute
    return () => clearInterval(reminderInterval);
  }, [agendaAppointments, agendaOverrides]);

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

  const filteredPatients = patients
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.email.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      // Sort patients with unread messages first
      const unreadA = unreadCounts[a.id] || 0;
      const unreadB = unreadCounts[b.id] || 0;
      if (unreadA !== unreadB) {
        return unreadB - unreadA;
      }
      return 0; // Otherwise maintain normal order
    });

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
          <div className="flex items-center justify-center h-10 w-10">
            <img src="/logo.png" alt="HealthMove AI Logo" className="h-full w-full object-contain rounded-xl" />
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
          <Space size="small" className="mr-2">
            <Popover 
              placement="bottomRight"
              title="Today's Status"
              content={(() => {
                const { currentEvent, nextEvent } = getCurrentAndNextEvents();
                return (
                  <div className="w-56 space-y-3">
                    <div>
                      <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Now</Text>
                      {currentEvent ? (
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-2 rounded border border-blue-100 dark:border-blue-800">
                          <Text className="font-semibold text-blue-700 dark:text-blue-300 block">{currentEvent.title}</Text>
                          <Text className="text-xs text-blue-600 dark:text-blue-400">Until {currentEvent.end.format('HH:mm')}</Text>
                        </div>
                      ) : (
                        <Text className="text-slate-400 italic">No active events</Text>
                      )}
                    </div>
                    <div>
                      <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Next</Text>
                      {nextEvent ? (
                        <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                          <Text className="font-semibold block">{nextEvent.title}</Text>
                          <Text className="text-xs text-slate-500">Starts at {nextEvent.start.format('HH:mm')}</Text>
                        </div>
                      ) : (
                        <Text className="text-slate-400 italic">No upcoming events today</Text>
                      )}
                    </div>
                  </div>
                );
              })()}
            >
              <Badge count={agendaAppointments.filter(a => a.appointment_date === dayjs().format('YYYY-MM-DD') && a.status !== 'CANCELLED').length} size="small">
                <Button 
                  type="text" 
                  icon={<CalendarOutlined className="text-slate-500" />} 
                  onClick={() => setIsTodayAgendaOpen(true)}
                />
              </Badge>
            </Popover>
          </Space>
          <Divider type="vertical" className={isDarkMode ? 'border-slate-800' : 'border-slate-200'} />
          <Space className="cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors dark:hover:bg-slate-800" onClick={() => setIsSettingsModalOpen(true)}>
            <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}?t=${avatarKey}`} className="bg-blue-100 text-blue-600 font-bold">
              {getInitials(localName)}
            </Avatar>
            <div className="text-left hidden sm:flex sm:flex-col sm:justify-center">
              <Text style={{ display: 'block' }} className="text-xs font-semibold leading-tight">{localName}</Text>
              <Text className="text-[10px] text-slate-400 leading-tight">{currentUser.specialization || "Clinician"}</Text>
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
                {[
                  { key: 'screening', icon: <VideoCameraOutlined />, label: 'Live Detection' },
                  { key: 'history', icon: <HistoryOutlined />, label: 'History' },
                  { key: 'calendar', icon: <AppstoreOutlined />, label: 'Calendar' },
                  { key: 'patients', icon: <UserOutlined />, label: 'Patients', badge: Object.values(unreadCounts).reduce((a, b) => a + b, 0) },
                  { key: 'learn', icon: <FileTextOutlined />, label: 'Learn & FAQs' },
                ].map(item => (
                  <Button
                    key={item.key}
                    type="text"
                    block
                    onClick={() => setActiveNav(item.key)}
                    className={`flex items-center justify-center gap-3 px-3 py-5 rounded-xl transition-all ${
                      activeNav === item.key
                        ? 'text-blue-600 bg-blue-50/50 font-semibold'
                        : isDarkMode
                        ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800'
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50/30'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      {item.icon}
                      <span className="font-semibold text-sm">{item.label}</span>
                      {(item.badge ?? 0) > 0 && <Badge count={item.badge} />}
                    </span>
                  </Button>
                ))}
              </div>

              <div className="px-3 mt-2 space-y-1">
                <div className="px-3 py-1">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scheduling</Text>
                </div>
                <Button 
                  type="text" 
                  block 
                  onClick={() => setActiveNav('schedule')}
                  className={`flex items-center justify-center gap-3 px-3 py-5 rounded-xl transition-all ${
                    activeNav === 'schedule' ? 'text-blue-600 bg-blue-50/50 font-semibold' : isDarkMode ? 'text-slate-400 hover:text-blue-400 hover:bg-slate-800' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50/30'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <CalendarOutlined /> <span className="font-semibold text-sm">Schedule & Bookings</span>
                  </span>
                </Button>
              </div>

              <Divider className="my-0" />
            </div>
          </div>
        </Sider>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-[calc(100vh-64px)] min-w-0">
          
          {/* Fixed Doctor Profile Bar (Always Visible) */}
          <div className="px-6 pt-6 pb-2 z-10 shrink-0">
            <div className="max-w-7xl mx-auto w-full">
              <Card 
                className={`border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                bodyStyle={{ padding: '16px 24px' }}
              >
                <Row justify="space-between" align="middle" gutter={[16, 16]}>
                  <Col>
                    <Space size="middle" align="start">
                      <Avatar size={40} src={`http://localhost:8000/api/profile/picture/${currentUser.id}?t=${avatarKey}`} className="bg-blue-100 text-blue-600 font-bold text-base mt-0.5">
                        {getInitials(localName)}
                      </Avatar>
                      <div className="flex flex-col justify-start">
                        <Title level={5} className={`m-0 font-bold ${isDarkMode ? 'text-white' : ''}`}>Dr. {localName}</Title>
                        <Space split={<Divider type="vertical" className={isDarkMode ? 'border-slate-700' : ''} />} className="text-[11px] text-slate-400 mt-0.5" wrap>
                          <span>License: {currentUser.medical_license || 'Approved'}</span>
                          <span>Specialization: {currentUser.specialization || 'General Practitioner'}</span>
                          <span>Clinic: {localClinic || 'Not assigned'}</span>
                        </Space>
                        <div className="flex items-start gap-1.5 text-[11px] text-slate-400 mt-1.5">
                          <InfoCircleOutlined className="mt-[2px]" /> 
                          <span className="flex-1 leading-tight">{localBio || 'No description provided'}</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[11px] text-slate-400 mt-1">
                          <ClockCircleOutlined className="mt-[2px]" /> 
                          <span className="flex-1 leading-tight break-all">{localHours || 'Consultation hours not set'}</span>
                        </div>
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

          <Content className="px-6 pb-6 pt-4 overflow-y-auto relative flex-1 custom-scrollbar">
            <div className="space-y-6 max-w-7xl mx-auto w-full lg:h-full flex flex-col lg:min-h-0">
              
              {activeNav === 'screening' && (
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
                  dbHistory={doctorDbHistory}
                  fetchHistory={fetchDoctorHistory}
                  uploading={uploading}
                />
              )}

              {activeNav === 'schedule' && (
                <div className="flex-1 min-h-0 overflow-y-auto w-full">
                  <DoctorScheduleTab currentUser={currentUser} isDarkMode={isDarkMode} refreshDashboard={fetchDashboardData} />
                </div>
              )}

              {activeNav === 'history' && (
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#0d1117', borderRadius: 24, padding: '24px 32px' }}>
                  <SessionHistoryTab dbHistory={doctorDbHistory} isDarkMode={true} />
                </div>
              )}

              {activeNav === 'calendar' && (
                <div style={{ overflowX: 'hidden', width: '100%' }}>
                  <Row gutter={[24, 24]}>
                    {/* Left: Month Calendar */}
                    <Col xs={24} lg={14}>
                      <Card
                        className={`rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                        bodyStyle={{ padding: '20px 24px' }}
                        title={
                          <div className="flex items-center justify-between">
                            <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={() => setCalSelectedDate(calSelectedDate.subtract(1, 'month'))} />
                            <Text className={`font-bold text-base ${isDarkMode ? 'text-white' : ''}`}>{calSelectedDate.format('MMMM YYYY')}</Text>
                            <Button type="text" size="small" icon={<ArrowLeftOutlined style={{ transform: 'rotate(180deg)' }} />} onClick={() => setCalSelectedDate(calSelectedDate.add(1, 'month'))} />
                          </div>
                        }
                      >
                        {/* Day-of-week headers */}
                        <div className="grid grid-cols-7 mb-2">
                          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                            <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>
                          ))}
                        </div>
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            // Malaysian public holidays (YYYY-MM-DD)
                            const MY_HOLIDAYS: Record<string, string> = {
                              '2025-01-01': 'New Year\'s Day', '2025-01-29': 'CNY', '2025-01-30': 'CNY',
                              '2025-02-01': 'Federal Territory Day', '2025-02-12': 'Thaipusam',
                              '2025-03-30': 'Nuzul Quran', '2025-03-31': 'Hari Raya Aidilfitri',
                              '2025-04-01': 'Hari Raya Aidilfitri', '2025-05-01': 'Labour Day',
                              '2025-05-12': 'Wesak Day', '2025-06-02': 'Agong\'s Birthday',
                              '2025-06-06': 'Hari Raya Aidiladha', '2025-06-26': 'Awal Muharram',
                              '2025-08-31': 'National Day', '2025-09-04': 'Prophet\'s Birthday',
                              '2025-09-16': 'Malaysia Day', '2025-10-20': 'Deepavali',
                              '2025-12-25': 'Christmas',
                              '2026-01-01': 'New Year\'s Day', '2026-01-28': 'CNY', '2026-01-29': 'CNY',
                              '2026-02-01': 'Federal Territory Day', '2026-02-17': 'Thaipusam',
                              '2026-03-20': 'Hari Raya Aidilfitri', '2026-03-21': 'Hari Raya Aidilfitri',
                              '2026-05-01': 'Labour Day', '2026-05-31': 'Wesak Day',
                              '2026-06-01': 'Agong\'s Birthday', '2026-05-27': 'Hari Raya Aidiladha',
                              '2026-06-16': 'Awal Muharram', '2026-08-31': 'National Day',
                              '2026-09-16': 'Malaysia Day', '2026-10-09': 'Prophet\'s Birthday',
                              '2026-10-28': 'Deepavali', '2026-12-25': 'Christmas',
                              '2027-01-01': 'New Year\'s Day', '2027-02-17': 'CNY', '2027-02-18': 'CNY',
                              '2027-03-09': 'Hari Raya Aidilfitri', '2027-03-10': 'Hari Raya Aidilfitri',
                              '2027-05-01': 'Labour Day', '2027-05-20': 'Wesak Day',
                              '2027-05-17': 'Hari Raya Aidiladha', '2027-06-07': 'Agong\'s Birthday',
                              '2027-06-06': 'Awal Muharram', '2027-08-31': 'National Day',
                              '2027-09-16': 'Malaysia Day', '2027-09-29': 'Prophet\'s Birthday',
                              '2027-11-08': 'Deepavali', '2027-12-25': 'Christmas',
                            };

                            const firstDay = calSelectedDate.startOf('month');
                            const daysInMonth = calSelectedDate.daysInMonth();
                            const startDow = firstDay.day();
                            const calDays: (number | null)[] = Array(startDow).fill(null).concat(
                              Array.from({ length: daysInMonth }, (_, i) => i + 1)
                            );
                            while (calDays.length % 7 !== 0) calDays.push(null);
                            return calDays.map((d, i) => {
                              if (!d) return <div key={i} />;
                              const dateStr = calSelectedDate.date(d).format('YYYY-MM-DD');
                              const hasAppt = agendaAppointments.some(a => a.appointment_date === dateStr && a.status !== 'CANCELLED');
                              const hasBlock = agendaOverrides.some(o => o.date === dateStr);
                              const isTodayCell = dayjs().format('YYYY-MM-DD') === dateStr;
                              const isSelected = calSelectedDate.format('YYYY-MM-DD') === dateStr;
                              const isSunday = calSelectedDate.date(d).day() === 0;
                              const isSaturday = calSelectedDate.date(d).day() === 6;
                              const holiday = MY_HOLIDAYS[dateStr];
                              const isHoliday = !!holiday;

                              let bgColor = 'transparent';
                              if (isSelected) bgColor = '#2563eb';
                              else if (isTodayCell) bgColor = isDarkMode ? 'rgba(37,99,235,0.25)' : '#eff6ff';

                              let textColor = '';
                              if (isSelected) textColor = '#ffffff';
                              else if (isTodayCell) textColor = '#2563eb';
                              else if (isHoliday || isSunday) textColor = '#ef4444';
                              else if (isSaturday) textColor = '#3b82f6';
                              else textColor = isDarkMode ? '#cbd5e1' : '#374151';

                              return (
                                <button
                                  key={i}
                                  onClick={() => setCalSelectedDate(calSelectedDate.date(d))}
                                  title={holiday || ''}
                                  style={{
                                    background: bgColor,
                                    color: textColor,
                                    cursor: 'pointer',
                                    border: isTodayCell && !isSelected ? `1px solid ${isDarkMode ? '#3b82f6' : '#bfdbfe'}` : 'none',
                                    borderRadius: '8px',
                                    padding: '2px 1px 4px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.15s',
                                    minHeight: '40px',
                                    position: 'relative',
                                    width: '100%',
                                  }}
                                >
                                  <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{d}</span>
                                  {holiday && (
                                    <span style={{ fontSize: 7, color: isSelected ? '#fecaca' : '#ef4444', lineHeight: 1.1, textAlign: 'center', maxWidth: 36, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                      {holiday.split(' ')[0]}
                                    </span>
                                  )}
                                  <div style={{ display: 'flex', gap: 2, marginTop: 1, height: 5, alignItems: 'center' }}>
                                    {hasAppt && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : '#3b82f6', display: 'inline-block' }} />}
                                    {hasBlock && <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fca5a5' : '#f87171', display: 'inline-block' }} />}
                                    {isHoliday && !isSelected && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />}
                                  </div>
                                </button>
                              );
                            });
                          })()}
                        </div>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /><Text className="text-xs text-slate-500">Appointment</Text></div>
                          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /><Text className="text-xs text-slate-500">Blocked</Text></div>
                          <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /><Text className="text-xs text-slate-500">Public Holiday</Text></div>
                          <div className="flex items-center gap-1.5"><span className="text-red-500 text-xs font-bold">S</span><Text className="text-xs text-slate-500">= Sun/Holiday</Text></div>
                          <div className="flex items-center gap-1.5"><span className="text-blue-500 text-xs font-bold">S</span><Text className="text-xs text-slate-500">= Sat</Text></div>
                        </div>

                      </Card>
                    </Col>

                    {/* Right: Day detail */}
                    <Col xs={24} lg={10}>
                      <Card
                        className={`rounded-2xl border shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                        bodyStyle={{ padding: '20px 24px' }}
                        title={
                          <div className="flex items-center gap-2">
                            <CalendarOutlined className="text-blue-500" />
                            <Text className={`font-bold ${isDarkMode ? 'text-white' : ''}`}>{calSelectedDate.format('ddd, D MMM YYYY')}</Text>
                          </div>
                        }
                      >
                        {(() => {
                          const todayStr = calSelectedDate.format('YYYY-MM-DD');
                          const dow = calSelectedDate.day();
                          const dayAppts = agendaAppointments.filter(a => a.appointment_date === todayStr && a.status !== 'CANCELLED');
                          const dayBlocks = agendaOverrides.filter(o => o.date === todayStr);
                          const workSched = agendaSchedule.find((s: any) => {
                            if (s.day_of_week !== dow) return false;
                            if (s.effective_start_date && calSelectedDate.isBefore(dayjs(s.effective_start_date), 'day')) return false;
                            if (s.effective_end_date && calSelectedDate.isSameOrAfter(dayjs(s.effective_end_date), 'day')) return false;
                            return true;
                          });

                          if (dayAppts.length === 0 && dayBlocks.length === 0 && !workSched) {
                            return <Empty description="No events on this day" />;
                          }
                          return (
                            <div className="space-y-3">
                              {/* Working hours */}
                              {workSched && (
                                <div className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                  <div>
                                    <Text className="font-semibold text-emerald-700 dark:text-emerald-300 block">Working Hours</Text>
                                    <Text className="text-xs text-emerald-600">{workSched.start_time} – {workSched.end_time}</Text>
                                  </div>
                                </div>
                              )}
                              {/* Blocked times */}
                              {dayBlocks.map((blk: any, i: number) => (
                                <div key={`blk-${i}`} className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl">
                                  <span className="w-2 h-2 rounded-full bg-red-400 mt-1.5 shrink-0" />
                                  <div>
                                    <Text className="font-semibold text-red-700 dark:text-red-300 block">{blk.reason || 'Blocked'}</Text>
                                    <Text className="text-xs text-red-500">{blk.start_time} – {blk.end_time}</Text>
                                  </div>
                                </div>
                              ))}
                              {/* Appointments */}
                              {dayAppts.map((appt: any, i: number) => (
                                <div key={`appt-${i}`} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl">
                                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                  <div>
                                    <Text className="font-semibold text-blue-700 dark:text-blue-300 block">{appt.patient_name || appt.patient_email}</Text>
                                    <Text className="text-xs text-blue-500">{appt.start_time} – {appt.end_time} • {appt.status}</Text>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </Card>
                    </Col>
                  </Row>
                </div>
              )}




              {activeNav === 'learn' && (
                <div className="flex-1 min-h-0 overflow-y-auto max-w-7xl mx-auto w-full">
                  <LearnAndFaqTab isDarkMode={isDarkMode} />
                </div>
              )}

              {activeNav === 'patients' && (
                selectedPatient ? (
                  <>
                    {/* We no longer show the duplicate Patient Profile Bar here */}

                    <Row gutter={[24, 24]} className="flex-1 min-h-0 h-full w-full mx-0">
                      {/* Left Column - Patient Chat */}
                      <Col xs={24} lg={16} className="h-full">
                        <DoctorPatientChat 
                          currentUser={currentUser} 
                          selectedPatient={selectedPatient} 
                          isDarkMode={isDarkMode} 
                          onBack={() => setSelectedPatient(null)}
                        />
                      </Col>

                      {/* Right Column - Appointment Records & Suggestions */}
                      <Col xs={24} lg={8} className="h-full">
                        <Card 
                          title={
                            <Space>
                              <FileTextOutlined className="text-blue-600" />
                              <span className={`font-bold ${isDarkMode ? 'text-white' : ''}`}>Consultation Notes</span>
                            </Space>
                          }
                          className={`h-full flex flex-col border shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                          bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px' }}
                        >
                          <div className="flex-1 flex flex-col space-y-4">
                            <div>
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Diagnosis / Findings</div>
                              <Input.TextArea
                                rows={4}
                                placeholder="Enter clinical observations here..."
                                className={`rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200'}`}
                              />
                            </div>
                            <div className="flex-1 flex flex-col">
                              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Treatment Suggestions</div>
                              <Input.TextArea
                                className={`flex-1 rounded-xl border resize-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200'}`}
                                placeholder="Enter recommendations, exercises, or follow-up instructions..."
                              />
                            </div>
                            <Button 
                              type="primary" 
                              className="bg-blue-600 hover:bg-blue-500 border-0 rounded-xl font-bold h-10 mt-2"
                              onClick={() => message.success('Consultation record saved successfully!')}
                            >
                              Save Appointment Record
                            </Button>
                          </div>
                        </Card>
                      </Col>
                    </Row>
                  </>
                ) : (
                  <div className={`p-6 rounded-2xl border flex flex-col flex-1 min-h-0 lg:h-full ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <div className="flex justify-between items-center mb-6">
                      <Title level={4} className={`m-0 ${isDarkMode ? 'text-white' : ''}`}>Active Patients ({filteredPatients.length})</Title>
                      <Input
                        prefix={<SearchOutlined className="text-slate-400" />}
                        placeholder="Search patients..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-64 rounded-xl ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'}`}
                      />
                    </div>
                    
                    {filteredPatients.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <Empty description={<span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>No patients found</span>} />
                      </div>
                    ) : (
                      <List
                        className="overflow-y-auto pr-2 custom-scrollbar flex-1"
                        itemLayout="horizontal"
                        dataSource={filteredPatients}
                        renderItem={(patient) => {
                          const unread = unreadCounts[patient.id] || 0;
                          return (
                            <List.Item
                              className={`cursor-pointer transition-colors border-b ${isDarkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'}`}
                              style={{ padding: '16px 24px' }}
                              onClick={() => handleSelectPatient(patient)}
                            >
                              <List.Item.Meta
                                avatar={
                                  <Avatar size={40} className="bg-blue-100 text-blue-600 font-bold text-base">
                                    {getInitials(patient.name)}
                                  </Avatar>
                                }
                                title={<span className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{patient.name}</span>}
                                description={<span className="text-xs text-slate-500">ID: #P-{String(patient.id).padStart(4, '0')} • {patient.gender}</span>}
                              />
                              {unread > 0 && (
                                <Badge count={unread} />
                              )}
                            </List.Item>
                          );
                        }}
                      />
                    )}
                  </div>
                )
              )}
            </div>
          </Content>
        </div>
      </Layout>
      <Modal
        title="Doctor Profile Settings"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={null}
        width={700}
      >
        <div className="flex flex-col items-center py-6">
          <Badge
            offset={[-10, 70]}
            count={
              <CloseCircleFilled
                style={{ fontSize: '20px', color: '#ff4d4f', cursor: 'pointer', backgroundColor: 'white', borderRadius: '50%' }}
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
              <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}?t=${avatarKey}`} size={80} className="bg-blue-100 text-blue-600 font-bold text-3xl shadow-md cursor-pointer hover:opacity-80 transition-opacity">
                {getInitials(localName)}
              </Avatar>
            </Upload>
          </Badge>

          <div className="w-full mt-8 text-left">
            <Typography.Title level={5} className="!mb-4">Basic Information</Typography.Title>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm mb-6">
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Name</span>
                <Text
                  editable={{
                    onChange: (newName) => {
                      if (!newName.trim()) return;
                      sharedApi.updateProfileName(currentUser.id, newName).then(() => {
                        message.success("Name updated successfully!");
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
                  className="font-bold text-slate-800 dark:text-white m-0"
                >
                  {localName}
                </Text>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-semibold">Email</span>
                <span className="text-slate-800 dark:text-slate-300">{currentUser.email}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 font-semibold">License</span>
                <span className="text-slate-800 dark:text-slate-300">{currentUser.medical_license || 'Verified'}</span>
              </div>
            </div>

            <Typography.Title level={5} className="!mb-4">Professional Details</Typography.Title>
            <Form
              form={settingsForm}
              layout="vertical"
              onFinish={handleSaveSettings}
              initialValues={{
                bio: localBio,
                clinic_name: localClinic,
                consultation_hours: localHours
              }}
              className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <Form.Item label={<span className="font-semibold text-slate-500">Bio / Description</span>} name="bio">
                <Input.TextArea rows={4} placeholder="Describe your expertise and background..." className="rounded-lg" />
              </Form.Item>
              <Form.Item label={<span className="font-semibold text-slate-500">Clinic Name</span>} name="clinic_name">
                <Input placeholder="E.g., City Health Clinic" className="rounded-lg" />
              </Form.Item>
              <Form.Item label={<span className="font-semibold text-slate-500">Consultation Notes (e.g. Zoom links)</span>} name="consultation_hours">
                <Input.TextArea rows={4} placeholder="E.g. Zoom Link: https://..." className="rounded-lg" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block className="rounded-lg mt-2">Save Details</Button>
            </Form>
          </div>
        </div>
      </Modal>



      <Modal
        title="Today's Agenda"
        open={isTodayAgendaOpen}
        onCancel={() => setIsTodayAgendaOpen(false)}
        footer={null}
        width={500}
      >
        <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          <DailyTimeline
            date={dayjs()}
            appointments={agendaAppointments}
            weeklySchedule={agendaSchedule}
            overrides={agendaOverrides}
            isDarkMode={isDarkMode}
          />
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
