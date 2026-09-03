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
    <div className="bg-gray-800 border-t border-gray-700 p-3">
      <h3 className="text-sm font-bold text-gray-400 mb-2">Battle Log</h3>
      <div className="space-y-1">
        <button
          onClick={() => router.push('/game/battle-logs/attack')}
          className="w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors flex justify-between items-center"
        >
          <span className="text-gray-300">Attack Logs</span>
          <span className="text-yellow-400 font-bold">
            {logCounts.attacks} {logCounts.attacks > 0 && <span className="text-green-400 text-xs ml-1">New</span>}
          </span>
        </button>
        <button
          onClick={() => router.push('/game/battle-logs/defense')}
          className="w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors flex justify-between items-center"
        >
          <span className="text-gray-300">Defense Logs</span>
          <span className="text-blue-400 font-bold">
            {logCounts.defenses} {logCounts.defenses > 0 && <span className="text-green-400 text-xs ml-1">New</span>}
          </span>
        </button>
        <button
          onClick={() => router.push('/game/battle-logs/infantry')}
          className="w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors flex justify-between items-center"
        >
          <span className="text-gray-300">Infantry Logs</span>
          <span className="text-purple-400 font-bold">
            {logCounts.infantry}
          </span>
        </button>
        <button
          onClick={() => router.push('/game/battle-logs/land-mines')}
          className="w-full text-left text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors flex justify-between items-center"
        >
          <span className="text-gray-300">Land Mine Logs</span>
          <span className="text-red-400 font-bold">
            {logCounts.landMines}
          </span>
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
