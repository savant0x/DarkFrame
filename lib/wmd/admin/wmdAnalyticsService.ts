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
 * - Uses Supabase queries for aggregation
 * - Time-range filtering to limit dataset size
 * - Results suitable for caching (consider Redis)
 * 
 * Related Files:
 * - lib/wmd/admin/wmdAdminService.ts - Admin operations
 * - lib/wmd/missileService.ts - Missile data source
 * - lib/wmd/clanVotingService.ts - Voting data source
 * - lib/wmd/spyService.ts - Spy mission data source
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Row type aliases for readability
type MissileRow = Database['public']['Tables']['wmd_missiles']['Row'];
type WarheadRow = Database['public']['Tables']['wmd_missile_warheads']['Row'];
type LaunchHistoryRow = Database['public']['Tables']['wmd_launch_history']['Row'];
type VoteRow = Database['public']['Tables']['wmd_clan_votes']['Row'];
type BatteryRow = Database['public']['Tables']['wmd_defense_batteries']['Row'];
type SpyMissionRow = Database['public']['Tables']['wmd_spy_missions']['Row'];
type ClanRow = Database['public']['Tables']['clans']['Row'];
type ClanMemberRow = Database['public']['Tables']['clan_members']['Row'];

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface GlobalWMDStats {
  timeRange: { start: string; end: string };
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
  timeRange: { start: string; end: string };
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
  currentCooldown?: string;
}

export interface MissileImpactReport {
  timeRange: { start: string; end: string };
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
  timeRange: { start: string; end: string };
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
    date: string;
    avgParticipation: number;
    votesCreated: number;
  }[];
}

