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
  beerBaseBots: number;
  roamingBots: number;
  activeBeerBases: number;
  nests: number;
  spawnRateMin: number;
  spawnRateMax: number;
  regenInterval: number;
  maxBots: number;
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
