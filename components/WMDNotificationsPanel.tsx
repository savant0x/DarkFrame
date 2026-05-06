/**
 * @file components/WMDNotificationsPanel.tsx
 * @created 2025-10-22
 * @overview WMD Event Notifications Panel
 * 
 * OVERVIEW:
 * Real-time WMD event notifications display. Shows launches, intercepts,
 * research completions, spy operations, and vote results.
 * 
 * Features:
 * - Notification feed with timestamps
 * - Priority-based styling (INFO/WARNING/ALERT/CRITICAL)
 * - Mark as read functionality
 * - Clear old notifications
 * - Event-specific icons and colors
 * 
 * Dependencies: /api/wmd/notifications, /types/wmd/notification.types
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

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
    if (!confirm('Clear all read notifications older than 30 days?')) return;

    const res = await fetch('/api/wmd/notifications?olderThan=30', {
      method: 'DELETE',
    });
    const data = await res.json();
    if (data.success) {
      alert(`Cleared ${data.deletedCount} notifications`);
      await fetchNotifications();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL': return 'bg-red-600';
      case 'ALERT': return 'bg-orange-600';
      case 'WARNING': return 'bg-yellow-600';
      case 'INFO': return 'bg-blue-600';
      default: return 'bg-gray-600';
    }
  };

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('MISSILE')) return '🚀';
    if (eventType.includes('DEFENSE')) return '🛡️';
    if (eventType.includes('SPY')) return '🕵️';
    if (eventType.includes('RESEARCH')) return '🔬';
    if (eventType.includes('VOTE')) return '🗳️';
    return '📢';
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
      <div className="p-6 bg-gray-800 rounded-lg">
        <p className="text-gray-300">Loading notifications...</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="p-6 bg-gray-800 rounded-lg space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">WMD Notifications</h2>
          <p className="text-sm text-gray-400">
            {unreadCount} unread | {notifications.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={markAllRead} variant="secondary" size="sm">
            Mark All Read
          </Button>
          <Button onClick={clearOld} variant="danger" size="sm">
            Clear Old
          </Button>
        </div>
      </div>

      {/* Notifications Feed */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {notifications.map((notif) => (
          <Card
            key={notif.notificationId}
            className={`p-4 ${notif.read ? 'bg-gray-700' : 'bg-gray-600 border-l-4 border-blue-400'}`}
          >
            <div className="flex justify-between items-start gap-4">
              {/* Icon */}
              <div className="text-2xl flex-shrink-0">
                {getEventIcon(notif.eventType)}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-white">{notif.title}</h3>
                  <Badge className={getPriorityColor(notif.priority)}>
                    {notif.priority}
                  </Badge>
                </div>
                <p className="text-sm text-gray-300">{notif.message}</p>
                <div className="flex gap-4 text-xs text-gray-400 mt-2">
                  <span>From: {notif.sourceName}</span>
                  {notif.targetName && <span>To: {notif.targetName}</span>}
                  <span>{formatTime(notif.createdAt)}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {notifications.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No notifications</p>
          <p className="text-gray-500 text-sm">WMD events will appear here</p>
        </div>
      )}
    </div>
  );
}
