/**
 * Clan Activity Service - Activity Logging & Feed
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan activity logging and activity feed generation.
 * Provides filtered views of clan activities for members and analytics.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  ClanActivityType,
} from '@/types/clan.types';

export async function logClanActivity(
  clanId: string,
  activityType: ClanActivityType,
  playerId?: string,
  details?: Record<string, any>
): Promise<any> {
  const supabase = createServiceClient();

  let username: string | undefined;
  if (playerId) {
    const { data: player } = await supabase.from('players').select('username').eq('username', playerId).single();
    username = player?.username || playerId;
  }

  const { data, error } = await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: activityType,
    player_id: playerId || null,
    username: username || null,
    details: details || {},
  }).select('*').single();

  if (error) {
    console.error('Failed to log clan activity:', error);
  }

  return data;
}

export async function getClanActivityFeed(
  clanId: string,
  options: {
    limit?: number;
    offset?: number;
    activityTypes?: ClanActivityType[];
    playerId?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<any[]> {
  const supabase = createServiceClient();
  
  const { limit = 100, offset = 0, activityTypes, playerId, startDate, endDate } = options;

  let query = supabase
    .from('clan_activity')
    .select('*')
    .eq('clan_id', clanId);

  if (activityTypes && activityTypes.length > 0) {
    query = query.in('activity_type', activityTypes);
  }

  if (playerId) {
    query = query.eq('player_id', playerId);
  }

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString());
  }

  if (endDate) {
    query = query.lte('created_at', endDate.toISOString());
  }

  const { data } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return data || [];
}

export async function getActivityStats(
  clanId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Record<string, number>> {
  const supabase = createServiceClient();

  let query = supabase
    .from('clan_activity')
    .select('activity_type, count')
    .eq('clan_id', clanId);

  if (startDate) query = query.gte('created_at', startDate.toISOString());
  if (endDate) query = query.lte('created_at', endDate.toISOString());

  const { data } = await query;

  if (!data) return {} as unknown as Record<string, number>;

  let researchContributions = 0;
  let bankDeposits = 0;
  let territoriesClaimed = 0;
  const activities = data || [];

  for (const item of data) {
    const type = item.activity_type;
    if (type === 'RESEARCH_CONTRIBUTED') researchContributions++;
    if (type === 'BANK_DEPOSIT') bankDeposits++;
    if (type === 'TERRITORY_CLAIMED') territoriesClaimed++;
  }

  const activityScore = researchContributions * 10 + bankDeposits * 5 + territoriesClaimed * 15 + activities.length;

  return {
    totalActivities: activities.length,
    researchContributions,
    bankDeposits,
    territoriesClaimed,
    activityScore,
  };
}

export async function cleanupOldActivities(clanId: string, daysToKeep: number = 30): Promise<number> {
  const supabase = createServiceClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const { error, count } = await supabase
    .from('clan_activity')
    .delete({ count: 'exact' })
    .eq('clan_id', clanId)
    .lt('created_at', cutoffDate.toISOString());

  return count || 0;
}
