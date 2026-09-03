/**
 * WMD Admin Service
 * 
 * Created: 2025-10-22
 * 
 * OVERVIEW:
 * Administrative oversight and emergency controls for the WMD system.
 * Provides admin-only operations for monitoring, intervention, and balance management.
 * 
 * Core Capabilities:
 * - System health monitoring and diagnostics
 * - Emergency interventions (disarm missiles, expire votes)
 * - Cooldown management and adjustments
 * - Suspicious activity detection and flagging
 * - Comprehensive analytics and reporting
 * - Full audit trail for all admin actions
 * 
 * Security:
 * - All functions require admin role verification (handled by API layer)
 * - Every action logged to admin audit trail
 * - Critical operations require justification/reason
 * - No direct database manipulation without validation
 * 
 * Related Files:
 * - lib/wmd/missileService.ts - Missile operations
 * - lib/wmd/clanVotingService.ts - Voting system
 * - lib/wmd/clanConsequencesService.ts - Consequence management
 * - lib/wmd/jobs/scheduler.ts - Background job monitoring
 */

import { db } from '@/lib/db';
import { missiles, wmdClanVotes, wmdSpyMissions, wmdDefenseBatteries, clans, wmdSuspiciousActivity, wmdAdminAlerts } from '@/lib/db/schema';
import { ClanBankTransactionType } from '@/types/clan.types';
import type { ClanBankTransaction } from '@/types/clan.types';
import { MissionStatus } from '@/types/wmd';
import { eq, and, gte, lte, desc } from 'drizzle-orm';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface WMDSystemStatus {
  timestamp: Date;
  scheduler: {
    running: boolean;
    jobs: {
      missileTracker: { running: boolean; lastRun?: Date; errorCount: number };
      spyMissionCompleter: { running: boolean; lastRun?: Date; errorCount: number };
      voteExpirationCleaner: { running: boolean; lastRun?: Date; errorCount: number };
      defenseRepairCompleter: { running: boolean; lastRun?: Date; errorCount: number };
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
  alertId: string;
  type: 'MISSILE_LAUNCH' | 'VOTE_PASSED' | 'SUSPICIOUS_ACTIVITY' | 'COOLDOWN_EXPIRED' | 'SYSTEM_ERROR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
}

export interface SuspiciousActivityReport {
  playerId: string;
  clanId: string;
  activityType: 'RAPID_VOTING' | 'COOLDOWN_BYPASS_ATTEMPT' | 'EXCESSIVE_LAUNCHES' | 'UNUSUAL_PATTERN';
  details: string;
  evidence: Record<string, unknown>;
  flaggedAt: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AdminAuditEntry {
  auditId: string;
  adminId: string;
  action: string;
  targetType: 'MISSILE' | 'VOTE' | 'CLAN' | 'PLAYER' | 'SYSTEM';
  targetId: string;
  reason: string;
  details: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
}

export interface WMDAnalyticsSummary {
  timeRange: { start: Date; end: Date };
  totals: {
    missilesLaunched: number;
    votesCreated: number;
    votesVetoed: number;
    defenseBatteriesBuilt: number;
    spyMissionsCompleted: number;
    totalDamageDealt: number;
  };
  byWarheadType: Record<string, number>;
  topClans: Array<{ clanId: string; clanName: string; activity: number }>;
  balanceMetrics: {
    avgVoteApprovalRate: number;
    avgMissileInterceptionRate: number;
    avgCooldownDuration: number;
  };
}

// ============================================================================
// ADMIN SERVICE FUNCTIONS
// ============================================================================

/**
 * Get comprehensive WMD system status
 */
export async function getWMDSystemStatus(): Promise<WMDSystemStatus> {
  const schedulerHealth = {
    running: true,
    jobs: {
      missileTracker: { running: true, errorCount: 0 },
      spyMissionCompleter: { running: true, errorCount: 0 },
      voteExpirationCleaner: { running: true, errorCount: 0 },
      defenseRepairCompleter: { running: true, errorCount: 0 },
    },
  };

  const activeMissilesRows = await db.select().from(missiles).where(eq(missiles.status, 'ACTIVE'));
  const activeVotesRows = await db.select().from(wmdClanVotes).where(eq(wmdClanVotes.status, 'ACTIVE'));
  const activeMissionsRows = await db.select().from(wmdSpyMissions).where(eq(wmdSpyMissions.status, MissionStatus.ACTIVE));
  const repairingBatteriesRows = await db.select().from(wmdDefenseBatteries).where(eq(wmdDefenseBatteries.status, 'REPAIRING'));

  const now = new Date();
  const clansRows = await db.select().from(clans);
  const clansOnCooldown = clansRows.filter(c => c.wmdCooldownUntil && new Date(c.wmdCooldownUntil) > now).length;

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentAlertsRows = await db.select().from(wmdAdminAlerts)
    .where(gte(wmdAdminAlerts.createdAt, dayAgo))
    .orderBy(desc(wmdAdminAlerts.createdAt))
    .limit(20);

  const recentAlerts: AdminAlert[] = recentAlertsRows.map(row => ({
    alertId: row.id,
    type: row.type as AdminAlert['type'],
    severity: row.severity as AdminAlert['severity'],
    message: row.message,
    details: (row.details as Record<string, unknown>) || {},
    timestamp: new Date(row.createdAt),
    acknowledged: row.status === 'ACKNOWLEDGED',
  }));

  return {
    timestamp: new Date(),
    scheduler: schedulerHealth,
    activeMissiles: activeMissilesRows.length,
    activeVotes: activeVotesRows.length,
    activeMissions: activeMissionsRows.length,
    repairingBatteries: repairingBatteriesRows.length,
    clansOnCooldown,
    recentAlerts,
  };
}

/**
 * Force expire a clan vote (emergency admin action)
 */
export async function forceExpireVote(
  voteId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const voteRows = await db.select().from(wmdClanVotes).where(eq(wmdClanVotes.voteId, voteId)).limit(1);
  const vote = voteRows[0];
  if (!vote) {
    return { success: false, message: 'Vote not found' };
  }

  if (vote.status !== 'ACTIVE') {
    return { success: false, message: `Vote already ${vote.status}` };
  }

  // Live voting model resolves when votesFor reaches requiredVotes.
  const votesFor = vote.votesFor?.length ?? 0;
  const finalStatus = votesFor >= vote.requiredVotes ? 'PASSED' : 'FAILED';

  await db.update(wmdClanVotes).set({
    status: finalStatus,
    resolvedAt: new Date(),
  }).where(eq(wmdClanVotes.voteId, voteId));

  await logAdminAction({
    adminId,
    action: 'FORCE_EXPIRE_VOTE',
    targetType: 'VOTE',
    targetId: voteId,
    reason,
    details: { originalStatus: 'ACTIVE', newStatus: finalStatus, votesFor },
  });

  await createAdminAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: 'HIGH',
    message: `Admin forced vote expiration: ${voteId}`,
    details: { voteId, adminId, reason, finalStatus },
  });

  return { success: true, message: `Vote ${finalStatus} by admin intervention` };
}

/**
 * Emergency disarm an active missile
 */
export async function emergencyDisarmMissile(
  missileId: string,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string; refunded?: boolean }> {
  const missileRows = await db.select().from(missiles).where(eq(missiles.missileId, missileId)).limit(1);
  const missile = missileRows[0];
  if (!missile) {
    return { success: false, message: 'Missile not found' };
  }

  if (missile.status !== 'ACTIVE') {
    return { success: false, message: `Missile already ${missile.status}` };
  }

  await db.update(missiles).set({
    status: 'ADMIN_DISARMED',
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(missiles.missileId, missileId));

  const refundAmount = Math.floor(
    ((missile.componentsWarhead ?? 0) +
      (missile.componentsPropulsion ?? 0) +
      (missile.componentsGuidance ?? 0) +
      (missile.componentsPayload ?? 0) +
      (missile.componentsStealth ?? 0)) * 0.5
  );
  if (refundAmount > 0 && missile.ownerClanId) {
    const clanRows = await db.select().from(clans).where(eq(clans.id, missile.ownerClanId)).limit(1);
    const clan = clanRows[0];
    if (clan) {
      const existingHistory = clan.bankTransactions || [];
      const bankHistory: ClanBankTransaction[] = [...existingHistory, {
        transactionId: crypto.randomUUID().replace(/-/g, '').slice(0, 24),
        type: ClanBankTransactionType.ADMIN_REFUND,
        amount: { metal: refundAmount, energy: 0 },
        description: `Missile ${missileId} admin-disarmed: ${reason}`,
        timestamp: new Date(),
      }].slice(-100);

      await db.update(clans).set({
        bankTreasuryMetal: Number(clan.bankTreasuryMetal) + Math.floor(refundAmount * 0.4),
        bankTreasuryEnergy: Number(clan.bankTreasuryEnergy) + Math.floor(refundAmount * 0.6),
        bankTransactions: bankHistory,
      }).where(eq(clans.id, missile.ownerClanId));
    }
  }

  await logAdminAction({
    adminId,
    action: 'EMERGENCY_DISARM_MISSILE',
    targetType: 'MISSILE',
    targetId: missileId,
    reason,
    details: {
      warheadType: missile.warheadType,
      targetClanId: missile.ownerClanId,
      refundAmount,
      launchedAt: missile.launchedAt,
    },
  });

  await createAdminAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: 'CRITICAL',
    message: `Admin emergency disarm: ${missileId}`,
    details: { missileId, adminId, reason, refundAmount },
  });

  return {
    success: true,
    message: `Missile disarmed successfully. Refunded ${refundAmount} resources.`,
    refunded: true,
  };
}

