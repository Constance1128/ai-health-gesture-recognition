import React, { useState } from 'react';
import { Button, Progress, Tag, Space, Empty, Card, Typography, Modal } from 'antd';
import {
  SettingOutlined, CheckCircleOutlined, WarningOutlined,
  LineChartOutlined, HistoryOutlined
} from '@ant-design/icons';
import { User, ScreenState } from '../types';
import { DiagnosisReport, generateDiagnosis } from '../utils/postureDiagnosis';
import { SkeletalFeed } from './SkeletalFeed';
import { PostureResultsCard } from './PostureResultsCard';
import * as analysisApi from '../api/analysis.api';
import { useScreeningTimers } from '../hooks/useScreeningTimers';
import { useNotifications } from '../contexts/NotificationContext';

interface LiveDetectionPanelProps {
  currentUser: User;
  isDarkMode: boolean;
  activeMode: 'posture' | 'tremor' | 'gait' | 'full';
  setActiveMode?: (mode: 'posture' | 'tremor' | 'gait' | 'full') => void;
  screenState: ScreenState;
  setScreenState: (state: ScreenState) => void;

  // Assessment Data from useAssessmentData
  backendConnected: boolean;
  analysisResult: any;
  setAnalysisResult: (res: any) => void;
  diagnosisReport: any;
  setDiagnosisReport: (res: any) => void;
  dbHistory: any[];
  fetchHistory: () => void;
  uploading: boolean;
}

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

