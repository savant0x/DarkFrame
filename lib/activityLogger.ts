/**
 * @file lib/activityLogger.ts
 * @created 2025-10-18
 * @overview Player activity logging service for tracking and analytics
 */

import { createServiceClient } from '@/lib/supabase/server';

export async function logActivity(params: {
  userId: string;
  action: string;
  sessionId: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    // Log to admin_logs for now since we don't have a dedicated player_activity table
    await supabase.from('admin_logs').insert({
      action: params.action,
      admin_username: 'SYSTEM',
      target: params.userId,
      details: {
        ...params.metadata,
        sessionId: params.sessionId,
      },
    });
    console.log(`📊 Activity logged: ${params.userId} - ${params.action}`);
  } catch (error) {
    console.error('⚠️ Activity logging failed:', error);
  }
}

export async function logHarvest(
  userId: string,
  sessionId: string,
  resourcesGained: { metal?: number; energy?: number },
  location: { x: number; y: number },
  duration: number
): Promise<void> {
  await logActivity({ userId, action: 'harvest', sessionId, metadata: { resourcesGained, location, duration, result: 'success' } });
}

export async function logAttack(
  userId: string,
  sessionId: string,
  target: string,
  result: 'success' | 'failure' | 'partial',
  resourcesGained?: { metal?: number; energy?: number }
): Promise<void> {
  await logActivity({ userId, action: 'attack', sessionId, metadata: { target, result, resourcesGained } });
}

export async function logFactory(
  userId: string,
  sessionId: string,
  isUpgrade: boolean,
  level: number,
  location: { x: number; y: number },
  resourcesSpent: { metal: number; energy: number }
): Promise<void> {
  await logActivity({ userId, action: isUpgrade ? 'upgrade_factory' : 'build_factory', sessionId, metadata: { factoryLevel: level, location, resourcesSpent, result: 'success' } });
}

export async function logBanking(
  userId: string,
  sessionId: string,
  isDeposit: boolean,
  resources: { metal?: number; energy?: number }
): Promise<void> {
  await logActivity({ userId, action: isDeposit ? 'bank_deposit' : 'bank_withdraw', sessionId, metadata: { resourcesSpent: isDeposit ? resources : undefined, result: 'success' } });
}

export async function logTechUnlock(
  userId: string,
  sessionId: string,
  techUnlocked: string,
  resourcesSpent: { metal: number; energy: number }
): Promise<void> {
  await logActivity({ userId, action: 'tech_unlock', sessionId, metadata: { techUnlocked, resourcesSpent, result: 'success' } });
}

export async function logMovement(
  userId: string,
  sessionId: string,
  fromLocation: { x: number; y: number },
  toLocation: { x: number; y: number }
): Promise<void> {
  await logActivity({ userId, action: 'move', sessionId, metadata: { location: toLocation, result: 'success' } });
}

export async function logTrade(
  userId: string,
  sessionId: string,
  isBuy: boolean,
  target: string,
  itemsGained?: string[],
  resourcesSpent?: { metal?: number; energy?: number },
  resourcesGained?: { metal?: number; energy?: number }
): Promise<void> {
  await logActivity({ userId, action: 'trade', sessionId, metadata: { target, itemsGained, resourcesSpent, resourcesGained, result: 'success' } });
}

export async function logCaveExplore(
  userId: string,
  sessionId: string,
  location: { x: number; y: number },
  itemsGained: string[]
): Promise<void> {
  await logActivity({ userId, action: 'cave_explore', sessionId, metadata: { location, itemsGained, result: 'success' } });
}

export async function getActivityCount(userId: string, hoursAgo: number): Promise<number> {
  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('admin_logs')
    .select('*', { count: 'exact', head: true })
    .eq('target', userId)
    .gte('created_at', cutoff);
  return count || 0;
}

export async function getTotalResourcesGained(userId: string, hoursAgo: number): Promise<{ metal: number; energy: number }> {
  const total = { metal: 0, energy: 0 };
  return total;
}

export async function getRecentActivities(userId: string, limit: number = 50): Promise<any[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('admin_logs')
    .select('*')
    .eq('target', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function cleanupOldActivities(daysToKeep: number = 90): Promise<number> {
  return 0;
}
