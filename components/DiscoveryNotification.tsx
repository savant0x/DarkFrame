/**
 * @file components/DiscoveryNotification.tsx
 * @created 2025-01-17
 * @overview Ancient technology discovery notification popup
 * 
 * OVERVIEW:
 * Displays a celebratory notification when player discovers an ancient technology.
 * Shows the technology icon, name, category, and bonus effect.
 * Auto-dismisses after 8 seconds or can be manually closed.
 * Appears with animation from the top of the screen.
 */

'use client';

import { useState, useEffect } from 'react';
import { Discovery, DiscoveryCategory } from '@/types';

interface DiscoveryNotificationProps {
  discovery: Discovery | null;
  totalDiscoveries?: number;
  onClose: () => void;
}

/**
 * Get category color for visual styling
 */
function getCategoryColor(category: DiscoveryCategory): string {
  switch (category) {
    case DiscoveryCategory.Industrial:
      return 'from-blue-500 to-cyan-500';
    case DiscoveryCategory.Combat:
      return 'from-red-500 to-orange-500';
    case DiscoveryCategory.Strategic:
      return 'from-purple-500 to-pink-500';
    default:
      return 'from-gray-500 to-gray-600';
  }
}

/**
 * Get category icon
 */
function getCategoryIcon(category: DiscoveryCategory): string {
  switch (category) {
    case DiscoveryCategory.Industrial:
      return '🏭';
    case DiscoveryCategory.Combat:
      return '⚔️';
    case DiscoveryCategory.Strategic:
      return '🎯';
    default:
      return '📜';
  }
}

export default function DiscoveryNotification({ 
  discovery, 
  totalDiscoveries,
  onClose 
}: DiscoveryNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (discovery) {
      // Trigger entrance animation
      setTimeout(() => setIsVisible(true), 100);

      // Auto-dismiss after 8 seconds
      const dismissTimer = setTimeout(() => {
        handleClose();
      }, 8000);

      return () => clearTimeout(dismissTimer);
    }
  }, [discovery]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  };

  if (!discovery) return null;

  const categoryColor = getCategoryColor(discovery.category);
  const categoryIcon = getCategoryIcon(discovery.category);

  return (
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50
        transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}
      `}
    >
      <div className={`
        bg-gradient-to-r ${categoryColor}
        rounded-lg shadow-2xl border-2 border-white/30
        p-6 min-w-[400px] max-w-[500px]
        relative overflow-hidden
      `}>
        {/* Animated background effect */}
        <div className="absolute inset-0 bg-white/10 animate-pulse"></div>
        
        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{categoryIcon}</span>
              <div>
                <div className="text-xs font-bold text-white/80 uppercase tracking-wider mb-1">
                  Ancient Technology Discovered!
                </div>
                <div className="text-xl font-bold text-white">
                  {discovery.name}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/70 hover:text-white transition-colors text-xl font-bold"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>

          {/* Category Badge */}
          <div className="inline-block bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-3">
            {discovery.category.toUpperCase()}
          </div>

          {/* Description */}
          <p className="text-white/90 text-sm mb-3 leading-relaxed">
            {discovery.description}
          </p>

          {/* Bonus */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 mb-3">
            <div className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-1">
              Permanent Bonus
            </div>
            <div className="text-lg font-bold text-white">
              {discovery.bonus}
            </div>
          </div>

          {/* Progress */}
          {totalDiscoveries !== undefined && (
            <div className="flex items-center justify-between text-white/80 text-sm">
              <span>Discoveries</span>
              <span className="font-bold">
                {totalDiscoveries} / 15
                {totalDiscoveries === 15 && ' 🎉 COMPLETE!'}
              </span>
            </div>
          )}
        </div>

        {/* Shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Auto-dismisses after 8 seconds
// - Manual close button
// - Category-specific color gradients
// - Animated entrance/exit
// - Shows progress toward 15/15 discoveries
// - Responsive design with fixed positioning
// ============================================================
// END OF FILE
// ============================================================
