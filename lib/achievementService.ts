/**
 * @file lib/achievementService.ts
 * @created 2026-05-07
 * @overview Achievement system — tiered rewards for player milestones
 *
 * Achievements track progress across categories: harvest, exploration, combat,
 * collection, social, time. Rewards include metal, energy, RP, XP, VIP days,
 * and cosmetics. No permanent stat boosts — only temporary buffs + cosmetics.
 */

import { createServiceClient } from '@/lib/supabase/server';

export type AchievementCategory = 'harvest' | 'exploration' | 'combat' | 'collection' | 'social' | 'time' | 'seasonal';
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AchievementReward {
  metal?: number;
  energy?: number;
  rp?: number;
  xp?: number;
  vipDays?: number;
  cosmeticId?: string;
  buffId?: string;
  buffDuration?: number; // hours
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  requirement: number;
  currentProgress: number;
  completed: boolean;
  claimed: boolean;
  reward: AchievementReward;
}

export const ACHIEVEMENTS: Achievement[] = [
  // Harvest
  { id: 'harvest_1k',    name: 'First Harvest',     description: 'Harvest 1,000 tiles',       category: 'harvest', tier: 'bronze',   requirement: 1000,   currentProgress: 0, completed: false, claimed: false, reward: { metal: 10000, xp: 500 } },
  { id: 'harvest_10k',   name: 'Dedicated Farmer',   description: 'Harvest 10,000 tiles',     category: 'harvest', tier: 'silver',   requirement: 10000,  currentProgress: 0, completed: false, claimed: false, reward: { metal: 50000, rp: 10, xp: 2000 } },
  { id: 'harvest_100k',  name: 'Master Harvester',   description: 'Harvest 100,000 tiles',    category: 'harvest', tier: 'gold',     requirement: 100000, currentProgress: 0, completed: false, claimed: false, reward: { metal: 250000, rp: 50, xp: 10000, vipDays: 1 } },
  { id: 'harvest_1m',    name: 'Legendary Farmer',   description: 'Harvest 1,000,000 tiles',  category: 'harvest', tier: 'platinum', requirement: 1000000, currentProgress: 0, completed: false, claimed: false, reward: { metal: 1000000, rp: 200, xp: 50000, vipDays: 7, cosmeticId: 'harvest-legend' } },
  // Exploration
  { id: 'cave_100',     name: 'Cave Explorer',      description: 'Explore 100 caves',        category: 'exploration', tier: 'bronze',   requirement: 100,   currentProgress: 0, completed: false, claimed: false, reward: { metal: 15000, xp: 1000 } },
  { id: 'cave_500',     name: 'Spelunker',          description: 'Explore 500 caves',        category: 'exploration', tier: 'silver',   requirement: 500,   currentProgress: 0, completed: false, claimed: false, reward: { metal: 75000, rp: 15, xp: 5000 } },
  { id: 'cave_2000',    name: 'Cave Master',        description: 'Explore 2,000 caves',      category: 'exploration', tier: 'gold',     requirement: 2000,  currentProgress: 0, completed: false, claimed: false, reward: { metal: 300000, rp: 75, xp: 25000, vipDays: 3 } },
  // Combat
  { id: 'attack_10',    name: 'First Blood',        description: 'Win 10 attacks',           category: 'combat', tier: 'bronze',   requirement: 10,    currentProgress: 0, completed: false, claimed: false, reward: { metal: 20000, xp: 2000 } },
  { id: 'attack_50',    name: 'Warrior',            description: 'Win 50 attacks',           category: 'combat', tier: 'silver',   requirement: 50,    currentProgress: 0, completed: false, claimed: false, reward: { metal: 100000, rp: 20, xp: 10000 } },
  { id: 'factory_5',    name: 'Factory Capturer',   description: 'Capture 5 factories',      category: 'combat', tier: 'gold',     requirement: 5,     currentProgress: 0, completed: false, claimed: false, reward: { metal: 500000, rp: 100, xp: 50000, vipDays: 5 } },
  // Collection
  { id: 'diggers_10',   name: 'Digger Collector',   description: 'Collect 10 diggers',       category: 'collection', tier: 'bronze',  requirement: 10,    currentProgress: 0, completed: false, claimed: false, reward: { metal: 25000, xp: 1500 } },
  { id: 'diggers_50',   name: 'Digger Hoarder',     description: 'Collect 50 diggers',       category: 'collection', tier: 'silver',  requirement: 50,    currentProgress: 0, completed: false, claimed: false, reward: { metal: 150000, rp: 30, xp: 7500 } },
  { id: 'diggers_200',  name: 'Digger Baron',       description: 'Collect 200 diggers',      category: 'collection', tier: 'gold',    requirement: 200,   currentProgress: 0, completed: false, claimed: false, reward: { metal: 750000, rp: 150, xp: 30000, vipDays: 7 } },
  // Social
  { id: 'referral_1',   name: 'Recruiter',          description: 'Refer 1 player (level 5)',  category: 'social', tier: 'bronze',    requirement: 1,     currentProgress: 0, completed: false, claimed: false, reward: { metal: 10000, rp: 5 } },
  { id: 'referral_5',   name: 'Networker',          description: 'Refer 5 players (level 15)', category: 'social', tier: 'silver',   requirement: 5,     currentProgress: 0, completed: false, claimed: false, reward: { metal: 50000, rp: 25, vipDays: 3 } },
  { id: 'referral_25',  name: 'Growth Hacker',      description: 'Refer 25 players (level 25)', category: 'social', tier: 'gold', requirement: 25, currentProgress: 0, completed: false, claimed: false, reward: { metal: 250000, rp: 100, vipDays: 14, cosmeticId: 'recruiter-gold' } },
  // Time
  { id: 'streak_7',     name: 'Weekly Warrior',     description: 'Play 7 days in a row',      category: 'time', tier: 'bronze',      requirement: 7,     currentProgress: 0, completed: false, claimed: false, reward: { metal: 25000, xp: 3000 } },
  { id: 'streak_30',    name: 'Monthly Master',     description: 'Play 30 days in a row',     category: 'time', tier: 'silver',      requirement: 30,    currentProgress: 0, completed: false, claimed: false, reward: { metal: 150000, rp: 50, xp: 15000, vipDays: 3 } },
  { id: 'streak_100',   name: 'Centurion',          description: 'Play 100 days in a row',    category: 'time', tier: 'gold',        requirement: 100,   currentProgress: 0, completed: false, claimed: false, reward: { metal: 1000000, rp: 200, xp: 100000, vipDays: 30, cosmeticId: 'centurion' } },
];

