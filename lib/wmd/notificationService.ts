/**
 * @file lib/wmd/notificationService.ts
 * @created 2025-10-22
 * @overview WMD Notification Service - Event Broadcasting
 * 
 * OVERVIEW:
 * Creates and manages WMD notifications using the proper type structure.
 * Production notification service with complete database integration.
 * 
 * Features:
 * - Proper notification structure matching WMDNotification type
 * - Helper functions for common notification scenarios
 * - Query functions for retrieving notifications
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { WMDNotification, WMDEventType, NotificationPriority, NotificationScope } from '@/types/wmd';

/**
 * Create a WMD notification
 */
export async function createWMDNotification(
  eventType: WMDEventType,
  priority: NotificationPriority,
  scope: NotificationScope,
  sourceId: string,
  sourceName: string,
  title: string,
  message: string,
  details: any = {},
  targetId?: string,
  targetName?: string
): Promise<{ success: boolean; notificationId?: string }> {
  try {
    const supabase = createServiceClient();
    const notificationId = `wmd_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data, error } = await supabase
      .from('wmd_notifications')
      .insert({
        player_id: sourceId,
        notification_type: eventType as unknown as Database['public']['Enums']['wmd_notification_type'],
        title,
        message,
        data: {
          priority,
          scope,
          sourceId,
          sourceName,
          targetId,
          targetName,
          ...details,
        },
        is_read: false,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating WMD notification:', error);
      return { success: false };
    }
    
    return { success: true, notificationId: data?.id || notificationId };
    
  } catch (error) {
    console.error('Error creating WMD notification:', error);
    return { success: false };
  }
}

/**
 * Quick helper: Missile launched notification
 */
export async function notifyMissileLaunch(
  launcherId: string,
  launcherName: string,
  targetId: string,
  targetName: string,
  missileId: string,
  warheadType: string
): Promise<void> {
  await createWMDNotification(
    WMDEventType.MISSILE_LAUNCHED,
    NotificationPriority.CRITICAL,
    NotificationScope.GLOBAL,
    launcherId,
    launcherName,
    '🚀 Missile Launched',
    `${launcherName} has launched a ${warheadType} missile at ${targetName}!`,
    { missileId, warheadType },
    targetId,
    targetName
  );
}

/**
 * Quick helper: Research completed notification
 */
export async function notifyResearchComplete(
  playerId: string,
  playerName: string,
  techId: string,
  techName: string,
  tier: number
): Promise<void> {
  await createWMDNotification(
    WMDEventType.RESEARCH_COMPLETED,
    NotificationPriority.INFO,
    NotificationScope.PERSONAL,
    playerId,
    playerName,
    '🔬 Research Complete',
    `${techName} (Tier ${tier}) research completed!`,
    { techId, techTier: tier }
  );
}

/**
 * Get notifications for display
 */
export async function getNotifications(
  scope: NotificationScope,
  limit: number = 50
): Promise<WMDNotification[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wmd_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (!data) return [];
    
    return data.map((n: any) => ({
      notificationId: n.id,
      eventType: n.notification_type as WMDEventType,
      priority: n.data?.priority || NotificationPriority.INFO,
      scope: n.data?.scope || NotificationScope.PERSONAL,
      sourceId: n.player_id,
      sourceName: n.data?.sourceName || '',
      targetId: n.data?.targetId,
      targetName: n.data?.targetName,
      details: n.data || {},
      title: n.title,
      message: n.message,
      broadcastAt: new Date(n.created_at),
      viewCount: 0,
      viewedBy: [],
      createdAt: new Date(n.created_at),
    })) as WMDNotification[];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}