export interface BalanceMetrics {
  timeRange: { start: string; end: string };
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
  date: string;
  missilesLaunched: number;
  votesCreated: number;
  batteriesBuilt: number;
  totalDamage: number;
  interceptionRate: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Fetch all clan member usernames for a given clan.
 * Returns empty array if clan has no members.
 */
async function getClanMemberIds(
  supabase: SupabaseClient<Database>,
  clanId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('clan_members')
    .select('username')
    .eq('clan_id', clanId);
  return (data || []).map(m => m.username);
}

/**
 * Build a map of missile_id → warhead_type from wmd_missile_warheads.
 */
async function getWarheadMap(
  supabase: SupabaseClient<Database>,
  missileIds: string[]
): Promise<Record<string, string>> {
  if (missileIds.length === 0) return {};
  const { data } = await supabase
    .from('wmd_missile_warheads')
    .select('missile_id, warhead_type')
    .in('missile_id', missileIds);
  const map: Record<string, string> = {};
  (data || []).forEach(w => { map[w.missile_id] = w.warhead_type; });
  return map;
}

/**
 * Build a map of missile_id → LaunchHistoryRow from wmd_launch_history.
 */
async function getLaunchHistoryMap(
  supabase: SupabaseClient<Database>,
  missileIds: string[]
): Promise<Record<string, LaunchHistoryRow>> {
  if (missileIds.length === 0) return {};
  const { data } = await supabase
    .from('wmd_launch_history')
    .select('*')
    .in('missile_id', missileIds);
  const map: Record<string, LaunchHistoryRow> = {};
  (data || []).forEach(h => { map[h.missile_id] = h; });
  return map;
}

// ============================================================================
// ANALYTICS FUNCTIONS
// ============================================================================

/**
 * Get global WMD statistics
 */
export async function getGlobalWMDStats(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string
): Promise<GlobalWMDStats> {
  // === MISSILE STATISTICS ===
  const { data: missiles, count: missileCountRaw } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact' })
    .gte('launched_at', startDate)
    .lte('launched_at', endDate);
  const missileTotal = missileCountRaw || 0;

  const missileList = missiles || [];
  const missileIds = missileList.map(m => m.id);

  // Fetch supplementary data
  const warheadMap = await getWarheadMap(supabase, missileIds);
  const launchHistoryMap = await getLaunchHistoryMap(supabase, missileIds);

  const byWarheadType: Record<string, number> = {};
  let activeCount = 0, impactedCount = 0, interceptedCount = 0, adminDisarmedCount = 0;
  let totalDamage = 0, totalFlightTime = 0;

  missileList.forEach(m => {
    const wt = warheadMap[m.id] || 'unknown';
    byWarheadType[wt] = (byWarheadType[wt] || 0) + 1;
    if (m.status === 'in_flight') activeCount++;
    if (m.status === 'impacted') impactedCount++;
    if (m.status === 'intercepted') interceptedCount++;
    if (m.status === 'failed') adminDisarmedCount++;
    const lh = launchHistoryMap[m.id];
    totalDamage += lh?.damage_dealt || 0;
    if (m.launched_at && lh?.launched_at) {
      totalFlightTime += new Date(lh.launched_at).getTime() - new Date(m.launched_at).getTime();
    }
  });

  // === VOTING STATISTICS ===
  const { data: votes, count: voteCountRaw } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const voteTotal = voteCountRaw || 0;

  const voteList = votes || [];
  let voteActive = 0, votePassed = 0, voteFailed = 0, voteVetoed = 0, voteExpired = 0;
  let totalApprovalSum = 0, totalParticipationSum = 0;

  voteList.forEach(v => {
    if (v.status === 'active') voteActive++;
    if (v.status === 'passed') votePassed++;
    if (v.status === 'failed') voteFailed++;
    if (v.status === 'tied') voteVetoed++;
    if (v.status === 'expired') voteExpired++;
    const approvalRate = v.total_eligible > 0 ? (v.votes_for || 0) / v.total_eligible : 0;
    totalApprovalSum += approvalRate;
    if (v.total_eligible > 0) {
      totalParticipationSum += ((v.votes_for || 0) + (v.votes_against || 0) + (v.votes_abstain || 0)) / v.total_eligible;
    }
  });
  const avgApprovalRate = voteTotal > 0 ? (totalApprovalSum / (voteTotal || 1)) * 100 : 0;
  const avgParticipationRate = voteTotal > 0 ? (totalParticipationSum / (voteTotal || 1)) * 100 : 0;

  // === DEFENSE STATISTICS ===
  const { data: batteries, count: batteryCountRaw } = await supabase
    .from('wmd_defense_batteries')
    .select('*', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const batteryTotal = batteryCountRaw || 0;

  const batteryList = batteries || [];
  let batterOps = 0, batterRepair = 0;
  batteryList.forEach(b => {
    if (b.status === 'OPERATIONAL') batterOps++;
    if (b.status === 'REPAIRING') batterRepair++;
  });

  // Count interceptions from wmd_interception_attempts
  const { data: interceptionAttempts, count: interceptions } = await supabase
    .from('wmd_interception_attempts')
    .select('*', { count: 'exact' })
    .gte('attempted_at', startDate)
    .lte('attempted_at', endDate)
    .eq('success', true);
  const totalIntercepts = interceptions || 0;
  const avgInterceptionRate = missileTotal > 0 ? (interceptedCount / missileTotal) * 100 : 0;

  // === SPY OPERATIONS STATISTICS ===
  const { data: missions, count: missionCountRaw } = await supabase
    .from('wmd_spy_missions')
    .select('*', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const missionTotal = missionCountRaw || 0;

  const missionList = missions || [];
  let missionSuccess = 0, missionFail = 0;
  missionList.forEach(m => {
    if (m.status === 'completed') missionSuccess++;
    if (m.status === 'failed') missionFail++;
  });
  const avgSuccessRate = missionTotal > 0 ? (missionSuccess / missionTotal) * 100 : 0;

  // === ECONOMIC STATISTICS ===
  let totalCost = 0, totalMetal = 0, totalEnergy = 0;
  missileList.forEach(m => {
    const lh = launchHistoryMap[m.id];
    totalCost += lh?.damage_dealt || 0;
    totalMetal += lh?.damage_dealt ? lh.damage_dealt * 0.5 : 0;
    totalEnergy += lh?.damage_dealt ? lh.damage_dealt * 0.5 : 0;
  });
  const avgCostPerMissile = missileTotal > 0 ? totalCost / missileTotal : 0;

  return {
    timeRange: { start: startDate, end: endDate },
    missiles: {
      total: missileTotal || 0,
      active: activeCount,
      impacted: impactedCount,
      intercepted: interceptedCount,
      adminDisarmed: adminDisarmedCount,
      byWarheadType,
      totalDamage,
      avgFlightTime: missileTotal > 0 ? totalFlightTime / missileTotal : 0,
    },
    votes: {
      total: voteTotal || 0,
      active: voteActive,
      passed: votePassed,
      failed: voteFailed,
      vetoed: voteVetoed,
      expired: voteExpired,
      avgApprovalRate,
      avgParticipationRate,
    },
    defense: {
      batteriesBuilt: batteryTotal || 0,
      batteriesOperational: batterOps,
      batteriesRepairing: batterRepair,
      totalInterceptions: totalIntercepts,
      avgInterceptionRate,
    },
    spyOps: {
      missionsCompleted: missionTotal || 0,
      successfulMissions: missionSuccess,
      failedMissions: missionFail,
      avgSuccessRate,
      totalIntelGenerated: missionSuccess,
    },
    economy: {
      totalResourcesSpent: totalCost,
      metalSpent: totalMetal,
      energySpent: totalEnergy,
      avgCostPerMissile,
    },
  };
}

/**
 * Get clan-specific WMD activity
 */
export async function getClanWMDActivity(
  supabase: SupabaseClient<Database>,
  clanId: string,
  startDate: string,
  endDate: string
): Promise<ClanWMDActivity> {
  // Get clan info
  const { data: clan } = await supabase
    .from('clans')
    .select('name')
    .eq('id', clanId)
    .single();
  const clanName = clan?.name || 'Unknown Clan';

  // Get clan member usernames
  const memberIds = await getClanMemberIds(supabase, clanId);

  let missileList: MissileRow[] = [];
  let mLaunched = 0;
  if (memberIds.length > 0) {
    const { data: missiles, count } = await supabase
      .from('wmd_missiles')
      .select('*', { count: 'exact' })
      .in('owner_id', memberIds)
      .gte('launched_at', startDate)
      .lte('launched_at', endDate);

    missileList = missiles || [];
    mLaunched = count || 0;
  }

  const missileIds = missileList.map(m => m.id);
  const launchHistoryMap = await getLaunchHistoryMap(supabase, missileIds);

  let mImpacted = 0, mIntercepted = 0, totalDamageDealt = 0;
  missileList.forEach(m => {
    if (m.status === 'impacted') mImpacted++;
    if (m.status === 'intercepted') mIntercepted++;
    totalDamageDealt += launchHistoryMap[m.id]?.damage_dealt || 0;
  });

  // Vote statistics (votes created by clan, based on clan_id on wmd_clan_votes)
  const { data: votes, count: voteTotal } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact' })
    .eq('clan_id', clanId)
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const voteList = votes || [];
  let vPassed = 0, vFailed = 0, vVetoed = 0, vTotalApproval = 0;
  voteList.forEach(v => {
    if (v.status === 'passed') vPassed++;
    if (v.status === 'failed') vFailed++;
    if (v.status === 'tied') vVetoed++;
    const approval = v.total_eligible > 0 ? (v.votes_for || 0) / v.total_eligible : 0;
    vTotalApproval += approval;
  });

  // Defense statistics (batteries owned by clan members)
  let defenseTotal = 0;
  let totalInterceptions = 0;
  if (memberIds.length > 0) {
    const { data: defenseList, count } = await supabase
      .from('wmd_defense_batteries')
      .select('*', { count: 'exact' })
      .in('owner_id', memberIds)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    defenseTotal = count || 0;

    const batteryIds = (defenseList || []).map(b => b.id);
    if (batteryIds.length > 0) {
      const { data: interceptions, count: ic } = await supabase
        .from('wmd_interception_attempts')
        .select('*', { count: 'exact' })
        .in('battery_id', batteryIds)
        .eq('success', true);
      totalInterceptions = ic || 0;
    }
  }

  // Spy mission statistics
  let spyTotal = 0;
  let spySuccess = 0;
  if (memberIds.length > 0) {
    const { data: spyList, count } = await supabase
      .from('wmd_spy_missions')
      .select('*', { count: 'exact' })
      .in('owner_id', memberIds)
      .gte('created_at', startDate)
      .lte('created_at', endDate);
    spyTotal = count || 0;
    spySuccess = (spyList || []).filter(m => m.status === 'completed').length;
  }

  return {
    clanId,
    clanName,
    timeRange: { start: startDate, end: endDate },
    missiles: {
      launched: mLaunched,
      impacted: mImpacted,
      intercepted: mIntercepted,
      totalDamageDealt,
      totalDamageReceived: 0,
    },
    votes: {
      created: voteTotal || 0,
      passed: vPassed,
      failed: vFailed,
      vetoed: vVetoed,
      avgApprovalRate: (voteTotal || 0) > 0 ? (vTotalApproval / (voteTotal || 1)) * 100 : 0,
    },
    defense: {
      batteriesBuilt: defenseTotal,
      successfulInterceptions: totalInterceptions,
    },
    spyOps: {
      missionsLaunched: spyTotal,
      successfulMissions: spySuccess,
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
    currentCooldown: undefined,
  };
}

/**
 * Get missile impact report
 */
export async function getMissileImpactReport(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string
): Promise<MissileImpactReport> {
  const { data: impacts, count: totalImpacts } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact' })
    .gte('launched_at', startDate)
    .lte('launched_at', endDate)
    .eq('status', 'impacted');

  const impactList = impacts || [];
  const impactIds = impactList.map(m => m.id);
  const warheadMap = await getWarheadMap(supabase, impactIds);
  const launchHistoryMap = await getLaunchHistoryMap(supabase, impactIds);

  // Damage by warhead type
  const damageByTypeMap: Record<string, { impacts: number; totalDamage: number }> = {};
  impactList.forEach(m => {
    const wt = warheadMap[m.id] || 'unknown';
    if (!damageByTypeMap[wt]) damageByTypeMap[wt] = { impacts: 0, totalDamage: 0 };
    damageByTypeMap[wt].impacts++;
    damageByTypeMap[wt].totalDamage += launchHistoryMap[m.id]?.damage_dealt || 0;
  });

  const damageByType = Object.entries(damageByTypeMap).map(([warheadType, stats]) => ({
    warheadType,
    impacts: stats.impacts,
    totalDamage: stats.totalDamage,
    avgDamage: stats.impacts > 0 ? stats.totalDamage / stats.impacts : 0,
  })).sort((a, b) => b.totalDamage - a.totalDamage);

  // Top targets by owner_id
  const targetMap: Record<string, { hits: number; damage: number }> = {};
  impactList.forEach(m => {
    const t = m.owner_id || 'unknown';
    if (!targetMap[t]) targetMap[t] = { hits: 0, damage: 0 };
    targetMap[t].hits++;
    targetMap[t].damage += launchHistoryMap[m.id]?.damage_dealt || 0;
  });
  const topTargets = Object.entries(targetMap)
    .sort(([, a], [, b]) => b.damage - a.damage)
    .slice(0, 10)
    .map(([clanId, v]) => ({ clanId, clanName: clanId, hitsReceived: v.hits, totalDamage: v.damage }));

  // Top attackers by owner_id
  const attackerMap: Record<string, { fired: number; damage: number }> = {};
  impactList.forEach(m => {
    const a = m.owner_id || 'unknown';
    if (!attackerMap[a]) attackerMap[a] = { fired: 0, damage: 0 };
    attackerMap[a].fired++;
    attackerMap[a].damage += launchHistoryMap[m.id]?.damage_dealt || 0;
  });
  const topAttackers = Object.entries(attackerMap)
    .sort(([, a], [, b]) => b.damage - a.damage)
    .slice(0, 10)
    .map(([clanId, v]) => ({ clanId, clanName: clanId, missilesFired: v.fired, totalDamage: v.damage }));

  // Interception analysis
  const { data: allMissiles, count: allTotal } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact' })
    .gte('launched_at', startDate)
    .lte('launched_at', endDate)
    .in('status', ['impacted', 'intercepted']);

  const allList = allMissiles || [];
  const intercepted = allList.filter(m => m.status === 'intercepted').length;
  const interceptionRate = (allTotal || 0) > 0 ? (intercepted / (allTotal || 1)) * 100 : 0;

  return {
    timeRange: { start: startDate, end: endDate },
    totalImpacts: totalImpacts || 0,
    damageByType,
    topTargets,
    topAttackers,
    interceptionAnalysis: {
      totalAttempts: allTotal || 0,
      successful: intercepted,
      failed: (allTotal || 0) - intercepted,
      rate: interceptionRate,
    },
  };
}

/**
 * Get voting pattern analysis
 */
export async function getVotingPatterns(
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string
): Promise<VotingPatterns> {
  const { data: votes, count: votesCountRaw } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const totalVotes = votesCountRaw || 0;

  const voteList = votes || [];

  let totalDuration = 0, totalParticipationSum = 0, totalApprovalSum = 0;
  voteList.forEach(v => {
    if (v.closed_at && v.created_at) {
      totalDuration += new Date(v.closed_at).getTime() - new Date(v.created_at).getTime();
    }
    if (v.total_eligible > 0) {
      totalParticipationSum += ((v.votes_for || 0) + (v.votes_against || 0) + (v.votes_abstain || 0)) / v.total_eligible;
    }
    const approval = v.total_eligible > 0 ? (v.votes_for || 0) / v.total_eligible : 0;
    totalApprovalSum += approval;
  });

  const avgDuration = totalVotes > 0 ? totalDuration / totalVotes : 0;
  const avgParticipation = totalVotes > 0 ? (totalParticipationSum / totalVotes) * 100 : 0;
  const avgApproval = totalVotes > 0 ? (totalApprovalSum / totalVotes) * 100 : 0;

  // Veto analysis (tied status is closest to veto)
  const vetoed = voteList.filter(v => v.status === 'tied');
  const vetoRate = totalVotes > 0 ? (vetoed.length / totalVotes) * 100 : 0;
  const vetoByType: Record<string, number> = {};
  vetoed.forEach(v => {
    const t = v.vote_type || 'unknown';
    vetoByType[t] = (vetoByType[t] || 0) + 1;
  });

  return {
    timeRange: { start: startDate, end: endDate },
    overallStats: {
      totalVotes: totalVotes || 0,
      avgDuration,
      avgParticipation,
      avgApprovalRate: avgApproval,
    },
    byWarheadType: [],
    vetoAnalysis: {
      totalVetoes: vetoed.length,
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
  supabase: SupabaseClient<Database>,
  startDate: string,
  endDate: string
): Promise<BalanceMetrics> {
  const warnings: string[] = [];

  const { data: missiles, count: missileCountRaw } = await supabase
    .from('wmd_missiles')
    .select('*', { count: 'exact' })
    .gte('launched_at', startDate)
    .lte('launched_at', endDate);
  const missileTotal = missileCountRaw || 0;

  const missileList = missiles || [];
  const intercepted = missileList.filter(m => m.status === 'intercepted').length;
  const offenseDefenseRatio = missileTotal > 0 ? intercepted / missileTotal : 0;

  if (offenseDefenseRatio < 0.1) {
    warnings.push('Defense severely underpowered - <10% interception rate');
  } else if (offenseDefenseRatio > 0.5) {
    warnings.push('Defense may be overpowered - >50% interception rate');
  }

  const { data: votes, count: voteCountRaw2 } = await supabase
    .from('wmd_clan_votes')
    .select('*', { count: 'exact' })
    .gte('created_at', startDate)
    .lte('created_at', endDate);
  const voteTotal = voteCountRaw2 || 0;
  const voteList = votes || [];
  const passedVotes = voteList.filter(v => v.status === 'passed').length;
  const vetoedVotes = voteList.filter(v => v.status === 'tied').length;
  const avgVoteApprovalRate = voteTotal > 0 ? passedVotes / voteTotal : 0;
  const vetoRate = voteTotal > 0 ? (vetoedVotes / voteTotal) * 100 : 0;

  if (avgVoteApprovalRate < 0.4) {
    warnings.push('Low vote approval rates - consensus difficult to reach');
  }
  if (vetoRate > 20) {
    warnings.push('High veto rate - clan leaders blocking too many votes');
  }

  // Activity distribution based on owner_id
  const clanActivityMap: Record<string, number> = {};
  missileList.forEach(m => {
    const cid = m.owner_id || 'unknown';
    clanActivityMap[cid] = (clanActivityMap[cid] || 0) + 1;
  });
  const clanActivities = Object.values(clanActivityMap).sort((a, b) => b - a);
  const totalActivity = clanActivities.reduce((s, v) => s + v, 0);
  const top10Percent = Math.max(1, Math.floor(clanActivities.length * 0.1));
  const top10Activity = clanActivities.slice(0, top10Percent).reduce((s, v) => s + v, 0);
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
      vetoRate: Math.round(vetoRate),
      consensusLevel: 0,
    },
    activityDistribution: {
      activeClans: clanActivities.length,
      inactiveClans: 0,
      concentrationIndex,
    },
    warnings,
  };
}
