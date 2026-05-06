/**
 * @file types/flag.types.ts
 * @created 2025-10-20
 * @updated 2026-05-04 — Full spec rebuild (FID-20260504-FLAG)
 * @overview Flag Bearer system types — King of the Hill with flee/channel/session-earnings
 */

export enum CompassDirection {
  North = 'N', NorthEast = 'NE', East = 'E', SouthEast = 'SE',
  South = 'S', SouthWest = 'SW', West = 'W', NorthWest = 'NW'
}

export enum FlagClaimReason { Claimed = 'claimed', Stolen = 'stolen', Dropped = 'dropped', MaxHold = 'max_hold_reached' }

export interface FlagBearer {
  playerId: string;
  username: string;
  level: number;
  position: { x: number; y: number };
  claimedAt: Date;
  holdDuration: number;
  currentHP?: number;
  maxHP?: number;
  trail?: Array<{ x: number; y: number; timestamp: Date; expiresAt: Date }>;
  sessionEarnings?: { metal: number; energy: number };
  fleeCount?: number;
  graceUntil?: Date | null;
  maxHoldExpiresAt?: Date | null;
}

export interface FlagTrackerData {
  bearer: FlagBearer | null;
  distance: number;
  direction: CompassDirection;
  inChallengeRange: boolean;
  trackerPosition: { x: number; y: number };
}

export interface ChallengeRequest {
  targetPlayerId: string;
  challengerPosition: { x: number; y: number };
}

export interface ChallengeResponse {
  success: boolean;
  error?: string;
  channelDuration?: number;
  lockDuration?: number;
  channelExpiresAt?: string;
  message?: string;
}

export interface FleeRequest {
  challengerId: string;
}

export interface FleeResponse {
  success: boolean;
  error?: string;
  cost?: { metal: number; energy: number };
  newPosition?: { x: number; y: number };
  message?: string;
}

export interface SessionEarnings {
  metal: number;
  energy: number;
  startedAt: string | null;
}

export interface ClaimRequest {
  playerPosition: { x: number; y: number };
}

export interface ClaimResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface FlagStatusResponse {
  success: boolean;
  data?: {
    bearer: FlagBearer | null;
    isAvailable: boolean;
    location?: { x: number; y: number };
    sessionEarnings?: SessionEarnings;
    fleeCount?: number;
    graceUntil?: string | null;
    maxHoldExpiresAt?: string | null;
    activeChallenge?: {
      challengerUsername: string;
      expiresAt: string;
    } | null;
  };
}

export interface FlagAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export const FLAG_CONFIG = {
  CHALLENGE_RANGE: 15,
  CHANNEL_DURATION: 30000,
  LOCK_DURATION: 5000,
  FLEE_DISTANCE: 5,
  FLEE_COSTS: [0.10, 0.15, 0.20, 0.25, 0.30] as const,
  MAX_FLEES: 5,
  MAX_HOLD_HOURS: 12,
  GRACE_PERIOD_MS: 60 * 60 * 1000,
  FLEE_COOLDOWN_MS: 60 * 1000,
  CHALLENGE_COOLDOWN_MS: 30 * 60 * 1000,
  CANCEL_CHALLENGE_COOLDOWN_MS: 5 * 60 * 1000,
  ANTIHOARD_COOLDOWN_HOURS: 2,
  RESPAWN_COUNTDOWN_MINUTES: 30,
  RESPAWN_TERRAIN_PREFERENCE: { metal: 0.40, energy: 0, cave: 0.30, forest: 0, factory: 0.30 },
  MAP_SIZE: 150,
  EDGE_BUFFER: 10,
  TRAIL_DURATION_MINUTES: 8,
  PERMANENT_HARVEST_BONUS_PCT: 2,
  MAX_HOLD_BONUS_METAL: 2_000_000,
  MAX_HOLD_BONUS_ENERGY: 2_000_000,
  FLAG_BONUSES: {
    harvestMultiplier: 2.0,
    xpMultiplier: 2.0,
    caveDropBoost: 1.5,
    autoFarmSpeedBoost: 1.5,
    unitStrengthBoost: 1.25,
    unitDefenseBoost: 1.25,
    bankCapacityBoost: 1.5,
    inventoryCapacityBoost: 1.5,
  },
} as const;
