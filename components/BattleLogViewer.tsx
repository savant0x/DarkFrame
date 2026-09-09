/**
 * BattleLogViewer.tsx
 * Created: 2025-10-17
 * 
 * OVERVIEW:
 * Component for viewing battle history. Displays recent battles with filtering,
 * sorting, and expandable detail views. Shows both offensive and defensive battles.
 * 
 * Features:
 * - List recent battles (default 10, load more option)
 * - Battle summary cards (outcome, participants, date, type)
 * - Expandable detail view (round-by-round breakdown)
 * - Filter by: Attack/Defense, Outcome, Battle Type
 * - Sort by date (newest first)
 * - Visual indicators for victories/defeats
 * - Quick stats (W/L record, total battles)
 * - Loading and error states
 * 
 * Integration:
 * - Calls /api/combat/logs (GET) for battle history
 * - Displays BattleLog data with full details
 * - Real-time updates after new battles
 * 
 * Dependencies: BattleLog, BattleOutcome, BattleType, useGameContext
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useGameContext } from '@/context/GameContext';
import { formatDate } from '@/utils/formatting';
import { BattleLog, BattleOutcome, BattleType } from '@/types/game.types';

interface BattleLogViewerProps {
  isOpen?: boolean;
  onClose?: () => void;
  limit?: number;
}

type FilterRole = 'all' | 'attacker' | 'defender';
type FilterOutcome = 'all' | 'victory' | 'defeat' | 'draw';
type FilterType = 'all' | BattleType.Infantry | BattleType.Base;

/**
 * Battle log viewer component
 * Displays and manages battle history
 */