export const LiveDetectionPanel: React.FC<LiveDetectionPanelProps> = ({
  currentUser,
  isDarkMode,
  activeMode,
  setActiveMode,
  screenState,
  setScreenState,
  backendConnected,
  analysisResult,
  setAnalysisResult,
  diagnosisReport,
  setDiagnosisReport,
  dbHistory,
  fetchHistory,
  uploading
}) => {
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [calibrationMode, setCalibrationMode] = useState<'full' | 'half'>('full');
  const [isCalibrationOk, setIsCalibrationOk] = useState<boolean>(false);
  const [calibrationDetail, setCalibrationDetail] = useState<'ok' | 'not_detected' | 'too_far' | 'too_close' | 'moving' | 'outside' | 'loading' | 'side_profile'>('not_detected');
  const [sessionId, setSessionId] = useState<string>(`capture_${Date.now()}`);
  // Ref so the onSnapshotsCollected callback always reads the latest analysisResult
  const analysisResultRef = React.useRef<any>(null);
  React.useEffect(() => {
    analysisResultRef.current = analysisResult;
    // Track the highest tremor_prob seen during this session
    const tp = analysisResult?.metrics?.tremor_prob || 0;
    if (tp > maxSessionTremorProbRef.current) {
      maxSessionTremorProbRef.current = tp;
    }
  }, [analysisResult]);
  // Track the HIGHEST tremor_prob seen from backend DURING this screening session
  // (the final analysisResult may not be the frame with highest tremor)
  const maxSessionTremorProbRef = React.useRef<number>(0);

  // Reset tremor tracker when SCREENING starts
  React.useEffect(() => {
    if (screenState === 'SCREENING') {
      maxSessionTremorProbRef.current = 0; // reset per-session tremor tracker
    }
  }, [screenState]);

  const notificationsCtx = useNotifications();
  const addNotification = notificationsCtx ? notificationsCtx.addNotification : undefined;

  const { prepSeconds, countdownSeconds, screeningSeconds } = useScreeningTimers(
    screenState,
    setScreenState,
    isCalibrationOk
  );

  // Trigger alert when assessment is finished and result is available
  React.useEffect(() => {
    if (screenState === 'FINISHED' && analysisResult && currentUser) {
      const isAbnormal =
        (analysisResult.score !== undefined && analysisResult.score < 70) ||
        (analysisResult.status && analysisResult.status.toLowerCase().includes('abnormal'));

      if (isAbnormal && addNotification) {
        // Prevent duplicate alerts for the same session
        const alertId = `alert_${sessionId || 'fallback'}`;
        if (!localStorage.getItem(alertId)) {
          localStorage.setItem(alertId, 'true');

          addNotification({
            userId: currentUser.id,
            title: 'Abnormal Screening Result Detected',
            message: `Your recent ${analysisResult.mode || 'kinesiology'} assessment requires attention. Status: ${analysisResult.status}`,
            type: 'warning',
            score: analysisResult.score
          });

          Modal.warning({
            title: 'Abnormal Result Detected',
            content: (
              <div>
                <p>The AI has detected an abnormality in your recent screening.</p>
                <p><strong>Status:</strong> {analysisResult.status}</p>
                {analysisResult.score !== undefined && <p><strong>Score:</strong> {Number(analysisResult.score).toFixed(0)}/100</p>}
                <p className="mt-2 text-xs text-slate-500">Please review your results carefully and consult with a professional if necessary.</p>
              </div>
            ),
            okText: 'Review Results',
            okButtonProps: { className: 'bg-emerald-600 border-0' }
          });
        }
      }
    }
  }, [screenState, analysisResult, addNotification, currentUser]);

  const { Text } = Typography;

  return (
    <div className="w-full lg:flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-6 items-start">
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
            // Use ref to avoid stale closure — always use the latest backend result
            const latestAnalysis = analysisResultRef.current;
            // Inject the MAX tremor_prob seen during this session into the analysisResult
            // so generateDiagnosis can use it as a fallback when wrist snapshots are unclear
            const enrichedAnalysis = latestAnalysis ? {
              ...latestAnalysis,
              metrics: {
                ...(latestAnalysis.metrics || {}),
                session_max_tremor_prob: maxSessionTremorProbRef.current,
              }
            } : null;
            console.log('[LiveDetectionPanel] onSnapshotsCollected | snaps:', snaps.length,
              '| maxSessionTremorProb:', maxSessionTremorProbRef.current.toFixed(3),
              '| analysisResult mode:', latestAnalysis?.mode);
            const report = generateDiagnosis(snaps, enrichedAnalysis);
            setDiagnosisReport(report);
            if (sessionId) {
              analysisApi.saveReport(sessionId, report)
                .then(() => fetchHistory())
                .catch(err => {
                  console.error(err);
                });
            }
          }}
          sessionId={sessionId}
        />
      </div>

      {/* Right Column - Scrollable Result & Feedback Column */}
      <div className="w-full lg:w-[45%] lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto space-y-6 pr-2 custom-scrollbar">

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
              <span className="text-[10px] font-bold uppercase tracking-widest block mb-1 opacity-60 text-slate-500">System Instruction</span>
              <span className={`font-semibold text-sm ${calibrationDetail === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {calibrationDetail === 'loading' && "Initializing AI models..."}
                {calibrationDetail === 'ok' && "Calibration successful! Please stand still."}
                {calibrationDetail === 'not_detected' && "Stand in front of the camera so the AI can track you."}
                {calibrationDetail === 'too_far' && "Please walk closer to the camera."}
                {calibrationDetail === 'too_close' && "Step back so your full body is visible."}
                {calibrationDetail === 'outside' && "Align your body centrally within the frame."}
                {calibrationDetail === 'side_profile' && "Please face the camera directly. Do not stand sideways."}
                {calibrationDetail === 'moving' && "Hold perfectly still to complete calibration."}
              </span>
            </div>
          </div>
        )}

        {/* IDLE State: Start Panel */}
        {screenState === 'IDLE' && (
          <div className={`h-auto lg:h-full flex flex-col justify-between p-8 rounded-3xl border relative overflow-hidden group ${isDarkMode ? 'bg-slate-800/80 border-slate-700/50' : 'bg-white border-slate-100 shadow-2xl'}`}>
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
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mb-2 uppercase font-black tracking-widest">Active Instruction</span>
              <span className="font-bold text-sm text-slate-700 dark:text-slate-300 block">
                {activeMode === 'tremor' && "Keep your right hand steady in front of the camera."}
                {activeMode === 'posture' && "Hold your spine straight and slowly tilt your head."}
                {activeMode === 'gait' && "Walk normally towards and away from the camera."}
                {activeMode === 'full' && "Move normally, we are assessing full body kinesiology."}
              </span>
            </div>
          </div>
        )}

        {/* FINISHED State */}
        {screenState === 'FINISHED' && diagnosisReport && (
          <ErrorBoundary>
            <PostureResultsCard
              report={diagnosisReport}
              analysisResult={analysisResult}
              dbHistory={dbHistory as any}
              isDarkMode={isDarkMode}
              onNewScreening={() => {
                setScreenState('IDLE');
                setAnalysisResult(null);
                setDiagnosisReport(null);
                setIsCalibrationOk(false);
                setCalibrationDetail('not_detected');
              }}
            />
          </ErrorBoundary>
        )}

        {/* Fallback Finished */}
        {screenState === 'FINISHED' && !diagnosisReport && analysisResult && (
          <ErrorBoundary>
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
          </ErrorBoundary>
        )}

        {/* Add Assessment Metrics and Recent History in FINISHED State */}
        {screenState === 'FINISHED' && (
          <ErrorBoundary>
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
                        <span className="font-bold text-slate-800">{Number(analysisResult.score || 0).toFixed(0)}/100</span>
                      </div>
                      <Progress percent={Math.round(analysisResult.score || 0)} showInfo={false} strokeColor="#000" strokeWidth={6} />
                    </div>
                    {analysisResult.metrics && Object.keys(analysisResult.metrics).length > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500 font-semibold">Stability Index</span>
                          <span className="font-bold text-slate-800">
                            {((Object.values(analysisResult.metrics) as any[])[0] * 10).toFixed(1)}/10
                          </span>
                        </div>
                        <Progress percent={Math.round((Object.values(analysisResult.metrics) as any[])[0] * 100)} showInfo={false} strokeColor="#000" strokeWidth={6} />
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
                  {dbHistory.slice(0, 3).map((record: any) => (
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
          </ErrorBoundary>
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
            Cancel Assessment
          </Button>
        )}
      </div>
    </div>
  );
};
