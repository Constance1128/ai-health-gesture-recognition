import { fetchApi } from './config';

export const getNotifications = (email: string) => 
  fetchApi<any[]>(`/api/notifications?email=${encodeURIComponent(email)}`);

export const uploadProfilePicture = (formData: FormData) => 
  fetchApi<any>('/api/profile/picture', { method: 'POST', body: formData });
