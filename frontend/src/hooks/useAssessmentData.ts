import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { User, DBHistoryRecord, AnalysisResult, ScreenState } from '../types';
import * as analysisApi from '../api/analysis.api';

export function useAssessmentData(
  currentUser: User | null,
  activeMode: string,
  setScreenState: (state: ScreenState) => void
) {
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [analysisResult, setAnalysisResultState] = useState<AnalysisResult | null>(() => {
    const saved = sessionStorage.getItem('dashboard_analysisResult');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return null;
  });
  const setAnalysisResult = useCallback((result: AnalysisResult | null) => {
    if (result) sessionStorage.setItem('dashboard_analysisResult', JSON.stringify(result));
    else sessionStorage.removeItem('dashboard_analysisResult');
    setAnalysisResultState(result);
  }, []);
  const [dbHistory, setDbHistory] = useState<DBHistoryRecord[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);

  const fetchHistory = async () => {
    try {
      if (currentUser?.email) {
        const data = await analysisApi.getScreeningHistory(currentUser.email);
        setDbHistory(data);
      }
    } catch (err: any) {
      console.error("Error fetching database history:", err);
      message.error("Failed to load history: " + err.message);
    }
  };

  const checkBackendAndHistory = async () => {
    const isConnected = await analysisApi.checkBackendStatus();
    setBackendConnected(isConnected);
    if (isConnected && currentUser?.email) {
      fetchHistory();
    }
  };

  useEffect(() => {
    checkBackendAndHistory();
    const interval = setInterval(checkBackendAndHistory, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleVideoUpload = async (info: any) => {
    const file = info.file;
    if (!file) return;

    setUploading(true);
    setScreenState('IDLE');
    setAnalysisResult(null);

    const formData = new FormData();
    formData.append('mode', activeMode);
    formData.append('file', file);
    if (currentUser?.email) {
      formData.append('user_email', currentUser.email);
    }

    try {
      const data = await analysisApi.uploadVideo(formData);
      setAnalysisResult(data);
      setScreenState('FINISHED');
      fetchHistory();
      message.success("Video processed successfully!");
    } catch (err: any) {
      console.error(err);
      message.error(err.message || "Failed to process video");
      setScreenState('IDLE');
    } finally {
      setUploading(false);
    }
  };

  const clearData = () => {
    setDbHistory([]);
    setAnalysisResult(null);
  };

  return {
    backendConnected,
    analysisResult,
    setAnalysisResult,
    dbHistory,
    uploading,
    fetchHistory,
    handleVideoUpload,
    clearData
  };
}
