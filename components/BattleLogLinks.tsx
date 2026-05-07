'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGameContext } from '@/context/GameContext';

export default function BattleLogLinks() {
  const { player } = useGameContext();
  const router = useRouter();
  const [logCounts, setLogCounts] = useState({ attacks: 0, defenses: 0, infantry: 0, landMines: 0 });

  useEffect(() => {
    if (!player) return;
    const fetchLogCounts = async () => {
      try {
        const response = await fetch(`/api/combat/logs?summary=true`);
        if (response.ok) {
          const data = await response.json();
          setLogCounts({
            attacks: data.attackCount || 0,
            defenses: data.defenseCount || 0,
            infantry: data.infantryCount || 0,
            landMines: data.landMineCount || 0
          });
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Failed to fetch log counts:', error instanceof Error ? error.message : String(error));
        }
      }
    };
    fetchLogCounts();
    const interval = setInterval(fetchLogCounts, 30000);
    return () => clearInterval(interval);
  }, [player]);

  if (!player) return null;

  const logs = [
    { label: 'Attack Logs', count: logCounts.attacks, path: '/game/battle-logs/attack', color: '--neon-yellow' },
    { label: 'Defense Logs', count: logCounts.defenses, path: '/game/battle-logs/defense', color: '--electric' },
    { label: 'Infantry Logs', count: logCounts.infantry, path: '/game/battle-logs/infantry', color: '--neon-pink' },
    { label: 'Land Mine Logs', count: logCounts.landMines, path: '/game/battle-logs/land-mines', color: '--neon-red' },
  ];

  return (
    <div className="bg-[--card] border-t border-[--border] p-2.5">
      <h3 className="text-[13px] font-bold text-[--text-2] mb-1.5">Battle Log</h3>
      <table className="w-full text-xs">
        <tbody>
          {logs.map((log, i) => (
            <tr key={log.path} className={i % 2 === 0 ? 'bg-[--row-even]' : 'bg-[--row-odd]'}>
              <td className="px-2 py-1">
                <button onClick={() => router.push(log.path)} className="text-[--text-2] hover:text-[--text-1] transition-colors text-left w-full">
                  {log.label}
                </button>
              </td>
              <td className="px-2 py-1 text-right font-bold font-mono" style={{ color: `var(${log.color})` }}>
                {log.count}{log.count > 0 && <span className="text-[--synth] text-[10px] ml-1">New</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}