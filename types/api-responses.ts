/**
 * @file types/api-responses.ts
 * @created 2026-05-04
 * @overview SINGLE SOURCE OF TRUTH for ALL API response shapes.
 * 
 * All API routes return `{ success: true, data: T }` or `{ success: false, error: string }`.
 * All frontend components import their expected types from HERE, never defining local interfaces.
 * 
 * RULE: Every API route MUST explicitly return its ApiPayload type.
 * RULE: Every component fetching an API MUST use the corresponding payload type.
 * This eliminates the cascade of silent interface mismatches.
 */

// ============================================================
// GENERIC API WRAPPER
// ============================================================

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================================
// ADMIN PANEL
// ============================================================

export interface AdminStatsPayload {
  totalPlayers: number;
  totalBots: number;
  totalFactories: number;
  totalTiles: number;
  totalClans: number;
  totalCaves: number;
  totalBattles: number;
  activePlayers24h: number;
  totalResourcesGathered: number;
  timestamp: string;
}

export interface AdminPlayerListItem {
  username: string;
  level: number;
  rank: number;
  totalStrength: number;
  totalDefense: number;
  resources: { metal: number; energy: number };
  researchPoints: number;
  isAdmin: boolean;
  isBot: boolean;
  isVip: boolean;
  clanId: string | null;
  createdAt: string;
  current_x: number;
  current_y: number;
}

export interface AdminBotStatsPayload {
  totalBots: number;
  activeBots: number;
  inactiveBots?: number;
  beerBaseBots: number;
  beerBases?: number;
  roamingBots: number;
  activeBeerBases: number;
  nests: number;
  spawnRateMin: number;
  spawnRateMax: number;
  regenInterval: number;
  maxBots: number;
  migrationPercent?: number;
  lastRegenCycle?: string;
  bySpecialization?: Record<string, number>;
}

export interface AdminBotSpawnPayload {
  spawned: number;
  totalBefore: number;
  totalAfter: number;
}

export interface AdminBotRegenPayload {
  updated: number;
  spawned: number;
  cleaned: number;
  totalBefore: number;
  totalAfter: number;
}

export interface AdminBotConfigPayload {
  spawnRateMin: number;
  spawnRateMax: number;
  regenInterval: number;
  maxBots: number;
  enabled: boolean;
}

export interface AdminGiveResourcesPayload {
  metal: number;
  energy: number;
}

// ============================================================
// PLAYER
// ============================================================

export interface PlayerPayload {
  username: string;
  email: string;
  base: { x: number; y: number };
  currentPosition: { x: number; y: number };
  resources: { metal: number; energy: number };
  bank: { metal: number; energy: number };
  totalStrength: number;
  totalDefense: number;
  level: number;
  rank: number;
  xp: number;
  researchPoints: number;
  factoryCount: number;
  isAdmin: boolean;
  isVip: boolean;
  vipExpiration: string | null;
  clanId: string | null;
  clanName: string | null;
  clanRole: string | null;
  balanceEffects?: Record<string, unknown>;
  xpProgress?: Record<string, unknown>;
  inventory: {
    items: Array<{
      id?: unknown;
      name: string;
      type: string;
      itemType?: string;
      rarity: string;
      description: string;
      quantity: number;
    }>;
    capacity: number;
    metalDiggerCount: number;
    energyDiggerCount: number;
  };
  shrineBoosts: Array<Record<string, unknown>>;
  unlockedTiers: string[];
  currentHp?: number;
  maxHp?: number;
}

// ============================================================
// TILE
// ============================================================

export interface TilePayload {
  x: number;
  y: number;
  terrain: string;
  occupiedByBase: boolean;
  owner?: string;
  baseOwner?: string;
  baseGreeting?: string;
  bankType?: string | null;
  hasFlagBearer?: boolean;
  hasTrail?: boolean;
  lastHarvestedBy?: Array<{
    playerId: string;
    harvestedAt: string;
  }>;
}

// ============================================================
// UNIT FACTORY
// ============================================================

export interface UnitFactoryStatsPayload {
  level: number;
  researchPoints: number;
  resources: { metal: number; energy: number };
  totalStrength: number;
  totalDefense: number;
  availableSlots: number;
  usedSlots: number;
  factoryBuildSlots: number;
  factoryCount: number;
}

// ============================================================
// INVENTORY
// ============================================================

export interface InventoryItemPayload {
  id: string;
  name: string;
  type: string;
  category: string;
  rarity: string;
  description: string;
  quantity: number;
  gatheringBonus: number;
  bonusType: string;
  foundAt: { x: number; y: number } | null;
  foundDate: string | null;
}

