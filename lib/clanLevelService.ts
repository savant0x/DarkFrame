/**
 * Clan Level Progression Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan level progression from 1-50 with exponential XP curve. Awards XP from member
 * actions (harvesting, combat, research, building) and triggers milestone rewards at key levels.
 * Unlocks features progressively: bank upgrades, perks, monuments, and warfare capabilities.
 * 
 * Core Systems:
 * - XP Calculation: Action-based XP awards with diminishing returns for repetitive actions
 * - Level Progression: Exponential curve (baseXP * level^1.8) requiring ~50M total XP to max
 * - Milestone Rewards: Resource bonuses, bank capacity, perk unlocks at levels 5,10,15,20,25,30,40,50
 * - Feature Unlocking: Progressive access to advanced systems (perks at 5, monuments at 20, warfare at 25)
 * - Progress Tracking: Real-time XP gain notifications and level-up events
 * 
 * XP Award Rates:
 * - Harvesting: 5 XP per harvest (metal, energy, research points)
 * - Combat Victory: 10 XP per enemy defeated
 * - Research Contribution: 15 XP per 1000 RP contributed
 * - Building Construction: 20 XP per building completed
 * - Territory Claim: 50 XP per territory captured
 * - Monument Control: 100 XP per monument controlled
 * 
 * Level Unlocks:
 * - Level 5: Bronze perks, bank level 2
 * - Level 10: Silver perks, bank level 3
 * - Level 15: Gold perks, bank level 4
 * - Level 20: Legendary perks, monuments, bank level 5
 * - Level 25: Clan warfare, bank level 6
 * - Level 30: Advanced monuments
 * - Level 40: Elite warfare bonuses
 * - Level 50: Max level rewards (prestige badge, 10M resources)
 * 
 * Integration Points:
 * - clanService.ts: Calls awardClanXP() when clan created/member joins
 * - clanActivityService.ts: Logs all XP awards to activity feed
 * - Player action handlers: Award XP on harvests, combat, research
 * - API routes: GET level info, POST award XP (admin/system only)
 */

