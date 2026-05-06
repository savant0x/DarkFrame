/**
 * @file types/botConfig.types.ts
 * @created 2025-10-18
 * @overview Bot system configuration types for admin panel
 * 
 * OVERVIEW:
 * Defines all configurable parameters for the bot ecosystem.
 * Admin panel can adjust these values in real-time to tune game balance.
 */

/**
 * Global bot system configuration
 * All parameters adjustable via admin panel
 */
export interface BotSystemConfig {
  // Population Control
  enabled: boolean;                    // Master enable/disable for entire bot system
  totalBotCap: number;                 // Maximum total bots (default: 1000)
  dailySpawnCount: number;             // Bots to spawn per day (default: 50-100)
  initialSpawnCount: number;           // Starting bots (default: 100)
  
  // Resource Regeneration (Full Permanence Model)
  regenEnabled: boolean;               // Enable hourly resource regeneration
  hoarderRegenRate: number;            // Hoarder regen % per hour (default: 0.05 = 5%)
  fortressRegenRate: number;           // Fortress regen % per hour (default: 0.10)
  raiderRegenRate: number;             // Raider regen % per hour (default: 0.15)
  ghostRegenRate: number;              // Ghost regen % per hour (default: 0.20)
  balancedRegenRate: number;           // Balanced regen % per hour (default: 0.10)
  
  // Beer Base System
  beerBaseEnabled: boolean;            // Enable Beer Bases
  beerBasePercentage: number;          // % of bots that are Beer Bases (default: 0.07 = 7%)
  beerBaseResourceMultiplier: number;  // Resource multiplier for Beer Bases (default: 3.0)
  beerBaseRespawnDay: number;          // Day of week to respawn (0=Sunday, default: 0)
  beerBaseRespawnHour: number;         // Hour to respawn Beer Bases (default: 4)
  
  // Bot Scanner Tech
  scannerBaseRadius: number;           // Base scan radius in tiles (default: 50)
  scannerUpgradedRadius: number;       // Upgraded scan radius (default: 100)
  scannerBaseCooldown: number;         // Base cooldown in minutes (default: 60)
  scannerUpgradedCooldown: number;     // Upgraded cooldown in minutes (default: 30)
  
  // Bot Magnet Tech
  magnetEnabled: boolean;              // Enable Bot Magnet feature
  magnetCost: number;                  // Metal cost to deploy (default: 10000)
  magnetRadius: number;                // Attraction radius in tiles (default: 75)
  magnetDuration: number;              // Duration in hours (default: 168 = 7 days)
  magnetMigrationTime: number;         // Hours for bots to migrate (default: 48)
  magnetMinBots: number;               // Min bots attracted (default: 20)
  magnetMaxBots: number;               // Max bots attracted (default: 50)
  magnetCooldown: number;              // Cooldown in hours (default: 336 = 14 days)
  
  // Bot Concentration Zones Tech
  concentrationEnabled: boolean;       // Enable Concentration Zones
  concentrationMaxZones: number;       // Max zones player can set (default: 3)
  concentrationZoneSize: number;       // Zone size in tiles (default: 30×30)
  concentrationSpawnPercentage: number; // % of new spawns in zones (default: 0.70 = 70%)
  concentrationRelocateInterval: number; // Days between relocations (default: 7)
  
  // Bot Summoning Circle Tech
  summoningEnabled: boolean;           // Enable Bot Summoning
  summoningCostMetal: number;          // Metal cost (default: 25000)
  summoningCostEnergy: number;         // Energy cost (default: 25000)
  summoningBotCount: number;           // Bots spawned per summon (default: 5)
  summoningRadius: number;             // Spawn radius in tiles (default: 20)
  summoningCooldown: number;           // Cooldown in hours (default: 168 = 7 days)
  
  // Fast Travel Network Tech
  travelEnabled: boolean;              // Enable Fast Travel
  travelMaxWaypoints: number;          // Max waypoints (default: 5)
  travelCostMetal: number;             // Metal cost per trip (default: 5000)
  travelCostEnergy: number;            // Energy cost per trip (default: 5000)
  travelWaypointCooldown: number;      // Cooldown per waypoint in hours (default: 12)
  
  // Bot Bounty Board
  bountyEnabled: boolean;              // Enable daily bounties
  bountyDailyCount: number;            // Bounties per day (default: 5)
  bountyMinReward: number;             // Min reward (default: 25000)
  bountyMaxReward: number;             // Max reward (default: 100000)
  bountyRefreshHour: number;           // Hour to refresh bounties (default: 0 = midnight)
  
  // Reputation System
  reputationNotoriousThreshold: number;  // Defeats for Notorious (default: 6)
  reputationInfamousThreshold: number;   // Defeats for Infamous (default: 16)
  reputationLegendaryThreshold: number;  // Defeats for Legendary (default: 31)
  reputationNotoriousBonus: number;      // Loot bonus % (default: 0.25 = +25%)
  reputationInfamousBonus: number;       // Loot bonus % (default: 0.50 = +50%)
  reputationLegendaryBonus: number;      // Loot bonus % (default: 1.00 = +100%)
  
