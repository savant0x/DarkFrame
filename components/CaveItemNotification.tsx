/**
 * @file components/CaveItemNotification.tsx
 * @created 2025-10-16
 * @overview Toast notification for cave item discoveries
 */

'use client';

import { useState, useEffect } from 'react';
import { InventoryItem, ItemRarity } from '@/types';

interface NotificationData {
  item: InventoryItem;
  timestamp: number;
}

let notificationQueue: NotificationData[] = [];
let notifyCallback: ((data: NotificationData) => void) | null = null;

// Global function to trigger notifications
export function showCaveItemNotification(item: InventoryItem) {
  const notification: NotificationData = {
    item,
    timestamp: Date.now()
  };
  
  notificationQueue.push(notification);
  
  if (notifyCallback) {
    notifyCallback(notification);
  }
}

export default function CaveItemNotification() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);

  useEffect(() => {
    // Register callback
    notifyCallback = (data: NotificationData) => {
      setNotifications(prev => [...prev, data]);
      
      // Auto-dismiss after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.timestamp !== data.timestamp));
      }, 5000);
    };

    // Process existing queue
    notificationQueue.forEach(data => {
      setNotifications(prev => [...prev, data]);
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.timestamp !== data.timestamp));
      }, 5000);
    });
    notificationQueue = [];

    return () => {
      notifyCallback = null;
    };
  }, []);

  // Get rarity color
  const getRarityColor = (rarity: ItemRarity): string => {
    switch (rarity) {
      case ItemRarity.Common: return 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]';
      case ItemRarity.Uncommon: return 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]';
      case ItemRarity.Rare: return 'border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)]';
      case ItemRarity.Epic: return 'border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)]';
      case ItemRarity.Legendary: return 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]';
      default: return 'border-[color-mix(in_oklab,var(--nn-cyan)_25%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)]';
    }
  };

  // Get rarity text color
  const getRarityTextColor = (rarity: ItemRarity): string => {
    switch (rarity) {
      case ItemRarity.Common: return 'text-[color:var(--nn-text-secondary)]';
      case ItemRarity.Uncommon: return 'text-[color:var(--nn-green)]';
      case ItemRarity.Rare: return 'text-[color:var(--nn-cyan)]';
      case ItemRarity.Epic: return 'text-[color:var(--nn-violet)]';
      case ItemRarity.Legendary: return 'text-[color:var(--nn-amber)]';
      default: return 'text-[color:var(--nn-text-primary)]';
    }
  };

  // Get icon based on item type
  const getItemIcon = (item: InventoryItem): string => {
    if (item.type.includes('DIGGER')) {
      if (item.type.includes('METAL')) return '⛏️';
      if (item.type.includes('ENERGY')) return '⚡';
      return '🔨';
    }
    return '🎁';
  };

  const dismissNotification = (timestamp: number) => {
    setNotifications(prev => prev.filter(n => n.timestamp !== timestamp));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-40 space-y-2">
      {notifications.map((notification) => (
        <div
          key={notification.timestamp}
          className={`${getRarityColor(notification.item.rarity)} border-2 rounded-none p-4 shadow-2xl animate-slide-in-right max-w-sm`}
          style={{
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="text-3xl">
              {getItemIcon(notification.item)}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="flex justify-between items-start mb-1">
                <h3 className={`font-bold ${getRarityTextColor(notification.item.rarity)}`}>
                  {notification.item.name}
                </h3>
                <button
                  onClick={() => dismissNotification(notification.timestamp)}
                  className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] transition-colors ml-2"
                >
                  ✕
                </button>
              </div>
              
              <p className="text-xs text-[color:var(--nn-text-secondary)] mb-1">
                {notification.item.rarity}
              </p>
              
              {notification.item.description && (
                <p className="text-sm text-[color:var(--nn-text-secondary)] mb-2">
                  {notification.item.description}
                </p>
              )}
              
              {notification.item.bonusValue && (
                <p className="text-sm font-bold text-[color:var(--nn-green)]">
                  +{notification.item.bonusValue}% gathering bonus!
                </p>
              )}
            </div>
          </div>

          {/* Progress bar for auto-dismiss */}
          <div className="mt-2 h-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[color:var(--nn-text-primary)] rounded-full"
              style={{
                animation: 'shrink 5s linear'
              }}
            />
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// - Toast-style notifications in top-right corner
// - Auto-dismiss after 5 seconds with progress bar
// - Color-coded by rarity
// - Stackable (multiple notifications)
// - Manual dismiss with X button
// - Slide-in animation
// - Usage: import { showCaveItemNotification } from '@/components/CaveItemNotification'
//   then call showCaveItemNotification(item) after cave harvest
// ============================================================