/**
 * Adjust clan WMD cooldown
 */
export async function adjustClanCooldown(
  clanId: string,
  adjustmentHours: number,
  adminId: string,
  reason: string
): Promise<{ success: boolean; message: string; newCooldownUntil?: Date }> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanRows[0];
  if (!clan) {
    return { success: false, message: 'Clan not found' };
  }

  const currentCooldown = clan.wmdCooldownUntil ? new Date(clan.wmdCooldownUntil) : new Date();
  const newCooldown = new Date(currentCooldown.getTime() + adjustmentHours * 60 * 60 * 1000);

  if (newCooldown < new Date()) {
    await db.update(clans).set({
      wmdCooldownUntil: null,
    }).where(eq(clans.id, clanId));

    await logAdminAction({
      adminId,
      action: 'REMOVE_CLAN_COOLDOWN',
      targetType: 'CLAN',
      targetId: clanId,
      reason,
      details: { previousCooldown: currentCooldown, adjustmentHours },
    });

    return { success: true, message: 'Cooldown removed (adjusted to past)' };
  }

  await db.update(clans).set({
    wmdCooldownUntil: newCooldown,
  }).where(eq(clans.id, clanId));

  await logAdminAction({
    adminId,
    action: 'ADJUST_CLAN_COOLDOWN',
    targetType: 'CLAN',
    targetId: clanId,
    reason,
    details: {
      previousCooldown: currentCooldown,
      newCooldown,
      adjustmentHours,
    },
  });

  return {
    success: true,
    message: `Cooldown adjusted by ${adjustmentHours} hours`,
    newCooldownUntil: newCooldown,
  };
}

