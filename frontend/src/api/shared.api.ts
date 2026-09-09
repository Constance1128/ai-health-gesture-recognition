import { fetchApi } from './config';

export const getNotifications = (email: string) => 
  fetchApi<any[]>(`/api/notifications?email=${encodeURIComponent(email)}`);

export const markAllNotificationsRead = (email: string) =>
  fetchApi<any>('/api/notifications/read-all', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

export const markOneNotificationRead = (notifId: number, email: string) =>
  fetchApi<any>(`/api/notifications/${notifId}/read`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

export const clearNotifications = (email: string) =>
  fetchApi<any>(`/api/notifications/clear?email=${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });

export const uploadProfilePicture = (formData: FormData) => 
  fetchApi<any>('/api/profile/picture', { method: 'POST', body: formData });

export const deleteProfilePicture = (userId: number) => 
  fetchApi<any>(`/api/profile/picture/${userId}`, { method: 'DELETE' });

export const updateProfileName = (userId: number, name: string) =>
  fetchApi<any>('/api/profile/name', { method: 'PUT', body: JSON.stringify({ user_id: userId, name: name }), headers: { 'Content-Type': 'application/json' }});
