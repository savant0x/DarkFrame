/**
 * WMD Alert Service
 * Created: 2025-10-22
 * 
 * OVERVIEW:
 * Comprehensive alert and notification system for critical WMD events.
 * Monitors missile launches, vote completions, cooldown expirations, and suspicious activity.
 * Delivers notifications through multiple channels: in-game, admin dashboard, and email.
 * 
 * KEY FEATURES:
 * - Real-time event detection and alert creation
 * - Multi-channel notification delivery (in-game, email, dashboard)
 * - Alert severity levels (INFO, WARNING, CRITICAL)
 * - Alert acknowledgment and resolution tracking
 * - Configurable alert thresholds and rules
 * - Alert history and audit trail
 * 
 * ALERT TYPES:
 * - MISSILE_LAUNCH: When a clan launches a WMD missile
 * - MISSILE_IMPACT: When a missile hits its target
 * - MISSILE_INTERCEPTED: When a missile is intercepted by defenses
 * - VOTE_PASSED: When a clan vote succeeds
 * - VOTE_FAILED: When a clan vote fails
 * - COOLDOWN_EXPIRED: When a clan's WMD cooldown expires
 * - SUSPICIOUS_ACTIVITY: Flagged by admin or auto-detected
 * - SYSTEM_ERROR: Critical WMD system errors
 * 
 * NOTIFICATION CHANNELS:
 * - In-Game: WebSocket broadcast to affected players
 * - Dashboard: Admin dashboard real-time updates
 * - Email: Critical alerts sent to admin email (future)
 * 
 * DEPENDENCIES:
 * - Drizzle ORM for alert storage
 * - WebSocket for real-time notifications
 * - Email service for critical alerts (future)
 */

import { db } from '@/lib/db';
import { wmdAlerts, wmdConfig, clans, playerNotifications, adminDashboardNotifications, emailQueue } from '@/lib/db/schema';
import { eq, and, or, lte, gte, desc } from 'drizzle-orm';
import {
  AlertSeverity,
  AlertType,
  AlertStatus,
  NotificationChannel,
  type AlertConfig,
  type WMDAlert,
  type WmdAlertData,
} from './alert.types';

export {
  AlertSeverity,
  AlertType,
  AlertStatus,
  NotificationChannel,
  type AlertConfig,
  type WMDAlert,
} from './alert.types';

/**
 * Default alert configuration
 */
const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  minSeverity: AlertSeverity.INFO,
  channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD],
  autoAcknowledge: false,
  autoArchiveDays: 30
};

/**
 * Create a new alert
 */
export async function createAlert(
  alertData: Omit<WMDAlert, 'id' | 'createdAt' | 'status' | 'deliveryStatus'>
): Promise<WMDAlert> {
  const config = await getAlertConfig();
  
  if (!config.enabled || !meetsMinSeverity(alertData.severity, config.minSeverity)) {
    throw new Error('Alert creation blocked by configuration');
  }
  
  const alert: WMDAlert = {
    ...alertData,
    status: AlertStatus.ACTIVE,
    createdAt: new Date(),
    channels: alertData.channels || config.channels,
    deliveryStatus: {}
  };
  
  alert.channels.forEach(channel => {
    alert.deliveryStatus[channel] = { sent: false };
  });
  
  const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.insert(wmdAlerts).values({
    id: alertId,
    type: alertData.type,
    severity: alertData.severity,
    status: AlertStatus.ACTIVE,
    title: alertData.title,
    message: alertData.message,
    playerId: alertData.playerId || null,
    playerName: alertData.playerName || null,
    clanId: alertData.clanId || null,
    clanName: alertData.clanName || null,
    targetClanId: alertData.targetClanId || null,
    targetClanName: alertData.targetClanName || null,
    missileId: alertData.missileId || null,
    voteId: alertData.voteId || null,
    operationId: alertData.operationId || null,
    data: alertData.data || null,
    channels: alert.channels,
    deliveryStatus: alert.deliveryStatus,
    createdAt: new Date(),
  });
  
  alert.id = alertId;
  
  await deliverAlertNotifications(alert);
  
  return alert;
}

/**
 * Check if alert severity meets minimum threshold
 */
