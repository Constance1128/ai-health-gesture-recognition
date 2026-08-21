import { fetchApi } from './config';

export const login = (data: any) => fetchApi<any>('/api/login', { method: 'POST', body: JSON.stringify(data) });
export const registerPatient = (data: any) => fetchApi<any>('/api/register', { method: 'POST', body: JSON.stringify(data) });
export const registerProfessional = (formData: FormData) => fetchApi<any>('/api/register-doctor', { method: 'POST', body: formData });
export const forgotPassword = (data: any) => fetchApi<any>('/api/forgot-password', { method: 'POST', body: JSON.stringify(data) });
export const resetPassword = (data: any) => fetchApi<any>('/api/reset-password', { method: 'POST', body: JSON.stringify(data) });
export const changePassword = (data: any) => fetchApi<any>('/api/change-password', { method: 'POST', body: JSON.stringify(data) });
