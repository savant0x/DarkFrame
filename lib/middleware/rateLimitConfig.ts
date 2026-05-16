/**
 * @file lib/middleware/rateLimitConfig.ts
 * @created 2025-10-24 (FID-20251024-PROD: Production Readiness)
 * @overview Comprehensive rate limiting configuration for all API endpoints
 * 
 * OVERVIEW:
 * Defines rate limiting strategies for different endpoint categories.
 * Prevents abuse, spam, and denial-of-service attacks while maintaining
 * good user experience for legitimate players.
 * 
 * STRATEGIES:
 * - Tiered limits based on action cost/impact
 * - Per-IP and per-user tracking
 * - Separate limits for different endpoint categories
 * - Automatic cleanup of old records
 * 
 * USAGE:
 * import { ENDPOINT_RATE_LIMITS } from '@/lib/middleware/rateLimitConfig';
 * import { withRateLimit } from '@/lib';
 * 
 * export const POST = withRateLimit(ENDPOINT_RATE_LIMITS.battle)(async (req) => {
 *   // Battle attack handler
 * });
 */

import type { RateLimitConfig } from './rateLimiter';

/**
 * Rate limit configurations for different endpoint categories
 * 
 * PHILOSOPHY:
 * - Critical actions (auth, payments) → Very strict (10-30/min)
 * - High-impact actions (battle, clan) → Strict (60-120/min)
 * - Standard actions (movement, harvest) → Moderate (120-300/min)
 * - Read-only actions (stats, leaderboard) → Relaxed (500-1000/min)
 * 
 * Limits are per-IP unless trackByUser is true.
 */
