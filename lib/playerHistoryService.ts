/**
 * @file lib/playerHistoryService.ts
 * @overview Player level history tracking — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { logger } from './logger';

export interface PlayerSnapshot {
  id?: string;
  username: string;
  level: number;
  changed_at: string;
}

export interface PlayerGrowthRate {
  userId: string; currentLevel: number; avgLevelsPerWeek: number; projectedLevelIn2Weeks: number;
}

export interface PredictiveDistribution {
  tierDistribution: number[];
  projectedPlayerLevels: { userId: string; currentLevel: number; projectedLevel: number }[];
  generatedAt: Date; weeksAhead: number;
}

function toISO(d: Date): string { return d.toISOString(); }
function fromISO(s: string): Date { return new Date(s); }

const TABLE = 'player_level_history';

export async function capturePlayerSnapshot(userId: string, currentLevel: number): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from(TABLE).insert({ username: userId, level: currentLevel, changed_at: toISO(new Date()) });
    if (error) logger.error('Failed to capture player snapshot', error);
  } catch (error) { logger.error('Failed to capture player snapshot', error); }
}

export async function getPlayerGrowthRate(userId: string): Promise<PlayerGrowthRate | null> {
  try {
    const supabase = createServiceClient();
    const { data: snapshots } = await supabase.from(TABLE).select('username, level, changed_at').eq('username', userId).order('changed_at', { ascending: true });
    if (!snapshots || snapshots.length < 2) return null;

    const currentLevel = snapshots[snapshots.length - 1].level;
    const lastTS = snapshots[snapshots.length - 1].changed_at || new Date().toISOString();
    const firstTS = snapshots[0].changed_at || new Date().toISOString();
    const timeDiffMs = fromISO(lastTS).getTime() - fromISO(firstTS).getTime();
    const weeks = timeDiffMs / (7 * 24 * 60 * 60 * 1000);
    if (weeks === 0) return null;

    const levelsGained = snapshots[snapshots.length - 1].level - snapshots[0].level;
    return { userId, currentLevel, avgLevelsPerWeek: levelsGained / weeks, projectedLevelIn2Weeks: Math.max(currentLevel, Math.round(currentLevel + ((levelsGained / weeks) * 2))) };
  } catch (error) { logger.error('Failed to calculate growth rate', error); return null; }
}

export async function predictPlayerLevels(weeksAhead = 2): Promise<{ userId: string; currentLevel: number; projectedLevel: number }[]> {
  try {
    const supabase = createServiceClient();
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentSnapshots } = await supabase.from(TABLE).select('username, level, changed_at').gte('changed_at', toISO(sevenDaysAgo));
    if (!recentSnapshots) return [];

    const predictions = [];
    for (const snap of recentSnapshots) {
      const { data: history } = await supabase.from(TABLE).select('username, level, changed_at').eq('username', snap.username).order('changed_at', { ascending: true });
      if (!history || history.length < 2) { predictions.push({ userId: snap.username || '', currentLevel: snap.level || 1, projectedLevel: snap.level || 1 }); continue; }

      const currentLevel = history[history.length - 1].level || 1;
      const hLast = history[history.length - 1].changed_at || new Date().toISOString();
      const hFirst = history[0].changed_at || new Date().toISOString();
      const timeDiffMs = fromISO(hLast).getTime() - fromISO(hFirst).getTime();
      const weeks = timeDiffMs / (7 * 24 * 60 * 60 * 1000);
      if (weeks === 0) { predictions.push({ userId: snap.username, currentLevel, projectedLevel: currentLevel }); continue; }

      const levelsGained = history[history.length - 1].level - history[0].level;
      predictions.push({ userId: snap.username, currentLevel, projectedLevel: Math.max(currentLevel, Math.round(currentLevel + ((levelsGained / weeks) * weeksAhead))) });
    }
    return predictions;
  } catch (error) { logger.error('Failed to predict player levels', error); return []; }
}

export async function generatePredictiveDistribution(weeksAhead = 2): Promise<PredictiveDistribution> {
  const projectedLevels = await predictPlayerLevels(weeksAhead);
  if (!projectedLevels.length) return { tierDistribution: [25, 25, 20, 15, 10, 5], projectedPlayerLevels: [], generatedAt: new Date(), weeksAhead };
  const tierCounts = [0, 0, 0, 0, 0, 0];
  for (const { projectedLevel } of projectedLevels) {
    let t = 0; if (projectedLevel >= 100) t = 5; else if (projectedLevel >= 75) t = 4; else if (projectedLevel >= 50) t = 3; else if (projectedLevel >= 30) t = 2; else if (projectedLevel >= 15) t = 1;
    tierCounts[t]++;
  }
  const total = projectedLevels.length;
  const dist = tierCounts.map(c => c / total * 100);
  for (let i = 0; i < 5; i++) if (dist[i] < 5) dist[i] = 5;
  const sum = dist.reduce((a, b) => a + b, 0);
  const normalized = dist.map(v => (v / sum) * 100);
  return { tierDistribution: normalized, projectedPlayerLevels: projectedLevels, generatedAt: new Date(), weeksAhead };
}

export async function purgeOldSnapshots(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const { count } = await supabase.from(TABLE).delete({ count: 'exact' }).lt('changed_at', toISO(oneYearAgo));
    return count || 0;
  } catch (error) { logger.error('Failed to purge old snapshots', error); return 0; }
}
