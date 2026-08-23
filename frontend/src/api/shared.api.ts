import { fetchApi } from './config';

export const getNotifications = (email: string) => 
  fetchApi<any[]>(`/api/notifications?email=${encodeURIComponent(email)}`);

export const uploadProfilePicture = (formData: FormData) => 
  fetchApi<any>('/api/profile/picture', { method: 'POST', body: formData });

export const deleteProfilePicture = (userId: number) => 
  fetchApi<any>(`/api/profile/picture/${userId}`, { method: 'DELETE' });

export const updateProfileName = (userId: number, name: string) =>
  fetchApi<any>('/api/profile/name', { method: 'PUT', body: JSON.stringify({ user_id: userId, name: name }), headers: { 'Content-Type': 'application/json' }});