  // Weekly Migration
  migrationEnabled: boolean;           // Enable weekly migrations
  migrationPercentage: number;         // % of bots that migrate (default: 0.30 = 30%)
  migrationDay: number;                // Day of week (0=Sunday, default: 0)
  migrationHour: number;               // Hour to trigger (default: 12)
  
  // Phase-Out System
  phaseOutEnabled: boolean;            // Enable gradual bot removal
  phaseOutRatio: number;               // 1 bot per X real players (default: 10)
  phaseOutPriority: 'weakest' | 'oldest' | 'random'; // Which bots to remove (default: 'weakest')
  phaseOutPreserveNests: boolean;      // Keep nest bots (default: true)
  
  // Bot Nests
  nestCount: number;                   // Number of nests (default: 8)
  nestMinBots: number;                 // Min bots per nest (default: 15)
  nestMaxBots: number;                 // Max bots per nest (default: 20)
}

/**
 * Bot nest location configuration
 */
export interface BotNestLocation {
  id: number;                          // Nest ID (0-7)
  position: { x: number; y: number };  // Map coordinates
  name: string;                        // Display name (e.g., "North Bank Nest")
  theme: string;                       // Thematic description
  active: boolean;                     // Is nest active
  currentBotCount: number;             // Current bots at this nest
}

/**
 * Bot spawn event for admin logging
 */
export interface BotSpawnEvent {
  timestamp: Date;
  count: number;
  zones: number[];                     // Zones where bots spawned
  specializations: Record<string, number>; // Count by type
  reason: 'initial' | 'daily' | 'manual' | 'beer_base_respawn';
}

/**
 * Default bot system configuration
 */
export const DEFAULT_BOT_CONFIG: BotSystemConfig = {
  // Population
  enabled: true,
  totalBotCap: 1000,
  dailySpawnCount: 75,
  initialSpawnCount: 100,
  
  // Regeneration
  regenEnabled: true,
  hoarderRegenRate: 0.05,
  fortressRegenRate: 0.10,
  raiderRegenRate: 0.15,
  ghostRegenRate: 0.20,
  balancedRegenRate: 0.10,
  
  // Beer Bases
  beerBaseEnabled: true,
  beerBasePercentage: 0.07,
  beerBaseResourceMultiplier: 3.0,
  beerBaseRespawnDay: 0,
  beerBaseRespawnHour: 4,
  
  // Scanner
  scannerBaseRadius: 50,
  scannerUpgradedRadius: 100,
  scannerBaseCooldown: 60,
  scannerUpgradedCooldown: 30,
  
  // Magnet
  magnetEnabled: true,
  magnetCost: 10000,
  magnetRadius: 75,
  magnetDuration: 168,
  magnetMigrationTime: 48,
  magnetMinBots: 20,
  magnetMaxBots: 50,
  magnetCooldown: 336,
  
  // Concentration
  concentrationEnabled: true,
  concentrationMaxZones: 3,
  concentrationZoneSize: 30,
  concentrationSpawnPercentage: 0.70,
  concentrationRelocateInterval: 7,
  
  // Summoning
  summoningEnabled: true,
  summoningCostMetal: 25000,
  summoningCostEnergy: 25000,
  summoningBotCount: 5,
  summoningRadius: 20,
  summoningCooldown: 168,
  
  // Travel
  travelEnabled: true,
  travelMaxWaypoints: 5,
  travelCostMetal: 5000,
  travelCostEnergy: 5000,
  travelWaypointCooldown: 12,
  
  // Bounty
  bountyEnabled: true,
  bountyDailyCount: 5,
  bountyMinReward: 25000,
  bountyMaxReward: 100000,
  bountyRefreshHour: 0,
  
  // Reputation
  reputationNotoriousThreshold: 6,
  reputationInfamousThreshold: 16,
  reputationLegendaryThreshold: 31,
  reputationNotoriousBonus: 0.25,
  reputationInfamousBonus: 0.50,
  reputationLegendaryBonus: 1.00,
  
  // Migration
  migrationEnabled: true,
  migrationPercentage: 0.30,
  migrationDay: 0,
  migrationHour: 12,
  
  // Phase-Out
  phaseOutEnabled: false,
  phaseOutRatio: 10,
  phaseOutPriority: 'weakest',
  phaseOutPreserveNests: true,
  
  // Nests
  nestCount: 8,
  nestMinBots: 15,
  nestMaxBots: 20,
};

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - All parameters stored in MongoDB 'botConfig' collection
// - Admin panel provides UI to adjust any parameter
// - Changes take effect immediately (no restart required)
// - Historical configuration changes logged for audit
// - Default values provide balanced gameplay out-of-the-box
// ============================================================
