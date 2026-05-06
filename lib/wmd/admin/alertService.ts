/**
 * WMD Alert Service
 * Created: 2025-10-22
 * 
 * OVERVIEW:
 * Comprehensive alert and notification system for critical WMD events.
 * Monitors missile launches, vote completions, cooldown expirations, and suspicious activity.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

type WMDNotificationType = Database['public']['Enums']['wmd_notification_type'];

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum AlertType {
  MISSILE_LAUNCH = 'MISSILE_LAUNCH',
  MISSILE_IMPACT = 'MISSILE_IMPACT',
  MISSILE_INTERCEPTED = 'MISSILE_INTERCEPTED',
  VOTE_PASSED = 'VOTE_PASSED',
  VOTE_FAILED = 'VOTE_FAILED',
  COOLDOWN_EXPIRED = 'COOLDOWN_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  EMERGENCY_DISARM = 'EMERGENCY_DISARM',
  VOTE_VETOED = 'VOTE_VETOED'
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED'
}

export enum NotificationChannel {
  IN_GAME = 'IN_GAME',
  DASHBOARD = 'DASHBOARD',
  EMAIL = 'EMAIL'
}

export interface WMDAlert {
  id?: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;

  player_id?: string;
  player_name?: string;
  clan_id?: string;
  clan_name?: string;
  target_clan_id?: string;
  target_clan_name?: string;

  missile_id?: string;
  vote_id?: string;
  operation_id?: string;

  data?: Record<string, unknown>;

  created_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;

  channels: NotificationChannel[];
  delivery_status: Record<string, { sent: boolean; sent_at?: string; error?: string }>;
}

export interface AlertConfig {
  enabled: boolean;
  min_severity: AlertSeverity;
  channels: NotificationChannel[];
  auto_acknowledge: boolean;
  auto_archive_days: number;
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  min_severity: AlertSeverity.INFO,
  channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD],
  auto_acknowledge: false,
  auto_archive_days: 30
};

const WMD_ALERT_NOTIF_TYPE: WMDNotificationType = 'wmd_alert' as WMDNotificationType;
const DASHBOARD_NOTIF_TYPE: WMDNotificationType = 'dashboard_alert' as WMDNotificationType;

function generateId(): string {
  return crypto.randomUUID();
}

export async function createAlert(
  alertData: Omit<WMDAlert, 'id' | 'created_at' | 'status' | 'delivery_status'>
): Promise<WMDAlert> {
  const supabase = createServiceClient();
  const config = await getAlertConfig();

  if (!config.enabled || !meetsMinSeverity(alertData.severity, config.min_severity)) {
    throw new Error('Alert creation blocked by configuration');
  }

  const alert: WMDAlert = {
    ...alertData,
    status: AlertStatus.ACTIVE,
    created_at: new Date().toISOString(),
    channels: alertData.channels || config.channels,
    delivery_status: {}
  };

  alert.channels.forEach(channel => {
    alert.delivery_status[channel] = { sent: false };
  });

  const alertId = generateId();
  alert.id = alertId;

  const storedData: Json = JSON.parse(JSON.stringify({
    type: alert.type,
    severity: alert.severity,
    status: alert.status,
    player_name: alert.player_name,
    clan_id: alert.clan_id,
    clan_name: alert.clan_name,
    target_clan_id: alert.target_clan_id,
    target_clan_name: alert.target_clan_name,
    missile_id: alert.missile_id,
    vote_id: alert.vote_id,
    operation_id: alert.operation_id,
    extra_data: alert.data,
    channels: alert.channels,
    delivery_status: alert.delivery_status,
    acknowledged_at: alert.acknowledged_at,
    acknowledged_by: alert.acknowledged_by,
    resolved_at: alert.resolved_at,
    resolved_by: alert.resolved_by,
  }));

  const insertData: Database['public']['Tables']['wmd_notifications']['Insert'] = {
    id: alertId,
    player_id: alert.player_id || 'SYSTEM',
    notification_type: WMD_ALERT_NOTIF_TYPE,
    title: alert.title,
    message: alert.message,
    is_read: false,
    created_at: alert.created_at,
    data: storedData,
  };

  await supabase.from('wmd_notifications').insert(insertData);

  await deliverAlertNotifications(alert);

  return alert;
}

function meetsMinSeverity(severity: AlertSeverity, minSeverity: AlertSeverity): boolean {
  const severityRanking: Record<AlertSeverity, number> = {
    [AlertSeverity.INFO]: 1,
    [AlertSeverity.WARNING]: 2,
    [AlertSeverity.CRITICAL]: 3
  };

  return severityRanking[severity] >= severityRanking[minSeverity];
}

async function deliverAlertNotifications(alert: WMDAlert): Promise<void> {
  const supabase = createServiceClient();

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

      const updatedStatus = {
        ...alert.delivery_status,
        [channel]: { sent: true, sent_at: new Date().toISOString() }
      } as Record<string, { sent: boolean; sent_at?: string; error?: string }>;

      const currentData = { ...(alert.data || {}), delivery_status: updatedStatus, channels: alert.channels };
      await supabase
        .from('wmd_notifications')
        .update({
          data: currentData,
        } as Database['public']['Tables']['wmd_notifications']['Update'])
        .eq('id', alert.id as string);
    } catch (error) {
      console.error(`Failed to deliver alert via ${channel}:`, error);

      const failureStatus = {
        ...alert.delivery_status,
        [channel]: {
          sent: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      } as Record<string, { sent: boolean; sent_at?: string; error?: string }>;

      const failureData = { ...(alert.data || {}), delivery_status: failureStatus, channels: alert.channels };
      await supabase
        .from('wmd_notifications')
        .update({
          data: failureData,
        } as Database['public']['Tables']['wmd_notifications']['Update'])
        .eq('id', alert.id as string);
    }
  }
}

async function deliverInGameNotification(alert: WMDAlert): Promise<void> {
  const supabase = createServiceClient();
  const recipients: string[] = [];

  if (alert.player_id) {
    recipients.push(alert.player_id);
  }

  if (alert.clan_id) {
    const { data: clan } = await supabase
      .from('clan_members')
      .select('player_id')
      .eq('clan_id', alert.clan_id);

    if (clan) {
      recipients.push(...clan.map((m) => m.player_id));
    }
  }

  if (alert.target_clan_id) {
    const { data: targetClan } = await supabase
      .from('clan_members')
      .select('player_id')
      .eq('clan_id', alert.target_clan_id);

    if (targetClan) {
      recipients.push(...targetClan.map((m) => m.player_id));
    }
  }

  const uniqueRecipients = [...new Set(recipients)];

  if (uniqueRecipients.length > 0) {
    const notifications: Database['public']['Tables']['wmd_notifications']['Insert'][] = uniqueRecipients.map(playerId => {
      const notifData: Json = {
        alert_id: alert.id,
        severity: alert.severity as string,
        type: alert.type as string,
      };
      return {
        id: generateId(),
        player_id: playerId,
        notification_type: WMD_ALERT_NOTIF_TYPE,
        title: alert.title,
        message: alert.message,
        is_read: false,
        created_at: new Date().toISOString(),
        data: notifData,
      };
    });

    for (const notification of notifications) {
      await supabase.from('wmd_notifications').insert(notification);
    }
  }

  console.log(`[WMD Alert] In-game notification sent to ${uniqueRecipients.length} players`);
}

async function deliverDashboardNotification(alert: WMDAlert): Promise<void> {
  const supabase = createServiceClient();

  const dashData: Json = {
    alert_id: alert.id,
    type: alert.type as string,
    severity: alert.severity as string,
    extra_data: alert.data ? JSON.parse(JSON.stringify(alert.data)) : undefined,
  };

  const dashNotif: Database['public']['Tables']['wmd_notifications']['Insert'] = {
    id: generateId(),
    player_id: 'DASHBOARD',
    notification_type: DASHBOARD_NOTIF_TYPE,
    title: alert.title,
    message: alert.message,
    is_read: false,
    created_at: new Date().toISOString(),
    data: dashData,
  };

  await supabase.from('wmd_notifications').insert(dashNotif);

  console.log(`[WMD Alert] Dashboard notification created: ${alert.title}`);
}

async function deliverEmailNotification(alert: WMDAlert): Promise<void> {
  const emailData = {
    to: process.env.ADMIN_EMAIL || 'admin@darkframe.com',
    subject: `[WMD Alert - ${alert.severity}] ${alert.title}`,
    body: `
      WMD System Alert
      ================
      
      Type: ${alert.type}
      Severity: ${alert.severity}
      Time: ${alert.created_at}
      
      ${alert.message}
      
      ${alert.clan_name ? `Clan: ${alert.clan_name}` : ''}
      ${alert.player_name ? `Player: ${alert.player_name}` : ''}
      ${alert.target_clan_name ? `Target: ${alert.target_clan_name}` : ''}
      
      ---
      This is an automated alert from the DarkFrame WMD System.
    `
  };

  console.log(`[WMD Alert] Email notification queued:`, emailData);
}

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
    title: `🚀 WMD Missile Launched!`,
    message: `Clan "${clanName}" has launched a ${warheadType} missile targeting "${targetClanName}". Impact expected at ${impactTime.toLocaleString()}.`,
    clan_id: clanId,
    clan_name: clanName,
    target_clan_id: targetClanId,
    target_clan_name: targetClanName,
    missile_id: missileId,
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
    title: `💥 WMD Missile Impact!`,
    message: `${warheadType} missile from "${clanName}" has struck "${targetClanName}" causing ${damage.toLocaleString()} damage!`,
    clan_id: clanId,
    clan_name: clanName,
    target_clan_id: targetClanId,
    target_clan_name: targetClanName,
    missile_id: missileId,
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
    title: `🛡️ Missile Intercepted!`,
    message: `"${defenderClanName}" successfully intercepted a ${warheadType} missile from "${attackerClanName}"!`,
    clan_id: attackerClanId,
    clan_name: attackerClanName,
    target_clan_id: defenderClanId,
    target_clan_name: defenderClanName,
    missile_id: missileId,
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
    title: `✅ WMD Vote Passed`,
    message: `Clan "${clanName}" has approved a ${voteType} operation with ${(approvalRate * 100).toFixed(1)}% approval.`,
    clan_id: clanId,
    clan_name: clanName,
    vote_id: voteId,
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
    title: `❌ WMD Vote Failed`,
    message: `Clan "${clanName}" failed to approve ${voteType} operation. Only ${(approvalRate * 100).toFixed(1)}% approval achieved.`,
    clan_id: clanId,
    clan_name: clanName,
    vote_id: voteId,
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
    title: `🚫 WMD Vote Vetoed`,
    message: `Clan leader ${leaderName} vetoed the ${voteType} vote in "${clanName}".`,
    clan_id: clanId,
    clan_name: clanName,
    vote_id: voteId,
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
    title: `⏰ WMD Cooldown Expired`,
    message: `Clan "${clanName}" can now launch WMD operations again.`,
    clan_id: clanId,
    clan_name: clanName,
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
    title: `🚩 Suspicious WMD Activity Detected`,
    message: `${activityType}: ${details}`,
    player_id: playerId,
    player_name: playerName,
    clan_id: clanId,
    clan_name: clanName,
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
    title: `🛑 Emergency Missile Disarm`,
    message: `Admin ${adminName} emergency-disarmed missile from "${clanName}". Reason: ${reason}`,
    clan_id: clanId,
    clan_name: clanName,
    missile_id: missileId,
    data: { adminName, reason },
    channels: [NotificationChannel.IN_GAME, NotificationChannel.DASHBOARD]
  });
}

export async function alertSystemError(
  errorType: string,
  errorMessage: string,
  context?: Record<string, unknown>
): Promise<WMDAlert> {
  return createAlert({
    type: AlertType.SYSTEM_ERROR,
    severity: AlertSeverity.CRITICAL,
    title: `⚠️ WMD System Error`,
    message: `${errorType}: ${errorMessage}`,
    data: { errorType, errorMessage, context },
    channels: [NotificationChannel.DASHBOARD]
  });
}

export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: existingAlert } = await supabase
    .from('wmd_notifications')
    .select('data')
    .eq('id', alertId)
    .maybeSingle();

  if (!existingAlert) {
    return false;
  }

  const existingData = (existingAlert.data as Record<string, unknown>) || {};
  if (existingData.status !== AlertStatus.ACTIVE) {
    return false;
  }

  const updatedData = {
    ...existingData,
    status: AlertStatus.ACKNOWLEDGED,
    acknowledged_at: new Date().toISOString(),
    acknowledged_by: acknowledgedBy,
  };

  const { error } = await supabase
    .from('wmd_notifications')
    .update({
      data: updatedData,
      is_read: true,
    } as Database['public']['Tables']['wmd_notifications']['Update'])
    .eq('id', alertId);

  return !error;
}

export async function resolveAlert(
  alertId: string,
  resolvedBy: string,
  resolution?: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: existingAlert } = await supabase
    .from('wmd_notifications')
    .select('data')
    .eq('id', alertId)
    .maybeSingle();

  if (!existingAlert) {
    return false;
  }

  const existingData = (existingAlert.data as Record<string, unknown>) || {};
  if (existingData.status !== AlertStatus.ACTIVE && existingData.status !== AlertStatus.ACKNOWLEDGED) {
    return false;
  }

  const updatedData: Record<string, unknown> = {
    ...existingData,
    status: AlertStatus.RESOLVED,
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy,
  };

  if (resolution) {
    updatedData.resolution = resolution;
  }

  const { error } = await supabase
    .from('wmd_notifications')
    .update({
      data: updatedData,
    } as Database['public']['Tables']['wmd_notifications']['Update'])
    .eq('id', alertId);

  return !error;
}

export async function getActiveAlerts(
  filters?: {
    severity?: AlertSeverity;
    type?: AlertType;
    clan_id?: string;
    limit?: number;
  }
): Promise<WMDAlert[]> {
  const supabase = createServiceClient();

  let query = supabase
    .from('wmd_notifications')
    .select('*')
    .eq('notification_type', WMD_ALERT_NOTIF_TYPE)
    .order('created_at', { ascending: false })
    .limit(filters?.limit || 50);

  if (filters?.clan_id) {
    query = query.eq('player_id', filters.clan_id);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const result: WMDAlert[] = [];
  for (const n of data) {
    const nd = (n.data as Record<string, unknown>) || {};
    if (nd.status !== AlertStatus.ACTIVE) continue;
    if (filters?.severity && nd.severity !== filters.severity) continue;
    if (filters?.type && nd.type !== filters.type) continue;

    result.push({
      id: n.id,
      type: nd.type as AlertType,
      severity: nd.severity as AlertSeverity,
      status: nd.status as AlertStatus,
      title: n.title,
      message: n.message,
      player_id: n.player_id,
      player_name: nd.player_name as string | undefined,
      clan_id: nd.clan_id as string | undefined,
      clan_name: nd.clan_name as string | undefined,
      missile_id: nd.missile_id as string | undefined,
      vote_id: nd.vote_id as string | undefined,
      operation_id: nd.operation_id as string | undefined,
      data: nd.extra_data as Record<string, unknown> | undefined,
      created_at: n.created_at,
      channels: (nd.channels as NotificationChannel[]) || [],
      delivery_status: (nd.delivery_status as Record<string, { sent: boolean; sent_at?: string; error?: string }>) || {},
    });
  }

  return result;
}

export async function archiveOldAlerts(daysOld: number = 30): Promise<number> {
  const supabase = createServiceClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  const cutoffStr = cutoffDate.toISOString();

  const { data, error } = await supabase
    .from('wmd_notifications')
    .select('id,data')
    .eq('notification_type', WMD_ALERT_NOTIF_TYPE)
    .lte('created_at', cutoffStr);

  if (error || !data) {
    return 0;
  }

  let archivedCount = 0;
  for (const notification of data) {
    const nd = (notification.data as Record<string, unknown>) || {};
    if (nd.status === AlertStatus.RESOLVED) {
      const updatedData = { ...nd, status: AlertStatus.ARCHIVED };
      const { error: updateError } = await supabase
        .from('wmd_notifications')
        .update({
          data: updatedData,
        } as Database['public']['Tables']['wmd_notifications']['Update'])
        .eq('id', notification.id);

      if (!updateError) {
        archivedCount++;
      }
    }
  }

  return archivedCount;
}

export async function getAlertConfig(): Promise<AlertConfig> {
  const supabase = createServiceClient();

  const { data: config } = await supabase
    .from('bot_config')
    .select('config_value')
    .eq('config_key', 'wmd_alerts_config')
    .maybeSingle();

  if (config?.config_value) {
    const settings = config.config_value as Record<string, unknown>;
    return {
      enabled: settings.enabled as boolean ?? DEFAULT_CONFIG.enabled,
      min_severity: settings.min_severity as AlertSeverity ?? DEFAULT_CONFIG.min_severity,
      channels: settings.channels as NotificationChannel[] ?? DEFAULT_CONFIG.channels,
      auto_acknowledge: settings.auto_acknowledge as boolean ?? DEFAULT_CONFIG.auto_acknowledge,
      auto_archive_days: settings.auto_archive_days as number ?? DEFAULT_CONFIG.auto_archive_days,
    };
  }

  return DEFAULT_CONFIG;
}

export async function updateAlertConfig(
  config: Partial<AlertConfig>
): Promise<AlertConfig> {
  const supabase = createServiceClient();
  const currentConfig = await getAlertConfig();
  const newConfig = { ...currentConfig, ...config };

  const configValue: Json = JSON.parse(JSON.stringify(newConfig));
  await supabase
    .from('bot_config')
    .upsert({
      config_key: 'wmd_alerts_config',
      config_value: configValue,
    }, { onConflict: 'config_key' });

  return newConfig;
}

export async function cleanupAlerts(): Promise<void> {
  const config = await getAlertConfig();

  const archivedCount = await archiveOldAlerts(config.auto_archive_days);
  console.log(`[WMD Alerts] Archived ${archivedCount} old alerts`);

  const supabase = createServiceClient();
  const deleteDate = new Date();
  deleteDate.setDate(deleteDate.getDate() - 90);
  const deleteStr = deleteDate.toISOString();

  const { data, error } = await supabase
    .from('wmd_notifications')
    .select('id,data')
    .eq('notification_type', WMD_ALERT_NOTIF_TYPE)
    .lte('created_at', deleteStr);

  if (error || !data) {
    return;
  }

  let deletedCount = 0;
  for (const notification of data) {
    const nd = (notification.data as Record<string, unknown>) || {};
    if (nd.status === AlertStatus.ARCHIVED) {
      await supabase
        .from('wmd_notifications')
        .delete()
        .eq('id', notification.id);
      deletedCount++;
    }
  }

  console.log(`[WMD Alerts] Deleted ${deletedCount} archived alerts older than 90 days`);
}