export interface InventoryPayload {
  items: InventoryItemPayload[];
  capacity: number;
  used: number;
  gatheringBonus: { metalBonus: number; energyBonus: number };
  diggers: { common: number; uncommon: number; rare: number; epic: number; legendary: number };
  activeShrineBoosts: Array<{ tier: string; expiresAt: string; yieldBonus: number }>;
}

// ============================================================
// ADMIN PAGE — Additional types for state management
// ============================================================

export interface AdminWmdStatusPayload {
  status: string;
  activeJobs: number;
  totalLaunches: number;
  totalIntercepts: number;
  activeOperations?: number;
  jobs?: Array<Record<string, unknown>>;
  alerts?: Array<{ id: string; message: string; severity: string; createdAt: string }>;
}

export interface AdminWmdAnalyticsPayload {
  launchesOverTime: Array<{ date: string; count: number }>;
  interceptsOverTime: Array<{ date: string; count: number }>;
  topTargets: Array<{ location: string; count: number }>;
  successRate: number;
  missiles?: Array<Record<string, unknown>>;
}

export interface AdminBeerBaseConfigPayload {
  enabled: boolean;
  spawnRateMin: number;
  spawnRateMax: number;
  resourceMultiplier: number;
  respawnDay: number;
  respawnHour: number;
  varietyEnabled: boolean;
  minWeakPercent: number;
  minMediumPercent: number;
  minStrongPercent: number;
  minElitePercent: number;
  maxSameTierPercent: number;
  schedulesEnabled: boolean;
  usePredictiveSpawning: boolean;
  predictiveWeeksAhead: number;
  schedules?: Array<Record<string, unknown>>;
}

export interface AdminSchedulePayload {
  id: string;
  enabled: boolean;
  dayOfWeek: number;
  hour: number;
  spawnPercentage: number;
  timezone: string;
  name: string;
}

export interface AdminBeerSpawnStatsPayload {
  totalSpawns: number;
  avgPerDay: number;
  dailySpawns?: Array<{ date: string; count: number }>;
  tierDistribution: Record<string, number>;
  spawnSources?: Array<{ source: string; count: number }>;
}

export interface AdminBeerDefeatStatsPayload {
  totalDefeats: number;
  avgDefeatsPerDay: number;
  dailyDefeats?: Array<{ date: string; count: number }>;
  topDefeaters: Array<{ username: string; count: number }>;
  defeatsByTier?: Record<string, number>;
  topPlayers?: Array<{ username: string; defeats: number }>;
}

export interface AdminBeerEffectivenessStatsPayload {
  resourceGainPerSpawn: number;
  defeatRate: number;
  avgPlayerLevel: number;
  engagementScore?: number;
  avgLifespanByTier?: Record<string, number>;
  peakHours?: Array<{ hour: number; count: number }>;
}

export interface AdminActivityTrendPayload {
  timestamp: number;
  date: string;
  count: number;
  uniquePlayers: number;
  activePlayers?: number;
  newPlayers?: number;
  battles?: number;
}

export interface AdminResourceTrendPayload {
  timestamp: number;
  date: string;
  metal: number;
  energy: number;
  total: number;
  sessions: number;
  metalGathered?: number;
  energyGathered?: number;
  metalSpent?: number;
  energySpent?: number;
}

export interface AdminSessionTrendPayload {
  buckets: Array<{ range: string; count: number }>;
  totalSessions?: number;
  avgDuration?: number;
  uniquePlayers?: number;
}

export interface AdminFlagDataPayload {
  severity: string;
  count: number;
  username?: string;
  flagType?: string;
  createdAt?: string;
  resolved?: boolean;
}

export interface VipUserPayload {
  username: string;
  email: string | null;
  isVIP: boolean;
  vipTier: 'basic' | 'vip' | null;
  vip: boolean;
  vipExpiration: string | null;
  createdAt: string;
}

export interface RpStatsPayload {
  totalRPGenerated: number;
  totalRPSpent: number;
  activePlayers: number;
  avgRPPerPlayer: number;
}

export interface RpTransactionPayload {
  id: string;
  username: string;
  amount: number;
  source: string;
  description: string;
  createdAt: string;
}

export interface RpGenerationSourcePayload {
  source: string;
  totalGenerated: number;
  transactionCount: number;
}

export interface RpMilestoneStatsPayload {
  milestone: string;
  playersReached: number;
  avgTimeToReach: number;
}

export interface RpTopPlayerPayload {
  username: string;
  totalRP: number;
  rank: number;
}
