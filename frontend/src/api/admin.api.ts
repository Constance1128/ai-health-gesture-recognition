import { fetchApi } from './config';

export const getAllUsers = (email: string) => 
  fetchApi<any[]>(`/api/admin/users?email=${encodeURIComponent(email)}`);

export const verifyDoctor = (data: any) => 
  fetchApi<any>('/api/admin/verify-doctor', { method: 'POST', body: JSON.stringify(data) });

export const getAuditLogs = (email: string) =>
  fetchApi<any[]>(`/api/admin/audit-logs?email=${encodeURIComponent(email)}`);