export default function BattleLogViewer({ isOpen = true, onClose, limit = 20 }: BattleLogViewerProps) {
  const { player } = useGameContext();
  const [battles, setBattles] = useState<BattleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBattle, setExpandedBattle] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<FilterRole>('all');
  const [filterOutcome, setFilterOutcome] = useState<FilterOutcome>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');

  const fetchBattleLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/combat/logs?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch battle logs');
      }

      const data = await response.json();
      setBattles(data.battles || []);
    } catch (err) {
      console.error('Error fetching battle logs:', err);
      setError('Failed to load battle history');
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    if (isOpen) {
      fetchBattleLogs();
    }
  }, [isOpen, fetchBattleLogs]);

  if (!isOpen) return null;

  // Filter battles
  const filteredBattles = battles.filter(battle => {
    const isAttacker = battle.attacker.username === player?.username;
    
    // Role filter
    if (filterRole === 'attacker' && !isAttacker) return false;
    if (filterRole === 'defender' && isAttacker) return false;

    // Outcome filter
    if (filterOutcome !== 'all') {
      const isVictory = (isAttacker && battle.outcome === BattleOutcome.AttackerWin) ||
                        (!isAttacker && battle.outcome === BattleOutcome.DefenderWin);
      const isDefeat = (isAttacker && battle.outcome === BattleOutcome.DefenderWin) ||
                       (!isAttacker && battle.outcome === BattleOutcome.AttackerWin);
      const isDraw = battle.outcome === BattleOutcome.Draw;

      if (filterOutcome === 'victory' && !isVictory) return false;
      if (filterOutcome === 'defeat' && !isDefeat) return false;
      if (filterOutcome === 'draw' && !isDraw) return false;
    }

    // Type filter
    if (filterType !== 'all' && battle.battleType !== filterType) return false;

    return true;
  });

  // Calculate stats
  const totalBattles = filteredBattles.length;
  const victories = filteredBattles.filter(b => {
    const isAttacker = b.attacker.username === player?.username;
    return (isAttacker && b.outcome === BattleOutcome.AttackerWin) ||
           (!isAttacker && b.outcome === BattleOutcome.DefenderWin);
  }).length;
  const defeats = filteredBattles.filter(b => {
    const isAttacker = b.attacker.username === player?.username;
    return (isAttacker && b.outcome === BattleOutcome.DefenderWin) ||
           (!isAttacker && b.outcome === BattleOutcome.AttackerWin);
  }).length;

  return (
    <div className={`${onClose ? 'fixed inset-0 bg-[color-mix(in_oklab,var(--nn-void)_80%,transparent)] flex items-center justify-center z-50 p-4' : ''}`}>
      <div className={`bg-[color:var(--nn-void)] rounded-none w-full ${onClose ? 'border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)] max-w-6xl max-h-[90vh] overflow-y-auto' : ''}`}>
        {/* Header */}
        <div className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] p-4 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-[color:var(--nn-text-primary)]">📜 Battle History</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[color:var(--nn-text-primary)] text-[color:var(--nn-text-secondary)] text-2xl font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 text-center">
              <p className="text-[color:var(--nn-text-secondary)] text-sm">Total Battles</p>
              <p className="text-3xl font-bold text-[color:var(--nn-text-primary)]">{totalBattles}</p>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] rounded-none p-4 text-center">
              <p className="text-[color:var(--nn-text-secondary)] text-sm">Victories</p>
              <p className="text-3xl font-bold text-[color:var(--nn-green)]">{victories}</p>
            </div>
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4 text-center">
              <p className="text-[color:var(--nn-text-secondary)] text-sm">Defeats</p>
              <p className="text-3xl font-bold text-[color:var(--nn-magenta)]">{defeats}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-4 mb-6">
            <h3 className="font-bold text-[color:var(--nn-text-primary)] mb-3">🔍 Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Role Filter */}
              <div>
                <label className="block text-[color:var(--nn-text-secondary)] text-sm mb-2">Role</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value as FilterRole)}
                  className="nn-input w-full"
                >
                  <option value="all">All Battles</option>
                  <option value="attacker">⚔️ Attacks</option>
                  <option value="defender">🛡️ Defenses</option>
                </select>
              </div>

              {/* Outcome Filter */}
              <div>
                <label className="block text-[color:var(--nn-text-secondary)] text-sm mb-2">Outcome</label>
                <select
                  value={filterOutcome}
                  onChange={(e) => setFilterOutcome(e.target.value as FilterOutcome)}
                  className="nn-input w-full"
                >
                  <option value="all">All Outcomes</option>
                  <option value="victory">✅ Victories</option>
                  <option value="defeat">❌ Defeats</option>
                  <option value="draw">⚔️ Draws</option>
                </select>
              </div>

              {/* Type Filter */}
              <div>
                <label className="block text-[color:var(--nn-text-secondary)] text-sm mb-2">Battle Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as FilterType)}
                  className="nn-input w-full"
                >
                  <option value="all">All Types</option>
                  <option value="INFANTRY">⚔️ Infantry</option>
                  <option value="BASE">🏠 Base</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="nn-spin-icon w-12 h-12 text-[color:var(--nn-violet)]" aria-label="Loading battle logs" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-4">
              <p className="text-[color:var(--nn-magenta)]">❌ {error}</p>
            </div>
          )}

          {/* Battle List */}
          {!loading && !error && (
            <>
              {filteredBattles.length === 0 ? (
                <div className="bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] rounded-none p-8 text-center">
                  <p className="text-[color:var(--nn-text-secondary)] text-lg">No battles found</p>
                  <p className="text-[color:var(--nn-text-secondary)] text-sm mt-2">
                    {filterRole !== 'all' || filterOutcome !== 'all' || filterType !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Launch your first attack to see battle history!'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredBattles.map((battle) => {
                    const isAttacker = battle.attacker.username === player?.username;
                    const isVictory = (isAttacker && battle.outcome === BattleOutcome.AttackerWin) ||
                                     (!isAttacker && battle.outcome === BattleOutcome.DefenderWin);
                    const isDraw = battle.outcome === BattleOutcome.Draw;
                    const isExpanded = expandedBattle === battle._id;

                    return (
                      <div
                        key={battle._id}
                        className={`border-2 rounded-none overflow-hidden transition-all ${
                          isVictory
                            ? 'border-[color-mix(in_oklab,var(--nn-green)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]'
                            : isDraw
                            ? 'border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)]'
                            : 'border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)]'
                        }`}
                      >
                        {/* Battle Summary */}
                        <div
                          onClick={() => setExpandedBattle(isExpanded ? null : (battle._id || battle.battleId))}
                          className="p-4 cursor-pointer bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="text-3xl">
                                {isVictory ? '✅' : isDraw ? '⚔️' : '❌'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-[color:var(--nn-text-primary)] text-lg">
                                    {isAttacker ? '⚔️ Attack' : '🛡️ Defense'}
                                  </span>
                                  <span className="text-[color:var(--nn-text-secondary)]">vs</span>
                                  <span className="font-bold text-[color:var(--nn-text-primary)] text-lg">
                                    {isAttacker ? battle.defender.username : battle.attacker.username}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-sm text-[color:var(--nn-text-secondary)]">
                                  <span>{battle.battleType === BattleType.Infantry ? '⚔️ Infantry' : '🏠 Base'}</span>
                                  <span>•</span>
                                  <span>{battle.totalRounds} rounds</span>
                                  <span>•</span>
                                  <span>{formatDate(battle.timestamp, true)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold text-xl ${
                                isVictory ? 'text-[color:var(--nn-green)]' : isDraw ? 'text-[color:var(--nn-amber)]' : 'text-[color:var(--nn-magenta)]'
                              }`}>
                                {isVictory ? 'VICTORY' : isDraw ? 'DRAW' : 'DEFEAT'}
                              </div>
                              <div className="text-[color:var(--nn-violet)] text-sm mt-1">
                                +{isAttacker ? battle.attacker.xpEarned : battle.defender.xpEarned} XP
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Attacker Stats */}
                              <div className="bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] rounded-none p-3">
                                <h4 className="font-bold text-[color:var(--nn-magenta)] mb-2">
                                  ⚔️ {battle.attacker.username} (Attacker)
                                </h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">HP:</span>
                                    <span className="text-[color:var(--nn-text-primary)]">
                                      {battle.attacker.startingHP} → {battle.attacker.endingHP}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">Damage Dealt:</span>
                                    <span className="text-[color:var(--nn-magenta)] font-bold">{battle.attacker.damageDealt}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">Units Lost:</span>
                                    <span className="text-[color:var(--nn-magenta)]">
                                      {battle.attacker.unitsLost}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">Units Captured:</span>
                                    <span className="text-[color:var(--nn-green)]">
                                      {battle.attacker.unitsCaptured}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Defender Stats */}
                              <div className="bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)] rounded-none p-3">
                                <h4 className="font-bold text-[color:var(--nn-cyan)] mb-2">
                                  🛡️ {battle.defender.username} (Defender)
                                </h4>
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">HP:</span>
                                    <span className="text-[color:var(--nn-text-primary)]">
                                      {battle.defender.startingHP} → {battle.defender.endingHP}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">Damage Dealt:</span>
                                    <span className="text-[color:var(--nn-cyan)] font-bold">{battle.defender.damageDealt}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">Units Lost:</span>
                                    <span className="text-[color:var(--nn-magenta)]">
                                      {battle.defender.unitsLost}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-[color:var(--nn-text-secondary)]">Units Captured:</span>
                                    <span className="text-[color:var(--nn-green)]">
                                      {battle.defender.unitsCaptured}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Resources Stolen */}
                            {battle.resourcesStolen && battle.resourcesStolen.amount > 0 && (
                              <div className="mt-3 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)] rounded-none p-3">
                                <p className="text-[color:var(--nn-amber)] font-bold">
                                  💰 {battle.resourcesStolen.resourceType.toUpperCase()} Stolen: {battle.resourcesStolen.amount.toLocaleString()}
                                </p>
                              </div>
                            )}

                            {/* Battle Message */}
                            <div className="mt-3 text-center text-[color:var(--nn-text-secondary)] text-sm italic">
                              &quot;{battle.message}&quot;
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Load More Button */}
              {filteredBattles.length >= limit && (
                <div className="text-center mt-6">
                  <button
                    onClick={fetchBattleLogs}
                    className="px-6 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-bold transition-colors"
                  >
                    Load More
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. BATTLE LIST DISPLAY:
 *    - Summary cards with outcome indicators
 *    - Click to expand for detailed view
 *    - Color-coded by outcome (green/yellow/red)
 *    - Shows role (attack/defense) and opponent
 * 
 * 2. FILTERING SYSTEM:
 *    - Role: All, Attacks, Defenses
 *    - Outcome: All, Victories, Defeats, Draws
 *    - Type: All, Infantry, Base
 *    - Real-time filter application
 * 
 * 3. STATISTICS:
 *    - Total battles count
 *    - Victory count
 *    - Defeat count
 *    - Updates with filters
 * 
 * 4. DETAILED VIEW:
 *    - Attacker and Defender stats
 *    - HP progression
 *    - Damage dealt
 *    - Units lost and captured
 *    - Resources stolen (if applicable)
 *    - Battle message
 * 
 * 5. USER EXPERIENCE:
 *    - Loading spinner during fetch
 *    - Error messaging
 *    - Empty state messages
 *    - Load more pagination
 *    - Expandable/collapsible details
 *    - Date formatting (readable)
 * 
 * 6. INTEGRATION:
 *    - API: /api/combat/logs (GET)
 *    - Context: player.username for role determination
 *    - Types: BattleLog, BattleOutcome, BattleType
 *    - Optional modal mode (with onClose)
 *    - Page mode (without onClose)
 * 
 * FUTURE ENHANCEMENTS:
 * - Round-by-round replay
 * - Battle statistics charts (W/L over time)
 * - Export battle history
 * - Search by opponent username
 * - Advanced filters (date range, XP range)
 * - Battle share feature (copy link/stats)
 */

