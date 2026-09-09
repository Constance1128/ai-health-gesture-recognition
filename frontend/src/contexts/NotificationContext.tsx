import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { notification as antdNotification } from 'antd';
import { BellOutlined, CalendarOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { AINotification } from '../types';
import * as sharedApi from '../api/shared.api';

interface NotificationContextProps {
  notifications: AINotification[];
  addNotification: (notification: Omit<AINotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAllAsRead: () => Promise<void>;
  markOneAsRead: (id: string | number) => Promise<void>;
  clearAll: () => Promise<void>;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider: React.FC<{ 
  children: React.ReactNode; 
  userId?: number; 
  userEmail?: string; 
  user?: { id: number; email: string; name?: string } | null;
}> = ({ children, userId, userEmail, user }) => {
  const [notifications, setNotifications] = useState<AINotification[]>([]);
  const effectiveUserId = user?.id || userId;
  const effectiveUserEmail = user?.email || userEmail;
  const seenNotificationIdsRef = useRef<Set<string | number>>(new Set());
  const initialLoadRef = useRef(true);

  // Poll backend notifications
  useEffect(() => {
    if (!effectiveUserEmail) return;

    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const backendNotifs = await sharedApi.getNotifications(effectiveUserEmail);
        if (!isMounted || !Array.isArray(backendNotifs)) return;

        const formattedBackend: AINotification[] = backendNotifs.map(n => ({
          id: n.id,
          title: n.title || 'System Notification',
          message: n.message || '',
          timestamp: n.timestamp ? (n.timestamp > 10000000000 ? n.timestamp : n.timestamp * 1000) : Date.now(),
          isRead: n.is_read === 1,
          type: n.title?.toLowerCase().includes('declined') || n.title?.toLowerCase().includes('cancel') 
            ? 'error' 
            : n.title?.toLowerCase().includes('rescheduled') 
            ? 'warning' 
            : 'info'
        }));

        // Check for new notifications to trigger toast popups
        if (!initialLoadRef.current) {
          formattedBackend.forEach(notif => {
            if (!notif.isRead && !seenNotificationIdsRef.current.has(notif.id)) {
              // Trigger pop-up alert toast
              antdNotification.open({
                message: (
                  <span className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <BellOutlined className="text-blue-500" />
                    {notif.title}
                  </span>
                ),
                description: (
                  <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed block mt-1">
                    {notif.message}
                  </span>
                ),
                placement: 'topRight',
                duration: 6,
                className: 'custom-notification-toast shadow-lg rounded-xl border border-blue-100 dark:border-slate-700'
              });
            }
          });
        }

        // Update seen set
        formattedBackend.forEach(n => seenNotificationIdsRef.current.add(n.id));
        initialLoadRef.current = false;
        setNotifications(formattedBackend);
      } catch (err) {
        console.error("Failed to fetch backend notifications:", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [effectiveUserEmail]);

  const addNotification = (notif: Omit<AINotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotification: AINotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      isRead: false,
    };
    
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })));
    if (effectiveUserEmail) {
      try {
        await sharedApi.markAllNotificationsRead(effectiveUserEmail);
      } catch (e) {
        console.error("Failed to mark all notifications read:", e);
      }
    }
  };

  const markOneAsRead = async (id: string | number) => {
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    if (effectiveUserEmail && typeof id === 'number') {
      try {
        await sharedApi.markOneNotificationRead(id, effectiveUserEmail);
      } catch (e) {
        console.error("Failed to mark notification read:", e);
      }
    }
  };

  const clearAll = async () => {
    setNotifications([]);
    if (effectiveUserEmail) {
      try {
        await sharedApi.clearNotifications(effectiveUserEmail);
      } catch (e) {
        console.error("Failed to clear notifications:", e);
      }
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAllAsRead, markOneAsRead, clearAll, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
