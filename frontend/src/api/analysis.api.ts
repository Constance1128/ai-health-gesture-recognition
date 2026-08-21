import { fetchApi, BACKEND_URL } from './config';

export const analyzeFrame = (data: any) => 
  fetchApi<any>('/api/analyze_frame', { method: 'POST', body: JSON.stringify(data) });

export const uploadVideo = (formData: FormData) => 
  fetchApi<any>('/api/upload_video', { method: 'POST', body: formData });

export const getScreeningHistory = (email: string) => 
  fetchApi<any[]>(`/api/history?email=${encodeURIComponent(email)}`);

export const checkBackendStatus = async () => {
  try {
    const response = await fetch(`${BACKEND_URL}/`);
    return response.ok;
  } catch {
    return false;
  }
};
