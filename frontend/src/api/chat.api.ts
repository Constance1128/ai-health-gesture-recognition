import { fetchApi } from './config';

export const getChatHistory = (email: string, otherUserId: number) => 
  fetchApi<any[]>(`/api/chat/history?email=${encodeURIComponent(email)}&other_user_id=${otherUserId}`);

export const sendMessage = (formData: FormData) => 
  fetchApi<any>('/api/chat/send', { method: 'POST', body: formData });

export const deleteMessage = (data: { message_id: number; sender_email?: string; email?: string }) => 
  fetchApi<any>('/api/chat/delete', { 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_id: data.message_id,
      email: data.email || data.sender_email,
      sender_email: data.sender_email || data.email
    }) 
  });

export const getUnreadCounts = (email: string) => 
  fetchApi<Record<string, number>>(`/api/chat/unread-counts?email=${encodeURIComponent(email)}`);

export const markMessagesRead = (data: any) => 
  fetchApi<any>('/api/chat/mark-read', { method: 'POST', body: JSON.stringify(data) });
