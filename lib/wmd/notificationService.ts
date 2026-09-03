/**
 * @file lib/wmd/notificationService.ts
 * @created 2025-10-22
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview WMD Notification Service - Event Broadcasting
 */

import { eq, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdNotifications } from '@/lib/db/schema/wmd';
import { WMDNotification, WMDEventType, NotificationPriority, NotificationScope } from '@/types/wmd';

/** Event-specific payload stored in wmd_notifications.details. */
type WmdNotificationDetails = Record<string, string | number | boolean | null | undefined>;

export async function createWMDNotification(
  eventType: WMDEventType,
  priority: NotificationPriority,
  scope: NotificationScope,
  sourceId: string,
  sourceName: string,
  title: string,
  message: string,
  details: WmdNotificationDetails = {},
  targetId?: string,
  targetName?: string
): Promise<{ success: boolean; notificationId?: string }> {
  try {
    const notificationId = `wmd_notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification = {
      id: notificationId,
      notificationId,
      eventType,
      priority,
      scope,
      sourceId,
      sourceName,
      targetId: targetId || null,
      targetName: targetName || null,
      details,
      title,
      message,
      broadcastAt: new Date(),
      viewCount: 0,
      viewedBy: [],
      createdAt: new Date(),
    };
    
    await db.insert(wmdNotifications).values(notification);
    
    return { success: true, notificationId };
  } catch (error) {
    console.error('Error creating WMD notification:', error);
    return { success: false };
  }
}

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

export async function getNotifications(
  scope: NotificationScope,
  limit: number = 50
): Promise<WMDNotification[]> {
  try {
    const results = await db.select()
      .from(wmdNotifications)
      .where(eq(wmdNotifications.scope, scope))
      .orderBy(desc(wmdNotifications.broadcastAt))
      .limit(limit);
    
    return results.map(r => ({
      ...r,
      details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details,
      viewedBy: typeof r.viewedBy === 'string' ? JSON.parse(r.viewedBy) : r.viewedBy,
    })) as unknown as WMDNotification[];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}