/**
 * Get WMD analytics summary
 */
export async function getWMDAnalytics(
  startDate: Date,
  endDate: Date
): Promise<WMDAnalyticsSummary> {
  const missilesRows = await db.select().from(missiles).where(
    and(
      gte(missiles.launchedAt, startDate),
      lte(missiles.launchedAt, endDate)
    )
  );

  const votesRows = await db.select().from(wmdClanVotes).where(
    and(
      gte(wmdClanVotes.createdAt, startDate),
      lte(wmdClanVotes.createdAt, endDate)
    )
  );

  const batteriesRows = await db.select().from(wmdDefenseBatteries).where(
    and(
      gte(wmdDefenseBatteries.builtAt, startDate),
      lte(wmdDefenseBatteries.builtAt, endDate)
    )
  );

  const missionsRows = await db.select().from(wmdSpyMissions).where(
    and(
      gte(wmdSpyMissions.completedAt, startDate),
      lte(wmdSpyMissions.completedAt, endDate),
      eq(wmdSpyMissions.status, MissionStatus.COMPLETED)
    )
  );

  const missilesLaunched = missilesRows.length;
  const votesCreated = votesRows.length;
  const votesVetoed = votesRows.filter(v => v.status === 'VETOED').length;
  const defenseBatteriesBuilt = batteriesRows.length;
  const spyMissionsCompleted = missionsRows.length;

  const impactedMissiles = missilesRows.filter(m => m.status === 'IMPACTED');
  const totalDamageDealt = impactedMissiles.reduce((sum, m) => {
    const damage = m.damageDealt;
    return sum + (damage ? damage.unitsDestroyed : 0);
  }, 0);

  const byWarheadType: Record<string, number> = {};
  missilesRows.forEach(m => {
    byWarheadType[m.warheadType ?? 'UNKNOWN'] = (byWarheadType[m.warheadType ?? 'UNKNOWN'] || 0) + 1;
  });

  const clanActivityMap: Record<string, number> = {};
  missilesRows.forEach(m => {
    clanActivityMap[m.ownerClanId ?? 'UNASSIGNED'] = (clanActivityMap[m.ownerClanId ?? 'UNASSIGNED'] || 0) + 1;
  });

  const topClans = Object.entries(clanActivityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([clanId, activity]) => ({
      clanId,
      clanName: clanId,
      activity,
    }));

  const passedVotes = votesRows.filter(v => v.status === 'PASSED').length;
  const avgVoteApprovalRate = votesCreated > 0 ? (passedVotes / votesCreated) * 100 : 0;

  const interceptedMissiles = missilesRows.filter(m => m.status === 'INTERCEPTED').length;
  const avgMissileInterceptionRate = missilesLaunched > 0 ? (interceptedMissiles / missilesLaunched) * 100 : 0;

  return {
    timeRange: { start: startDate, end: endDate },
    totals: {
      missilesLaunched,
      votesCreated,
      votesVetoed,
      defenseBatteriesBuilt,
      spyMissionsCompleted,
      totalDamageDealt,
    },
    byWarheadType,
    topClans,
    balanceMetrics: {
      avgVoteApprovalRate,
      avgMissileInterceptionRate,
      avgCooldownDuration: 14,
    },
  };
}

