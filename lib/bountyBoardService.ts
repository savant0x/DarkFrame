/**
 * @fileoverview Bounty Board Service - Daily bot defeat challenges with progressive rewards
 * @module lib/bountyBoardService
 * @created 2025-10-18
 * 
 * OVERVIEW:
 * The Bounty Board provides players with daily challenges to defeat specific bot types/tiers.
 * - 3 bounties per day: Easy (25k), Medium (50k), Hard (100k rewards)
 * - Auto-refreshes at midnight UTC
 * - Tracks completion per player
 * - Rewards metal + energy on claim
 * - Integrated with bot reputation system
 * 
 * Features:
 * - Random bounty generation based on bot tiers and specializations
 * - Progressive difficulty: Tier 1-2 (easy), 3-4 (medium), 5-6 (hard)
 * - Completion tracking with defeat count validation
 * - Daily reset mechanism at midnight UTC
 * - Unclaimed reward handling (expires at reset)
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export type BountyDifficulty = 'easy' | 'medium' | 'hard';

export type BountySpecialization = 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost';

export interface Bounty {
  id: string;
  difficulty: BountyDifficulty;
  specialization: BountySpecialization;
  tier: number;
  defeatsRequired: number;
  currentDefeats: number;
  metalReward: number;
  energyReward: number;
  completed: boolean;
  claimed: boolean;
}

export interface PlayerBounties {
  bounties: Bounty[];
  lastRefresh: Date;
  unclaimedRewards: number;
}

const BOUNTY_CONFIG = {
  BOUNTIES_PER_DAY: 3,
  EASY: {
    minTier: 1,
    maxTier: 2,
    defeatsRequired: 3,
    metalReward: 25000,
    energyReward: 15000,
  },
  MEDIUM: {
    minTier: 3,
    maxTier: 4,
    defeatsRequired: 5,
    metalReward: 50000,
    energyReward: 30000,
  },
  HARD: {
    minTier: 5,
    maxTier: 6,
    defeatsRequired: 3,
    metalReward: 100000,
    energyReward: 60000,
  },
} as const;

const SPECIALIZATIONS: BountySpecialization[] = ['Hoarder', 'Fortress', 'Raider', 'Balanced', 'Ghost'];

function generateBounty(difficulty: BountyDifficulty): Bounty {
  const config = BOUNTY_CONFIG[difficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD'];
  const tier = Math.floor(Math.random() * (config.maxTier - config.minTier + 1)) + config.minTier;
  const specialization = SPECIALIZATIONS[Math.floor(Math.random() * SPECIALIZATIONS.length)];
  
  return {
    id: `bounty-${difficulty}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    difficulty,
    specialization,
    tier,
    defeatsRequired: config.defeatsRequired,
    currentDefeats: 0,
    metalReward: config.metalReward,
    energyReward: config.energyReward,
    completed: false,
    claimed: false,
  };
}

function generateDailyBounties(): Bounty[] {
  return [
    generateBounty('easy'),
    generateBounty('medium'),
    generateBounty('hard'),
  ];
}

function needsRefresh(lastRefresh: Date | null): boolean {
  if (!lastRefresh) return true;
  const now = new Date();
  const last = new Date(lastRefresh);
  return now.toISOString().split('T')[0] !== last.toISOString().split('T')[0];
}

async function refreshBountiesIfNeeded(username: string): Promise<PlayerBounties | null> {
  const playerRows = await db.select().from(players).where(eq(players.username, username)).limit(1);
  
  if (playerRows.length === 0) {
    throw new Error('Player not found');
  }
  
  const player = playerRows[0];
  const currentBounties = player.dailyBounties as PlayerBounties | undefined;
  
  if (!needsRefresh(currentBounties?.lastRefresh || null)) {
    return null;
  }
  
  const newBounties: PlayerBounties = {
    bounties: generateDailyBounties(),
    lastRefresh: new Date(),
    unclaimedRewards: 0,
  };
  
  await db.update(players).set({
    dailyBounties: newBounties,
  }).where(eq(players.username, username));
  
  return newBounties;
}

export async function recordBotDefeat(
  username: string,
  botSpecialization: BountySpecialization,
  botTier: number
): Promise<{ updated: boolean; completedBounties: string[] }> {
  await refreshBountiesIfNeeded(username);
  
  const playerRows = await db.select().from(players).where(eq(players.username, username)).limit(1);
  if (playerRows.length === 0 || !playerRows[0].dailyBounties) {
    return { updated: false, completedBounties: [] };
  }
  
  const bounties = playerRows[0].dailyBounties.bounties as Bounty[];
  let updated = false;
  const completedBounties: string[] = [];
  
  for (const bounty of bounties) {
    if (
      !bounty.completed &&
      bounty.specialization === botSpecialization &&
      bounty.tier === botTier
    ) {
      bounty.currentDefeats++;
      updated = true;
      
      if (bounty.currentDefeats >= bounty.defeatsRequired) {
        bounty.completed = true;
        completedBounties.push(bounty.id);
      }
    }
  }
  
  if (updated) {
    const unclaimedRewards = bounties.filter(b => b.completed && !b.claimed).length;
    const updatedBounties: PlayerBounties = {
      bounties,
      lastRefresh: playerRows[0].dailyBounties.lastRefresh,
      unclaimedRewards,
    };
    
    await db.update(players).set({
      dailyBounties: updatedBounties,
    }).where(eq(players.username, username));
  }
  
  return { updated, completedBounties };
}

export async function claimBountyReward(
  username: string,
  bountyId: string
): Promise<{ success: boolean; message: string; metalGained?: number; energyGained?: number }> {
  const playerRows = await db.select().from(players).where(eq(players.username, username)).limit(1);
  if (playerRows.length === 0 || !playerRows[0].dailyBounties) {
    return { success: false, message: 'No bounties found' };
  }
  
  const bounties = playerRows[0].dailyBounties.bounties as Bounty[];
  const bounty = bounties.find(b => b.id === bountyId);
  
  if (!bounty) {
    return { success: false, message: 'Bounty not found' };
  }
  
  if (!bounty.completed) {
    return { success: false, message: 'Bounty not completed yet' };
  }
  
  if (bounty.claimed) {
    return { success: false, message: 'Reward already claimed' };
  }
  
  bounty.claimed = true;
  const unclaimedRewards = bounties.filter(b => b.completed && !b.claimed).length;
  
  const updatedBounties: PlayerBounties = {
    bounties,
    lastRefresh: playerRows[0].dailyBounties.lastRefresh,
    unclaimedRewards,
  };
  
  await db.update(players).set({
    dailyBounties: updatedBounties,
    resourcesMetal: sql`${players.resourcesMetal} + ${bounty.metalReward}`,
    resourcesEnergy: sql`${players.resourcesEnergy} + ${bounty.energyReward}`,
  }).where(eq(players.username, username));
  
  return {
    success: true,
    message: 'Reward claimed successfully!',
    metalGained: bounty.metalReward,
    energyGained: bounty.energyReward,
  };
}

export async function getBounties(username: string): Promise<PlayerBounties> {
  const refreshed = await refreshBountiesIfNeeded(username);
  if (refreshed) {
    return refreshed;
  }
  
  const playerRows = await db.select().from(players).where(eq(players.username, username)).limit(1);
  if (playerRows.length === 0 || !playerRows[0].dailyBounties) {
    const newBounties: PlayerBounties = {
      bounties: generateDailyBounties(),
      lastRefresh: new Date(),
      unclaimedRewards: 0,
    };
    
    await db.update(players).set({
      dailyBounties: newBounties,
    }).where(eq(players.username, username));
    
    return newBounties;
  }
  
  return playerRows[0].dailyBounties as PlayerBounties;
}

export async function getBountyStats(username: string): Promise<{
  totalCompleted: number;
  totalClaimed: number;
  unclaimedRewards: number;
  nextRefresh: Date;
}> {
  const bounties = await getBounties(username);
  
  const totalCompleted = bounties.bounties.filter(b => b.completed).length;
  const totalClaimed = bounties.bounties.filter(b => b.claimed).length;
  
  const nextRefresh = new Date();
  nextRefresh.setUTCHours(24, 0, 0, 0);
  
  return {
    totalCompleted,
    totalClaimed,
    unclaimedRewards: bounties.unclaimedRewards,
    nextRefresh,
  };
}

export function formatTimeUntilRefresh(nextRefresh: Date): string {
  const now = new Date();
  const diff = nextRefresh.getTime() - now.getTime();
  
  if (diff <= 0) return 'Refreshing...';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${hours}h ${minutes}m`;
}
