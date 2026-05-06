/**
 * @file types/referral.types.ts
 * Created: 2025-10-24
 * 
 * OVERVIEW:
 * Type definitions for the player referral and recruitment system.
 * Defines interfaces for referral tracking, rewards, validation, and analytics.
 * 
 * FEATURES:
 * - Unique referral codes per player
 * - 7-day validation period for new signups
 * - Progressive reward scaling
 * - Anti-abuse tracking
 * - Admin management capabilities
 */

type ObjectId = string;

/**
 * Referral reward package given to referrer when referral validates
 */
export interface ReferralReward {
  metal: number;
  energy: number;
  rp: number;
  xp: number;
  vipDays: number;
  specialReward?: string; // e.g., "Recruiter's Squad Unit", "Elite Recruiter Title"
  milestone?: number; // Which milestone this reward is for (5, 10, 25, etc.)
}

/**
 * New player welcome package received on signup with referral code
 */
export interface WelcomePackage {
  metal: number;
  energy: number;
  items: Array<{
    id: string;
    name: string;
    type: string;
    quantity: number;
  }>;
  xpBoostPercent: number;
  xpBoostDuration: number; // In days
  vipTrialDays: number;
  title: string;
}

/**
 * Referral tracking document in referrals collection
 */
export interface ReferralRecord {
  _id?: ObjectId;
  referrerCode: string; // Code used by new player
  referrerUsername: string; // Who gets the reward
  referrerPlayerId: ObjectId; // Referrer's player ID
  newPlayerUsername: string; // New player username
  newPlayerEmail: string; // For duplicate checking
  newPlayerIP: string; // For abuse detection
  signupDate: Date; // When new player registered
  validationDate: Date | null; // When 7-day validation passed
  validated: boolean; // Whether referral is validated
  loginCount: number; // Number of times new player logged in
  lastLogin: Date | null; // Last login timestamp
  daysActive: number; // Days since signup
  rewardsClaimed: boolean; // Whether referrer claimed rewards
  rewardsData: ReferralReward; // What rewards were given
  welcomePackageGiven: boolean; // Whether new player got welcome package
  flaggedForAbuse: boolean; // Admin flagged as suspicious
  flagReason: string | null; // Why it was flagged
  adminNotes: string | null; // Admin comments
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Player referral statistics (embedded in Player document)
 */
export interface PlayerReferralStats {
  referralCode: string; // Unique code (e.g., "DF-A7K9X2M5")
  referralLink: string; // Full URL with code
  referredBy: string | null; // Code of player who referred them
  referredByUsername: string | null; // Username of referrer
  referralValidated: boolean; // Whether this player's referral validated (for new players)
  referralValidatedAt: Date | null; // When validation occurred
  totalReferrals: number; // Count of validated referrals
  pendingReferrals: number; // Count awaiting validation
  totalRewardsEarned: {
    metal: number;
    energy: number;
    rp: number;
    xp: number;
    vipDays: number;
  };
  referralTitles: string[]; // Earned titles
  referralBadges: string[]; // Earned badges
  referralMultiplier: number; // Admin bonus multiplier (default 1.0)
  lastReferralValidated: Date | null; // Last time a referral validated
  milestonesReached: number[]; // Which milestones achieved (e.g., [5, 10, 25])
}

/**
 * Referral leaderboard entry
 */
export interface ReferralLeaderboardEntry {
  rank: number;
  username: string;
  totalReferrals: number;
  pendingReferrals: number;
  level: number;
  titles: string[];
  badges: string[];
  joinedDate: Date;
}

/**
 * Anti-abuse detection result
 */
export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
  flags: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Admin referral analytics
 */
export interface ReferralAnalytics {
  totalReferrals: number;
  validatedReferrals: number;
  pendingReferrals: number;
  flaggedReferrals: number;
  validationRate: number; // Percentage of referrals that validated
  averageDaysToValidation: number;
  topRecruiters: Array<{
    username: string;
    referralCount: number;
    validationRate: number;
  }>;
  recentActivity: ReferralRecord[];
  suspiciousPatterns: Array<{
    type: string;
    description: string;
    affectedUsers: string[];
  }>;
}

/**
 * Global referral configuration (admin-controlled)
 */
export interface ReferralConfig {
  enabled: boolean; // Can disable referral system globally
  globalMultiplier: number; // Event multiplier (e.g., 2x rewards)
  validationDays: number; // How many days for validation (default 7)
  minLoginCount: number; // Minimum logins required (default 4)
  maxReferralsPerIP: number; // Max accounts per IP (default 3)
  blockedEmailDomains: string[]; // Temp email services to block
  welcomePackage: WelcomePackage; // Current welcome package
  baseRewards: ReferralReward; // Base reward per referral
  milestoneRewards: Map<number, ReferralReward>; // Milestone bonuses
  lastUpdated: Date;
  updatedBy: string; // Admin username
}

/**
 * Referral milestone definition
 */
export interface ReferralMilestone {
  count: number; // Number of referrals needed
  name: string; // Milestone name (e.g., "Elite Recruiter")
  rewards: ReferralReward;
  badge?: string; // Badge identifier (e.g., "gold_recruiter")
  title?: string; // Title awarded (e.g., "Legendary Recruiter")
  description: string;
}

/**
 * Referral code validation result
 */
export interface ReferralCodeValidation {
  valid: boolean;
  code?: string;
  referrerUsername?: string;
  error?: string;
}

/**
 * Referral dashboard data (for UI)
 */
export interface ReferralDashboardData {
  playerStats: PlayerReferralStats;
  pendingReferrals: ReferralRecord[];
  validatedReferrals: ReferralRecord[];
  nextMilestone: ReferralMilestone | null;
  progressToNextMilestone: number; // Percentage (0-100)
  recentRewards: Array<{
    date: Date;
    reward: ReferralReward;
    newPlayerUsername: string;
  }>;
  totalValueEarned: {
    metal: number;
    energy: number;
    rp: number;
    xp: number;
    vipDays: number;
  };
}

/**
 * Referral share options
 */
export interface ReferralShareOptions {
  discord: string; // Discord share URL
  x: string; // X (formerly Twitter) share URL
  email: string; // Email mailto link
  copyLink: string; // Direct link for copying
}
