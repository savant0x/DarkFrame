/**
 * Ranking Service — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { calculateBalanceEffects } from '@/lib/balanceService';

export interface RankedPlayer {
  rank: number;
  username: string;
  effectivePower: number;
  totalPower: number;
  balanceMultiplier: number;
  balanceStatus: string;
  totalStrength: number;
  totalDefense: number;
  factoriesOwned: number;
  level?: number;
  validatedReferrals?: number;
}

export interface LeaderboardData {
  leaderboard: RankedPlayer[];
  currentPlayerRank: number | null;
  totalPlayers: number;
  lastUpdated: Date;
}

export function calculateEffectivePower(player: { totalStrength: number; totalDefense: number }): number {
  const totalPower = player.totalStrength + player.totalDefense;
  if (totalPower === 0) return 0;
  const effects = calculateBalanceEffects(player.totalStrength, player.totalDefense);
  return Math.floor(totalPower * effects.powerMultiplier);
}

interface PlayerPower {
  username: string;
  effectivePower: number;
  totalPower: number;
  balanceMultiplier: number;
  balanceStatus: string;
  totalStrength: number;
  totalDefense: number;
  level: number;
}

async function fetchAndRankPlayers(): Promise<PlayerPower[]> {
  const supabase = createServiceClient();
  const { data: players } = await supabase.from('players')
    .select('username, total_strength, total_defense, level')
    .neq('is_bot', true)
    .order('total_strength', { ascending: false });

  const ranked = (players || []).map(p => {
    const str = p.total_strength || 0;
    const def = p.total_defense || 0;
    const tp = str + def;
    const effects = calculateBalanceEffects(str, def);
    return { username: p.username, effectivePower: Math.floor(tp * effects.powerMultiplier), totalPower: tp, balanceMultiplier: effects.powerMultiplier, balanceStatus: effects.status, totalStrength: str, totalDefense: def, level: p.level || 1 };
  });

  ranked.sort((a, b) => b.effectivePower !== a.effectivePower ? b.effectivePower - a.effectivePower : a.username.localeCompare(b.username));
  return ranked;
}

async function getFactoryCounts(usernames: string[]): Promise<Map<string, number>> {
  if (!usernames.length) return new Map();
  const supabase = createServiceClient();
  const { data } = await supabase.from('factories').select('owner').in('owner', usernames);
  const map = new Map<string, number>();
  for (const f of (data || [])) { const key = f.owner || ''; map.set(key, (map.get(key) || 0) + 1); }
  return map;
}

export async function getTopPlayers(limit: number = 100): Promise<RankedPlayer[]> {
  const ranked = await fetchAndRankPlayers();
  const top = ranked.slice(0, limit);
  const factoryMap = await getFactoryCounts(top.map(p => p.username));
  return top.map((p, i) => ({ rank: i + 1, ...p, factoriesOwned: factoryMap.get(p.username) || 0 }));
}

export async function getPlayerRank(username: string): Promise<number | null> {
  const ranked = await fetchAndRankPlayers();
  const idx = ranked.findIndex(p => p.username === username);
  return idx === -1 ? null : idx + 1;
}

export async function getPlayerRankData(username: string): Promise<{ rank: number | null; totalPlayers: number; effectivePower: number; playerAbove?: RankedPlayer; playerBelow?: RankedPlayer } | null> {
  const ranked = await fetchAndRankPlayers();
  const idx = ranked.findIndex(p => p.username === username);
  if (idx === -1) return null;
  const current = ranked[idx];
  const supabase = createServiceClient();
  const { count } = await supabase.from('factories').select('*', { count: 'exact', head: true }).eq('owner', username);
  return {
    rank: idx + 1, totalPlayers: ranked.length, effectivePower: current.effectivePower,
    playerAbove: idx > 0 ? { rank: idx, ...ranked[idx - 1], factoriesOwned: 0 } : undefined,
    playerBelow: idx < ranked.length - 1 ? { rank: idx + 2, ...ranked[idx + 1], factoriesOwned: 0 } : undefined,
    ...{ factoriesOwned: count || 0 },
  } as never as { rank: number; totalPlayers: number; effectivePower: number; playerAbove?: RankedPlayer; playerBelow?: RankedPlayer };
}

export async function getTotalPlayerCount(): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).neq('is_bot', true);
  return count || 0;
}

export function formatRank(rank: number): string {
  if (rank === 1) return '🥇 #1';
  if (rank === 2) return '🥈 #2';
  if (rank === 3) return '🥉 #3';
  return `#${rank}`;
}