/**
 * Get achievements by category.
 */
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category);
}

/**
 * Get achievement by ID.
 */
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id);
}

/**
 * Check and update achievement progress for a player.
 * Called after stat-tracking events (battle won, unit built, etc.).
 * Returns newly completed achievements.
 */
export async function checkAchievements(username: string): Promise<Achievement[]> {
  const supabase = createServiceClient();
  const { data: player } = await supabase.from('players').select('*').eq('username', username).single();
  if (!player) return [];

  const newlyCompleted: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    let currentValue = 0;

    // Map achievement IDs to player stat fields
    switch (achievement.id) {
      case 'harvest_1k': case 'harvest_10k': case 'harvest_100k': case 'harvest_1m':
        currentValue = player.stat_total_resources_gathered || 0;
        break;
      case 'cave_100': case 'cave_500': case 'cave_2000':
        currentValue = player.stat_caves_explored || 0;
        break;
      case 'attack_10': case 'attack_50': case 'factory_5':
        currentValue = player.stat_battles_won || 0;
        break;
      case 'diggers_10': case 'diggers_50': case 'diggers_200':
        currentValue = (player.inventory_metal_digger_count || 0) + (player.inventory_energy_digger_count || 0);
        break;
      case 'referral_1': case 'referral_5': case 'referral_25':
        currentValue = player.total_referrals || 0;
        break;
      case 'streak_7': case 'streak_30': case 'streak_100':
        currentValue = player.login_streak || 0;
        break;
      default:
        continue;
    }

    const updated = checkAchievementProgress(achievement, currentValue);
    if (updated.completed && !achievement.completed) {
      newlyCompleted.push(updated);
    }
  }

  return newlyCompleted;
}

/**
 * Check if an achievement should be completed based on progress.
 */
export function checkAchievementProgress(achievement: Achievement, currentValue: number): Achievement {
  const completed = currentValue >= achievement.requirement;
  return { ...achievement, currentProgress: Math.min(currentValue, achievement.requirement), completed };
}