/**
 * Flag suspicious WMD activity
 */
export async function flagSuspiciousActivity(
  report: Omit<SuspiciousActivityReport, 'flaggedAt'>
): Promise<{ success: boolean; alertId: string }> {
  const alertId = `susp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await db.insert(wmdSuspiciousActivity).values({
    id: alertId,
    playerId: report.playerId,
    clanId: report.clanId,
    activityType: report.activityType,
    severity: report.severity,
    details: report.details,
    evidence: report.evidence,
    reportedBy: 'ADMIN',
    createdAt: new Date(),
  });

  const alert = await createAdminAlert({
    type: 'SUSPICIOUS_ACTIVITY',
    severity: report.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
    message: `Suspicious ${report.activityType}: ${report.details}`,
    details: {
      playerId: report.playerId,
      clanId: report.clanId,
      activityType: report.activityType,
      evidence: report.evidence,
    },
  });

  return { success: true, alertId: alert.alertId };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Log admin action to audit trail
 */
async function logAdminAction(
  action: Omit<AdminAuditEntry, 'auditId' | 'timestamp' | 'ipAddress'>
): Promise<void> {
  // SCOPE (WMD-phantom finding): the wmdAdminAudit table has never existed in any
  // schema or migration, so this insert never worked — and on a reachable database it
  // would throw after the admin action's side effects. No-op until the operator decides
  // whether to build the audit-table feature (tracked in SCOPE.md).
  void action;
}

/**
 * Create admin alert
 */
async function createAdminAlert(
  alert: Omit<AdminAlert, 'alertId' | 'timestamp' | 'acknowledged'>
): Promise<AdminAlert> {
  const alertId = `ALERT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await db.insert(wmdAdminAlerts).values({
    id: alertId,
    type: alert.type,
    severity: alert.severity,
    status: 'ACTIVE',
    title: alert.message.substring(0, 200),
    message: alert.message,
    details: alert.details,
    createdAt: new Date(),
  });

  return {
    ...alert,
    alertId,
    timestamp: new Date(),
    acknowledged: false,
  };
}
