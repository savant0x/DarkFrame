/**
 * Clan Level Progression Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan level progression from 1-50 with exponential XP curve. Awards XP from member
 * actions (harvesting, combat, research, building) and triggers milestone rewards at key levels.
 * Unlocks features progressively: bank upgrades, perks, monuments, and warfare capabilities.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  Clan,
  ClanMilestone,
  ClanXPSource,
  CLAN_LEVEL_CONSTANTS,
  CLAN_XP_RATES,
  CLAN_MILESTONES,
} from '@/types/clan.types';

type MilestoneEntry = {
  level: number;
  completedAt: string;
  rewards: { metal: number; energy: number; researchPoints: number };
};

function readMilestones(settings: Record<string, unknown>): Array<{
  level: number;
  completedAt: Date;
  rewards: { metal: number; energy: number; researchPoints: number };
}> {
  const raw = (settings.milestonesCompleted as MilestoneEntry[]) || [];
  return raw.map((m) => ({
    level: m.level,
    completedAt: new Date(m.completedAt),
    rewards: m.rewards,
  }));
}

async function fetchClanWithMembers(supabase: ReturnType<typeof createServiceClient>, clanId: string): Promise<Clan> {
  const { data: clanRow, error } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();

  if (error || !clanRow) {
    throw new Error('Clan not found');
  }

  const { data: memberRows } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);

  const r = clanRow as Record<string, unknown>;
  const settings = (r.clan_settings as Record<string, unknown>) || {};
  const members = (memberRows || []).map((m) => ({
    playerId: m.player_id as string,
    username: m.username as string,
    role: m.role as import('@/types/clan.types').ClanRole,
    joinedAt: new Date(m.joined_at as string),
    lastActive: new Date(m.last_active as string),
  }));

  return {
    _id: r.id as string,
    name: r.name as string,
    tag: r.tag as string,
    description: r.description as string,
    leaderId: r.leader_id as string,
    members,
    maxMembers: r.max_members as number,
    level: {
      currentLevel: r.clan_level as number,
      totalXP: r.total_xp as number,
      currentLevelXP: r.current_level_xp as number,
      xpToNextLevel: r.xp_to_next_level as number,
      featuresUnlocked: (settings.featuresUnlocked as string[]) || [],
      milestonesCompleted: readMilestones(settings),
      lastLevelUp: r.last_level_up ? new Date(r.last_level_up as string) : undefined,
      lastXPGain: r.last_xp_gain ? new Date(r.last_xp_gain as string) : undefined,
      prestigeBadge: r.prestige_badge as string | undefined,
    },
    createdAt: new Date(r.created_at as string),
    settings: {
      messageOfTheDay: (settings.messageOfTheDay as string) || '',
      isRecruiting: (settings.isRecruiting as boolean) || false,
      minLevelToJoin: (settings.minLevelToJoin as number) || 1,
      requiresApproval: (settings.requiresApproval as boolean) || false,
      allowTerritoryControl: (settings.allowTerritoryControl as boolean) !== false,
      allowWarDeclarations: (settings.allowWarDeclarations as boolean) !== false,
    },
    stats: {
      totalPower: r.total_power as number || 0,
      totalTerritories: r.total_territories as number || 0,
      totalMonuments: r.total_monuments as number || 0,
      warsWon: r.wars_won as number || 0,
      warsLost: r.wars_lost as number || 0,
      totalRP: r.total_rp as number || 0,
    },
    research: {
      researchPoints: r.research_points as number || 0,
      unlockedTechs: r.unlocked_research as string[] || [],
      activeResearch: r.active_research as string | null,
    },
    bank: {
      treasury: {
        metal: r.bank_treasury_metal as number || 0,
        energy: r.bank_treasury_energy as number || 0,
        researchPoints: r.bank_treasury_rp as number || 0,
      },
      taxRates: {
        metal: r.bank_tax_metal as number || 0,
        energy: r.bank_tax_energy as number || 0,
        researchPoints: r.bank_tax_rp as number || 0,
      },
      upgradeLevel: r.bank_upgrade_level as number || 1,
      capacity: r.bank_capacity as number || 0,
      transactions: [],
    },
    activePerks: [],
    territories: [],
    monuments: [],
    wars: {
      active: [],
      history: [],
    },
  };
}

export async function awardClanXP(
  clanId: string,
  source: ClanXPSource,
  amount: number,
  playerId: string
): Promise<{
  success: boolean;
  clan: Clan;
  xpAwarded: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  milestoneRewards?: ClanMilestone;
}> {
  const supabase = createServiceClient();

  const { data: clanRow, error } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();

  if (error || !clanRow) {
    throw new Error('Clan not found');
  }

  const r = clanRow as Record<string, unknown>;
  const settings = (r.clan_settings as Record<string, unknown>) || {};
  const currentClanLevel = r.clan_level as number;
  const currentTotalXP = r.total_xp as number;
  const currentFeatures = (settings.featuresUnlocked as string[]) || [];
  const currentMilestones: MilestoneEntry[] = (settings.milestonesCompleted as MilestoneEntry[]) || [];

  const xpAwarded = calculateXPFromSource(source, amount);
  if (xpAwarded <= 0) {
    const clan = await fetchClanWithMembers(supabase, clanId);
    return {
      success: false,
      clan,
      xpAwarded: 0,
      leveledUp: false,
      previousLevel: currentClanLevel,
      newLevel: currentClanLevel,
    };
  }

  const previousLevel = currentClanLevel;
  const newTotalXP = currentTotalXP + xpAwarded;
  const newLevel = calculateLevelFromXP(newTotalXP);
  const leveledUp = newLevel > previousLevel;
  const xpForCurrentLevel = getXPRequiredForLevel(newLevel);
  const xpForNextLevel = getXPRequiredForLevel(newLevel + 1);
  const currentLevelXP = newTotalXP - xpForCurrentLevel;
  const xpToNextLevel = xpForNextLevel - newTotalXP;

  const updateData: Database['public']['Tables']['clans']['Update'] = {
    clan_level: newLevel,
    total_xp: newTotalXP,
    current_level_xp: currentLevelXP,
    xp_to_next_level: xpToNextLevel,
    last_xp_gain: new Date().toISOString(),
  };

  let milestoneRewards: ClanMilestone | undefined;

  if (leveledUp) {
    milestoneRewards = checkForMilestoneReward(newLevel);
    if (milestoneRewards) {
      updateData.bank_treasury_metal = ((r.bank_treasury_metal as number) || 0) + milestoneRewards.rewards.metal;
      updateData.bank_treasury_energy = ((r.bank_treasury_energy as number) || 0) + milestoneRewards.rewards.energy;
      updateData.bank_treasury_rp = ((r.bank_treasury_rp as number) || 0) + milestoneRewards.rewards.researchPoints;

      let features = [...currentFeatures];
      let milestones: MilestoneEntry[] = [...currentMilestones];

      if (milestoneRewards.unlocksFeature) {
        if (!features.includes(milestoneRewards.unlocksFeature)) {
          features.push(milestoneRewards.unlocksFeature);
        }
      }

      milestones.push({
        level: newLevel,
        completedAt: new Date().toISOString(),
        rewards: milestoneRewards.rewards,
      });

      updateData.last_level_up = new Date().toISOString();

      updateData.clan_settings = {
        ...settings,
        featuresUnlocked: features,
        milestonesCompleted: milestones,
      };
    }
  }

  await supabase
    .from('clans')
    .update(updateData)
    .eq('id', clanId);

  const updatedClan = await fetchClanWithMembers(supabase, clanId);

  await logXPActivity(supabase, clanId, playerId, source, xpAwarded, leveledUp, previousLevel, newLevel);

  return {
    success: true,
    clan: updatedClan,
    xpAwarded,
    leveledUp,
    previousLevel,
    newLevel,
    milestoneRewards,
  };
}

export async function getClanLevelInfo(clanId: string): Promise<{
  currentLevel: number;
  totalXP: number;
  currentLevelXP: number;
  xpToNextLevel: number;
  progressPercentage: number;
  nextMilestone: ClanMilestone | null;
  milestonesCompleted: number;
  featuresUnlocked: string[];
  maxLevel: boolean;
}> {
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('*')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    throw new Error('Clan not found');
  }

  const r = clan as Record<string, unknown>;
  const settings = (r.clan_settings as Record<string, unknown>) || {};
  const currentLevel = r.clan_level as number;
  const totalXP = r.total_xp as number;
  const currentLevelXP = r.current_level_xp as number;
  const xpToNextLevel = r.xp_to_next_level as number;

  const xpRequiredForNextLevel = getXPRequiredForLevel(currentLevel + 1) - getXPRequiredForLevel(currentLevel);
  const progressPercentage = Math.floor((currentLevelXP / xpRequiredForNextLevel) * 100);
  const nextMilestone = findNextMilestone(currentLevel);

  return {
    currentLevel,
    totalXP,
    currentLevelXP,
    xpToNextLevel,
    progressPercentage,
    nextMilestone,
    milestonesCompleted: ((settings.milestonesCompleted as unknown[]) || []).length,
    featuresUnlocked: (settings.featuresUnlocked as string[]) || [],
    maxLevel: currentLevel >= CLAN_LEVEL_CONSTANTS.MAX_LEVEL,
  };
}

export async function getClanMilestones(clanId: string): Promise<{
  completed: Array<{
    level: number;
    completedAt: Date;
    rewards: { metal: number; energy: number; researchPoints: number };
  }>;
  upcoming: ClanMilestone[];
  currentLevel: number;
}> {
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('clan_level, clan_settings')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    throw new Error('Clan not found');
  }

  const r = clan as Record<string, unknown>;
  const settings = (r.clan_settings as Record<string, unknown>) || {};
  const currentLevel = r.clan_level as number;

  const completed = readMilestones(settings);

  const upcoming = CLAN_MILESTONES.filter((m) => m.level > currentLevel);

  return {
    completed,
    upcoming,
    currentLevel,
  };
}

export function getXPRequiredForLevel(level: number): number {
  if (level <= 1) return 0;

  let totalXP = 0;
  for (let i = 2; i <= level; i++) {
    totalXP += Math.floor(
      CLAN_LEVEL_CONSTANTS.BASE_XP_REQUIREMENT * Math.pow(i, CLAN_LEVEL_CONSTANTS.XP_EXPONENT)
    );
  }

  return totalXP;
}

export function calculateLevelFromXP(totalXP: number): number {
  let level = 1;

  while (level < CLAN_LEVEL_CONSTANTS.MAX_LEVEL) {
    const xpForNextLevel = getXPRequiredForLevel(level + 1);
    if (totalXP < xpForNextLevel) {
      break;
    }
    level++;
  }

  return level;
}

export function calculateXPFromSource(source: ClanXPSource, amount: number): number {
  const rate = CLAN_XP_RATES[source] || 0;
  return Math.floor(amount * rate);
}

export function checkForMilestoneReward(level: number): ClanMilestone | undefined {
  return CLAN_MILESTONES.find((m) => m.level === level);
}

export function findNextMilestone(currentLevel: number): ClanMilestone | null {
  const next = CLAN_MILESTONES.find((m) => m.level > currentLevel);
  return next || null;
}

export async function isFeatureUnlocked(clanId: string, featureName: string): Promise<boolean> {
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('clan_settings')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    return false;
  }

  const settings = ((clan as Record<string, unknown>).clan_settings as Record<string, unknown>) || {};
  const features = (settings.featuresUnlocked as string[]) || [];
  return features.includes(featureName);
}

export function getRecommendedXPSources(): Array<{
  source: ClanXPSource;
  xpRate: number;
  description: string;
}> {
  return [
    {
      source: 'monument_control' as ClanXPSource,
      xpRate: CLAN_XP_RATES.monument_control,
      description: 'Control monuments for massive XP (100 XP per monument)',
    },
    {
      source: 'territory_claim' as ClanXPSource,
      xpRate: CLAN_XP_RATES.territory_claim,
      description: 'Claim territories for high XP (50 XP per territory)',
    },
    {
      source: 'building' as ClanXPSource,
      xpRate: CLAN_XP_RATES.building,
      description: 'Construct buildings (20 XP per building)',
    },
    {
      source: 'research' as ClanXPSource,
      xpRate: CLAN_XP_RATES.research,
      description: 'Contribute research points (15 XP per 1000 RP)',
    },
    {
      source: 'combat' as ClanXPSource,
      xpRate: CLAN_XP_RATES.combat,
      description: 'Win battles (10 XP per victory)',
    },
    {
      source: 'harvest' as ClanXPSource,
      xpRate: CLAN_XP_RATES.harvest,
      description: 'Harvest resources (5 XP per 1000 resources)',
    },
  ].sort((a, b) => b.xpRate - a.xpRate);
}

export async function estimateTimeToNextLevel(
  clanId: string,
  daysToAnalyze: number = 7
): Promise<number | null> {
  const supabase = createServiceClient();

  const { data: clan, error } = await supabase
    .from('clans')
    .select('clan_level, xp_to_next_level')
    .eq('id', clanId)
    .single();

  if (error || !clan) {
    return null;
  }

  const r = clan as Record<string, unknown>;
  if ((r.clan_level as number) >= CLAN_LEVEL_CONSTANTS.MAX_LEVEL) {
    return null;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);

  const { data: recentActivities } = await supabase
    .from('clan_activity')
    .select('details')
    .eq('clan_id', clanId)
    .eq('activity_type', 'LEVEL_UP')
    .gte('created_at', cutoffDate.toISOString());

  if (!recentActivities || recentActivities.length === 0) {
    return null;
  }

  const totalXP = recentActivities.reduce((sum, activity) => {
    const details = (activity as Record<string, unknown>).details as Record<string, unknown> | null;
    return sum + ((details?.xp_awarded as number) || 0);
  }, 0);

  const hoursAnalyzed = daysToAnalyze * 24;
  const xpPerHour = totalXP / hoursAnalyzed;

  if (xpPerHour <= 0) {
    return null;
  }

  const xpNeeded = r.xp_to_next_level as number;
  const hoursToNextLevel = Math.ceil(xpNeeded / xpPerHour);

  return hoursToNextLevel;
}

async function logXPActivity(
  supabase: ReturnType<typeof createServiceClient>,
  clanId: string,
  playerId: string,
  source: ClanXPSource,
  xpAwarded: number,
  leveledUp: boolean,
  previousLevel: number,
  newLevel: number
): Promise<void> {
  if (!leveledUp) return;

  await supabase.from('clan_activity').insert({
    clan_id: clanId,
    activity_type: 'LEVEL_UP',
    player_id: playerId,
    created_at: new Date().toISOString(),
    details: {
      source,
      xp_awarded: xpAwarded,
      previous_level: previousLevel,
      new_level: newLevel,
    },
  });
}
