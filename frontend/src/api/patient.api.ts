import { fetchApi } from './config';

export const getDoctorsDirectory = (email: string) => 
  fetchApi<any[]>(`/api/patient/doctors?email=${encodeURIComponent(email)}`);

export const getPatientAppointments = (email: string) => 
  fetchApi<any[]>(`/api/patient/appointments?email=${encodeURIComponent(email)}`);

export const bookAppointment = (data: any) => 
  fetchApi<any>('/api/patient/book', { method: 'POST', body: JSON.stringify(data) });

export const toggleDoctorPermission = (data: any) => 
  fetchApi<any>('/api/patient/toggle-permission', { method: 'POST', body: JSON.stringify(data) });

export const cancelAppointment = (data: { email: string; appointment_id: number; reason?: string }) =>
  fetchApi<any>('/api/patient/appointment/cancel', { method: 'POST', body: JSON.stringify(data) });

export const getPatientConsultationNotes = (email: string, doctorId?: number) => {
  const url = doctorId
    ? `/api/patient/consultation-notes?email=${encodeURIComponent(email)}&doctor_id=${doctorId}`
    : `/api/patient/consultation-notes?email=${encodeURIComponent(email)}`;
  return fetchApi<any[]>(url);
};


