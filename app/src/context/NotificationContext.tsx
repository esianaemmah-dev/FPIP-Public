import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  seedActivity,
  seedNotifications,
  type ActivityItem,
  type FpipNotification,
  type NotificationKind,
} from '@/lib/notifications';

interface NotificationContextValue {
  notifications: FpipNotification[];
  activity: ActivityItem[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  push: (n: Omit<FpipNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => void;
  pushActivity: (a: Omit<ActivityItem, 'id' | 'at'> & { id?: string; at?: string }) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState(seedNotifications);
  const [activity, setActivity] = useState(seedActivity);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const markRead = useCallback((id: string) => {
    setNotifications((rows) => rows.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((rows) => rows.map((n) => ({ ...n, read: true })));
  }, []);

  const push = useCallback((n: Omit<FpipNotification, 'id' | 'createdAt' | 'read'> & { id?: string }) => {
    const item: FpipNotification = {
      id: n.id ?? `n${Math.random().toString(36).slice(2, 9)}`,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
      createdAt: new Date().toISOString(),
      read: false,
    };
    setNotifications((rows) => [item, ...rows]);
  }, []);

  const pushActivity = useCallback((a: Omit<ActivityItem, 'id' | 'at'> & { id?: string; at?: string }) => {
    const item: ActivityItem = {
      id: a.id ?? `a${Math.random().toString(36).slice(2, 9)}`,
      at: a.at ?? new Date().toISOString(),
      actor: a.actor,
      action: a.action,
      detail: a.detail,
      href: a.href,
    };
    setActivity((rows) => [item, ...rows]);
  }, []);

  const value = useMemo(
    () => ({ notifications, activity, unreadCount, markRead, markAllRead, push, pushActivity }),
    [notifications, activity, unreadCount, markRead, markAllRead, push, pushActivity],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

export type { NotificationKind };
