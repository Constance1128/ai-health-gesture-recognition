import { fetchApi } from './config';

export const getFaqs = () => 
  fetchApi<any[]>('/content/faqs');

export const createFaq = (data: any) => 
  fetchApi<any>('/content/faqs', { method: 'POST', body: JSON.stringify(data) });

export const deleteFaq = (faqId: number) => 
  fetchApi<any>(`/content/faqs/${faqId}`, { method: 'DELETE' });

export const getArticles = () => 
  fetchApi<any[]>('/content/articles');

export const createArticle = (data: any) => 
  fetchApi<any>('/content/articles', { method: 'POST', body: JSON.stringify(data) });

export const deleteArticle = (articleId: number) => 
  fetchApi<any>(`/content/articles/${articleId}`, { method: 'DELETE' });
