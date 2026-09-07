/**
 * @file components/BattleLogLinks.tsx
 * @created 2025-10-17
 * @updated 2025-10-17
 * @overview Simple battle log links for navigating to battle log pages
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';

export default function BattleLogLinks() {
  const { player } = useGameContext();
  const router = useRouter();
  const [logCounts, setLogCounts] = useState({
    attacks: 0,
    defenses: 0,
    infantry: 0,
    landMines: 0
  });

  useEffect(() => {
    if (!player) return;

    // Fetch battle log counts
    const fetchLogCounts = async () => {
      try {
        const response = await fetch(`/api/combat/logs?username=${player.username}&summary=true`);
        if (response.ok) {
          const data = await response.json();
          setLogCounts({
            attacks: data.attackCount || 0,
            defenses: data.defenseCount || 0,
            infantry: data.infantryCount || 0,
            landMines: data.landMineCount || 0
          });
        }
        // Silently ignore errors (API might be rate limited or temporarily unavailable)
      } catch (error) {
        // Only log in development
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to fetch log counts:', error instanceof Error ? error.message : String(error));
        }
      }
    };

    fetchLogCounts();
    const interval = setInterval(fetchLogCounts, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, [player]);

  if (!player) return null;

  return (
    <div className="nn-panel" style={{ '--nn-accent': 'var(--nn-cyan)' } as React.CSSProperties}>
      <div className="nn-panel__header">
        <h3 className="nn-panel__title">Battle Log</h3>
        <span className="nn-panel__meta">AUTO-REFRESH 30S</span>
      </div>
      <div className="nn-feed">
        <button
          onClick={() => router.push('/game/battle-logs/attack')}
          className="nn-feed__item"
        >
          <span>Attack Logs</span>
          <span className="nn-feed__count">
            {logCounts.attacks}
            {logCounts.attacks > 0 && <span className="nn-feed__new">new</span>}
          </span>
        </button>
        <button
          onClick={() => router.push('/game/battle-logs/defense')}
          className="nn-feed__item nn-feed__item--defense"
        >
          <span>Defense Logs</span>
          <span className="nn-feed__count">
            {logCounts.defenses}
            {logCounts.defenses > 0 && <span className="nn-feed__new">new</span>}
          </span>
        </button>
        <button
          onClick={() => router.push('/game/battle-logs/infantry')}
          className="nn-feed__item"
        >
          <span>Infantry Logs</span>
          <span className="nn-feed__count">{logCounts.infantry}</span>
        </button>
        <button
          onClick={() => router.push('/game/battle-logs/land-mines')}
          className="nn-feed__item nn-feed__item--defense"
        >
          <span>Land Mine Logs</span>
          <span className="nn-feed__count">{logCounts.landMines}</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Navigates to dedicated battle log pages
// - Shows counts for each log type  
// - Clickable buttons navigate to /game/battle-logs/[type]
// - Auto-refreshes counts every 30 seconds
// - Compact design for bottom-left panel
// - No modal dependencies
// ============================================================
// END OF FILE
// ============================================================
