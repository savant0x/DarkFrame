/**
 * @file components/WMDNotificationsPanel.tsx
 * @created 2025-10-22
 * @updated 2026-09-08 (FID-20260908-009: NEON NOIR redesign — nn-panel/nn-chip/
 * nn-abtn token structure, event glyph slabs removed; feed logic byte-preserved)
 * @overview WMD Event Notifications Panel
 *
 * OVERVIEW:
 * Real-time WMD event notifications display. Shows launches, intercepts,
 * research completions, spy operations, and vote results.
 *
 * Dependencies: /api/wmd/notifications, /types/wmd/notification.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { showSuccess } from '@/lib/toastService';
import { confirmDialog } from '@/components/ui/ConfirmDialog';

interface Notification {
  notificationId: string;
  eventType: string;
  priority: string;
  sourceName: string;
  targetName?: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export default function WMDNotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/wmd/notifications?limit=50');
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    const res = await fetch('/api/wmd/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationIds: 'all' }),
    });
    if (res.ok) {
      await fetchNotifications();
    }
  };

  const clearOld = async () => {
    if (!(await confirmDialog('Clear all read notifications older than 30 days?'))) return;

    const res = await fetch('/api/wmd/notifications?olderThan=30', {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      showSuccess(`Cleared ${data.deletedCount} notifications`);
      await fetchNotifications();
    }
  };

  const getPriorityChip = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'nn-chip nn-chip--magenta';
      case 'ALERT': return 'nn-chip nn-chip--amber';
      case 'WARNING': return 'nn-chip nn-chip--amber';
      case 'INFO': return 'nn-chip nn-chip--cyan';
      default: return 'nn-chip';
    }
  };

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div style={{ background: 'color-mix(in oklab, var(--nn-void) 65%, transparent)' }} className="p-6 rounded-none">
        <p className="nn-lab">Loading notifications…</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header — scanline section instrument */}
      <div className="nn-sec">
        <span className="nn-panel__icon"><Bell className="h-4 w-4" /></span>
        <span className="nn-sec__title">WMD Notifications</span>
        <span className="nn-sec__note nn-num">{unreadCount} unread · {notifications.length} total</span>
        <div className="ml-auto flex gap-2">
          <button onClick={markAllRead} className="nn-abtn nn-abtn--cyan">Mark All Read</button>
          <button onClick={clearOld} className="nn-abtn nn-abtn--magenta">Clear Old</button>
        </div>
      </div>

      {/* Notifications Feed — ledger panels, unread = cyan left-rule */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {notifications.map((notif) => (
          <div
            key={notif.notificationId}
            className="nn-panel"
            style={
              {
                '--nn-accent': notif.read ? 'var(--nn-cyan)' : 'var(--nn-cyan)',
                opacity: notif.read ? 0.75 : 1,
                borderLeft: notif.read ? undefined : '2px solid var(--nn-cyan)',
              } as React.CSSProperties
            }
          >
            <div className="nn-panel__header">
              <span className="nn-panel__title">{notif.title}</span>
              <span className={`nn-chip ${getPriorityChip(notif.priority)} nn-panel__meta`}>{notif.priority}</span>
            </div>
            <div className="nn-panel__body" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 12.5, color: 'var(--nn-text-secondary)', margin: 0 }}>{notif.message}</p>
              <div className="flex gap-4">
                <span className="nn-lab" style={{ fontSize: 9.5 }}>From ▸ {notif.sourceName}</span>
                {notif.targetName && <span className="nn-lab" style={{ fontSize: 9.5 }}>To ▸ {notif.targetName}</span>}
                <span className="nn-lab" style={{ fontSize: 9.5 }}>{formatTime(notif.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {notifications.length === 0 && (
        <div className="text-center py-12">
          <p className="nn-lab">No notifications</p>
          <p className="nn-footnote" style={{ marginTop: 4 }}>WMD events will appear here</p>
        </div>
      )}
    </div>
  );
}
