export interface User {
  id: number;
  name: string;
  gender: string;
  age: number;
  birthday: string;
  email: string;
  role?: 'general user' | 'professional' | 'admin';
  is_verified?: number;
  specialization?: string;
  medical_license?: string;
  verification_document?: string;
  bio?: string;
  clinic_name?: string;
  consultation_hours?: string;
}

export interface JointPoint {
  name: string;
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface AnalysisResult {
  mode: string;
  status: string;
  score: number;
  recommendation: string;
  prediction?: string;
  explanation?: string;
  landmarks: JointPoint[];
  metrics: Record<string, number>;
  timestamp: number;
  is_fallback?: boolean;
}

export interface DBHistoryRecord {
  id: number;
  session_id: string;
  timestamp: number;
  mode: string;
  status: string;
  metric_1: { name: string; value: number };
  metric_2: { name: string; value: number };
  recommendation: string;
  video_path?: string;
}

export interface LogEntry {
  time: string;
  type: 'info' | 'warning' | 'success';
  message: string;
}

export type ScreenState = 'IDLE' | 'INSTRUCTION' | 'PREPARATION' | 'COUNTDOWN' | 'SCREENING' | 'FINISHED';

export interface ActiveScreeningHUDProps {
  screenState: ScreenState;
  prepSeconds: number;
  countdownSeconds: number;
  screeningSeconds: number;
  isDarkMode: boolean;
}

export interface DashboardHeaderProps {
  currentUser: User | null;
  handleLogout: () => void;
  handleChangePassword?: (values: any) => Promise<boolean>;
  isDarkMode: boolean;
  setIsDarkMode: (checked: boolean) => void;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string | null;
  file_name: string | null;
  file_type: string | null;
  timestamp: number;
  is_deleted: number;
}

export interface Doctor extends User {
  is_online?: number;
  has_permission?: boolean;
}

export interface Patient extends User {
  latest_status?: string;
  latest_timestamp?: number;
  latest_mode?: string;
  is_online?: number;
}

export interface Appointment {
  id: number;
  doctor_id: number;
  patient_id: number;
  doctor_name?: string;
  doctor_email?: string;
  patient_name?: string;
  patient_email?: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
  timestamp: number;
}

// Component Props Interfaces
export interface SkeletalFeedProps {
  cameraActive: boolean;
  setCameraActive: (active: boolean) => void;
  screenState: ScreenState;
  activeMode: string;
  currentUser: User | null;
  backendConnected: boolean;
  analysisResult: AnalysisResult | null;
  setAnalysisResult: (res: AnalysisResult | null) => void;
  fetchHistory: (email?: string) => void;
  uploading: boolean;
  prepSeconds: number;
  countdownSeconds: number;
  screeningSeconds: number;
  isDarkMode: boolean;
  calibrationMode?: 'full' | 'half';
  onCalibrationStatusChange?: (isOk: boolean, detail?: 'ok' | 'not_detected' | 'too_far' | 'too_close' | 'moving' | 'outside' | 'loading') => void;
  sessionId?: string;
}

export interface InstructionGuideProps {
  activeMode: string;
  setScreenState: (state: ScreenState) => void;
  isDarkMode: boolean;
}

export interface HistoryLogsProps {
  dbHistory: DBHistoryRecord[];
  isDarkMode: boolean;
}

export interface HealthInsightsProps {
  analysisResult: AnalysisResult | null;
  isDarkMode: boolean;
}

export interface PendingVerificationProps {
  onLogout: () => void;
  isDarkMode: boolean;
}

export interface PatientDoctorDirectoryProps {
  currentUser: User;
  isDarkMode: boolean;
}

export interface PatientDashboardProps {
  currentUser: User;
  handleLogout: () => void;
  handleChangePassword: (values: any) => Promise<boolean | void>;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export interface DoctorPatientChatProps {
  currentUser: User;
  selectedPatient: User;
  isDarkMode: boolean;
  onClose: () => void;
}

export interface DoctorDashboardProps {
  currentUser: User;
  handleLogout: () => void;
  handleChangePassword: (values: any) => Promise<boolean | void>;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export interface AdminDashboardProps {
  currentUser: User;
  handleLogout: () => void;
  handleChangePassword: (values: any) => Promise<boolean | void>;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
}

export interface AuthCardProps {
  children: React.ReactNode;
  isDarkMode: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export interface ResetPasswordViewProps {
  isDarkMode: boolean;
  setAuthView: (view: 'login' | 'register' | 'register_professional' | 'forgot_password' | 'reset_password') => void;
  handleResetPassword: (values: any) => Promise<boolean | void>;
}

export interface RegisterProfessionalViewProps {
  isDarkMode: boolean;
  setAuthView: (view: 'login' | 'register' | 'register_professional' | 'forgot_password' | 'reset_password') => void;
  handleRegisterProfessional: (formData: FormData) => Promise<boolean | void>;
}

export interface RegisterPatientViewProps {
  isDarkMode: boolean;
  setAuthView: (view: 'login' | 'register' | 'register_professional' | 'forgot_password' | 'reset_password') => void;
  handleRegister: (values: any) => Promise<boolean | void>;
}

export interface LoginViewProps {
  isDarkMode: boolean;
  setAuthView: (view: 'login' | 'register' | 'register_professional' | 'forgot_password' | 'reset_password') => void;
  handleLogin: (values: any) => Promise<boolean | void>;
}

export interface ForgotPasswordViewProps {
  isDarkMode: boolean;
  setAuthView: (view: 'login' | 'register' | 'register_professional' | 'forgot_password' | 'reset_password') => void;
  handleForgotPassword: (values: any) => Promise<boolean | void>;
}

export interface AssessmentControllerProps {
  activeMode: string;
  setActiveMode: (mode: string) => void;
  cameraActive: boolean;
  setCameraActive: (active: boolean) => void;
  screenState: ScreenState;
  setScreenState: (state: ScreenState) => void;
  isDarkMode: boolean;
  analysisResult: AnalysisResult | null;
  dbHistory: DBHistoryRecord[];
  uploading: boolean;
  handleVideoUpload: (info: any) => void;
  clearData: () => void;
  backendConnected: boolean;
}
