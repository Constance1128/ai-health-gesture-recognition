import React, { createContext, useContext, useState, useEffect } from 'react';
import { AINotification } from '../types';

interface NotificationContextProps {
  notifications: AINotification[];
  addNotification: (notification: Omit<AINotification, 'id' | 'timestamp' | 'isRead'>) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode, userId?: number }> = ({ children, userId }) => {
  const [notifications, setNotifications] = useState<AINotification[]>([]);

  // Load from local storage when userId changes
  useEffect(() => {
    if (userId) {
      const stored = localStorage.getItem(`ai_health_notifications_${userId}`);
      if (stored) {
        try {
          setNotifications(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse notifications", e);
        }
      } else {
        setNotifications([]);
      }
    } else {
      setNotifications([]);
    }
  }, [userId]);

  // Save to local storage when notifications change
  useEffect(() => {
    if (userId) {
      localStorage.setItem(`ai_health_notifications_${userId}`, JSON.stringify(notifications));
    }
  }, [notifications, userId]);

  const addNotification = (notif: Omit<AINotification, 'id' | 'timestamp' | 'isRead'>) => {
    if (!userId) return;
    
    const newNotification: AINotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      isRead: false,
    };
    
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAllAsRead, clearAll, unreadCount }}>
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
