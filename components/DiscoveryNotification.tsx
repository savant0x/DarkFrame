/**
 * @file components/DiscoveryNotification.tsx
 * @overview Ancient technology discovery notification — NEON NOIR §5.1 popup.
 * Quiet glass panel, left signal rail per category, Orbitron title.
 * Auto-dismisses after 8 seconds or can be manually closed.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Discovery, DiscoveryCategory } from '@/types';

interface DiscoveryNotificationProps {
  discovery: Discovery | null;
  totalDiscoveries?: number;
  onClose: () => void;
}

/**
 * Category signal-rail token (NEON NOIR: semantic accent per discipline)
 */
function getCategoryAccent(category: DiscoveryCategory): string {
  switch (category) {
    case DiscoveryCategory.Industrial:
      return 'var(--nn-cyan)';
    case DiscoveryCategory.Combat:
      return 'var(--nn-magenta)';
    case DiscoveryCategory.Strategic:
      return 'var(--nn-violet)';
    default:
      return 'var(--nn-text-secondary)';
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

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 300);
  }, [onClose]);

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
  }, [discovery, handleClose]);

  if (!discovery) return null;

  const accent = getCategoryAccent(discovery.category);
  const categoryIcon = getCategoryIcon(discovery.category);

  return (
    <div
      className={`
        fixed top-4 left-1/2 transform -translate-x-1/2 z-50
        transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-10'}
      `}
    >
      <div
        className="rounded-none p-5 min-w-[400px] max-w-[500px]"
        style={{
          background: 'color-mix(in oklab, var(--nn-void) 90%, transparent)',
          border: '1px solid color-mix(in oklab, var(--nn-cyan) 16%, transparent)',
          borderLeft: `3px solid ${accent}`,
          boxShadow: `0 0 40px color-mix(in oklab, ${accent} 25%, transparent), 0 8px 32px rgba(0,0,0,0.6)`,
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Content */}
        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{categoryIcon}</span>
              <div>
                <div
                  className="mb-1 uppercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    color: accent,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  }}
                >
                  Ancient Technology Discovered
                </div>
                <div
                  className="text-lg font-bold text-[color:var(--nn-text-primary)]"
                  style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: '0.04em' }}
                >
                  {discovery.name}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-[color:var(--nn-text-secondary)] hover:text-[color:var(--nn-text-primary)] transition-colors text-xl font-bold leading-none"
              aria-label="Close notification"
            >
              ×
            </button>
          </div>

          {/* Category Badge */}
          <div
            className="mb-3 inline-block px-2 py-1 text-xs font-semibold uppercase"
            style={{
              letterSpacing: '0.14em',
              color: accent,
              border: `1px solid color-mix(in oklab, ${accent} 45%, transparent)`,
              background: `color-mix(in oklab, ${accent} 10%, transparent)`,
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}
          >
            {discovery.category.toUpperCase()}
          </div>

          {/* Description */}
          <p className="mb-3 text-sm leading-relaxed text-[color:var(--nn-text-secondary)]">
            {discovery.description}
          </p>

          {/* Bonus — neutral well with rail */}
          <div
            className="mb-3 p-3 rounded-none"
            style={{
              border: '1px solid color-mix(in oklab, var(--nn-cyan) 12%, transparent)',
              borderLeft: `2px solid ${accent}`,
              background: 'color-mix(in oklab, var(--nn-void) 45%, transparent)',
            }}
          >
            <div
              className="mb-1 text-xs font-semibold uppercase"
              style={{ letterSpacing: '0.16em', color: 'var(--nn-text-secondary)', fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              Permanent Bonus
            </div>
            <div className="nn-num text-base text-[color:var(--nn-text-primary)]">
              {discovery.bonus}
            </div>
          </div>

          {/* Progress */}
          {totalDiscoveries !== undefined && (
            <div className="flex items-center justify-between text-xs text-[color:var(--nn-text-secondary)]">
              <span className="uppercase" style={{ letterSpacing: '0.14em' }}>Discoveries</span>
              <span className="nn-num text-[color:var(--nn-text-primary)]">
                {totalDiscoveries} / 15
                {totalDiscoveries === 15 && <span style={{ color: 'var(--nn-green)' }}> — COMPLETE</span>}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