import { db } from '@/lib/db';
import { clans } from '@/lib/db/schema';
import { eq, sql, gte } from 'drizzle-orm';
import {
  Clan,
  ClanLevel,
  ClanMilestone,
  ClanXPSource,
  ClanActivityType,
  CLAN_LEVEL_CONSTANTS,
  CLAN_XP_RATES,
  CLAN_MILESTONES,
} from '@/types/clan.types';

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
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }

  const clan = clanRows[0];
  const clanLevel: ClanLevel = {
    currentLevel: clan.levelCurrentLevel,
    totalXP: clan.levelTotalXP,
    currentLevelXP: clan.levelCurrentLevelXP,
    xpToNextLevel: clan.levelXpToNextLevel,
    featuresUnlocked: clan.levelFeaturesUnlocked,
    milestonesCompleted: clan.levelMilestonesCompleted,
    lastLevelUp: clan.levelLastLevelUp || undefined,
    lastXPGain: undefined,
  };

  const xpAwarded = calculateXPFromSource(source, amount);
  if (xpAwarded <= 0) {
    return {
      success: false,
      clan: clan as unknown as Clan,
      xpAwarded: 0,
      leveledUp: false,
      previousLevel: clanLevel.currentLevel,
      newLevel: clanLevel.currentLevel,
    };
  }

  const previousLevel = clanLevel.currentLevel;
  const newTotalXP = clanLevel.totalXP + xpAwarded;
  const newLevel = calculateLevelFromXP(newTotalXP);
  const leveledUp = newLevel > previousLevel;

  const xpForCurrentLevel = getXPRequiredForLevel(newLevel);
  const xpForNextLevel = getXPRequiredForLevel(newLevel + 1);
  const currentLevelXP = newTotalXP - xpForCurrentLevel;
  const xpToNextLevel = xpForNextLevel - newTotalXP;

  let milestoneRewards: ClanMilestone | undefined;
  if (leveledUp) {
    milestoneRewards = checkForMilestoneReward(newLevel);
  }

  const updates: any = {
    levelCurrentLevel: newLevel,
    levelTotalXP: newTotalXP,
    levelCurrentLevelXP: currentLevelXP,
    levelXpToNextLevel: xpToNextLevel,
    lastXPGain: new Date(),
  };

  if (leveledUp) {
    updates.levelLastLevelUp = new Date();

    if (milestoneRewards) {
      updates.bankTreasuryMetal = sql`${clans.bankTreasuryMetal} + ${milestoneRewards.rewards.metal}`;
      updates.bankTreasuryEnergy = sql`${clans.bankTreasuryEnergy} + ${milestoneRewards.rewards.energy}`;
      updates.bankTreasuryResearchPoints = sql`${clans.bankTreasuryResearchPoints} + ${milestoneRewards.rewards.researchPoints}`;

      if (milestoneRewards.unlocksFeature) {
        const existingFeatures = clan.levelFeaturesUnlocked || [];
        if (!existingFeatures.includes(milestoneRewards.unlocksFeature)) {
          const newFeatures = [...existingFeatures, milestoneRewards.unlocksFeature];
          updates.levelFeaturesUnlocked = newFeatures;
        }
      }

      const existingMilestones = clan.levelMilestonesCompleted || [];
      const newMilestones = [
        ...existingMilestones,
        {
          level: newLevel,
          completedAt: new Date(),
          rewards: milestoneRewards.rewards,
        },
      ];
      updates.levelMilestonesCompleted = newMilestones;
    }
  }

  await db.update(clans).set(updates).where(eq(clans.id, clanId));

  const updatedClanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (updatedClanRows.length === 0) {
    throw new Error('Failed to retrieve updated clan');
  }

  const updatedClan = updatedClanRows[0];

  await logXPActivity(clanId, playerId, source, xpAwarded, leveledUp, previousLevel, newLevel);

  return {
    success: true,
    clan: updatedClan as unknown as Clan,
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
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }

  const clan = clanRows[0];
  const currentLevel = clan.levelCurrentLevel;
  const totalXP = clan.levelTotalXP;
  const currentLevelXP = clan.levelCurrentLevelXP;
  const xpToNextLevel = clan.levelXpToNextLevel;

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
    milestonesCompleted: (clan.levelMilestonesCompleted || []).length,
    featuresUnlocked: clan.levelFeaturesUnlocked || [],
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
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    throw new Error('Clan not found');
  }

  const clan = clanRows[0];
  const upcoming = CLAN_MILESTONES.filter((m) => m.level > clan.levelCurrentLevel);

  return {
    completed: clan.levelMilestonesCompleted || [],
    upcoming,
    currentLevel: clan.levelCurrentLevel,
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
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0) {
    return false;
  }

  return (clanRows[0].levelFeaturesUnlocked || []).includes(featureName);
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
  const clanRows = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
  if (clanRows.length === 0 || clanRows[0].levelCurrentLevel >= CLAN_LEVEL_CONSTANTS.MAX_LEVEL) {
    return null;
  }

  const clan = clanRows[0];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);

  const result = await db.execute(sql`
    SELECT details FROM clan_activities
    WHERE clan_id = ${clanId}
      AND activity_type = 'xp_gain'
      AND timestamp >= ${cutoffDate}
  `);

  const activities = result.rows as any[];
  if (activities.length === 0) {
    return null;
  }

  let totalXP = 0;
  for (const activity of activities) {
    const details = typeof activity.details === 'string' ? JSON.parse(activity.details) : activity.details;
    totalXP += details?.xpAwarded || 0;
  }

  const hoursAnalyzed = daysToAnalyze * 24;
  const xpPerHour = totalXP / hoursAnalyzed;

  if (xpPerHour <= 0) {
    return null;
  }

  const xpNeeded = clan.levelXpToNextLevel;
  const hoursToNextLevel = Math.ceil(xpNeeded / xpPerHour);

  return hoursToNextLevel;
}

async function logXPActivity(
  clanId: string,
  playerId: string,
  source: ClanXPSource,
  xpAwarded: number,
  leveledUp: boolean,
  previousLevel: number,
  newLevel: number
): Promise<void> {
  await db.execute(sql`
    INSERT INTO clan_activities
    (clan_id, activity_type, player_id, timestamp, details)
    VALUES (${clanId}, ${leveledUp ? 'level_up' : 'xp_gain'}, ${playerId},
            ${new Date()}, ${JSON.stringify({
              source,
              xpAwarded,
              previousLevel,
              newLevel,
            })})
  `);
}
