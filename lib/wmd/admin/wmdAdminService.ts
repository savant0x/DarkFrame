/**
 * WMD Admin Service
 * 
 * Created: 2025-10-22
 * 
 * OVERVIEW:
 * Administrative oversight and emergency controls for the WMD system.
 * Provides admin-only operations for monitoring, intervention, and balance management.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database, Json } from '@/types/database';

type WMDNotificationType = Database['public']['Enums']['wmd_notification_type'];
type WMDLaunchStatus = Database['public']['Enums']['wmd_launch_status'];
type WMDVoteStatus = Database['public']['Enums']['wmd_vote_status'];
type WMDMissionStatus = Database['public']['Enums']['wmd_mission_status'];

export interface WMDSystemStatus {
  timestamp: string;
  scheduler: {
    running: boolean;
    jobs: {
      missileTracker: { running: boolean; lastRun?: string; errorCount: number };
      spyMissionCompleter: { running: boolean; lastRun?: string; errorCount: number };
      voteExpirationCleaner: { running: boolean; lastRun?: string; errorCount: number };
      defenseRepairCompleter: { running: boolean; lastRun?: string; errorCount: number };
    };
  };
  activeMissiles: number;
  activeVotes: number;
  activeMissions: number;
  repairingBatteries: number;
  clansOnCooldown: number;
  recentAlerts: AdminAlert[];
}

export interface AdminAlert {
  alert_id: string;
  type: string;
  severity: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
}

export interface SuspiciousActivityReport {
  player_id: string;
  clan_id: string;
  activity_type: string;
  details: string;
  evidence: Record<string, unknown>;
  flagged_at: string;
  severity: string;
}

export interface AdminAuditEntry {
  audit_id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface WMDAnalyticsSummary {
  time_range: { start: string; end: string };
  totals: {
    missiles_launched: number;
    votes_created: number;
    votes_vetoed: number;
    defense_batteries_built: number;
    spy_missions_completed: number;
    total_damage_dealt: number;
  };
  by_warhead_type: Record<string, number>;
  top_clans: Array<{ clan_id: string; clan_name: string; activity: number }>;
  balance_metrics: {
    avg_vote_approval_rate: number;
    avg_missile_interception_rate: number;
    avg_cooldown_duration: number;
  };
}

export async function getWMDSystemStatus(): Promise<WMDSystemStatus> {
  const supabase = createServiceClient();

  const schedulerHealth = {
    running: true,
    jobs: {
      missileTracker: { running: true, errorCount: 0 },
      spyMissionCompleter: { running: true, errorCount: 0 },
      voteExpirationCleaner: { running: true, errorCount: 0 },
      defenseRepairCompleter: { running: true, errorCount: 0 },
    },
  };

  const { count: activeMissiles } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_flight' as WMDLaunchStatus);

  const { count: activeVotes } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active' as WMDVoteStatus);

  const { count: activeMissions } = await supabase
    .from('wmd_spy_missions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'in_progress' as WMDMissionStatus);

  const { count: repairingBatteries } = await supabase
    .from('wmd_defense_batteries')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'REPAIRING');

  const now = new Date().toISOString();
  const { data: allClans } = await supabase
    .from('clans')
    .select('clan_settings');

  let clansOnCooldownCount = 0;
  if (allClans) {
    for (const clan of allClans) {
      const settings = clan.clan_settings as Record<string, unknown> | null;
      if (settings?.wmd_cooldown_until && typeof settings.wmd_cooldown_until === 'string') {
        if (settings.wmd_cooldown_until > now) {
          clansOnCooldownCount++;
        }
      }
    }
  }

  const adminNotifType: WMDNotificationType = 'admin_alert' as WMDNotificationType;
  const { data: recentAlertsRaw } = await supabase
    .from('wmd_notifications')
    .select('id,notification_type,message,data,created_at')
    .eq('notification_type', adminNotifType)
    .order('created_at', { ascending: false })
    .limit(20);

  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentAlerts: AdminAlert[] = (recentAlertsRaw || [])
    .filter((a) => a.created_at >= cutoffDate)
    .map((a) => {
      const alertData = (a.data as Record<string, unknown>) || {};
      return {
        alert_id: a.id,
        type: alertData.alert_type as string || a.notification_type,
        severity: alertData.severity as string || 'INFO',
        message: a.message,
        details: alertData.details as Record<string, unknown> || {},
        timestamp: a.created_at,
        acknowledged: alertData.acknowledged as boolean || false,
      };
    });

  return {
    timestamp: new Date().toISOString(),
    scheduler: schedulerHealth,
    activeMissiles: activeMissiles || 0,
    activeVotes: activeVotes || 0,
    activeMissions: activeMissions || 0,
    repairingBatteries: repairingBatteries || 0,
    clansOnCooldown: clansOnCooldownCount || 0,
    recentAlerts: recentAlerts || [],
  };
}

export async function forceExpireVote(
  voteId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();

  const { data: vote, error: voteError } = await supabase
    .from('wmd_clan_votes')
    .select('*')
    .eq('vote_id', voteId)
    .single();

  if (voteError || !vote) {
    return { success: false, message: 'Vote not found' };
  }

  if (vote.status !== ('active' as WMDVoteStatus)) {
    return { success: false, message: `Vote already ${vote.status}` };
  }

  const votesFor = vote.votes_for || 0;
  const votesAgainst = vote.votes_against || 0;
  const votesCast = votesFor + votesAgainst;
  const requiredVotes = 75;
  const approvalRate = votesCast > 0 ? (votesFor / votesCast) * 100 : 0;
  const finalStatus: WMDVoteStatus = approvalRate >= requiredVotes ? 'passed' : 'failed';

  await supabase
    .from('wmd_clan_votes')
    .update({
      status: finalStatus,
      closed_at: new Date().toISOString(),
    })
    .eq('vote_id', voteId);

  await logAdminAction({
    admin_id: adminId,
    action: 'FORCE_EXPIRE_VOTE',
    target_type: 'VOTE',
    target_id: voteId,
    reason,
    details: { original_status: 'active', new_status: finalStatus, approval_rate: approvalRate },
  });

  await createAdminAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: 'HIGH',
    message: `Admin forced vote expiration: ${voteId}`,
    details: { vote_id: voteId, admin_id: adminId, reason, final_status: finalStatus },
  });

  const statusLabel = finalStatus === 'passed' ? 'PASSED' : 'FAILED';
  return { success: true, message: `Vote ${statusLabel} by admin intervention` };
}

export async function emergencyDisarmMissile(
  missileId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string; refunded?: boolean }> {
  const supabase = createServiceClient();

  const { data: missile, error: missileError } = await supabase
    .from('wmd_missiles')
    .select('*')
    .eq('missile_id', missileId)
    .single();

  if (missileError || !missile) {
    return { success: false, message: 'Missile not found' };
  }

  if (missile.status !== ('in_flight' as WMDLaunchStatus)) {
    return { success: false, message: `Missile already ${missile.status}` };
  }

  const disarmedStatus: WMDLaunchStatus = 'admin_disarmed' as WMDLaunchStatus;
  await supabase
    .from('wmd_missiles')
    .update({ status: disarmedStatus })
    .eq('missile_id', missileId);

  const refundAmount = Math.floor(((missile as Record<string, unknown>).total_cost as number || 0) * 0.5);
  let refundExecuted = false;

  if (refundAmount > 0 && missile.owner_id) {
    const { data: memberData } = await supabase
      .from('clan_members')
      .select('clan_id')
      .eq('player_id', missile.owner_id)
      .maybeSingle();

    if (memberData?.clan_id) {
      const { data: clan } = await supabase
        .from('clans')
        .select('bank_treasury_metal,bank_treasury_energy')
        .eq('id', memberData.clan_id)
        .single();

      if (clan) {
        const currentMetal = clan.bank_treasury_metal || 0;
        const currentEnergy = clan.bank_treasury_energy || 0;

        await supabase
          .from('clans')
          .update({
            bank_treasury_metal: currentMetal + Math.floor(refundAmount * 0.4),
            bank_treasury_energy: currentEnergy + Math.floor(refundAmount * 0.6),
          })
          .eq('id', memberData.clan_id);

        refundExecuted = true;
      }
    }
  }

  await logAdminAction({
    admin_id: adminId,
    action: 'EMERGENCY_DISARM_MISSILE',
    target_type: 'MISSILE',
    target_id: missileId,
    reason,
    details: {
      warhead_type: (missile as Record<string, unknown>).warhead_type,
      target_clan_id: (missile as Record<string, unknown>).target_clan_id,
      refund_amount: refundAmount,
      launched_at: (missile as Record<string, unknown>).launched_at,
    },
  });

  await createAdminAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: 'CRITICAL',
    message: `Admin emergency disarm: ${missileId}`,
    details: { missile_id: missileId, admin_id: adminId, reason, refund_amount: refundAmount },
  });

  return {
    success: true,
    message: `Missile disarmed successfully. Refunded ${refundAmount} resources.`,
    refunded: refundExecuted,
  };
}

export async function adjustClanCooldown(
  clanId: string,
  adjustmentHours: number,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string; newCooldownUntil?: string }> {
  const supabase = createServiceClient();

  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .select('id,clan_settings')
    .eq('id', clanId)
    .single();

  if (clanError || !clan) {
    return { success: false, message: 'Clan not found' };
  }

  const clanSettings = (clan.clan_settings as Record<string, unknown>) || {};
  const currentCooldownRaw = clanSettings.wmd_cooldown_until as string | undefined;
  const currentCooldown = currentCooldownRaw ? new Date(currentCooldownRaw) : new Date();
  const newCooldown = new Date(currentCooldown.getTime() + adjustmentHours * 60 * 60 * 1000);
  const now = new Date();

  if (newCooldown < now) {
    const newSettings = { ...clanSettings, wmd_cooldown_until: null };
    await supabase
      .from('clans')
      .update({ clan_settings: newSettings })
      .eq('id', clanId);

    await logAdminAction({
      admin_id: adminId,
      action: 'REMOVE_CLAN_COOLDOWN',
      target_type: 'CLAN',
      target_id: clanId,
      reason,
      details: { previous_cooldown: currentCooldown.toISOString(), adjustment_hours: adjustmentHours },
    });

    return { success: true, message: 'Cooldown removed (adjusted to past)' };
  }

  const newSettings = { ...clanSettings, wmd_cooldown_until: newCooldown.toISOString() };
  await supabase
    .from('clans')
    .update({ clan_settings: newSettings })
    .eq('id', clanId);

  await logAdminAction({
    admin_id: adminId,
    action: 'ADJUST_CLAN_COOLDOWN',
    target_type: 'CLAN',
    target_id: clanId,
    reason,
    details: {
      previous_cooldown: currentCooldown.toISOString(),
      new_cooldown: newCooldown.toISOString(),
      adjustment_hours: adjustmentHours,
    },
  });

  return {
    success: true,
    message: `Cooldown adjusted by ${adjustmentHours} hours`,
    newCooldownUntil: newCooldown.toISOString(),
  };
}

export async function getWMDAnalytics(
  startDate: string,
  endDate: string
): Promise<WMDAnalyticsSummary> {
  const supabase = createServiceClient();

  const { count: missilesLaunched } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact', head: true })
    .gte('launched_at', startDate)
    .lte('launched_at', endDate);

  const { count: votesCreated } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { count: votesVetoed } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('status', 'vetoed' as WMDVoteStatus);

  const { count: defenseBatteriesBuilt } = await supabase
    .from('wmd_defense_batteries')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  const { count: spyMissionsCompleted } = await supabase
    .from('wmd_spy_missions')
    .select('*', { count: 'exact', head: true })
    .gte('completed_at', startDate)
    .lte('completed_at', endDate)
    .eq('status', 'completed' as WMDMissionStatus);

  const { data: damageData } = await supabase
    .from('wmd_missiles')
    .select('damage_radius')
    .gte('launched_at', startDate)
    .lte('launched_at', endDate)
    .eq('status', 'impacted' as WMDLaunchStatus);

  const totalDamageDealt = (damageData || []).reduce(
    (sum, m) => sum + (m.damage_radius || 0),
    0
  );

  const { data: warheadData } = await supabase
    .from('wmd_missile_warheads')
    .select('warhead_type');

  const byWarheadType: Record<string, number> = {};
  (warheadData || []).forEach((m) => {
    const wt = m.warhead_type;
    byWarheadType[wt] = (byWarheadType[wt] || 0) + 1;
  });

  const { data: clanActivityData } = await supabase
    .from('wmd_missiles')
    .select('owner_id')
    .gte('launched_at', startDate)
    .lte('launched_at', endDate);

  const clanActivityMap: Record<string, number> = {};
  (clanActivityData || []).forEach((m) => {
    const cid = m.owner_id || 'unknown';
    clanActivityMap[cid] = (clanActivityMap[cid] || 0) + 1;
  });
  const topClans = Object.entries(clanActivityMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([clanId, activity]) => ({ clan_id: clanId, clan_name: clanId, activity }));

  const { count: passedVotes } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .eq('status', 'passed' as WMDVoteStatus);

  const avgVoteApprovalRate =
    (votesCreated || 0) > 0 ? ((passedVotes || 0) / (votesCreated || 1)) * 100 : 0;

  const { count: interceptedMissiles } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact', head: true })
    .gte('launched_at', startDate)
    .lte('launched_at', endDate)
    .eq('status', 'intercepted' as WMDLaunchStatus);

  const avgMissileInterceptionRate =
    (missilesLaunched || 0) > 0
      ? ((interceptedMissiles || 0) / (missilesLaunched || 1)) * 100
      : 0;

  return {
    time_range: { start: startDate, end: endDate },
    totals: {
      missiles_launched: missilesLaunched || 0,
      votes_created: votesCreated || 0,
      votes_vetoed: votesVetoed || 0,
      defense_batteries_built: defenseBatteriesBuilt || 0,
      spy_missions_completed: spyMissionsCompleted || 0,
      total_damage_dealt: totalDamageDealt,
    },
    by_warhead_type: byWarheadType,
    top_clans: topClans,
    balance_metrics: {
      avg_vote_approval_rate: avgVoteApprovalRate,
      avg_missile_interception_rate: avgMissileInterceptionRate,
      avg_cooldown_duration: 14,
    },
  };
}

export async function flagSuspiciousActivity(
  report: Omit<SuspiciousActivityReport, 'flagged_at'>
): Promise<{ success: boolean; alert_id: string }> {
  const supabase = createServiceClient();

  const fullReport: SuspiciousActivityReport = {
    ...report,
    flagged_at: new Date().toISOString(),
  };

  await supabase.from('player_flags').insert({
    player_username: report.player_id,
    flagged_by: 'WMD_SYSTEM',
    reason: `${report.activity_type}: ${report.details}`,
    resolved: false,
    created_at: fullReport.flagged_at,
  });

  const alert = await createAdminAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: report.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
    message: `Suspicious ${report.activity_type}: ${report.details}`,
    details: {
      player_id: report.player_id,
      clan_id: report.clan_id,
      activity_type: report.activity_type,
      evidence: report.evidence,
    },
  });

  return { success: true, alert_id: alert.alert_id };
}

async function logAdminAction(
  action: Omit<AdminAuditEntry, 'audit_id' | 'timestamp'>
): Promise<void> {
  const supabase = createServiceClient();

  const entry: AdminAuditEntry = {
    ...action,
    audit_id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
  };

  await supabase.from('admin_logs').insert({
    id: entry.audit_id,
    admin_username: entry.admin_id,
    action: entry.action,
    target: `${entry.target_type}:${entry.target_id}`,
    details: {
      reason: entry.reason,
      ...entry.details,
    },
    created_at: entry.timestamp,
  });
}

async function createAdminAlert(
  alert: Omit<AdminAlert, 'alert_id' | 'timestamp' | 'acknowledged'>
): Promise<AdminAlert> {
  const supabase = createServiceClient();

  const alertId = `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();

  const fullAlert: AdminAlert = {
    ...alert,
    alert_id: alertId,
    timestamp,
    acknowledged: false,
  };

  const notifType: WMDNotificationType = 'admin_alert' as WMDNotificationType;
  const adminAlertData: Json = {
    alert_type: alert.type,
    severity: alert.severity,
    details: JSON.parse(JSON.stringify(alert.details)),
    acknowledged: false,
  };

  const insertData: Database['public']['Tables']['wmd_notifications']['Insert'] = {
    id: alertId,
    player_id: 'ADMIN',
    notification_type: notifType,
    message: alert.message,
    title: `[${alert.severity}] ${alert.type}`,
    is_read: false,
    created_at: timestamp,
    data: adminAlertData,
  };

  await supabase.from('wmd_notifications').insert(insertData);

  return fullAlert;
}
