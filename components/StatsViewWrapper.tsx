// ============================================================
// FILE: components/StatsViewWrapper.tsx
// CREATED: 2025-01-23 (FID-20250123-001)
// UPDATED: 2026-09-09 (FID-20260909-028 §2.5: full neon noir structural pass —
//   gradient heroes → flat nn-sec strips / nn-panel headers; emoji tabs → nn-sz
//   instrument row; emoji icons → lucide; doubled background classes removed;
//   stat cards → nn-stat family; achievement grid + leaderboard → nn-row
//   ledgers. All fetch/calculator logic byte-preserved.)
// ============================================================
// OVERVIEW:
// Three-tab statistics interface embedded in game center view:
// 1. Personal Stats - Player's individual achievements and metrics
// 2. Game Stats - Global leaderboards (power, level, resources)
// 3. Economy - Placeholder for auction house and trade data
//
// Replaces tile view when opened, auto-closes on player movement
// ============================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Swords,
  Trophy,
  Pickaxe,
  Coins,
  BarChart3,
  Users,
  Zap,
  Award,
  Factory,
  Landmark,
  Map,
  CircleAlert,
  TrendingUp,
  Percent,
} from 'lucide-react';
import TileHarvestStatus from './TileHarvestStatus';
import type { Tile } from '@/types/game.types';
import { GAME_CONSTANTS } from '@/types';
import { estimateHarvest } from '@/lib/harvestEstimate';

// FID-20260910-040: the real roll bounds (the old UI assumed 1000 flat and
// 500–1500 for cave/forest — both wrong).
const { HARVEST: { MIN_AMOUNT: HARVEST_MIN, MAX_AMOUNT: HARVEST_MAX } } = GAME_CONSTANTS;

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface StatsViewWrapperProps {
  currentTile: Tile | null;
  playerUsername: string;
}

interface PlayerStats {
  battlesWon: number;
  totalUnitsBuilt: number;
  totalResourcesGathered: number;
  totalResourcesBanked: number;
  shrineTradeCount: number;
  cavesExplored: number;
}

interface PersonalStatsData {
  stats: PlayerStats;
  username: string;
  level: number;
  combatPower: number;
  powerBreakdown?: {
    rawStrength: number;
    rawDefense: number;
    balanceMultiplier: number;
    balanceStatus: string;
    bonuses: {
      clanMilitary: number;
      discoveries: number;
      specialization: number;
    };
    finalCombatPower: number;
  };
  resources: {
    metal: number;
    energy: number;
  };
}

interface LeaderboardPlayer {
  _id: string;
  username: string;
  level: number;
  combatPower: number;
  totalStrength?: number;
  totalDefense?: number;
  resources?: {
    metal: number;
    energy: number;
  };
  rank?: string;
}

interface GameStatsData {
  totalPlayers: number;
  totalMetal: number;
  totalEnergy: number;
  combatPower: number;
  averageLevel: number;
  totalBattles: number;
  totalTerritories: number;
}

interface LeaderboardData {
  topPlayers: LeaderboardPlayer[];
  gameStats: GameStatsData;
  sortBy: string;
}