function meetsMinSeverity(severity: AlertSeverity, minSeverity: AlertSeverity): boolean {
  const severityRanking = {
    [AlertSeverity.INFO]: 1,
    [AlertSeverity.WARNING]: 2,
    [AlertSeverity.CRITICAL]: 3
  };
  
  return severityRanking[severity] >= severityRanking[minSeverity];
}

/**
 * Deliver alert notifications through configured channels
 */
async function deliverAlertNotifications(alert: WMDAlert): Promise<void> {
  for (const channel of alert.channels) {
    try {
      switch (channel) {
        case NotificationChannel.IN_GAME:
          await deliverInGameNotification(alert);
          break;
        case NotificationChannel.DASHBOARD:
          await deliverDashboardNotification(alert);
          break;
        case NotificationChannel.EMAIL:
          await deliverEmailNotification(alert);
          break;
      }
      
      const deliveryStatus = alert.deliveryStatus;
      deliveryStatus[channel] = { sent: true, sentAt: new Date() };
      
      await db.update(wmdAlerts).set({
        deliveryStatus: deliveryStatus,
      }).where(eq(wmdAlerts.id, alert.id!));
    } catch (error) {
      console.error(`Failed to deliver alert via ${channel}:`, error);
      
      const deliveryStatus = alert.deliveryStatus;
      deliveryStatus[channel] = {
        sent: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      await db.update(wmdAlerts).set({
        deliveryStatus: deliveryStatus,
      }).where(eq(wmdAlerts.id, alert.id!));
    }
  }
}

/**
 * Deliver in-game notification via WebSocket
 */
async function deliverInGameNotification(alert: WMDAlert): Promise<void> {
  const recipients: string[] = [];
  
  if (alert.playerId) {
    recipients.push(alert.playerId);
  }
  
  if (alert.clanId) {
    const clanRow = await db.select().from(clans).where(eq(clans.id, alert.clanId)).limit(1);
    const clan = clanRow[0];
    if (clan && clan.members) {
      recipients.push(...clan.members.map((m) => m.playerId));
    }
  }
  
  if (alert.targetClanId) {
    const targetClanRow = await db.select().from(clans).where(eq(clans.id, alert.targetClanId)).limit(1);
    const targetClan = targetClanRow[0];
    if (targetClan && targetClan.members) {
      recipients.push(...targetClan.members.map((m) => m.playerId));
    }
  }
  
  const uniqueRecipients = [...new Set(recipients)];
  
  const notifications = uniqueRecipients.map(playerId => ({
    id: `pn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    playerId,
    type: 'WMD_ALERT',
    alertId: alert.id || null,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    read: 0,
    createdAt: new Date()
  }));
  
  if (notifications.length > 0) {
    await db.insert(playerNotifications).values(notifications);
  }
  
  console.log(`[WMD Alert] In-game notification sent to ${uniqueRecipients.length} players`);
}

/**
 * Deliver dashboard notification
 */
async function deliverDashboardNotification(alert: WMDAlert): Promise<void> {
  await db.insert(adminDashboardNotifications).values({
    id: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    alertId: alert.id || null,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    data: alert.data || null,
    read: 0,
    createdAt: new Date()
  });
  
  console.log(`[WMD Alert] Dashboard notification created: ${alert.title}`);
}

/**
 * Deliver email notification
 */
async function deliverEmailNotification(alert: WMDAlert): Promise<void> {
  const emailData = {
    to: process.env.ADMIN_EMAIL || 'admin@darkframe.com',
    subject: `[WMD Alert - ${alert.severity}] ${alert.title}`,
    body: `
      WMD System Alert
      ================
      
      Type: ${alert.type}
      Severity: ${alert.severity}
      Time: ${alert.createdAt.toISOString()}
      
      ${alert.message}
      
      ${alert.clanName ? `Clan: ${alert.clanName}` : ''}
      ${alert.playerName ? `Player: ${alert.playerName}` : ''}
      ${alert.targetClanName ? `Target: ${alert.targetClanName}` : ''}
      
      ---
      This is an automated alert from the DarkFrame WMD System.
    `
  };
  
  console.log(`[WMD Alert] Email notification queued:`, emailData);
  
  await db.insert(emailQueue).values({
    id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    to: emailData.to,
    subject: emailData.subject,
    body: emailData.body,
    alertId: alert.id || null,
    status: 'PENDING',
    createdAt: new Date()
  });
}

/**
 * Alert factory functions for common WMD events
 */

export async function alertMissileLaunch(
  missileId: string,
  clanId: string,
  clanName: string,
  targetClanId: string,
  targetClanName: string,
  warheadType: string,
  impactTime: Date
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.MISSILE_LAUNCH,
    severity: AlertSeverity.CRITICAL,
    title: `WMD Missile Launched!`,
    message: `Clan "${clanName}" has launched a ${warheadType} missile targeting "${targetClanName}". Impact expected at ${impactTime.toLocaleString()}.`,
    clanId,
    clanName,
    targetClanId,
    targetClanName,
    missileId,
    data: { warheadType, impactTime: impactTime.toISOString() },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertMissileImpact(
  missileId: string,
  clanId: string,
  clanName: string,
  targetClanId: string,
  targetClanName: string,
  damage: number,
  warheadType: string
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.MISSILE_IMPACT,
    severity: AlertSeverity.CRITICAL,
    title: `WMD Missile Impact!`,
    message: `${warheadType} missile from "${clanName}" has struck "${targetClanName}" causing ${damage.toLocaleString()} damage!`,
    clanId,
    clanName,
    targetClanId,
    targetClanName,
    missileId,
    data: { damage, warheadType },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertMissileIntercepted(
  missileId: string,
  attackerClanId: string,
  attackerClanName: string,
  defenderClanId: string,
  defenderClanName: string,
  warheadType: string
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.MISSILE_INTERCEPTED,
    severity: AlertSeverity.WARNING,
    title: `Missile Intercepted!`,
    message: `"${defenderClanName}" successfully intercepted a ${warheadType} missile from "${attackerClanName}"!`,
    clanId: attackerClanId,
    clanName: attackerClanName,
    targetClanId: defenderClanId,
    targetClanName: defenderClanName,
    missileId,
    data: { warheadType },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertVotePassed(
  voteId: string,
  clanId: string,
  clanName: string,
  voteType: string,
  approvalRate: number
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.VOTE_PASSED,
    severity: AlertSeverity.WARNING,
    title: `WMD Vote Passed`,
    message: `Clan "${clanName}" has approved a ${voteType} operation with ${(approvalRate * 100).toFixed(1)}% approval.`,
    clanId,
    clanName,
    voteId,
    data: { voteType, approvalRate },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertVoteFailed(
  voteId: string,
  clanId: string,
  clanName: string,
  voteType: string,
  approvalRate: number
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.VOTE_FAILED,
    severity: AlertSeverity.INFO,
    title: `WMD Vote Failed`,
    message: `Clan "${clanName}" failed to approve ${voteType} operation. Only ${(approvalRate * 100).toFixed(1)}% approval achieved.`,
    clanId,
    clanName,
    voteId,
    data: { voteType, approvalRate },
    channels: [NotificationChannel.DASHBOARD]
  });
}

export async function alertVoteVetoed(
  voteId: string,
  clanId: string,
  clanName: string,
  leaderName: string,
  voteType: string
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.VOTE_VETOED,
    severity: AlertSeverity.WARNING,
    title: `WMD Vote Vetoed`,
    message: `Clan leader ${leaderName} vetoed the ${voteType} vote in "${clanName}".`,
    clanId,
    clanName,
    voteId,
    data: { voteType, leaderName },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertCooldownExpired(
  clanId: string,
  clanName: string
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.COOLDOWN_EXPIRED,
    severity: AlertSeverity.INFO,
    title: `WMD Cooldown Expired`,
    message: `Clan "${clanName}" can now launch WMD operations again.`,
    clanId,
    clanName,
    channels: [NotificationChannel.IN_GAME]
  });
}

export async function alertSuspiciousActivity(
  activityType: string,
  playerId: string | undefined,
  playerName: string | undefined,
  clanId: string | undefined,
  clanName: string | undefined,
  details: string
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.SUSPICIOUS_ACTIVITY,
    severity: AlertSeverity.CRITICAL,
    title: `Suspicious WMD Activity Detected`,
    message: `${activityType}: ${details}`,
    playerId,
    playerName,
    clanId,
    clanName,
    data: { activityType, details },
    channels: [NotificationChannel.DASHBOARD]
  });
}

export async function alertEmergencyDisarm(
  missileId: string,
  clanId: string,
  clanName: string,
  adminName: string,
  reason: string
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.EMERGENCY_DISARM,
    severity: AlertSeverity.CRITICAL,
    title: `Emergency Missile Disarm`,
    message: `Admin ${adminName} emergency-disarmed missile from "${clanName}". Reason: ${reason}`,
    clanId,
    clanName,
    missileId,
    data: { adminName, reason },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertSystemError(
  errorType: string,
  errorMessage: string,
  context?: WmdAlertData
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.SYSTEM_ERROR,
    severity: AlertSeverity.CRITICAL,
    title: `WMD System Error`,
    message: `${errorType}: ${errorMessage}`,
    data: { errorType, errorMessage, ...(context ? { context: JSON.stringify(context) } : {}) },
    channels: [NotificationChannel.DASHBOARD]
  });
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<boolean> {
  const result = await db.update(wmdAlerts).set({
    status: AlertStatus.ACKNOWLEDGED,
    acknowledgedAt: new Date(),
    acknowledgedBy,
  }).where(
    and(
      eq(wmdAlerts.id, alertId),
      eq(wmdAlerts.status, AlertStatus.ACTIVE)
    )
  );
  
  return (result.rowCount ?? 0) > 0;
}

/**
 * Resolve an alert
 */
export async function resolveAlert(
  alertId: string,
  resolvedBy: string,
  resolution?: string
): Promise<boolean> {
  const updateData: Partial<typeof wmdAlerts.$inferInsert> = {
    status: AlertStatus.RESOLVED,
    resolvedAt: new Date(),
    resolvedBy,
  };
  
  if (resolution) {
    const rows = await db.select().from(wmdAlerts).where(eq(wmdAlerts.id, alertId)).limit(1);
    if (rows[0] && rows[0].data) {
      const existingData: WmdAlertData = rows[0].data;
      updateData.data = { ...existingData, resolution };
    }
  }
  
  const result = await db.update(wmdAlerts).set(updateData).where(
    and(
      eq(wmdAlerts.id, alertId),
      or(
        eq(wmdAlerts.status, AlertStatus.ACTIVE),
        eq(wmdAlerts.status, AlertStatus.ACKNOWLEDGED)
      )
    )
  );
  
  return (result.rowCount ?? 0) > 0;
}

/**
 * Get active alerts
 */
export async function getActiveAlerts(
  filters?: {
    severity?: AlertSeverity;
    type?: AlertType;
    clanId?: string;
    limit?: number;
  }
): Promise<WMDAlert[]> {
  const conditions = [eq(wmdAlerts.status, AlertStatus.ACTIVE)];
  
  if (filters?.severity) conditions.push(eq(wmdAlerts.severity, filters.severity));
  if (filters?.type) conditions.push(eq(wmdAlerts.type, filters.type));
  if (filters?.clanId) conditions.push(eq(wmdAlerts.clanId, filters.clanId));
  
  const rows = await db.select().from(wmdAlerts)
    .where(and(...conditions))
    .orderBy(desc(wmdAlerts.createdAt))
    .limit(filters?.limit || 50);
  
  return rows.map(row => mapAlertRow(row));
}

/**
 * Get alert history
 */
export async function getAlertHistory(
  filters?: {
    startDate?: Date;
    endDate?: Date;
    severity?: AlertSeverity;
    type?: AlertType;
    clanId?: string;
    status?: AlertStatus;
    limit?: number;
  }
): Promise<WMDAlert[]> {
  const conditions = [];
  
  if (filters?.startDate || filters?.endDate) {
    if (filters.startDate && filters.endDate) {
      conditions.push(and(gte(wmdAlerts.createdAt, filters.startDate), lte(wmdAlerts.createdAt, filters.endDate)));
    } else if (filters.startDate) {
      conditions.push(gte(wmdAlerts.createdAt, filters.startDate));
    } else if (filters.endDate) {
      conditions.push(lte(wmdAlerts.createdAt, filters.endDate));
    }
  }
  
  if (filters?.severity) conditions.push(eq(wmdAlerts.severity, filters.severity));
  if (filters?.type) conditions.push(eq(wmdAlerts.type, filters.type));
  if (filters?.clanId) conditions.push(eq(wmdAlerts.clanId, filters.clanId));
  if (filters?.status) conditions.push(eq(wmdAlerts.status, filters.status));
  
  const rows = await db.select().from(wmdAlerts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(wmdAlerts.createdAt))
    .limit(filters?.limit || 100);
  
  return rows.map(row => mapAlertRow(row));
}

/**
 * Archive old alerts
 */
export async function archiveOldAlerts(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await db.update(wmdAlerts).set({
    status: AlertStatus.ARCHIVED,
  }).where(
    and(
      eq(wmdAlerts.status, AlertStatus.RESOLVED),
      lte(wmdAlerts.resolvedAt, cutoffDate)
    )
  );
  
  return (result.rowCount ?? 0) || 0;
}

/**
 * Get alert configuration
 */
export async function getAlertConfig(): Promise<AlertConfig> {
  const rows = await db.select().from(wmdConfig).where(eq(wmdConfig.key, 'alerts')).limit(1);
  const row = rows[0];
  if (row && row.value) {
    return row.value.settings || DEFAULT_CONFIG;
  }
  return DEFAULT_CONFIG;
}

/**
 * Update alert configuration
 */
export async function updateAlertConfig(
  config: Partial<AlertConfig>
): Promise<AlertConfig> {
  const currentConfig = await getAlertConfig();
  const newConfig = { ...currentConfig, ...config };
  
  const existing = await db.select().from(wmdConfig).where(eq(wmdConfig.key, 'alerts')).limit(1);
  
  if (existing.length > 0) {
    await db.update(wmdConfig).set({
      value: { settings: newConfig },
      updatedAt: new Date(),
    }).where(eq(wmdConfig.key, 'alerts'));
  } else {
    await db.insert(wmdConfig).values({
      id: `config_alerts_${Date.now()}`,
      key: 'alerts',
      value: { settings: newConfig },
      updatedAt: new Date(),
    });
  }
  
  return newConfig;
}

/**
 * Background job to clean up old alerts
 */
export async function cleanupAlerts(): Promise<void> {
  const config = await getAlertConfig();
  
  const archivedCount = await archiveOldAlerts(config.autoArchiveDays);
  console.log(`[WMD Alerts] Archived ${archivedCount} old alerts`);
  
  const deleteDate = new Date();
  deleteDate.setDate(deleteDate.getDate() - 90);
  
  const result = await db.delete(wmdAlerts).where(
    and(
      eq(wmdAlerts.status, AlertStatus.ARCHIVED),
      lte(wmdAlerts.resolvedAt, deleteDate)
    )
  );
  
  console.log(`[WMD Alerts] Deleted ${(result.rowCount ?? 0)} archived alerts older than 90 days`);
}

function mapAlertRow(row: typeof wmdAlerts.$inferSelect): WMDAlert {
  return {
    id: row.id,
    type: row.type as AlertType,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    title: row.title,
    message: row.message,
    playerId: row.playerId || undefined,
    playerName: row.playerName || undefined,
    clanId: row.clanId || undefined,
    clanName: row.clanName || undefined,
    targetClanId: row.targetClanId || undefined,
    targetClanName: row.targetClanName || undefined,
    missileId: row.missileId || undefined,
    voteId: row.voteId || undefined,
    operationId: row.operationId || undefined,
    data: row.data ?? undefined,
    createdAt: new Date(row.createdAt),
    acknowledgedAt: row.acknowledgedAt ? new Date(row.acknowledgedAt) : undefined,
    acknowledgedBy: row.acknowledgedBy || undefined,
    resolvedAt: row.resolvedAt ? new Date(row.resolvedAt) : undefined,
    resolvedBy: row.resolvedBy || undefined,
    channels: row.channels || [],
    deliveryStatus: row.deliveryStatus || {},
  };
}
