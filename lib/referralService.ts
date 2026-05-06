/**
 * @file lib/referralService.ts
 * Created: 2025-10-24
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * Core business logic for player referral and recruitment system.
 * Handles code generation, validation, reward calculation, and abuse detection.
 * 
 * FEATURES:
 * - Unique referral code generation
 * - Progressive reward scaling
 * - 7-day validation system
 * - Anti-abuse IP and email checking
 * - Milestone reward packages
 * - Welcome package distribution
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/types/database';
import { pickRandomName } from './itemUtils';
import type {
  ReferralRecord,
  ReferralReward,
  WelcomePackage,
  AbuseCheckResult,
  ReferralMilestone,
  ReferralCodeValidation
} from '@/types/referral.types';
import type { Player } from '@/types/game.types';

type ReferralRow = Tables<'referrals'>;
type PlayerRow = Tables<'players'>;

function getSupabase() {
  return createServiceClient();
}

/**
 * Generate unique referral code for player
 * Format: DF-XXXXXXXX (8 alphanumeric characters)
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'DF-';
  
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return code;
}

/**
 * Generate referral link from code
 */
export function generateReferralLink(code: string): string {
  const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseURL}/register?ref=${code}`;
}

/**
 * Validate referral code exists and is active
 */
export async function validateReferralCode(code: string): Promise<ReferralCodeValidation> {
  const supabase = getSupabase();
  
  const { data: referrer, error } = await supabase
    .from('players')
    .select('username, referral_code, is_bot')
    .eq('referral_code', code)
    .neq('is_bot', true)
    .single();
  
  if (error || !referrer) {
    return {
      valid: false,
      error: 'Invalid referral code'
    };
  }
  
  return {
    valid: true,
    code,
    referrerUsername: referrer.username
  };
}

/**
 * Referral milestone definitions with rewards
 * CONSERVATIVE: Targets ~5M total resources at 100 referrals
 * 
 * Distribution Strategy:
 * - Base rewards (10k × 2.0 cap × 100): ~2.5M resources
 * - Milestone bonuses (8 milestones): ~2.5M resources
 * - Total target: 5M resources at 100 referrals (~2-3 hours farming value)
 * 
 * VIP Strategy: 30-day cap enforced, front-loaded in early milestones
 * RP Strategy: ~12k total (0.45% of WMD tree = meaningful starter progression)
 */
export const REFERRAL_MILESTONES: ReferralMilestone[] = [
  {
    count: 1,
    name: 'First Recruiter',
    title: 'Recruiter',
    rewards: {
      metal: 25000,
      energy: 25000,
      rp: 20,
      xp: 3000,
      vipDays: 2,
      specialReward: 'Recruiter Title'
    },
    description: 'Recruit your first player'
  },
  {
    count: 3,
    name: 'Active Recruiter',
    rewards: {
      metal: 50000,
      energy: 50000,
      rp: 40,
      xp: 6000,
      vipDays: 3,
      specialReward: '5 Elite Infantry Units'
    },
    description: 'Recruit 3 players'
  },
  {
    count: 5,
    name: 'Talent Scout',
    title: 'Talent Scout',
    badge: 'bronze_recruiter',
    rewards: {
      metal: 100000,
      energy: 100000,
      rp: 80,
      xp: 10000,
      vipDays: 5,
      specialReward: 'Bronze Recruiter Badge'
    },
    description: 'Recruit 5 players and earn Bronze badge'
  },
  {
    count: 10,
    name: 'Dedicated Recruiter',
    rewards: {
      metal: 250000,
      energy: 250000,
      rp: 200,
      xp: 25000,
      vipDays: 7,
      specialReward: "Unlock 'Recruiter's Squad' Unit + 5% Permanent Resource Bonus"
    },
    description: 'Recruit 10 players and unlock special unit'
  },
  {
    count: 15,
    name: 'Elite Recruiter',
    title: 'Elite Recruiter',
    badge: 'silver_recruiter',
    rewards: {
      metal: 500000,
      energy: 500000,
      rp: 400,
      xp: 50000,
      vipDays: 5,
      specialReward: 'Silver Recruiter Badge + Legendary Unit Pack (2 units)'
    },
    description: 'Recruit 15 players and earn Silver badge'
  },
  {
    count: 25,
    name: 'Master Recruiter',
    title: 'Ambassador',
    rewards: {
      metal: 750000,
      energy: 750000,
      rp: 800,
      xp: 100000,
      vipDays: 2,
      specialReward: "Unlock 'Ambassador' Prestige Unit + 10% Permanent XP Bonus"
    },
    description: 'Recruit 25 players and unlock prestige unit'
  },
  {
    count: 50,
    name: 'Legendary Recruiter',
    title: 'Legendary Recruiter',
    badge: 'gold_recruiter',
    rewards: {
      metal: 625000,
      energy: 625000,
      rp: 1500,
      xp: 200000,
      vipDays: 0,
      specialReward: 'Gold Badge + Permanent 10% Resource Boost + Advanced Research Pack'
    },
    description: 'Recruit 50 players and earn legendary status'
  },
  {
    count: 100,
    name: 'Empire Builder',
    title: 'Empire Builder',
    badge: 'diamond_recruiter',
    rewards: {
      metal: 150000,
      energy: 150000,
      rp: 3000,
      xp: 500000,
      vipDays: 0,
      specialReward: "Unlock 'Empire Builder' Ultimate Unit + Diamond Badge + Permanent 25% All Bonuses + Custom Profile Frame"
    },
    description: 'Recruit 100 players - the ultimate achievement'
  }
];

/**
 * Calculate progressive rewards for a specific referral number
 * Rewards scale: base + (count * multiplier * progressiveFactor)
 * 
 * CONSERVATIVE: Targets ~5M total resources at 100 referrals
 * Base: 10k metal/energy per referral
 * Progressive multiplier: 1.05x per referral, CAPPED at 2.0x (reached ~referral #15)
 * VIP: CAPPED at 30 days total (enforced via currentVIPDays parameter)
 * RP: 15 per referral for meaningful WMD progression (~12k total at 100)
 */
export function calculateReferralReward(
  referralCount: number,
  globalMultiplier: number = 1.0,
  currentVIPDays: number = 0
): ReferralReward {
  const VIP_CAP = 30;
  const PROGRESSIVE_CAP = 2.0;
  
  const baseReward = {
    metal: 10000,
    energy: 10000,
    rp: 15,
    xp: 2000,
    vipDays: 1
  };
  
  const progressiveFactor = Math.min(
    Math.pow(1.05, referralCount - 1),
    PROGRESSIVE_CAP
  );
  
  const reward: ReferralReward = {
    metal: Math.floor(baseReward.metal * progressiveFactor * globalMultiplier),
    energy: Math.floor(baseReward.energy * progressiveFactor * globalMultiplier),
    rp: Math.floor(baseReward.rp * progressiveFactor * globalMultiplier),
    xp: Math.floor(baseReward.xp * progressiveFactor * globalMultiplier),
    vipDays: Math.floor(baseReward.vipDays * globalMultiplier)
  };
  
  const milestone = REFERRAL_MILESTONES.find(m => m.count === referralCount);
  if (milestone) {
    reward.metal += milestone.rewards.metal;
    reward.energy += milestone.rewards.energy;
    reward.rp += milestone.rewards.rp;
    reward.xp += milestone.rewards.xp;
    reward.vipDays += milestone.rewards.vipDays;
    reward.specialReward = milestone.rewards.specialReward;
    reward.milestone = milestone.count;
  }
  
  if (currentVIPDays >= VIP_CAP) {
    reward.vipDays = 0;
  } else if (currentVIPDays + reward.vipDays > VIP_CAP) {
    reward.vipDays = VIP_CAP - currentVIPDays;
  }
  
  return reward;
}

/**
 * Get welcome package for new players (with referral code)
 * Generous starter package to encourage new player retention
 * Awarded upon tutorial completion
 */
export function getWelcomePackage(): WelcomePackage {
  return {
    metal: 50000,
    energy: 50000,
    items: [
      {
        id: 'digger_legendary',
        name: pickRandomName('UNIVERSAL_DIGGER', 'Legendary'),
        type: 'digger',
        quantity: 1
      }
    ],
    xpBoostPercent: 25,
    xpBoostDuration: 7,
    vipTrialDays: 3,
    title: 'Recruit'
  };
}

/**
 * Get starter package for new players (without referral code)
 * Half the value of the full welcome package
 * Awarded upon tutorial completion
 */
export function getStarterPackage(): WelcomePackage {
  return {
    metal: 25000,
    energy: 25000,
    items: [
      {
        id: 'digger_rare',
        name: pickRandomName('UNIVERSAL_DIGGER', 'Rare'),
        type: 'digger',
        quantity: 1
      }
    ],
    xpBoostPercent: 15,
    xpBoostDuration: 3,
    vipTrialDays: 1,
    title: 'Recruit'
  };
}

/**
 * Check for referral abuse patterns
 * - Same IP creating multiple accounts
 * - Suspicious email domains (temp email services)
 * - Rapid signups from same referral code
 */
export async function checkForAbuse(
  email: string,
  ip: string,
  referralCode: string
): Promise<AbuseCheckResult> {
  const supabase = getSupabase();
  const flags: string[] = [];
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  
  const { count: sameIPReferrals, error: ipErr } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_code', referralCode)
    .eq('new_player_ip', ip);

  const ipCount = sameIPReferrals || 0;
  
  if (ipCount >= 3) {
    flags.push(`IP ${ip} has already created ${ipCount} accounts with this referral code`);
    riskLevel = 'high';
    return {
      allowed: false,
      reason: 'Maximum referrals per IP exceeded (3 limit)',
      flags,
      riskLevel
    };
  }
  
  if (ipCount >= 2) {
    flags.push(`IP ${ip} has created ${ipCount} accounts with this code`);
    riskLevel = 'medium';
  }
  
  const tempEmailDomains = [
    'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'throwaway.email',
    'mailinator.com', 'temp-mail.org', 'getnada.com', 'maildrop.cc'
  ];
  
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (emailDomain && tempEmailDomains.includes(emailDomain)) {
    flags.push(`Temporary email domain detected: ${emailDomain}`);
    riskLevel = 'medium';
  }
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recentSignups, error: recentErr } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_code', referralCode)
    .gte('signup_date', oneHourAgo);

  const recentCount = recentSignups || 0;
  
  if (recentCount >= 5) {
    flags.push(`${recentCount} signups in last hour from this referral code`);
    riskLevel = 'high';
  }
  
  return {
    allowed: true,
    flags,
    riskLevel
  };
}

/**
 * Create referral record when new player signs up with code
 */
export async function createReferralRecord(
  referrerCode: string,
  newPlayer: { username: string; email: string },
  ip: string
): Promise<string> {
  const supabase = getSupabase();
  
  const { data: referrer, error: referrerErr } = await supabase
    .from('players')
    .select('*')
    .eq('referral_code', referrerCode)
    .single();

  if (referrerErr || !referrer) {
    throw new Error('Referrer not found');
  }
  
  const currentVIPDays = referrer.referral_rewards_vip_days || 0;
  
  const futureRewards = calculateReferralReward(
    (referrer.total_referrals || 0) + (referrer.pending_referrals || 0) + 1,
    1.0,
    currentVIPDays
  );
  
  const now = new Date().toISOString();
  const insertRow: TablesInsert<'referrals'> = {
    referrer_code: referrerCode,
    referrer_username: referrer.username,
    new_player_username: newPlayer.username,
    new_player_email: newPlayer.email,
    new_player_ip: ip,
    signup_date: now,
    validation_date: null,
    validated: false,
    login_count: 1,
    last_login: now,
    days_active: 0,
    rewards_claimed: false,
    reward_metal: futureRewards.metal,
    reward_energy: futureRewards.energy,
    reward_rp: futureRewards.rp,
    reward_xp: futureRewards.xp,
    reward_vip_days: futureRewards.vipDays,
    welcome_package_given: false,
    flagged_for_abuse: false,
    flag_reason: null,
    admin_notes: null,
  };
  
  const { data: insertedRow, error: insertErr } = await supabase
    .from('referrals')
    .insert(insertRow)
    .select('id')
    .single();

  if (insertErr || !insertedRow) {
    throw new Error('Failed to create referral record');
  }
  
  const currentPending = referrer.pending_referrals || 0;
  await supabase
    .from('players')
    .update({ pending_referrals: currentPending + 1 })
    .eq('username', referrer.username);
  
  return insertedRow.id;
}

/**
 * Check if referred player meets 7-day validation criteria
 * - Must be at least 7 days since signup
 * - Must have logged in at least 4 times
 */
export async function checkReferralValidation(referralId: string): Promise<boolean> {
  const supabase = getSupabase();
  
  const { data: record, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .single();

  if (error || !record || record.validated) {
    return false;
  }
  
  const daysSinceSignup = (Date.now() - new Date(record.signup_date).getTime()) / (1000 * 60 * 60 * 24);
  
  return daysSinceSignup >= 7 && record.login_count >= 4;
}

/**
 * Validate a referral and distribute rewards to referrer
 */
export async function validateReferral(referralId: string): Promise<boolean> {
  const supabase = getSupabase();
  
  const { data: record, error: fetchErr } = await supabase
    .from('referrals')
    .select('*')
    .eq('id', referralId)
    .single();

  if (fetchErr || !record || record.validated) {
    return false;
  }
  
  const now = new Date().toISOString();
  
  await supabase
    .from('referrals')
    .update({
      validated: true,
      validation_date: now,
      updated_at: now,
    })
    .eq('id', referralId);
  
  await supabase
    .from('players')
    .update({
      referral_validated: true,
      referral_validated_at: now,
    })
    .eq('username', record.new_player_username);
  
  const { data: referrer, error: refErr } = await supabase
    .from('players')
    .select('*')
    .eq('username', record.referrer_username)
    .single();

  if (refErr || !referrer) {
    return false;
  }
  
  const newTotalReferrals = (referrer.total_referrals || 0) + 1;
  const newPendingReferrals = Math.max(0, (referrer.pending_referrals || 1) - 1);
  
  const newMetal = (referrer.resources_metal || 0) + (record.reward_metal || 0);
  const newEnergy = (referrer.resources_energy || 0) + (record.reward_energy || 0);
  const newRp = (referrer.research_points || 0) + (record.reward_rp || 0);
  const newXp = (referrer.xp || 0) + (record.reward_xp || 0);
  const newRewardsMetal = (referrer.referral_rewards_metal || 0) + (record.reward_metal || 0);
  const newRewardsEnergy = (referrer.referral_rewards_energy || 0) + (record.reward_energy || 0);
  const newRewardsRp = (referrer.referral_rewards_rp || 0) + (record.reward_rp || 0);
  const newRewardsXp = (referrer.referral_rewards_xp || 0) + (record.reward_xp || 0);
  const newRewardsVip = (referrer.referral_rewards_vip_days || 0) + (record.reward_vip_days || 0);
  
  const milestone = REFERRAL_MILESTONES.find(m => m.count === newTotalReferrals);

  const currentMilestones = referrer.referral_milestones_reached || [];
  const newMilestones = milestone ? [...currentMilestones, newTotalReferrals] : currentMilestones;
  
  let vipExpiration: string | null = referrer.vip_expiration;
  if ((record.reward_vip_days || 0) > 0) {
    const currentExpiration = referrer.vip_expiration 
      ? new Date(referrer.vip_expiration).getTime() 
      : Date.now();
    const newExpiration = new Date(
      Math.max(currentExpiration, Date.now()) + 
      ((record.reward_vip_days || 0) * 24 * 60 * 60 * 1000)
    );
    vipExpiration = newExpiration.toISOString();
  }

  await supabase
    .from('players')
    .update({
      total_referrals: newTotalReferrals,
      pending_referrals: newPendingReferrals,
      resources_metal: newMetal,
      resources_energy: newEnergy,
      research_points: newRp,
      xp: newXp,
      referral_rewards_metal: newRewardsMetal,
      referral_rewards_energy: newRewardsEnergy,
      referral_rewards_rp: newRewardsRp,
      referral_rewards_xp: newRewardsXp,
      referral_rewards_vip_days: newRewardsVip,
      referral_milestones_reached: newMilestones,
      is_vip: vipExpiration ? true : referrer.is_vip,
      vip_expiration: vipExpiration,
      vip_last_updated: now,
    })
    .eq('username', record.referrer_username);
  
  await supabase
    .from('referrals')
    .update({
      rewards_claimed: true,
      updated_at: now,
    })
    .eq('id', referralId);
  
  return true;
}

/**
 * Get next milestone for player
 */
export function getNextMilestone(currentReferrals: number): ReferralMilestone | null {
  return REFERRAL_MILESTONES.find(m => m.count > currentReferrals) || null;
}

/**
 * Calculate progress to next milestone (0-100)
 */
export function calculateMilestoneProgress(currentReferrals: number): number {
  const nextMilestone = getNextMilestone(currentReferrals);
  if (!nextMilestone) {
    return 100;
  }
  
  const previousMilestoneCount = REFERRAL_MILESTONES
    .filter(m => m.count < nextMilestone.count)
    .reduce((max, m) => Math.max(max, m.count), 0);
  
  const progress = ((currentReferrals - previousMilestoneCount) / (nextMilestone.count - previousMilestoneCount)) * 100;
  return Math.min(100, Math.max(0, progress));
}