type TabType = 'personal' | 'game' | 'economy' | 'harvest';

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function StatsViewWrapper({ currentTile, playerUsername }: StatsViewWrapperProps) {
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [personalData, setPersonalData] = useState<PersonalStatsData | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [sortBy, setSortBy] = useState<string>('combatPower');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches personal player statistics from API
   */
  const fetchPersonalStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/player/stats');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch personal stats');
      }

      setPersonalData(data);
    } catch (err) {
      console.error('❌ Error fetching personal stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetches game leaderboard statistics from API
   */
  const fetchLeaderboardStats = useCallback(async (newSortBy?: string) => {
    try {
      setLoading(true);
      setError(null);

      const sortField = newSortBy || sortBy;
      const response = await fetch(`/api/stats?sortBy=${sortField}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error('Failed to fetch leaderboard stats');
      }

      setLeaderboardData(data);
      setSortBy(sortField);
    } catch (err) {
      console.error('❌ Error fetching leaderboard stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [sortBy]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'personal') {
      fetchPersonalStats();
    } else if (activeTab === 'game') {
      fetchLeaderboardStats();
    } else {
      setLoading(false);
    }
  }, [activeTab, fetchLeaderboardStats, fetchPersonalStats]);

  /**
   * Handles sort button click for leaderboards
   */
  const handleSort = (field: string) => {
    if (activeTab === 'game') {
      fetchLeaderboardStats(field);
    }
  };

  const TABS: Array<{ id: TabType; label: string }> = [
    { id: 'personal', label: 'Personal' },
    { id: 'game', label: 'Game Stats' },
    { id: 'harvest', label: 'Harvest Calc' },
    { id: 'economy', label: 'Economy' },
  ];

  return (
    <div className="h-full overflow-hidden flex flex-col" style={{ background: 'var(--nn-void)' }}>
      {/* Header — flat full-bleed strip (FID-028 §2.5: gradient hero removed) */}
      <div
        className="border-b border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] px-6 py-4 flex-shrink-0"
        style={{ background: 'color-mix(in oklab, var(--nn-void) 92%, transparent)' }}
      >
        <div className="nn-sec">
          <span className="nn-sec__title">Statistics</span>
          <span className="nn-sec__note">Commander ▸ Server Telemetry</span>
        </div>
      </div>

      {/* Tab Navigation — nn-sz instrument row (emoji labels removed) */}
      <div className="px-6 py-3 border-b border-[color-mix(in_oklab,var(--nn-cyan)_14%,transparent)] flex-shrink-0">
        <div className="nn-sz" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id ? 'on' : ''}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div
              className="h-10 w-10"
              style={{
                border: '2px solid color-mix(in oklab, var(--nn-cyan) 45%, transparent)',
                borderBottomColor: 'transparent',
                borderRadius: 0,
                animation: 'nn-spin 0.9s linear infinite',
              }}
              aria-hidden
            />
          </div>
        )}

        {error && (
          <div className="nn-panel nn-panel--magenta max-w-md" style={{ '--nn-accent': 'var(--nn-magenta)' } as React.CSSProperties}>
            <div className="nn-panel__header nn-panel__header--bleed nn-panel__header--magenta">
              <span className="nn-panel__title">Telemetry Error</span>
            </div>
            <div className="nn-panel__body">
              <p className="flex items-center gap-2" style={{ fontSize: 12.5, color: 'var(--nn-text-secondary)' }}>
                <CircleAlert className="w-4 h-4 text-[color:var(--nn-magenta)]" />
                {error}
              </p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Personal Stats Tab */}
            {activeTab === 'personal' && personalData && (
              <>
                {/* Harvest Status Calculator */}
                {currentTile && playerUsername && (
                  <div className="mb-6">
                    <TileHarvestStatus
                      currentTile={currentTile}
                      playerUsername={playerUsername}
                    />
                  </div>
                )}
                
                <PersonalStatsTab data={personalData} />
              </>
            )}

            {/* Game Stats Tab */}
            {activeTab === 'game' && leaderboardData && (
              <GameStatsTab 
                data={leaderboardData} 
                sortBy={sortBy}
                onSort={handleSort}
              />
            )}

            {/* Harvest Calculator Tab */}
            {activeTab === 'harvest' && (
              <HarvestCalculatorTab />
            )}

            {/* Economy Tab */}
            {activeTab === 'economy' && (
              <EconomyTab />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PERSONAL STATS TAB COMPONENT
// ============================================================

interface PersonalStatsTabProps {
  data: PersonalStatsData;
}

function PersonalStatsTab({ data }: PersonalStatsTabProps) {
  const { stats, username, level, combatPower, powerBreakdown, resources } = data;

  return (
    <div className="space-y-6">
      {/* Player Overview — flat stat strip (FID-028 §2.5: gradient hero → nn-stat row) */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">{username}</span>
          <span className="nn-panel__meta">LVL {level} ▸ COMBAT RECORD</span>
          {powerBreakdown && (
            <span className="nn-chip ml-auto" data-variant={powerBreakdown.balanceStatus.toLowerCase()}>
              {powerBreakdown.balanceStatus.toUpperCase()}
            </span>
          )}
        </div>
        <div className="nn-panel__body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="nn-stat">
              <p className="nn-stat__lab">Level</p>
              <p className="nn-stat__num nn-stat__num--glow-amber nn-num">{level}</p>
            </div>
            <div className="nn-stat">
              <p className="nn-stat__lab flex items-center gap-2">
                <Swords className="h-3.5 w-3.5" />
                Combat Power
              </p>
              <p className="nn-stat__num nn-stat__num--glow-magenta nn-num">{combatPower.toLocaleString()}</p>
            </div>
            <div className="nn-stat">
              <p className="nn-stat__lab">Metal</p>
              <p className="nn-stat__num nn-stat__num--glow-violet nn-num">{resources.metal.toLocaleString()}</p>
            </div>
            <div className="nn-stat">
              <p className="nn-stat__lab">Energy</p>
              <p className="nn-stat__num nn-stat__num--glow-cyan nn-num">{resources.energy.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Stats — nn-row ledger (emoji section header + emoji cards removed) */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Achievements</span>
          <span className="nn-panel__meta">LIFETIME ▸ LEDGER</span>
        </div>
        <div className="nn-panel__body">
          <div className="space-y-2">
            <LedgerRow icon={<Swords className="w-3.5 h-3.5" />} label="Battles Won" value={stats.battlesWon} accent="var(--nn-magenta)" />
            <LedgerRow icon={<Factory className="w-3.5 h-3.5" />} label="Units Built" value={stats.totalUnitsBuilt} accent="var(--nn-cyan)" />
            <LedgerRow icon={<Pickaxe className="w-3.5 h-3.5" />} label="Resources Gathered" value={stats.totalResourcesGathered} accent="var(--nn-amber)" />
            <LedgerRow icon={<Landmark className="w-3.5 h-3.5" />} label="Resources Banked" value={stats.totalResourcesBanked} accent="var(--nn-green)" />
            <LedgerRow icon={<Zap className="w-3.5 h-3.5" />} label="Shrine Trades" value={stats.shrineTradeCount} accent="var(--nn-violet)" />
            <LedgerRow icon={<Map className="w-3.5 h-3.5" />} label="Caves Explored" value={stats.cavesExplored} accent="var(--nn-text-primary)" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Single nn-row ledger line with an accent-colored value. */
function LedgerRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent: string }) {
  return (
    <div className="nn-row">
      <span className="nn-row__label">
        <span style={{ color: accent, display: 'inline-flex' }}>{icon}</span>
        {label}
      </span>
      <span className="nn-row__value nn-num" style={{ color: accent }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ============================================================
// GAME STATS TAB COMPONENT
// ============================================================

interface GameStatsTabProps {
  data: LeaderboardData;
  sortBy: string;
  onSort: (field: string) => void;
}

function GameStatsTab({ data, sortBy, onSort }: GameStatsTabProps) {
  const { topPlayers, gameStats } = data;

  const SORTS: Array<{ field: string; label: string }> = [
    { field: 'combatPower', label: 'Power' },
    { field: 'level', label: 'Level' },
    { field: 'resources.metal', label: 'Metal' },
    { field: 'resources.energy', label: 'Energy' },
  ];

  return (
    <div className="space-y-6">
      {/* Global Statistics — flat stat strip (gradient hero removed) */}
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Global Statistics</span>
          <span className="nn-panel__meta">SERVER ▸ ALL COMMANDERS</span>
        </div>
        <div className="nn-panel__body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="nn-stat">
              <p className="nn-stat__lab flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Total Players
              </p>
              <p className="nn-stat__num nn-stat__num--glow-violet nn-num">{gameStats.totalPlayers.toLocaleString()}</p>
            </div>
            <div className="nn-stat">
              <p className="nn-stat__lab">Total Metal</p>
              <p className="nn-stat__num nn-stat__num--glow-amber nn-num">{gameStats.totalMetal.toLocaleString()}</p>
            </div>
            <div className="nn-stat">
              <p className="nn-stat__lab">Total Energy</p>
              <p className="nn-stat__num nn-stat__num--glow-cyan nn-num">{gameStats.totalEnergy.toLocaleString()}</p>
            </div>
            <div className="nn-stat">
              <p className="nn-stat__lab">Average Level</p>
              <p className="nn-stat__num nn-stat__num--glow-green nn-num">{gameStats.averageLevel.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard — sort instrument rides the panel header */}
      <div className="nn-panel overflow-hidden">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Top 10 Players</span>
          <span className="nn-panel__meta">Ranked ▸ By {SORTS.find((s) => s.field === sortBy)?.label ?? 'Power'}</span>
          <div className="nn-sz ml-4">
            {SORTS.map((s) => (
              <button key={s.field} onClick={() => onSort(s.field)} className={sortBy === s.field ? 'on' : ''}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="nn-panel__body">
          <div className="space-y-2">
            {topPlayers.map((player, index) => (
              <LeaderboardRow
                key={player._id}
                player={player}
                rank={index + 1}
                sortBy={sortBy}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HARVEST CALCULATOR TAB COMPONENT
// ============================================================

/** Player fields the harvest calculator reads from /api/player (FID-20260908-020;
 *  gatheringBonus/shrineBoosts exposed by the sanitizer in FID-20260910-040). */
interface HarvestPlayerData {
  totalStrength?: number;
  totalDefense?: number;
  gatheringBonus?: { metalBonus?: number; energyBonus?: number };
  shrineBoosts?: Array<{ expiresAt: string | Date; yieldBonus: number }>;
  activeBoosts?: { gatheringBoost?: number | null };
  vip?: boolean;
  vipExpiration?: string | Date | null;
}

function HarvestCalculatorTab() {
  const [playerData, setPlayerData] = useState<HarvestPlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  // FID-20260910-040: defaults are the REAL roll range (800–1500), seeded from
  // the roll mean so the initial render is a believable harvest, not a fantasy.
  const [baseAmount, setBaseAmount] = useState<number>(HARVEST_MIN + Math.floor((HARVEST_MAX - HARVEST_MIN) / 2));
  const [resource, setResource] = useState<'metal' | 'energy'>('metal');
  const [isVIP, setIsVIP] = useState<boolean>(false);

  // Fetch player's actual stats
  useEffect(() => {
    const fetchPlayerStats = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/player');
        if (response.ok) {
          const data = (await response.json()) as HarvestPlayerData;
          setPlayerData(data);
          setIsVIP(Boolean(data.vip && data.vipExpiration && new Date(data.vipExpiration) > new Date()));
        }
      } catch (error) {
        console.error('Error fetching player stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayerStats();
  }, []);

  // FID-20260910-040: the math IS the server's — this component renders the
  // shared estimate module's output instead of re-implementing (and re-drifting)
  // the pipeline. The digger term comes from players.gatheringBonus (the field
  // the harvest route actually reads), not a scrape of nonexistent item fields.
  const gatheringBonusPct = resource === 'metal'
    ? playerData?.gatheringBonus?.metalBonus ?? 0
    : playerData?.gatheringBonus?.energyBonus ?? 0;
  const shrineBonusPct = (playerData?.shrineBoosts ?? [])
    .filter((b) => new Date(b.expiresAt) > new Date())
    .reduce((sum, b) => sum + (b.yieldBonus || 0) * 100, 0);
  const temporaryBonusPct = playerData?.activeBoosts?.gatheringBoost || 0;

  const estimate = estimateHarvest({
    gatheringBonusPct,
    temporaryBonusPct,
    shrineBoosts: playerData?.shrineBoosts ?? [],
    vip: isVIP,
    vipExpiration: playerData?.vipExpiration ?? null,
    totalStrength: playerData?.totalStrength || 0,
    totalDefense: playerData?.totalDefense || 0,
    base: baseAmount,
  });
  const finalAmount = estimate.final;
  const totalBonus = finalAmount - baseAmount;
  const bonusPercentage = baseAmount > 0 ? ((finalAmount / baseAmount - 1) * 100).toFixed(1) : '0';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div
          className="h-10 w-10"
          style={{
            border: '2px solid color-mix(in oklab, var(--nn-cyan) 45%, transparent)',
            borderBottomColor: 'transparent',
            borderRadius: 0,
            animation: 'nn-spin 0.9s linear infinite',
          }}
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="nn-panel nn-panel--green">
        <div className="nn-panel__header nn-panel__header--green">
          <span className="nn-panel__title">Harvest Calculator</span>
          <span className="nn-panel__meta">YIELD ▸ AUTO-DETECTED BONUSES</span>
        </div>
        <div className="nn-panel__body space-y-6">
          <p className="nn-text-secondary" style={{ fontSize: 12.5 }}>
            Your current harvest bonuses (auto-populated from your stats)
          </p>

          {/* VIP Status — flat chips row (gradient alert removed) */}
          <div className="nn-row">
            <span className="nn-row__label">
              <Zap className="w-3.5 h-3.5" style={{ display: 'inline-flex', color: isVIP ? 'var(--nn-amber)' : 'var(--nn-text-tertiary)' }} />
              VIP Status
            </span>
            <span className="nn-row__value">
              {isVIP ? (
                <span className="nn-chip nn-chip--amber">ACTIVE · 2x MULTIPLIER</span>
              ) : (
                <span className="nn-chip">NOT ACTIVE · Purchase VIP for 2x harvests</span>
              )}
            </span>
          </div>

          {/* Player Stats Summary */}
          {playerData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="nn-stat">
                <p className="nn-stat__lab">Total Strength</p>
                <p className="nn-stat__num nn-stat__num--glow-magenta nn-num">{playerData.totalStrength || 0}</p>
              </div>
              <div className="nn-stat">
                <p className="nn-stat__lab">Total Defense</p>
                <p className="nn-stat__num nn-stat__num--glow-cyan nn-num">{playerData.totalDefense || 0}</p>
              </div>
              <div className="nn-stat">
                <p className="nn-stat__lab">Total Power</p>
                <p className="nn-stat__num nn-stat__num--glow-violet nn-num">
                  {(playerData.totalStrength || 0) + (playerData.totalDefense || 0)}
                </p>
              </div>
              <div className="nn-stat">
                <p className="nn-stat__lab">VIP</p>
                <p className="nn-stat__num nn-stat__num--glow-amber" style={{ fontSize: 16 }}>
                  {isVIP ? 'ACTIVE' : 'INACTIVE'}
                </p>
              </div>
            </div>
          )}

          {/* Input Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Base Amount */}
            <div className="nn-well p-4">
              <label className="nn-lab mb-2 block">Base Harvest Amount</label>
              <input
                type="number"
                min={HARVEST_MIN}
                max={HARVEST_MAX}
                value={baseAmount}
                onChange={(e) => setBaseAmount(parseInt(e.target.value) || 0)}
                className="nn-input w-full"
              />
              <p className="nn-footnote mt-1">Actual roll range: {HARVEST_MIN}–{HARVEST_MAX} (the server rolls this per harvest)</p>
            </div>

            {/* Resource selector — digger bonuses are per-resource */}
            <div className="nn-well p-4">
              <label className="nn-lab mb-2 block">Resource</label>
              <div className="flex gap-2">
                {(['metal', 'energy'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setResource(r)}
                    className={`nn-btn nn-btn--flex ${resource === r ? 'nn-btn--green' : ''}`}
                  >
                    {r === 'metal' ? 'Metal Node' : 'Energy Node'}
                  </button>
                ))}
              </div>
              <p className="nn-footnote mt-2">
                Diggers are per-resource: this node&apos;s gathering bonus is
                <b style={{ color: 'var(--nn-green)' }}> +{gatheringBonusPct}%</b>
              </p>
            </div>

            {/* Digger Bonus — read-only now: it IS players.gatheringBonus */}
            <div className="nn-well p-4">
              <label className="nn-lab mb-2 block">
                Gathering Bonus (%)
                <span className="nn-chip nn-chip--green ml-2">AUTO</span>
              </label>
              <p className="nn-num" style={{ fontSize: 20, color: 'var(--nn-green)' }}>+{gatheringBonusPct}%</p>
              <p className="nn-footnote mt-1">Permanent, from your diggers (raises automatically on new digs)</p>
            </div>

            {/* Shrine Bonus — read-only: it IS the live boost sum */}
            <div className="nn-well p-4">
              <label className="nn-lab mb-2 block">
                Shrine Boost (%)
                <span className="nn-chip nn-chip--green ml-2">AUTO</span>
              </label>
              <p className="nn-num" style={{ fontSize: 20, color: 'var(--nn-cyan)' }}>+{shrineBonusPct.toFixed(0)}%</p>
              <p className="nn-footnote mt-1">Sum of your active shrine boosts{temporaryBonusPct > 0 ? ` + legacy item boost (${temporaryBonusPct}%)` : ''}</p>
            </div>

            {/* Balance — the REAL four-tier system, read-only */}
            <div className="nn-well p-4">
              <label className="nn-lab mb-2 block">
                Army Balance
                <span className="nn-chip nn-chip--green ml-2">AUTO</span>
              </label>
              <p className="nn-num" style={{ fontSize: 20, color: estimate.terms.balanceMultiplier < 1 ? 'var(--nn-magenta)' : estimate.terms.balanceMultiplier > 1 ? 'var(--nn-green)' : 'var(--nn-text-secondary)' }}>
                ×{estimate.terms.balanceMultiplier}
              </p>
              <p className="nn-footnote mt-1">
                {estimate.terms.balanceStatus.toLowerCase()} tier — CRITICAL 0.75 · IMBALANCED 0.90 · BALANCED 1.00 · OPTIMAL 1.10 gathering
              </p>
            </div>

            {/* VIP Toggle */}
            <div className="nn-well p-4 md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isVIP}
                  onChange={(e) => setIsVIP(e.target.checked)}
                  className="nn-input"
                  style={{ width: 16, height: 16 }}
                />
                <span className="nn-lab">
                  VIP Status (2x Multiplier)
                  <span className="nn-chip nn-chip--green ml-2">AUTO</span>
                </span>
              </label>
            </div>
          </div>

          {/* Results Display */}
          <div className="nn-surface nn-surface--dark p-6 border border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="nn-lab mb-1">Base Amount</p>
                <p className="nn-num text-2xl font-bold" style={{ color: 'var(--nn-cyan)' }}>{baseAmount.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="nn-lab mb-1">Total Bonus</p>
                <p className="nn-num text-2xl font-bold" style={{ color: 'var(--nn-green)' }}>+{totalBonus.toLocaleString()}</p>
              </div>
              <div className="text-center">
                <p className="nn-lab mb-1">Final Harvest</p>
                <p className="nn-num text-3xl font-bold" style={{ color: 'var(--nn-amber)' }}>{finalAmount.toLocaleString()}</p>
              </div>
            </div>

            <div className="text-center pt-4 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)]">
              <p className="text-lg nn-text-secondary">
                Total Increase: <span className="nn-num font-bold" style={{ color: 'var(--nn-green)' }}>{bonusPercentage}%</span>
              </p>
            </div>

            {/* Breakdown — mirrors the shared estimate pipeline term-for-term */}
            <div className="mt-6 space-y-2">
              <p className="nn-lab">Calculation Breakdown (server-identical):</p>
              <div className="nn-well p-3 space-y-1" style={{ fontSize: 12.5, color: 'var(--nn-text-secondary)' }}>
                <p>1. Base roll: <span className="nn-num">{baseAmount.toLocaleString()}</span></p>
                {gatheringBonusPct + temporaryBonusPct + shrineBonusPct > 0 && (
                  <p>2. Bonuses (+{gatheringBonusPct}% gathering{temporaryBonusPct ? ` +${temporaryBonusPct}% legacy` : ''}{shrineBonusPct > 0 ? ` +${shrineBonusPct.toFixed(0)}% shrine` : ''}): <span className="nn-num">+{Math.floor(baseAmount * ((gatheringBonusPct + temporaryBonusPct + shrineBonusPct) / 100)).toLocaleString()}</span></p>
                )}
                {estimate.terms.vip && <p className="font-bold" style={{ color: 'var(--nn-amber)' }}>3. VIP ×2</p>}
                {estimate.terms.balanceMultiplier !== 1 && (
                  <p>4. Balance ({estimate.terms.balanceStatus.toLowerCase()}): ×{estimate.terms.balanceMultiplier}</p>
                )}
                <p className="pt-2 border-t border-[color-mix(in_oklab,var(--nn-cyan)_16%,transparent)] font-bold" style={{ color: 'var(--nn-green)' }}>= <span className="nn-num">{finalAmount.toLocaleString()}</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ECONOMY TAB COMPONENT (FID-20260909-031 — replaces COMING SOON stub)
// Market pulse · price band · 7-day resource flow · supply · top traders.
// Data: GET /api/economy/stats (server-cached 60s).
// ============================================================

interface EconomyDayFlow {
  date: string;
  harvestedMetal: number;
  harvestedEnergy: number;
  caveExplorations: number;
}

interface EconomyStatsData {
  market: {
    totalTrades: number;
    tradesToday: number;
    trades7d: number;
    totalVolume: number;
    volumeToday: number;
    volume7d: number;
    avgSalePrice: number;
    medianSalePrice: number;
    priceFloor: number;
    priceCeiling: number;
    totalFeesCollected: number;
    avgFeePct: number;
  };
  auctions: {
    activeCount: number;
    avgCurrentBidOnActive: number;
    avgBuyoutPrice: number;
    soldCount: number;
    avgSoldPrice: number;
    avgTimeToSellHours: number | null;
  };
  flow7d: {
    days: EconomyDayFlow[];
    totals: {
      harvestedMetal: number;
      harvestedEnergy: number;
      caveExplorations: number;
    };
  };
  supply: {
    walletMetal: number;
    walletEnergy: number;
    bankedMetal: number;
    bankedEnergy: number;
  };
  topTraders: Array<{ username: string; trades: number; volume: number; received: number }>;
  generatedAt: string;
}

function EconomyTab() {
  const [stats, setStats] = useState<EconomyStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/economy/stats');
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message ?? `Request failed (${response.status})`);
      }
      setStats(payload.data as EconomyStatsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load economy data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
 if (loading) {
    return (
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Economy Statistics</span>
          <span className="nn-panel__meta">MARKET ▸ SYNCING</span>
        </div>
        <div className="nn-panel__body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="nn-stat">
                <p className="nn-stat__lab">···</p>
                <p className="nn-stat__num nn-num" style={{ opacity: 0.35 }}>—</p>
              </div>
            ))}
          </div>
          <p className="nn-footnote mt-4" style={{ textAlign: 'center' }}>Syncing market data…</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="nn-panel">
        <div className="nn-panel__header">
          <span className="nn-panel__title">Economy Statistics</span>
          <span className="nn-panel__meta">MARKET ▸ OFFLINE</span>
        </div>
        <div className="nn-panel__body">
          <div className="nn-note" style={{ borderColor: 'color-mix(in oklab, var(--nn-magenta) 45%, transparent)' }}>
            <CircleAlert className="h-4 w-4 flex-none" style={{ color: 'var(--nn-magenta)' }} />
            <span>{error ?? 'Economy data unavailable'}</span>
          </div>
          <div className="mt-4" style={{ textAlign: 'center' }}>
            <button type="button" className="nn-btn nn-btn--primary" onClick={() => void load()}>
              RETRY
            </button>
          </div>
        </div>
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString();
  const flowMax = Math.max(
    1,
    ...stats.flow7d.days.map((d) => Math.max(d.harvestedMetal, d.harvestedEnergy))
  );

  return (
    <div className="nn-panel">
      <div className="nn-panel__header">
        <span className="nn-panel__title">Economy Statistics</span>
        <span className="nn-panel__meta flex items-center gap-3">
          <span>UPDATED {new Date(stats.generatedAt).toLocaleTimeString()}</span>
          <button
            type="button"
            className="nn-btn nn-btn--ghost"
            style={{ padding: '2px 10px', fontSize: 10 }}
            onClick={() => void load()}
            disabled={loading}
          >
            REFRESH
          </button>
        </span>
      </div>
      <div className="nn-panel__body">
        {/* MARKET PULSE */}
        <div className="nn-sec mb-3">
          <span className="nn-lab">Market Pulse</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="nn-stat">
            <p className="nn-stat__lab flex items-center gap-2">
              <Coins className="h-3.5 w-3.5" />
              Total Trades
            </p>
            <p className="nn-stat__num nn-stat__num--glow-green nn-num">{fmt(stats.market.totalTrades)}</p>
            <p className="nn-footnote">{fmt(stats.market.trades7d)} in 7d · {fmt(stats.market.tradesToday)} today</p>
          </div>
          <div className="nn-stat">
            <p className="nn-stat__lab flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5" />
              7d Volume
            </p>
            <p className="nn-stat__num nn-stat__num--glow-cyan nn-num">{fmt(stats.market.volume7d)}</p>
            <p className="nn-footnote">{fmt(stats.market.totalVolume)} all-time</p>
          </div>
          <div className="nn-stat">
            <p className="nn-stat__lab flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5" />
              Avg Sale
            </p>
            <p className="nn-stat__num nn-stat__num--glow-amber nn-num">{fmt(stats.market.avgSalePrice)}</p>
            <p className="nn-footnote">median {fmt(stats.market.medianSalePrice)}</p>
          </div>
          <div className="nn-stat">
            <p className="nn-stat__lab flex items-center gap-2">
              <Percent className="h-3.5 w-3.5" />
              Fees Collected
            </p>
            <p className="nn-stat__num nn-stat__num--glow-magenta nn-num">{fmt(stats.market.totalFeesCollected)}</p>
            <p className="nn-footnote">{stats.market.avgFeePct}% avg sink</p>
          </div>
        </div>

        {/* PRICE BAND + ACTIVE BOOK */}
        <div className="nn-sec mt-6 mb-3">
          <span className="nn-lab">Price Band & Active Book</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="nn-well p-4" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <span className="nn-lab">Completed Sales</span>
            <div className="grid grid-cols-3 gap-2" style={{ textAlign: 'center' }}>
              <div>
                <p className="nn-lab">Floor</p>
                <p className="nn-num text-lg" style={{ color: 'var(--nn-text-secondary)' }}>{fmt(stats.market.priceFloor)}</p>
              </div>
              <div>
                <p className="nn-lab">Median</p>
                <p className="nn-num text-lg" style={{ color: 'var(--nn-cyan)' }}>{fmt(stats.market.medianSalePrice)}</p>
              </div>
              <div>
                <p className="nn-lab">Ceiling</p>
                <p className="nn-num text-lg" style={{ color: 'var(--nn-amber)' }}>{fmt(stats.market.priceCeiling)}</p>
              </div>
            </div>
          </div>
          <div className="nn-well p-4" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <span className="nn-lab">Active Listings ({fmt(stats.auctions.activeCount)})</span>
            <div className="grid grid-cols-2 gap-2" style={{ textAlign: 'center' }}>
              <div>
                <p className="nn-lab">Avg Bid</p>
                <p className="nn-num text-lg" style={{ color: 'var(--nn-violet)' }}>{fmt(stats.auctions.avgCurrentBidOnActive)}</p>
              </div>
              <div>
                <p className="nn-lab">Avg Buyout</p>
                <p className="nn-num text-lg" style={{ color: 'var(--nn-magenta)' }}>{fmt(stats.auctions.avgBuyoutPrice)}</p>
              </div>
            </div>
            <p className="nn-footnote" style={{ textAlign: 'center' }}>
              {fmt(stats.auctions.soldCount)} sold · avg {fmt(stats.auctions.avgSoldPrice)}
              {stats.auctions.avgTimeToSellHours !== null && ` · sells in ~${stats.auctions.avgTimeToSellHours}h`}
            </p>
          </div>
        </div>

        {/* 7-DAY RESOURCE FLOW */}
        <div className="nn-sec mt-6 mb-3">
          <span className="nn-lab">Resource Flow · 7 Days</span>
        </div>
        <div className="nn-well p-4" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          {stats.flow7d.days.map((day) => (
            <div key={day.date} className="flex items-center gap-3">
              <span className="nn-lab" style={{ width: 84, flex: 'none' }}>
                {new Date(`${day.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <div className="nn-meter h-2" style={{ flex: 1 }}>
                <div className="nn-meter__fill" style={{ width: `${Math.max(2, (day.harvestedMetal / flowMax) * 100)}%` }} />
              </div>
              <span className="nn-num" style={{ width: 72, textAlign: 'right', color: 'var(--nn-amber)', fontSize: 12 }}>{fmt(day.harvestedMetal)}</span>
              <div className="nn-meter h-2" style={{ flex: 1 }}>
                <div className="nn-meter__fill" style={{ width: `${Math.max(2, (day.harvestedEnergy / flowMax) * 100)}%` }} />
              </div>
              <span className="nn-num" style={{ width: 72, textAlign: 'right', color: 'var(--nn-cyan)', fontSize: 12 }}>{fmt(day.harvestedEnergy)}</span>
              <span className="nn-chip nn-chip--violet" style={{ width: 58, textAlign: 'center', flex: 'none' }} title="Cave explorations">{fmt(day.caveExplorations)} caves</span>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid color-mix(in oklab, var(--nn-cyan) 16%, transparent)' }}>
            <span className="nn-lab" style={{ width: 84, flex: 'none' }}>Totals</span>
            <span className="nn-num" style={{ flex: 1, textAlign: 'right', color: 'var(--nn-amber)' }}>{fmt(stats.flow7d.totals.harvestedMetal)}</span>
            <span style={{ width: 8 }} />
            <span className="nn-num" style={{ flex: 1, textAlign: 'right', color: 'var(--nn-cyan)' }}>{fmt(stats.flow7d.totals.harvestedEnergy)}</span>
            <span className="nn-num" style={{ width: 58, textAlign: 'center', color: 'var(--nn-violet)', fontSize: 12 }}>{fmt(stats.flow7d.totals.caveExplorations)}</span>
          </div>
          <p className="nn-footnote" style={{ textAlign: 'center' }}>Metal ▸ amber · Energy ▸ cyan · caves per day ▸ violet chip</p>
        </div>

        {/* SYSTEM SUPPLY */}
        <div className="nn-sec mt-6 mb-3">
          <span className="nn-lab">System Supply</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="nn-stat">
            <p className="nn-stat__lab">Wallet Metal</p>
            <p className="nn-stat__num nn-stat__num--glow-amber nn-num">{fmt(stats.supply.walletMetal)}</p>
          </div>
          <div className="nn-stat">
            <p className="nn-stat__lab">Wallet Energy</p>
            <p className="nn-stat__num nn-stat__num--glow-cyan nn-num">{fmt(stats.supply.walletEnergy)}</p>
          </div>
          <div className="nn-stat">
            <p className="nn-stat__lab">Banked Metal</p>
            <p className="nn-stat__num nn-stat__num--glow-amber nn-num" style={{ opacity: 0.75 }}>{fmt(stats.supply.bankedMetal)}</p>
          </div>
          <div className="nn-stat">
            <p className="nn-stat__lab">Banked Energy</p>
            <p className="nn-stat__num nn-stat__num--glow-cyan nn-num" style={{ opacity: 0.75 }}>{fmt(stats.supply.bankedEnergy)}</p>
          </div>
        </div>

        {/* TOP TRADERS */}
        <div className="nn-sec mt-6 mb-3">
          <span className="nn-lab">Top Traders</span>
        </div>
        {stats.topTraders.length === 0 ? (
          <p className="nn-footnote" style={{ textAlign: 'center' }}>No trades recorded yet.</p>
        ) : (
          <div className="nn-well p-2" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
            {stats.topTraders.map((trader, idx) => {
              const rankAccent =
                idx === 0 ? 'var(--nn-amber)' :
                idx === 1 ? 'var(--nn-cyan)' :
                idx === 2 ? 'var(--nn-violet)' :
                'var(--nn-text-tertiary)';
              return (
                <div key={trader.username} className="nn-row">
                  <span className="nn-row__label">
                    <span className="nn-num" style={{ color: rankAccent, width: 34, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {trader.username}
                  </span>
                  <span className="nn-row__value">
                    <span className="nn-num">{fmt(trader.volume)}</span>
                    <span className="nn-chip ml-2">{trader.trades} trades</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

interface LeaderboardRowProps {
  player: LeaderboardPlayer;
  rank: number;
  sortBy: string;
}

function LeaderboardRow({ player, rank, sortBy }: LeaderboardRowProps) {
  const rankAccent =
    rank === 1 ? 'var(--nn-amber)' :
    rank === 2 ? 'var(--nn-cyan)' :
    rank === 3 ? 'var(--nn-violet)' :
    'var(--nn-text-tertiary)';

  const getHighlightedValue = () => {
    if (sortBy === 'combatPower') return player.combatPower?.toLocaleString() ?? '0';
    if (sortBy === 'level') return player.level?.toLocaleString() ?? '0';
    if (sortBy === 'resources.metal') return player.resources?.metal?.toLocaleString() ?? '0';
    if (sortBy === 'resources.energy') return player.resources?.energy?.toLocaleString() ?? '0';
    return player.combatPower?.toLocaleString() ?? '0';
  };

  return (
    <div className="nn-row" style={rank <= 3 ? { background: `color-mix(in oklab, ${rankAccent} 5%, transparent)` } : undefined}>
      <span className="nn-row__label">
        <span className="nn-num" style={{ color: rankAccent, width: 34, textAlign: 'center', fontSize: 14, fontWeight: 700 }}>
          {rank <= 3 ? <Trophy className="w-4 h-4 inline" /> : `#${rank}`}
        </span>
        <span style={{ color: 'var(--nn-text-primary)', fontWeight: 600 }}>{player.username}</span>
        <span className="nn-lab">LVL {player.level ?? 0}</span>
      </span>
      <span className="nn-row__value nn-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: rank <= 3 ? rankAccent : 'var(--nn-text-primary)' }}>
        {sortBy === 'combatPower' && <><Swords style={{ width: 13, height: 13 }} />{getHighlightedValue()}</>}
        {sortBy === 'level' && <><Award style={{ width: 13, height: 13 }} />{getHighlightedValue()}</>}
        {(sortBy === 'resources.metal' || sortBy === 'resources.energy') && <><Coins style={{ width: 13, height: 13 }} />{getHighlightedValue()}</>}
      </span>
    </div>
  );
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Three-tab interface: Personal Stats, Game Stats, Economy
// - Personal tab fetches from /api/player/stats
// - Game tab fetches from /api/stats with sort parameter
// - Uses only metal and energy resources (ECHO compliant)
// - Optional chaining (?.) for all data access
// - Responsive grid layouts for stats display
// - Auto-closes when player moves (handled by GameLayout)
// - FID-20260909-028 §2.5: token primitives only — nn-sec/nn-sz/nn-stat/
//   nn-panel/nn-row/nn-chip/nn-well/nn-num/nn-lab; zero gradients, zero emoji
// ============================================================
// END OF FILE
// ============================================================
