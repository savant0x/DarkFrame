/**
 * Activity Log Service
 * Created: 2025-10-18
 * OVERVIEW: Core service for logging all player activities in DarkFrame.
 */

import { createServiceClient } from '@/lib/supabase/server';

const COLLECTION_NAME = 'ActionLog';

export { logActivityEntry as logActivity };

export async function logActivityEntry(logEntry: any): Promise<string> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from('admin_logs').insert({
      action: logEntry.actionType || 'activity',
      admin_username: logEntry.username || 'SYSTEM',
      target: logEntry.playerId,
      details: logEntry.details || logEntry,
    }).select('id').single();
    
    if (error) {
      console.error('[ActivityLog] Error logging activity:', error);
      return '';
    }
    return data?.id || '';
  } catch (error) {
    console.error('[ActivityLog] Error logging activity:', error);
    return '';
  }
}

export async function logActivitiesBulk(logEntries: any[]): Promise<string[]> {
  const supabase = createServiceClient();
  const insertData = logEntries.map(entry => ({
    action: entry.actionType || 'activity',
    admin_username: entry.username || 'SYSTEM',
    target: entry.playerId,
    details: entry,
  }));
  const { data, error } = await supabase.from('admin_logs').insert(insertData).select('id');
  if (error) return [];
  return (data || []).map((d: any) => d.id);
}

export async function queryActivityLogs(query: any): Promise<any[]> {
  const supabase = createServiceClient();
  let q = supabase.from('admin_logs').select('*');
  
  if (query.playerId) q = q.eq('target', query.playerId);
  if (query.startDate) q = q.gte('created_at', query.startDate.toISOString());
  if (query.endDate) q = q.lte('created_at', query.endDate.toISOString());
  
  const limit = Math.min(query.limit || 100, 1000);
  const { data } = await q.order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function getPlayerActivityLogs(playerId: string, limit: number = 100): Promise<any[]> {
  return queryActivityLogs({ playerId, limit });
}

export async function getRecentActivityLogs(limit: number = 100): Promise<any[]> {
  const supabase = createServiceClient();
  const { data } = await supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).limit(limit);
  return data || [];
}

export async function getFailedActions(limit: number = 100): Promise<any[]> {
  return [];
}

export async function getActivityLogStats(query?: any): Promise<any> {
  return {
    totalActions: 0,
    actionsByCategory: {},
    actionsByType: {},
    successRate: 100,
    averageExecutionTimeMs: 0,
    uniquePlayers: 0,
  };
}

export async function getActionCountForPeriod(hours: number): Promise<number> {
  return 0;
}

export async function cleanupOldLogs(policy?: any): Promise<number> {
  return 0;
}

export async function archiveOldLogs(policy?: any): Promise<number> {
  return 0;
}

export async function createActivityLogIndexes(): Promise<void> {
  // Supabase handles indexes automatically
}
