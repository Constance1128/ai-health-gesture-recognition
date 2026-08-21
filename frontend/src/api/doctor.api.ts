import { fetchApi } from './config';

export const getDoctorPatients = (email: string) => 
  fetchApi<any[]>(`/api/doctor/patients?email=${encodeURIComponent(email)}`);

export const getPatientHistory = (doctorEmail: string, patientEmail: string) => 
  fetchApi<any[]>(`/api/doctor/patient-history?email=${encodeURIComponent(doctorEmail)}&patient_email=${encodeURIComponent(patientEmail)}`);

export const getDoctorAppointments = (email: string) => 
  fetchApi<any[]>(`/api/doctor/appointments?email=${encodeURIComponent(email)}`);

export const updateAppointmentStatus = (data: any) => 
  fetchApi<any>('/api/doctor/appointment/status', { method: 'POST', body: JSON.stringify(data) });

export const getScheduleOverrides = (email: string) => 
  fetchApi<any[]>(`/api/doctor/schedule/overrides?email=${encodeURIComponent(email)}`);

export const addScheduleOverride = (data: any) => 
  fetchApi<any>('/api/doctor/schedule/override', { method: 'POST', body: JSON.stringify(data) });

export const deleteScheduleOverride = (email: string, overrideId: number) => 
  fetchApi<any>(`/api/doctor/schedule/override?email=${encodeURIComponent(email)}&override_id=${overrideId}`, { method: 'DELETE' });

export const updateDoctorProfile = (data: any) => 
  fetchApi<any>('/api/doctor/profile', { method: 'PUT', body: JSON.stringify(data) });
