import React, { useState } from 'react';
import { Layout, Row, Col, Card, Avatar, Typography, Button, Progress, Tag, Space, Divider, Select, Empty, message, Upload, Modal, Radio } from 'antd';
import {
  VideoCameraOutlined, HistoryOutlined, LineChartOutlined,
  CheckCircleOutlined, SettingOutlined, FilePdfOutlined, InfoCircleOutlined,
  WarningOutlined, ReloadOutlined, LogoutOutlined, UploadOutlined, MessageOutlined
} from '@ant-design/icons';
import { User, ScreenState } from '../../types';
import * as sharedApi from '../../api/shared.api';
import { downloadPDFReport } from '../../utils/pdfGenerator';
import { useScreeningTimers } from '../../hooks/useScreeningTimers';
import { useAssessmentData } from '../../hooks/useAssessmentData';
import { SkeletalFeed } from '../SkeletalFeed';
import { PatientDoctorDirectory } from './PatientDoctorDirectory';
import { PostureResultsCard } from '../PostureResultsCard';
import { SessionHistoryTab } from '../SessionHistoryTab';
import { generateDiagnosis, DiagnosisReport } from '../../utils/postureDiagnosis';

const { Header, Sider, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

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
  const [activeTab, setActiveTab] = useState<'screening' | 'history' | 'doctors'>('screening');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeMode, setActiveModeState] = useState<'posture' | 'tremor' | 'gait' | 'full'>(() => {
    const saved = sessionStorage.getItem('dashboard_activeMode');
    return saved ? (saved as any) : 'full';
  });
  const setActiveMode = React.useCallback((mode: 'posture' | 'tremor' | 'gait' | 'full') => {
    sessionStorage.setItem('dashboard_activeMode', mode);
    setActiveModeState(mode);
  }, []);
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [screenState, setScreenStateState] = useState<ScreenState>(() => {
    const saved = sessionStorage.getItem('dashboard_screenState');
    return saved ? (saved as ScreenState) : 'IDLE';
  });
  const setScreenState = React.useCallback((state: ScreenState) => {
    sessionStorage.setItem('dashboard_screenState', state);
    setScreenStateState(state);
  }, []);
  const [calibrationMode, setCalibrationMode] = useState<'full' | 'half'>('full');
  const [isCalibrationOk, setIsCalibrationOk] = useState<boolean>(false);
  const [calibrationDetail, setCalibrationDetail] = useState<'ok' | 'not_detected' | 'too_far' | 'too_close' | 'moving' | 'outside' | 'loading'>('not_detected');
  const [diagnosisReport, setDiagnosisReportState] = useState<DiagnosisReport | null>(() => {
    const saved = sessionStorage.getItem('dashboard_diagnosisReport');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { }
    }
    return null;
  });
  const setDiagnosisReport = React.useCallback((report: DiagnosisReport | null) => {
    if (report) sessionStorage.setItem('dashboard_diagnosisReport', JSON.stringify(report));
    else sessionStorage.removeItem('dashboard_diagnosisReport');
    setDiagnosisReportState(report);
  }, []);
  const [sessionId, setSessionId] = useState<string>(`capture_${Date.now()}`);

  const { prepSeconds, countdownSeconds, screeningSeconds } = useScreeningTimers(
    screenState,
    setScreenState,
    isCalibrationOk
  );

  const {
    backendConnected,
    analysisResult,
    setAnalysisResult,
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
          <Button type="text" icon={<SettingOutlined className="text-slate-400" />} onClick={() => setIsSettingsModalOpen(true)} />
          <Divider type="vertical" className={isDarkMode ? 'border-slate-800' : 'border-slate-200'} />
          <Space className="cursor-pointer hover:bg-slate-100 p-2 rounded-lg transition-colors dark:hover:bg-slate-800" onClick={() => setIsSettingsModalOpen(true)}>
            <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}`} className="bg-blue-100 text-blue-600 font-bold">
              {getInitials(currentUser.name)}
            </Avatar>
            <div className="text-left hidden sm:block">
              <Text style={{ display: 'block' }} className="text-xs font-semibold leading-none">{currentUser.name}</Text>
              <Text className="text-[10px] text-slate-400 leading-none">Patient / General User</Text>
            </div>
          </Space>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={() => {
              clearData();
              handleLogout();
            }}
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
              {/* Navigation Menu */}
              <div className="px-3 space-y-1">
                <Button
                  type="text"
                  block
                  onClick={() => setActiveTab('screening')}
                  className={`text-left flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'screening'
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
                  className={`text-left flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'history'
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
                  className={`text-left flex items-center gap-3 px-3 py-5 rounded-xl transition-all ${activeTab === 'doctors'
                    ? 'text-blue-600 bg-blue-50/50 font-semibold'
                    : 'text-slate-400 hover:text-blue-600'
                    }`}
                >
                  <MessageOutlined /> <span className="text-sm font-semibold">Doctor Directory</span>
                </Button>
              </div>
            </div>
          </div>
        </Sider>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 h-[calc(100vh-64px)] min-w-0">
          {/* Fixed Patient Profile Bar */}
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
                        <Title level={4} className="m-0 font-bold">{currentUser.name}</Title>
                        <Space split={<Divider type="vertical" />} className="text-xs text-slate-400">
                          <span>Patient ID: #P-2026-{String(currentUser.id).padStart(4, '0')}</span>
                          <span>Age: {currentUser.age}</span>
                          <span>Gender: {currentUser.gender}</span>
                        </Space>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Space>
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

          <Content className="px-6 pb-6 pt-4 relative flex-1 flex flex-col min-h-0">
            <div className="max-w-7xl mx-auto w-full h-full flex flex-col min-h-0">

              {/* TAB 1: Live Detection (Webcam + 4 Steps Workflow) */}
              {activeTab === 'screening' && (
                <div className="w-full flex-1 min-h-0 flex flex-col lg:flex-row gap-6 items-start">

                  {/* Left Column - Fixed Camera Card */}
                  <div className="w-full lg:w-[55%] shrink-0">
                    <SkeletalFeed
                      cameraActive={cameraActive}
                      setCameraActive={setCameraActive}
                      screenState={screenState}
                      activeMode={activeMode}
                      currentUser={currentUser}
                      backendConnected={backendConnected}
                      analysisResult={analysisResult}
                      setAnalysisResult={setAnalysisResult}
                      fetchHistory={fetchHistory}
                      uploading={uploading}
                      prepSeconds={prepSeconds}
                      countdownSeconds={countdownSeconds}
                      screeningSeconds={screeningSeconds}
                      isDarkMode={isDarkMode}
                      calibrationMode={calibrationMode}
                      onCalibrationStatusChange={(isOk, detail) => {
                        setIsCalibrationOk(isOk);
                        if (detail) setCalibrationDetail(detail);
                      }}
                      onSnapshotsCollected={(snaps) => {
                        setDiagnosisReport(generateDiagnosis(snaps));
                      }}
                      sessionId={sessionId}
                    />
                  </div>

                  {/* Right Column - Scrollable Result & Feedback Column */}
                  <div className="w-full lg:w-[45%] max-h-[calc(100vh-230px)] overflow-y-auto space-y-6 pr-2 custom-scrollbar">

                    {/* Calibration Feedback Panel */}
                    {(screenState === 'IDLE' || screenState === 'PREPARATION' || screenState === 'COUNTDOWN') && (
                      <div className={`p-6 rounded-3xl backdrop-blur-xl border ${isDarkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white/80 border-slate-100 shadow-xl'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wider flex items-center gap-2">
                            <SettingOutlined className="text-blue-500 animate-spin-slow" />
                            TECHNICAL CALIBRATION
                          </h3>
                          {calibrationDetail === 'ok' ? (
                            <Tag color="success" className="border-0 font-bold px-3 py-1 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">READY</Tag>
                          ) : (
                            <Tag color="warning" className="border-0 font-bold px-3 py-1 rounded-full animate-pulse">ADJUSTING</Tag>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Ambient Light</span>
                            <span className="text-emerald-500 font-semibold text-xs flex items-center gap-1"><CheckCircleOutlined /> Optimal</span>
                          </div>
                          <div className={`p-4 rounded-2xl ${isDarkMode ? 'bg-slate-900/50' : 'bg-slate-50'}`}>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Distance & Pose</span>
                            <span className={`font-semibold text-xs flex items-center gap-1 ${calibrationDetail === 'ok' ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {calibrationDetail === 'ok' ? <CheckCircleOutlined /> : <WarningOutlined />}
                              {calibrationDetail === 'ok' ? 'Perfect Position' : 'Action Required'}
                            </span>
                          </div>
                        </div>

                        <div className={`mt-4 p-4 rounded-2xl border ${calibrationDetail === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                          <Text className="text-[10px] font-bold uppercase tracking-widest block mb-1 opacity-60">System Instruction</Text>
                          <Text className={`font-semibold text-sm ${calibrationDetail === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {calibrationDetail === 'loading' && "Initializing AI models..."}
                            {calibrationDetail === 'ok' && "Calibration successful! Please stand still."}
                            {calibrationDetail === 'not_detected' && "Stand in front of the camera so the AI can track you."}
                            {calibrationDetail === 'too_far' && "Please walk closer to the camera."}
                            {calibrationDetail === 'too_close' && "Step back so your full body is visible."}
                            {calibrationDetail === 'outside' && "Align your body centrally within the frame."}
                            {calibrationDetail === 'moving' && "Hold perfectly still to complete calibration."}
                          </Text>
                        </div>
                      </div>
                    )}

                    {/* IDLE State: Start Panel */}
                    {screenState === 'IDLE' && (
                      <div className={`h-full flex flex-col justify-between p-8 rounded-3xl border relative overflow-hidden group ${isDarkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white border-slate-100 shadow-2xl'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 opacity-50" />

                        <div>
                          <h2 className="text-2xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Start Assessment</h2>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Follow the calibration steps on the left, then begin your AI-guided posture screening.</p>

                          <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 transition-transform hover:scale-105">
                              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-lg shrink-0">📸</div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">Check Camera</h4>
                                <p className="text-[11px] text-slate-500">Ensure the webcam has a clear, well-lit view of your full body.</p>
                              </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 transition-transform hover:scale-105">
                              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 text-lg shrink-0">🎯</div>
                              <div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1">Achieve Calibration</h4>
                                <p className="text-[11px] text-slate-500">Move until the status panel shows a green 'READY' badge.</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-8">
                          <Button
                            type="primary"
                            size="large"
                            onClick={() => {
                              setSessionId(`capture_${Date.now()}`);
                              setScreenState('PREPARATION');
                            }}
                            className="w-full h-16 rounded-2xl text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 border-0 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02]"
                          >
                            START ASSESSMENT
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* ACTIVE SCREENING State */}
                    {screenState === 'SCREENING' && (
                      <div className={`flex flex-col p-8 rounded-3xl border relative overflow-hidden ${isDarkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white border-slate-100 shadow-2xl'}`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500 animate-pulse" />
                        <h2 className="text-xl font-black mb-6 text-emerald-600 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                          Recording in Progress
                        </h2>

                        <div className="text-center py-8">
                          <div className="text-6xl font-black text-slate-800 dark:text-slate-100 mb-2">{screeningSeconds}s</div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Time Remaining</p>
                        </div>

                        <Progress
                          percent={Math.round(((15 - screeningSeconds) / 15) * 100)}
                          status="active"
                          strokeColor={{ '0%': '#10b981', '100%': '#3b82f6' }}
                          strokeWidth={12}
                          className="mb-8"
                        />

                        <div className="mt-auto p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 text-center">
                          <Text className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-2 uppercase font-black tracking-widest">Active Instruction</Text>
                          <Text className="font-bold text-sm text-slate-700 dark:text-slate-300">
                            {activeMode === 'tremor' && "Keep your right hand steady in front of the camera."}
                            {activeMode === 'posture' && "Hold your spine straight and slowly tilt your head."}
                          </Text>
                        </div>
                      </div>
                    )}

                    {/* FINISHED State */}
                    {screenState === 'FINISHED' && diagnosisReport && (
                      <PostureResultsCard
                        report={diagnosisReport}
                        analysisResult={analysisResult}
                        dbHistory={dbHistory}
                        isDarkMode={isDarkMode}
                        onNewScreening={() => {
                          setScreenState('IDLE');
                          setAnalysisResult(null);
                          setDiagnosisReport(null);
                          setIsCalibrationOk(false);
                          setCalibrationDetail('not_detected');
                        }}
                      />
                    )}

                    {/* Fallback Finished */}
                    {screenState === 'FINISHED' && !diagnosisReport && analysisResult && (
                      <div className={`p-8 rounded-3xl border shadow-2xl ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <h2 className="text-2xl font-black text-slate-800 mb-6">Assessment Complete</h2>
                        <div className={`p-6 rounded-2xl mb-6 text-center ${analysisResult?.status === 'Normal' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          <h3 className="text-xl font-bold uppercase tracking-wider">{analysisResult?.status}</h3>
                        </div>
                        <Button
                          block size="large" type="primary"
                          onClick={() => { setScreenState('IDLE'); setAnalysisResult(null); }}
                          className="h-14 rounded-xl text-sm font-bold shadow-lg"
                        >
                          Run New Assessment
                        </Button>
                      </div>
                    )}

                    {/* Add Assessment Metrics and Recent History in FINISHED State */}
                    {screenState === 'FINISHED' && (
                      <>
                        {analysisResult && (
                          <Card
                            title="Assessment Metrics"
                            className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                          >
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="text-slate-500 font-semibold">Movement Score</span>
                                  <span className="font-bold text-slate-800">{(analysisResult.score).toFixed(0)}/100</span>
                                </div>
                                <Progress percent={Math.round(analysisResult.score)} showInfo={false} strokeColor="#000" strokeWidth={6} />
                              </div>
                              {analysisResult.metrics && Object.keys(analysisResult.metrics).length > 0 && (
                                <div>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500 font-semibold">Stability Index</span>
                                    <span className="font-bold text-slate-800">
                                      {(Object.values(analysisResult.metrics)[0] * 10).toFixed(1)}/10
                                    </span>
                                  </div>
                                  <Progress percent={Math.round(Object.values(analysisResult.metrics)[0] * 100)} showInfo={false} strokeColor="#000" strokeWidth={6} />
                                </div>
                              )}
                            </div>
                          </Card>
                        )}

                        <Card
                          title="Recent Assessments"
                          className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                        >
                          <div className="space-y-3">
                            {dbHistory.slice(0, 3).map((record) => (
                              <div key={record.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                                <div>
                                  <span className="font-bold text-xs text-slate-800 block">
                                    {new Date(record.timestamp * 1000).toLocaleDateString()}
                                  </span>
                                  <span className="text-[10px] text-slate-400 uppercase">{record.mode}</span>
                                </div>
                                <Tag color={record.status.toLowerCase().includes('normal') ? 'success' : 'warning'} className="border-0 font-semibold rounded-full text-[10px]">
                                  {record.status}
                                </Tag>
                              </div>
                            ))}
                            {dbHistory.length === 0 && <Empty description="No screening records" />}
                          </div>
                        </Card>
                      </>
                    )}

                    {/* Stop Detection Button (Globally available during recording/prep) */}
                    {(screenState === 'PREPARATION' || screenState === 'COUNTDOWN' || screenState === 'SCREENING') && (
                      <Button
                        type="text"
                        danger
                        className="w-full mt-4 font-bold tracking-widest text-xs uppercase hover:bg-red-50"
                        onClick={() => {
                          setScreenState('IDLE');
                          setAnalysisResult(null);
                          setIsCalibrationOk(false);
                          setCalibrationDetail('not_detected');
                        }}
                      >
                        Abort Detection
                      </Button>
                    )}
                  </div>

                </div>
              )}

              {/* TAB 2: Health History & Trends (Figure 4.23) */}
              {activeTab === 'history' && (
                <div className="flex-1 min-h-0 overflow-y-auto" style={{ background: '#0d1117', borderRadius: 24, padding: '24px 32px' }}>
                  <SessionHistoryTab dbHistory={dbHistory} isDarkMode={isDarkMode} />
                </div>
              )}



              {/* TAB 3: Doctor Directory & Chat */}
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
          <Avatar src={`http://localhost:8000/api/profile/picture/${currentUser.id}`} size={100} className="mb-4 bg-blue-100 text-blue-600 font-bold text-3xl">
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
            <Button size="middle" icon={<UploadOutlined />}>Upload Profile Picture</Button>
          </Upload>
        </div>
      </Modal>
    </Layout>
  );
};
