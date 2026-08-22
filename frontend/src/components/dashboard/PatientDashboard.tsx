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
  const [activeMode, setActiveMode] = useState<'posture' | 'tremor' | 'gait' | 'full'>('full');
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [screenState, setScreenState] = useState<ScreenState>('IDLE');
  const [calibrationMode, setCalibrationMode] = useState<'full' | 'half'>('full');
  const [isCalibrationOk, setIsCalibrationOk] = useState<boolean>(false);
  const [calibrationDetail, setCalibrationDetail] = useState<'ok' | 'not_detected' | 'too_far' | 'too_close' | 'moving' | 'outside' | 'loading'>('not_detected');
  const [diagnosisReport, setDiagnosisReport] = useState<DiagnosisReport | null>(null);

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
        <Content className="p-6 overflow-y-auto h-[calc(100vh-64px)]">
          <div className="space-y-6 max-w-7xl mx-auto">

            {/* Patient Profile Bar */}
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

            {/* TAB 1: Live Detection (Webcam + 4 Steps Workflow) */}
            {activeTab === 'screening' && (
              <Row gutter={[24, 24]}>

                {/* Left Column - Webcam Feed / Step Visuals */}
                <Col xs={24} lg={14} className="space-y-6">

                  {/* Step 1: Onboarding View */}
                  {screenState === 'IDLE' && (
                    <Card
                      title={
                        <Space>
                          <InfoCircleOutlined className="text-blue-600" />
                          <span className="font-bold">GETTING READY FOR YOUR TEST</span>
                        </Space>
                      }
                      className={`border border-slate-100 shadow-lg rounded-3xl text-center py-8 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                    >
                      <div className="max-w-md mx-auto space-y-6">

                        {/* Visual Pose Guide */}
                        <div className={`flex flex-col items-center mb-6 p-6 rounded-3xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                          <Text className="text-sm font-bold text-slate-500 mb-4 tracking-widest">EXPECTED POSE</Text>
                          <svg width="150" height="200" viewBox="0 0 100 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-lg">
                            <circle cx="50" cy="30" r="15" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <rect x="35" y="50" width="30" height="60" rx="10" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <rect x="15" y="55" width="12" height="50" rx="6" transform="rotate(20 21 55)" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <rect x="73" y="55" width="12" height="50" rx="6" transform="rotate(-20 79 55)" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <rect x="37" y="115" width="12" height="60" rx="6" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <rect x="51" y="115" width="12" height="60" rx="6" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            <rect x="10" y="80" width="80" height="4" rx="2" fill="#3b82f6" className="animate-pulse shadow-blue-500 shadow-lg" />
                          </svg>
                          <Text className="text-xs text-slate-400 mt-4 text-center">Stand still facing the camera. Keep your arms slightly away from your body.</Text>
                        </div>

                        <div className="space-y-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 text-left">
                            <span className="text-2xl">💡</span>
                            <div>
                              <Text className="text-xs font-bold text-slate-800 block">1. WELL-LIT ENVIRONMENT</Text>
                              <Text className="text-[11px] text-slate-400">Ensure the room has sufficient lighting so the AI can detect joints.</Text>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 text-left">
                            <span className="text-2xl">📏</span>
                            <div>
                              <Text className="text-xs font-bold text-slate-800 block">2. 2-METER CLEAR WALKING PATH</Text>
                              <Text className="text-[11px] text-slate-400">Maintain a distance of 2 meters from the camera for full body visibility.</Text>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 text-left">
                            <span className="text-2xl">📷</span>
                            <div>
                              <Text className="text-xs font-bold text-slate-800 block">3. WEBCAM AT WAIST/CHEST HEIGHT</Text>
                              <Text className="text-[11px] text-slate-400">Position the webcam correctly, viewed directly from the front.</Text>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 text-left">
                          <Text className="text-xs font-bold text-slate-800 block mb-2 text-emerald-600 text-center">✓ FULL BODY CALIBRATION ACTIVE</Text>
                        </div>

                        <Button
                          type="primary"
                          size="large"
                          onClick={() => setScreenState('PREPARATION')}
                          className="bg-blue-600 hover:bg-blue-500 border-0 rounded-xl px-12 py-6 h-auto text-sm font-bold shadow-lg shadow-blue-500/20 mt-4"
                        >
                          Start Calibration
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Step 2 & 3: Live Camera Feed & Calibration / Screening */}
                  {(screenState === 'PREPARATION' || screenState === 'COUNTDOWN' || screenState === 'SCREENING') && (
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
                    />
                  )}

                  {/* Stop Detection Button */}
                  {(screenState !== 'IDLE' && screenState !== 'FINISHED') && (
                    <Button
                      danger
                      type="primary"
                      size="large"
                      className="w-full mt-4 h-12 rounded-xl font-bold shadow-lg shadow-red-500/20"
                      onClick={() => {
                        setScreenState('IDLE');
                        setAnalysisResult(null);
                        setIsCalibrationOk(false);
                        setCalibrationDetail('not_detected');
                      }}
                    >
                      Stop Detection
                    </Button>
                  )}

                  {/* Step 4: AI Posture Diagnostic Results */}
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
                  {/* Fallback if no diagnosis (e.g. video upload result) */}
                  {screenState === 'FINISHED' && !diagnosisReport && analysisResult && (
                    <Card
                      title={
                        <Space className="w-full justify-between">
                          <span className="font-bold">Screening Summary</span>
                          <Tag color="success" className="rounded-full border-0 font-semibold px-2.5">Finished</Tag>
                        </Space>
                      }
                      className={`border border-slate-100 shadow-lg rounded-3xl py-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                    >
                      <div className="space-y-4">
                        <div className={`p-4 border rounded-2xl text-center ${analysisResult?.status === 'Normal' ? 'bg-green-50 border-green-200/50' : 'bg-red-50 border-red-200/50'}`}>
                          <Typography.Title level={4} className={`m-0 font-bold flex items-center justify-center gap-2 ${analysisResult?.status === 'Normal' ? 'text-green-600' : 'text-red-600'}`}>
                            {analysisResult?.status === 'Normal' ? <CheckCircleOutlined /> : <WarningOutlined />} {analysisResult?.status ? analysisResult.status.toUpperCase() : 'RESULTS AVAILABLE'}
                          </Typography.Title>
                        </div>
                        <Typography.Paragraph className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                          {analysisResult?.recommendation || 'Please provide the generated technical report to your physician.'}
                        </Typography.Paragraph>
                        <Button block icon={<ReloadOutlined />} onClick={() => { setScreenState('IDLE'); setAnalysisResult(null); }}>
                          Start New Screening
                        </Button>
                      </div>
                    </Card>
                  )}


                </Col>

                {/* Right Column - Status & Live Instructions */}
                <Col xs={24} lg={10} className="space-y-6">

                  {/* Step 2: Calibration Feedback Panel */}
                  {screenState === 'PREPARATION' && (
                    <Card
                      title="Technical Calibration"
                      className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                    >
                      <div className="space-y-4 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">Ambient Lighting</span>
                          <Tag color="success" className="border-0 font-semibold rounded-full">STATUS: [ OK ]</Tag>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 font-semibold">User Distance</span>
                          {calibrationDetail === 'loading' && (
                            <Tag color="default" className="border-0 font-semibold rounded-full animate-pulse">STATUS: [ INITIALIZING AI... ]</Tag>
                          )}
                          {calibrationDetail === 'ok' && (
                            <Tag color="success" className="border-0 font-semibold rounded-full">STATUS: [ OK ]</Tag>
                          )}
                          {calibrationDetail === 'not_detected' && (
                            <Tag color="warning" className="border-0 font-semibold rounded-full animate-pulse">STATUS: [ NO USER DETECTED ]</Tag>
                          )}
                          {calibrationDetail === 'too_far' && (
                            <Tag color="error" className="border-0 font-semibold rounded-full animate-pulse">STATUS: [ TOO FAR ]</Tag>
                          )}
                          {calibrationDetail === 'too_close' && (
                            <Tag color="error" className="border-0 font-semibold rounded-full animate-pulse">STATUS: [ TOO CLOSE ]</Tag>
                          )}
                          {calibrationDetail === 'outside' && (
                            <Tag color="error" className="border-0 font-semibold rounded-full animate-pulse">STATUS: [ OUT OF BOUNDS ]</Tag>
                          )}
                          {calibrationDetail === 'moving' && (
                            <Tag color="processing" className="border-0 font-semibold rounded-full animate-pulse">STATUS: [ KEEP STILL ]</Tag>
                          )}
                        </div>
                        <Divider className="my-2" />
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <Text className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Calibration Instruction:</Text>
                          <Text className="font-semibold text-slate-700">
                            {calibrationDetail === 'loading' && "Initializing local AI pose estimation models. Please wait..."}
                            {calibrationDetail === 'ok' && "Calibration successful! Please stand still. Commencing test shortly..."}
                            {calibrationDetail === 'not_detected' && "Please stand in front of the camera so the AI can track you."}
                            {calibrationDetail === 'too_far' && "Please walk closer to the camera."}
                            {calibrationDetail === 'too_close' && "Please step back from the camera so your full body is visible."}
                            {calibrationDetail === 'outside' && "Please align your body centrally within the blue dashed box."}
                            {calibrationDetail === 'moving' && "Hold perfectly still to complete the calibration process."}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Step 3: Active Screening HUD */}
                  {screenState === 'SCREENING' && (
                    <Card
                      title="Screening In Progress"
                      className={`border border-slate-100 shadow-sm rounded-2xl ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}
                    >
                      <div className="space-y-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Typography.Text className="text-xs text-slate-400 block mb-1">Time Remaining</Typography.Text>
                          <Typography.Text className="text-xs font-bold" style={{ color: '#10b981' }}>{screeningSeconds}s</Typography.Text>
                        </div>
                        <Progress
                          percent={Math.round(((15 - screeningSeconds) / 15) * 100)}
                          status="active"
                          strokeColor="#10b981"
                        />
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                          <Text className="text-[10px] text-slate-400 block mb-1 uppercase font-bold">Screening Instruction:</Text>
                          <Text className="font-semibold text-slate-700">
                            {activeMode === 'tremor' && "Keep your right hand steady in front of the camera for 60 seconds."}
                            {activeMode === 'posture' && "Hold your spine straight and slowly tilt your head."}
                            {activeMode === 'exercise' && "Perform the physical therapy repetitions slowly and steadily."}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  )}

                  {/* Right column: show Recent Assessments only in IDLE */}
                  {screenState === 'IDLE' && (
                    <>
                      {/* Health Insights (from backend analysis) */}
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

                      {/* Recent History Table */}
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

                </Col>

              </Row>
            )}

            {/* TAB 2: Health History & Trends (Figure 4.23) */}
            {activeTab === 'history' && (
              <div style={{ background: '#0d1117', borderRadius: 16, padding: '20px 24px', minHeight: 400 }}>
                <SessionHistoryTab dbHistory={dbHistory} isDarkMode={isDarkMode} />
              </div>
            )}

            {/* Bottom Action Bar (Only shown in Live Detection) */}
            {activeTab === 'screening' && (
              <div className={`p-4 rounded-2xl border border-slate-100 flex flex-wrap justify-between items-center gap-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white'}`}>
                <Space>
                  <Button
                    type="primary"
                    icon={<FilePdfOutlined />}
                    disabled={dbHistory.length === 0}
                    onClick={() => downloadPDFReport(analysisResult, dbHistory)}
                    className="bg-slate-950 hover:bg-slate-900 border-0 rounded-xl font-semibold text-xs px-6 py-4 flex items-center h-auto"
                  >
                    Export PDF Report
                  </Button>
                  <Button icon={<LineChartOutlined />} className="rounded-xl text-xs font-semibold py-4 flex items-center h-auto">
                    View Diagnostics
                  </Button>
                </Space>
                <Button type="text" icon={<SettingOutlined className="text-slate-400 text-lg" />} />
              </div>
            )}

            {/* TAB 3: Doctor Directory & Chat */}
            {activeTab === 'doctors' && (
              <PatientDoctorDirectory currentUser={currentUser} isDarkMode={isDarkMode} />
            )}

          </div>
        </Content>
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
