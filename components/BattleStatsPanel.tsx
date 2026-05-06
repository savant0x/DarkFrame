/**
 * BattleStatsPanel - Displays player battle stats and recent battles
 * @created 2025-10-19
 * @author ECHO v5.1
 *
 * OVERVIEW: Shows wins, losses, draws, win rate, and recent battles. Integrates with useBattleStats hook and StatsPanel.
 */
import React from 'react';
import type { BattleRecord } from '@/lib';
import { useBattleStats } from '@/hooks/useBattleStats';

export const BattleStatsPanel: React.FC<{ username: string }> = ({ username }) => {
  const { stats, recent, loading, error } = useBattleStats(username);
  if (loading) return <div>Loading battle stats...</div>;
  if (error) return <div>Error loading battle stats</div>;
  return (
    <div className="p-4 bg-gray-900 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-2">Battle Stats</h2>
      <div className="mb-2">Wins: {stats.wins}</div>
      <div className="mb-2">Losses: {stats.losses}</div>
      <div className="mb-2">Draws: {stats.draws}</div>
      <div className="mb-2">Win Rate: {(stats.winRate * 100).toFixed(1)}%</div>
      <div className="mb-4">Total Battles: {stats.totalBattles}</div>
      <h3 className="text-lg font-semibold mb-2">Recent Battles</h3>
      <ul className="space-y-1">
        {recent.map((battle: BattleRecord, i: number) => (
          <li key={i} className="text-sm">
            {battle.attacker} vs {battle.defender} - Winner: {battle.winner || 'Draw'}
          </li>
        ))}
      </ul>
    </div>
  );
};
