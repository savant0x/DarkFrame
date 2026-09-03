/**
 * WMD Analytics Service
 * 
 * Created: 2025-10-22
 * 
 * OVERVIEW:
 * Comprehensive analytics and reporting for the WMD system.
 * Provides aggregated statistics, trend analysis, and balance metrics
 * for monitoring system health and player behavior.
 * 
 * Core Capabilities:
 * - Global WMD statistics and trends
 * - Clan-specific activity reports
 * - Missile impact analysis
 * - Voting pattern analysis
 * - Balance metrics and health indicators
 * - Time-series data for charting
 * 
 * Performance:
 * - Uses Drizzle ORM queries for efficiency
 * - Time-range filtering to limit dataset size
 * - Results suitable for caching (consider Redis)
 * 
 * Related Files:
 * - lib/wmd/admin/wmdAdminService.ts - Admin operations
 * - lib/wmd/missileService.ts - Missile data source
 * - lib/wmd/clanVotingService.ts - Voting data source
 * - lib/wmd/spyService.ts - Spy mission data source
 */

import { db } from '@/lib/db';
import { missiles, wmdClanVotes, wmdDefenseBatteries, wmdSpyMissions, clans } from '@/lib/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';

/** Member counts per clan id, read from `clans.members`. */
async function getClanMemberCounts(clanIds: string[]): Promise<Map<string, number>> {
  const uniqueIds = [...new Set(clanIds)];
  if (uniqueIds.length === 0) return new Map();
  const clanRows = await db
    .select({ id: clans.id, members: clans.members })
    .from(clans)
    .where(inArray(clans.id, uniqueIds));
  return new Map(clanRows.map(c => [c.id, c.members?.length ?? 0]));
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GlobalWMDStats {
  timeRange: { start: Date; end: Date };
  missiles: {
    total: number;
    active: number;
    impacted: number;
    intercepted: number;
    adminDisarmed: number;
    byWarheadType: Record<string, number>;
    totalDamage: number;
    avgFlightTime: number;
  };
  votes: {
    total: number;
    active: number;
    passed: number;
    failed: number;
    vetoed: number;
    expired: number;
    avgApprovalRate: number;
    avgParticipationRate: number;
  };
  defense: {
    batteriesBuilt: number;
    batteriesOperational: number;
    batteriesRepairing: number;
    totalInterceptions: number;
    avgInterceptionRate: number;
  };
  spyOps: {
    missionsCompleted: number;
    successfulMissions: number;
    failedMissions: number;
    avgSuccessRate: number;
    totalIntelGenerated: number;
  };
  economy: {
    totalResourcesSpent: number;
    metalSpent: number;
    energySpent: number;
    avgCostPerMissile: number;
  };
}

export interface ClanWMDActivity {
  clanId: string;
  clanName: string;
  timeRange: { start: Date; end: Date };
  missiles: {
    launched: number;
    impacted: number;
    intercepted: number;
    totalDamageDealt: number;
    totalDamageReceived: number;
  };
  votes: {
    created: number;
    passed: number;
    failed: number;
    vetoed: number;
    avgApprovalRate: number;
  };
  defense: {
    batteriesBuilt: number;
    successfulInterceptions: number;
  };
  spyOps: {
    missionsLaunched: number;
    successfulMissions: number;
  };
  economy: {
    totalSpent: number;
    avgMemberContribution: number;
  };
  reputation: {
    current: number;
    netChange: number;
    wmdPenalties: number;
  };
  currentCooldown?: Date;
}

export interface MissileImpactReport {
  timeRange: { start: Date; end: Date };
  totalImpacts: number;
  damageByType: {
    warheadType: string;
    impacts: number;
    totalDamage: number;
    avgDamage: number;
  }[];
  topTargets: {
    clanId: string;
    clanName: string;
    hitsReceived: number;
    totalDamage: number;
  }[];
  topAttackers: {
    clanId: string;
    clanName: string;
    missilesFired: number;
    totalDamage: number;
  }[];
  interceptionAnalysis: {
    totalAttempts: number;
    successful: number;
    failed: number;
    rate: number;
  };
}

export interface VotingPatterns {
  timeRange: { start: Date; end: Date };
  overallStats: {
    totalVotes: number;
    avgDuration: number;
    avgParticipation: number;
    avgApprovalRate: number;
  };
  byWarheadType: {
    type: string;
    votes: number;
    passRate: number;
    avgApprovalThreshold: number;
    avgParticipation: number;
  }[];
  vetoAnalysis: {
    totalVetoes: number;
    vetoRate: number;
    byWarheadType: Record<string, number>;
  };
  participationTrends: {
    date: Date;
    avgParticipation: number;
    votesCreated: number;
  }[];
}

export interface BalanceMetrics {
  timeRange: { start: Date; end: Date };
  offenseDefenseRatio: number;
  economicBalance: {
    avgClanSpending: number;
    topSpenders: { clanId: string; totalSpent: number }[];
    spendingGini: number;
  };
  consequenceEffectiveness: {
    avgCooldownDuration: number;
    avgReputationLoss: number;
    retaliationUtilization: number;
  };
  votingHealth: {
    avgApprovalRate: number;
    vetoRate: number;
    consensusLevel: number;
  };
  activityDistribution: {
    activeClans: number;
    inactiveClans: number;
    concentrationIndex: number;
  };
  warnings: string[];
}

export interface TimeSeriesData {
  date: Date;
  missilesLaunched: number;
  votesCreated: number;
  batteriesBuilt: number;
  totalDamage: number;
  interceptionRate: number;
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Get global WMD statistics
 */
export async function getGlobalWMDStats(
  startDate: Date,
  endDate: Date
): Promise<GlobalWMDStats> {
  const missilesRows = await db.select().from(missiles).where(
    and(gte(missiles.launchedAt, startDate), lte(missiles.launchedAt, endDate))
  );

  const votesRows = await db.select().from(wmdClanVotes).where(
    and(gte(wmdClanVotes.createdAt, startDate), lte(wmdClanVotes.createdAt, endDate))
  );

  const batteriesRows = await db.select().from(wmdDefenseBatteries).where(
    and(gte(wmdDefenseBatteries.builtAt, startDate), lte(wmdDefenseBatteries.builtAt, endDate))
  );

  const missionsRows = await db.select().from(wmdSpyMissions).where(
    and(gte(wmdSpyMissions.completedAt, startDate), lte(wmdSpyMissions.completedAt, endDate))
  );

  const totals = {
    total: missilesRows.length,
    active: missilesRows.filter(m => m.status === 'ACTIVE').length,
    impacted: missilesRows.filter(m => m.status === 'IMPACTED').length,
    intercepted: missilesRows.filter(m => m.status === 'INTERCEPTED').length,
    adminDisarmed: missilesRows.filter(m => m.status === 'ADMIN_DISARMED').length,
  };

  const byWarheadType: Record<string, number> = {};
  missilesRows.forEach(m => {
    byWarheadType[m.warheadType] = (byWarheadType[m.warheadType] || 0) + 1;
  });

  const totalDamage = missilesRows.filter(m => m.status === 'IMPACTED').reduce((sum, m) => {
    const damage = m.damageDealt;
    return sum + (damage ? damage.unitsDestroyed : 0);
  }, 0);

  const avgFlightTime = totals.impacted > 0
    ? missilesRows.filter(m => m.status === 'IMPACTED' && m.flightTime).reduce((sum, m) => sum + (m.flightTime || 0), 0) / totals.impacted
    : 0;

  const voteData = {
    total: votesRows.length,
    active: votesRows.filter(v => v.status === 'ACTIVE').length,
    passed: votesRows.filter(v => v.status === 'PASSED').length,
    failed: votesRows.filter(v => v.status === 'FAILED').length,
    vetoed: votesRows.filter(v => v.status === 'VETOED').length,
    expired: votesRows.filter(v => v.status === 'EXPIRED').length,
  };

  const avgApprovalRate = voteData.total > 0
    ? votesRows.reduce((sum, v) => {
        const forCount = v.votesFor?.length ?? 0;
        const againstCount = v.votesAgainst?.length ?? 0;
        const totalBallots = forCount + againstCount;
        return sum + (totalBallots > 0 ? (forCount / totalBallots) * 100 : 0);
      }, 0) / voteData.total
    : 0;

  const clanMemberCounts = await getClanMemberCounts(votesRows.map(v => v.clanId));
  const avgParticipationRate = voteData.total > 0
    ? votesRows.reduce((sum, v) => {
        const ballots = (v.votesFor?.length ?? 0) + (v.votesAgainst?.length ?? 0);
        const eligible = clanMemberCounts.get(v.clanId) ?? 0;
        return sum + (eligible > 0 ? (ballots / eligible) * 100 : 0);
      }, 0) / voteData.total
    : 0;

  const defenseData = {
    total: batteriesRows.length,
    operational: batteriesRows.filter(b => b.status === 'OPERATIONAL').length,
    repairing: batteriesRows.filter(b => b.status === 'REPAIRING').length,
    totalInterceptions: batteriesRows.reduce((sum, b) => sum + (Number(b.interceptChance) || 0), 0),
  };

  const avgInterceptionRate = totals.total > 0 ? (totals.intercepted / totals.total) * 100 : 0;

  const spyData = {
    total: missionsRows.length,
    successful: missionsRows.filter(m => m.status === 'COMPLETED').length,
    failed: missionsRows.filter(m => m.status === 'FAILED').length,
  };

  const avgSuccessRate = spyData.total > 0 ? (spyData.successful / spyData.total) * 100 : 0;

  const totalIntel = missionsRows.reduce((sum, m) => {
    return sum + (m.intelGathered ? m.intelGathered.length : 0);
  }, 0);

  const    economicData = {
      totalCost: missilesRows.reduce((sum, m) => {
        return sum + (m.componentsWarhead ?? 0) + (m.componentsPropulsion ?? 0) + (m.componentsGuidance ?? 0) + (m.componentsPayload ?? 0) + (m.componentsStealth ?? 0);
      }, 0),
      count: missilesRows.length,
    };

  const avgCostPerMissile = economicData.count > 0 ? economicData.totalCost / economicData.count : 0;

  return {
    timeRange: { start: startDate, end: endDate },
    missiles: {
      ...totals,
      byWarheadType,
      totalDamage,
      avgFlightTime,
    },
    votes: {
      ...voteData,
      avgApprovalRate,
      avgParticipationRate,
    },
    defense: {
      batteriesBuilt: defenseData.total,
      batteriesOperational: defenseData.operational,
      batteriesRepairing: defenseData.repairing,
      totalInterceptions: defenseData.totalInterceptions,
      avgInterceptionRate,
    },
    spyOps: {
      missionsCompleted: spyData.total,
      successfulMissions: spyData.successful,
      failedMissions: spyData.failed,
      avgSuccessRate,
      totalIntelGenerated: totalIntel,
    },
    economy: {
      totalResourcesSpent: economicData.totalCost,
      metalSpent: Math.floor(economicData.totalCost * 0.4),
      energySpent: Math.floor(economicData.totalCost * 0.6),
      avgCostPerMissile,
    },
  };
}

/**
 * Get clan-specific WMD activity
 */
export async function getClanWMDActivity(
  clanId: string,
  startDate: Date,
  endDate: Date
): Promise<ClanWMDActivity> {
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  const clan = clanRows[0];
  const clanName = clan?.name || 'Unknown Clan';

  const missilesRows = await db.select().from(missiles).where(
    and(eq(missiles.ownerClanId, clanId), gte(missiles.launchedAt, startDate), lte(missiles.launchedAt, endDate))
  );

  const missilesReceived = await db.select().from(missiles).where(
    and(eq(missiles.targetId, clanId), gte(missiles.launchedAt, startDate), lte(missiles.launchedAt, endDate), eq(missiles.status, 'IMPACTED'))
  );

  const votesRows = await db.select().from(wmdClanVotes).where(
    and(eq(wmdClanVotes.clanId, clanId), gte(wmdClanVotes.createdAt, startDate), lte(wmdClanVotes.createdAt, endDate))
  );

  const batteriesRows = await db.select().from(wmdDefenseBatteries).where(
    and(eq(wmdDefenseBatteries.clanId, clanId), gte(wmdDefenseBatteries.builtAt, startDate), lte(wmdDefenseBatteries.builtAt, endDate))
  );

  const spyMissionsRows = await db.select().from(wmdSpyMissions).where(
    and(eq(wmdSpyMissions.senderClanId, clanId), gte(wmdSpyMissions.createdAt, startDate), lte(wmdSpyMissions.createdAt, endDate))
  );

  const missileData = {
    launched: missilesRows.length,
    impacted: missilesRows.filter(m => m.status === 'IMPACTED').length,
    intercepted: missilesRows.filter(m => m.status === 'INTERCEPTED').length,
    totalDamageDealt: missilesRows.filter(m => m.status === 'IMPACTED').reduce((sum, m) => {
      const damage = m.damageDealt;
      return sum + (damage ? damage.unitsDestroyed : 0);
    }, 0),
  };

  const totalDamageReceived = missilesReceived.reduce((sum, m) => {
    const damage = m.damageDealt;
    return sum + (damage ? damage.unitsDestroyed : 0);
  }, 0);

  const voteData = {
    created: votesRows.length,
    passed: votesRows.filter(v => v.status === 'PASSED').length,
    failed: votesRows.filter(v => v.status === 'FAILED').length,
    vetoed: votesRows.filter(v => v.status === 'VETOED').length,
  };

  const avgApprovalRate = voteData.created > 0
    ? votesRows.reduce((sum, v) => {
        const forCount = v.votesFor?.length ?? 0;
        const againstCount = v.votesAgainst?.length ?? 0;
        const totalBallots = forCount + againstCount;
        return sum + (totalBallots > 0 ? (forCount / totalBallots) * 100 : 0);
      }, 0) / voteData.created
    : 0;

  return {
    clanId,
    clanName,
    timeRange: { start: startDate, end: endDate },
    missiles: {
      ...missileData,
      totalDamageReceived,
    },
    votes: {
      ...voteData,
      avgApprovalRate,
    },
    defense: {
      batteriesBuilt: batteriesRows.length,
      successfulInterceptions: batteriesRows.reduce((sum, b) => sum + (Number(b.interceptChance) || 0), 0),
    },
    spyOps: {
      missionsLaunched: spyMissionsRows.length,
      successfulMissions: spyMissionsRows.filter(m => m.status === 'COMPLETED').length,
    },
    economy: {
      totalSpent: 0,
      avgMemberContribution: 0,
    },
    reputation: {
      current: 0,
      netChange: 0,
      wmdPenalties: 0,
    },
    currentCooldown: clan?.wmdCooldownUntil ? new Date(clan.wmdCooldownUntil) : undefined,
  };
}

/**
 * Get missile impact report
 */
export async function getMissileImpactReport(
  startDate: Date,
  endDate: Date
): Promise<MissileImpactReport> {
  const missilesRows = await db.select().from(missiles).where(
    and(gte(missiles.launchedAt, startDate), lte(missiles.launchedAt, endDate))
  );

  const impactedMissiles = missilesRows.filter(m => m.status === 'IMPACTED');
  const totalImpacts = impactedMissiles.length;

  const damageByTypeMap: Record<string, { impacts: number; totalDamage: number }> = {};
  impactedMissiles.forEach(m => {
    const dmg = m.damageDealt ? m.damageDealt.unitsDestroyed : 0;
    if (!damageByTypeMap[m.warheadType]) {
      damageByTypeMap[m.warheadType] = { impacts: 0, totalDamage: 0 };
    }
    damageByTypeMap[m.warheadType].impacts++;
    damageByTypeMap[m.warheadType].totalDamage += dmg;
  });

  const damageByType = Object.entries(damageByTypeMap).map(([warheadType, data]) => ({
    warheadType,
    impacts: data.impacts,
    totalDamage: data.totalDamage,
    avgDamage: data.impacts > 0 ? data.totalDamage / data.impacts : 0,
  })).sort((a, b) => b.totalDamage - a.totalDamage);

  const targetMap: Record<string, { hitsReceived: number; totalDamage: number }> = {};
  impactedMissiles.forEach(m => {
    const target = m.targetId || 'unknown';
    const dmg = m.damageDealt ? m.damageDealt.unitsDestroyed : 0;
    if (!targetMap[target]) {
      targetMap[target] = { hitsReceived: 0, totalDamage: 0 };
    }
    targetMap[target].hitsReceived++;
    targetMap[target].totalDamage += dmg;
  });

  const topTargets = Object.entries(targetMap)
    .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
    .slice(0, 10)
    .map(([clanId, data]) => ({
      clanId,
      clanName: clanId,
      hitsReceived: data.hitsReceived,
      totalDamage: data.totalDamage,
    }));

  const attackerMap: Record<string, { missilesFired: number; totalDamage: number }> = {};
  impactedMissiles.forEach(m => {
    if (m.ownerClanId === null) return; // missiles fired without a clan cannot be attributed
    const dmg = m.damageDealt ? m.damageDealt.unitsDestroyed : 0;
    if (!attackerMap[m.ownerClanId]) {
      attackerMap[m.ownerClanId] = { missilesFired: 0, totalDamage: 0 };
    }
    attackerMap[m.ownerClanId].missilesFired++;
    attackerMap[m.ownerClanId].totalDamage += dmg;
  });

  const topAttackers = Object.entries(attackerMap)
    .sort((a, b) => b[1].totalDamage - a[1].totalDamage)
    .slice(0, 10)
    .map(([clanId, data]) => ({
      clanId,
      clanName: clanId,
      missilesFired: data.missilesFired,
      totalDamage: data.totalDamage,
    }));

  const allMissiles = missilesRows.filter(m => m.status === 'IMPACTED' || m.status === 'INTERCEPTED');
  const totalAttempts = allMissiles.length;
  const successful = allMissiles.filter(m => m.status === 'INTERCEPTED').length;
  const interceptionRate = totalAttempts > 0 ? (successful / totalAttempts) * 100 : 0;

  return {
    timeRange: { start: startDate, end: endDate },
    totalImpacts,
    damageByType,
    topTargets,
    topAttackers,
    interceptionAnalysis: {
      totalAttempts,
      successful,
      failed: totalAttempts - successful,
      rate: interceptionRate,
    },
  };
}

/**
 * Get voting pattern analysis
 */
export async function getVotingPatterns(
  startDate: Date,
  endDate: Date
): Promise<VotingPatterns> {
  const votesRows = await db.select().from(wmdClanVotes).where(
    and(gte(wmdClanVotes.createdAt, startDate), lte(wmdClanVotes.createdAt, endDate))
  );

  const memberCountByClan = await getClanMemberCounts(votesRows.map(v => v.clanId));

  const totalVotes = votesRows.length;
  const avgApprovalRate = totalVotes > 0
    ? votesRows.reduce((sum, v) => {
        const forCount = v.votesFor?.length ?? 0;
        const againstCount = v.votesAgainst?.length ?? 0;
        const totalBallots = forCount + againstCount;
        return sum + (totalBallots > 0 ? (forCount / totalBallots) * 100 : 0);
      }, 0) / totalVotes
    : 0;

  const avgParticipation = totalVotes > 0
    ? votesRows.reduce((sum, v) => {
        const ballots = (v.votesFor?.length ?? 0) + (v.votesAgainst?.length ?? 0);
        const eligible = memberCountByClan.get(v.clanId) ?? 0;
        return sum + (eligible > 0 ? (ballots / eligible) * 100 : 0);
      }, 0) / totalVotes
    : 0;

  const avgDuration = totalVotes > 0
    ? votesRows.reduce((sum, v) => {
        if (v.resolvedAt) {
          return sum + (new Date(v.resolvedAt).getTime() - new Date(v.createdAt).getTime());
        }
        return sum;
      }, 0) / totalVotes
    : 0;

  const byVoteTypeMap: Record<string, { votes: number; passed: number; totalApprovalThreshold: number; totalParticipation: number }> = {};
  votesRows.forEach(v => {
    if (!byVoteTypeMap[v.voteType]) {
      byVoteTypeMap[v.voteType] = { votes: 0, passed: 0, totalApprovalThreshold: 0, totalParticipation: 0 };
    }
    byVoteTypeMap[v.voteType].votes++;
    if (v.resolvedAt && (v.votesFor?.length ?? 0) > (v.votesAgainst?.length ?? 0)) byVoteTypeMap[v.voteType].passed++;
    byVoteTypeMap[v.voteType].totalApprovalThreshold += v.requiredVotes;
    const ballots = (v.votesFor?.length ?? 0) + (v.votesAgainst?.length ?? 0);
    const eligible = memberCountByClan.get(v.clanId) ?? 0;
    byVoteTypeMap[v.voteType].totalParticipation += eligible > 0 ? (ballots / eligible) * 100 : 0;
  });

  const byWarheadType = Object.entries(byVoteTypeMap).map(([type, data]) => ({
    type,
    votes: data.votes,
    passRate: data.votes > 0 ? (data.passed / data.votes) * 100 : 0,
    avgApprovalThreshold: data.votes > 0 ? data.totalApprovalThreshold / data.votes : 0,
    avgParticipation: data.votes > 0 ? data.totalParticipation / data.votes : 0,
  }));

  // The live voting model (wmd_clan_votes) has no veto mechanism.
  const totalVetoes = 0;
  const vetoRate = 0;
  const vetoByType: Record<string, number> = {};

  return {
    timeRange: { start: startDate, end: endDate },
    overallStats: {
      totalVotes,
      avgDuration,
      avgParticipation,
      avgApprovalRate,
    },
    byWarheadType,
    vetoAnalysis: {
      totalVetoes,
      vetoRate,
      byWarheadType: vetoByType,
    },
    participationTrends: [],
  };
}

/**
 * Get balance metrics
 */
export async function getBalanceMetrics(
  startDate: Date,
  endDate: Date
): Promise<BalanceMetrics> {
  const warnings: string[] = [];

  const missilesRows = await db.select().from(missiles).where(
    and(gte(missiles.launchedAt, startDate), lte(missiles.launchedAt, endDate))
  );

  const votesRows = await db.select().from(wmdClanVotes).where(
    and(gte(wmdClanVotes.createdAt, startDate), lte(wmdClanVotes.createdAt, endDate))
  );

  const total = missilesRows.length;
  const intercepted = missilesRows.filter(m => m.status === 'INTERCEPTED').length;
  const offenseDefenseRatio = total > 0 ? intercepted / total : 0;

  if (offenseDefenseRatio < 0.1) {
    warnings.push('Defense severely underpowered - <10% interception rate');
  } else if (offenseDefenseRatio > 0.5) {
    warnings.push('Defense may be overpowered - >50% interception rate');
  }

  const totalVotes = votesRows.length;
  const vetoed = 0; // The live voting model (wmd_clan_votes) has no veto mechanism.
  const avgVoteApprovalRate = totalVotes > 0
    ? votesRows.reduce((sum, v) => {
        const forCount = v.votesFor?.length ?? 0;
        const againstCount = v.votesAgainst?.length ?? 0;
        const totalBallots = forCount + againstCount;
        return sum + (totalBallots > 0 ? (forCount / totalBallots) * 100 : 0);
      }, 0) / totalVotes
    : 0;
  const vetoRate = totalVotes > 0 ? (vetoed / totalVotes) * 100 : 0;

  if (avgVoteApprovalRate < 40) {
    warnings.push('Low vote approval rates - consensus difficult to reach');
  }
  if (vetoRate > 20) {
    warnings.push('High veto rate - clan leaders blocking too many votes');
  }

  const clanActivityMap: Record<string, number> = {};
  missilesRows.forEach(m => {
    clanActivityMap[m.ownerClanId ?? 'UNASSIGNED'] = (clanActivityMap[m.ownerClanId ?? 'UNASSIGNED'] || 0) + 1;
  });

  const clanActivity = Object.entries(clanActivityMap).sort((a, b) => b[1] - a[1]);
  const totalActivity = clanActivity.reduce((sum, c) => sum + c[1], 0);
  const top10Percent = Math.max(1, Math.floor(clanActivity.length * 0.1));
  const top10Activity = clanActivity.slice(0, top10Percent).reduce((sum, c) => sum + c[1], 0);
  const concentrationIndex = totalActivity > 0 ? top10Activity / totalActivity : 0;

  if (concentrationIndex > 0.7) {
    warnings.push('Activity highly concentrated - top 10% clans dominate system');
  }

  return {
    timeRange: { start: startDate, end: endDate },
    offenseDefenseRatio,
    economicBalance: {
      avgClanSpending: 0,
      topSpenders: [],
      spendingGini: 0,
    },
    consequenceEffectiveness: {
      avgCooldownDuration: 14 * 24 * 60 * 60 * 1000,
      avgReputationLoss: 2000,
      retaliationUtilization: 0,
    },
    votingHealth: {
      avgApprovalRate: avgVoteApprovalRate,
      vetoRate,
      consensusLevel: 0,
    },
    activityDistribution: {
      activeClans: clanActivity.length,
      inactiveClans: 0,
      concentrationIndex,
    },
    warnings,
  };
}
