import { fetchApi } from './config';

export const getChatHistory = (email: string, otherUserId: number) => 
  fetchApi<any[]>(`/api/chat/history?email=${encodeURIComponent(email)}&other_user_id=${otherUserId}`);

export const sendMessage = (formData: FormData) => 
  fetchApi<any>('/api/chat/send', { method: 'POST', body: formData });

export const deleteMessage = (data: any) => 
  fetchApi<any>('/api/chat/delete', { method: 'DELETE', body: JSON.stringify(data) });

export const getUnreadCounts = (email: string) => 
  fetchApi<Record<string, number>>(`/api/chat/unread-counts?email=${encodeURIComponent(email)}`);

export const markMessagesRead = (data: any) => 
  fetchApi<any>('/api/chat/mark-read', { method: 'POST', body: JSON.stringify(data) });