export const ENDPOINT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // ==========================================================================
  // AUTHENTICATION & ACCOUNT MANAGEMENT (VERY STRICT)
  // ==========================================================================
  
  /**
   * Login attempts
   * 10 attempts per minute to prevent brute force attacks
   */
  login: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    message: 'Too many login attempts detected. Please wait a moment before trying again, or use the "Forgot Password" link if you need to reset your credentials.',
    skipIPs: ['127.0.0.1', '::1'] // Allow localhost for development
  },
  
  /**
   * Registration attempts
   * 5 registrations per hour per IP to prevent spam accounts
   */
  register: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    message: 'Registration rate limit exceeded. Please wait before creating another account. If you already have an account, try logging in instead.',
    skipIPs: ['127.0.0.1', '::1']
  },
  
  /**
   * Password reset requests
   * 3 requests per hour to prevent email flooding
   */
  passwordReset: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    message: 'Password reset limit reached. Please check your email for the reset link that was already sent. If you didn\'t receive it, please wait before requesting another.',
  },

  /**
   * Auth endpoints (logout, session, etc.)
   * 30 requests per minute
   */
  AUTH: {
    maxRequests: 30,
    windowMs: 60 * 1000,
    message: 'Too many auth operations. Please wait a moment.',
  },
  
  // ==========================================================================
  // PAYMENTS (VERY STRICT)
  // ==========================================================================
  
  /**
   * Payment checkout creation
   * 10 checkout attempts per hour per user
   */
  paymentCheckout: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'Payment rate limit exceeded. Please complete your current checkout session or wait before starting a new one. Contact support if you need assistance.',
  },
  
  /**
   * Payment webhook processing
   * 100 webhooks per minute (Stripe may retry)
   */
  paymentWebhook: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    message: 'Webhook processing rate limit exceeded. This is a system limit - please contact support if you see this error.',
  },
  
  // ==========================================================================
  // BATTLE SYSTEM (STRICT)
  // ==========================================================================
  
  /**
   * Battle attacks
   * 60 attacks per minute (one per second sustained)
   * Prevents attack spam while allowing active gameplay
   */
  battle: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Battle rate limit exceeded. Please pace your attacks to avoid server overload. You\'re attacking too rapidly - slow down for better performance.',
  },
  
  /**
   * Battle log viewing
   * 300 requests per minute (viewing own battles)
   */
  battleLog: {
    maxRequests: 300,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Battle log rate limit exceeded. Please slow down your log queries to reduce server load.',
  },
  
  // ==========================================================================
  // FLAG SYSTEM (STRICT)
  // ==========================================================================
  
  /**
   * Flag Bearer attacks
   * 60 attacks per minute (same as battle attacks)
   * Prevents attack spam on flag bearer
   */
  FLAG_ATTACK: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Flag attack limit reached. Please wait before attacking the Flag Bearer again. You\'re attacking too rapidly - pace yourself for better performance.',
  },
  
  /**
   * Flag data retrieval
   * 300 requests per minute (read-only operation)
   * Allows frequent polling for flag position updates
   */
  FLAG_DATA: {
    maxRequests: 300,
    windowMs: 60 * 1000,
    message: 'Flag data retrieval limit reached. Please slow down your requests to reduce server load.',
  },
  
  /**
   * Flag system initialization
   * 10 requests per minute (admin-level action)
   * Rarely needed in production
   */
  FLAG_INIT: {
    maxRequests: 10,
    windowMs: 60 * 1000,
    message: 'Flag initialization limit reached. This is an admin action - please wait before retrying.',
  },
  
  // ==========================================================================
  // MOVEMENT & HARVESTING (MODERATE)
  // ==========================================================================
  
  /**
   * Movement actions
   * 120 movements per minute (2 per second)
   * Allows active exploration without abuse
   */
  movement: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Movement speed limit reached. Please slow down your movement to maintain stable gameplay and reduce server load.',
  },
  
  /**
   * Resource harvesting
   * 120 harvests per minute
   * Matches movement rate for active gathering
   */
  harvest: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Harvesting too rapidly. Please slow down your resource gathering to maintain game balance and server performance.',
  },

  /**
   * Fast travel
   * 20 per minute — prevent abuse but allow quick navigation
   */
  FAST_TRAVEL: {
    maxRequests: 20,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Fast travel limit reached. Please wait before traveling again.',
  },
  
  // ==========================================================================
  // UNIT BUILDING (MODERATE)
  // ==========================================================================
  
  /**
   * Unit building (player)
   * 60 build requests per minute
   */
  buildUnit: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Unit building limit reached. Please slow down your unit recruitment to prevent server overload.',
  },
  
  /**
   * Factory unit building
   * 60 factory build requests per minute
   */
  factoryBuild: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Factory building limit reached. Please slow down your production commands to maintain server stability.',
  },
  
  // ==========================================================================
  // BANKING & RESOURCES (MODERATE)
  // ==========================================================================
  
  /**
   * Bank deposits
   * 120 deposits per minute
   */
  bankDeposit: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Bank deposit limit reached. Please slow down your banking transactions for security and server stability.',
  },
  
  /**
   * Bank withdrawals
   * 120 withdrawals per minute
   */
  bankWithdraw: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Bank withdrawal limit reached. Please slow down your banking transactions for security and server stability.',
  },
  
  /**
   * Resource exchanges
   * 60 exchanges per minute
   */
  resourceExchange: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Resource exchange limit reached. Please slow down your trading activity to prevent market manipulation.',
  },
  
  // ==========================================================================
  // CLAN SYSTEM (STRICT)
  // ==========================================================================
  
  /**
   * Clan creation
   * 3 clan creations per day per IP
   * Prevents spam clan creation
   */
  clanCreate: {
    maxRequests: 3,
    windowMs: 24 * 60 * 60 * 1000,
    message: 'Clan creation limit reached. Please wait before creating another clan. This prevents spam and encourages thoughtful clan creation.',
  },
  
  /**
   * Clan join/leave
   * 30 clan actions per hour
   * Prevents rapid join/leave spam
   */
  clanAction: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'Clan action limit reached. Please wait before joining or leaving clans. Excessive clan hopping is not permitted.',
  },
  
  /**
   * Clan chat messages
   * 120 messages per minute
   */
  clanChat: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Clan chat limit reached. Please slow down your messaging to prevent spam and maintain chat quality.',
  },
  
  // ==========================================================================
  // AUCTION SYSTEM (MODERATE)
  // ==========================================================================
  
  /**
   * Auction creation
   * 30 auction creations per hour
   */
  auctionCreate: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'Auction creation limit reached. Please wait before creating more listings. Consider listing multiple items in fewer auctions.',
  },
  
  /**
   * Auction bidding
   * 120 bids per minute
   */
  auctionBid: {
    maxRequests: 120,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Auction bidding limit reached. Please slow down your bidding activity to maintain fair auction dynamics.',
  },
  
  /**
   * Auction listing viewing
   * 300 requests per minute
   */
  auctionList: {
    maxRequests: 300,
    windowMs: 60 * 1000,
    message: 'Auction listing limit reached. Please slow down your browsing to reduce server load.',
  },
  
  // ==========================================================================
  // SHRINE SYSTEM (MODERATE)
  // ==========================================================================
  
  /**
   * Shrine sacrifices and boost activations
   * 60 shrine actions per minute
   * Prevents spam while allowing active shrine usage
   */
  SHRINE_SACRIFICE: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Shrine action limit reached. Please slow down your shrine interactions to maintain game balance and server performance.',
  },
  
  // ==========================================================================
  // ADMIN ACTIONS (VERY STRICT)
  // ==========================================================================
  
  /**
   * Admin configuration changes
   * 20 changes per hour
   */
  adminConfig: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'Admin action limit reached. Please slow down configuration changes to prevent accidental system disruption.',
  },
  
  /**
   * Admin bot management
   * 30 actions per hour
   */
  adminBot: {
    maxRequests: 30,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'Bot management limit reached. Please slow down bot management actions to maintain system stability.',
  },
  
  /**
   * Admin VIP grants/revokes
   * 100 per hour
   */
  adminVIP: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'VIP management limit reached. Please slow down VIP status changes.',
  },

  /**
   * Admin VIP grants (separate from revokes for finer control)
   * 100 per hour
   */
  adminVIPGrant: {
    maxRequests: 100,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'VIP grant limit reached. Please slow down.',
  },

  /**
   * Admin system reset — very strict
   * 5 per hour
   */
  ADMIN_OPERATIONS: {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'System operations limit reached. Please wait before performing more admin actions.',
  },

  /**
   * Bank operations (deposit/withdraw)
   * 60 per minute
   */
  BANK: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Bank operation limit reached. Please wait before performing another transaction.',
  },

  /**
   * Tier unlock operations
   * 20 per hour
   */
  TIER_UNLOCK: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
    trackByUser: true,
    message: 'Tier unlock limit reached. Please wait before unlocking more tiers.',
  },

  /**
   * General admin analytics/viewing
   * 500 requests per minute
   * Used for admin dashboard data viewing (stats, logs, analytics)
   */
  admin: {
    maxRequests: 500,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Admin dashboard limit reached. Please slow down your data requests to reduce server load.',
  },
  
  // ==========================================================================
  // READ-ONLY ENDPOINTS (RELAXED)
  // ==========================================================================
  
  /**
   * Player stats viewing
   * 500 requests per minute
   */
  playerStats: {
    maxRequests: 500,
    windowMs: 60 * 1000,
    message: 'Stats viewing limit reached. Please slow down your requests to reduce server load.',
  },
  
  /**
   * Leaderboard viewing
   * 300 requests per minute
   */
  leaderboard: {
    maxRequests: 300,
    windowMs: 60 * 1000,
    message: 'Leaderboard viewing limit reached. Please slow down your requests to reduce server load.',
  },
  
  /**
   * Inventory viewing
   * 500 requests per minute
   */
  inventory: {
    maxRequests: 500,
    windowMs: 60 * 1000,
    trackByUser: true,
    message: 'Inventory viewing limit reached. Please slow down your requests to reduce server load.',
  },
  
  /**
   * Map data fetching
   * 300 requests per minute
   */
  mapData: {
    maxRequests: 300,
    windowMs: 60 * 1000,
    message: 'Map data limit reached. Please slow down your requests to reduce server load.',
  },
  
  // ==========================================================================
  // STANDARD/SESSION ENDPOINTS (MODERATE)
  // ==========================================================================
  
  /**
   * Session validation and general API endpoints
   * 300 requests per minute
   * Used for session checks, general API calls
   */
  STANDARD: {
    maxRequests: 300,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please slow down your requests.',
  },

  /**
   * Strict rate limit for sensitive write operations
   * 60 requests per minute
   * Used for friend requests, permissions, session verification
   */
  STRICT: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please wait before sending more requests.',
  },

  // ==========================================================================
  // DEFAULT LIMITS
  // ==========================================================================
  
  /**
   * Default rate limit for uncategorized endpoints
   * 200 requests per minute
   */
  default: {
    maxRequests: 200,
    windowMs: 60 * 1000,
    message: 'Rate limit exceeded. Please slow down your requests.',
  },
};

/**
 * Helper function to get rate limit config by name
 * Falls back to default if not found
 * 
 * @param name - Rate limit configuration name
 * @returns Rate limit configuration
 */
export function getRateLimitConfig(name: string): RateLimitConfig {
  return ENDPOINT_RATE_LIMITS[name] || ENDPOINT_RATE_LIMITS.default;
}

/**
 * FOOTER:
 * These rate limits are calibrated for:
 * - Preventing abuse and spam
 * - Maintaining good UX for legitimate players
 * - Protecting server resources
 * - Allowing active gameplay without artificial throttling
 * 
 * Adjust limits based on:
 * - Server capacity and performance
 * - Player feedback and usage patterns
 * - Cost per action (CPU, database queries)
 * - Security requirements
 * 
 * Monitor rate limit hits in production logs to identify:
 * - Legitimate users being limited (increase limit)
 * - Abuse patterns (decrease limit or add CAPTCHA)
 * - Unused limits (can be removed or simplified)
 */
