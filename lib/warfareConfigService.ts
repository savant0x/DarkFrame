/**
 * Warfare Configuration Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages warfare system configuration stored in Drizzle ORM. Allows admin
 * to modify war costs, rewards, durations, territory limits, and passive
 * income parameters in real-time without server restart.
 * 
 * Features:
 * - Load configuration from database (with defaults)
 * - Save/update configuration
 * - Validate configuration parameters
 * - Real-time config application
 * - Config versioning and history
 * 
 * Default Config Structure:
 * - warCosts: Metal/Energy costs, scaling factors
 * - warRewards: Spoils percentages, XP bonuses
 * - warDuration: Minimum duration, cooldowns
 * - warRequirements: Level, member minimums
 * - territoryCosts: Base costs, tiered pricing
 * - passiveIncome: Base income, scaling factors
 * - territoryLimits: Max territories by level
 * 
 * @module lib/warfareConfigService
 */

import { db } from '@/lib/db';
import { gameConfig } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import crypto from 'node:crypto';

/**
 * Warfare configuration interface
 */
export interface WarfareConfig {
  _id?: string;
  version: number;
  lastUpdated: Date;
  updatedBy: string;
  
  warCosts: {
    baseMetal: number;
    baseEnergy: number;
    scalingPerTerritory: number;
  };
  
  warRewards: {
    metalSpoilsPercent: number;
    energySpoilsPercent: number;
    rpSpoilsPercent: number;
    victoryXP: number;
    defeatXPPenalty: number;
  };
  
  warDuration: {
    minimumHours: number;
    cooldownHours: number;
  };
  
  warRequirements: {
    minimumLevel: number;
    minimumMembers: number;
  };
  
  territoryCosts: {
    baseMetal: number;
    baseEnergy: number;
    costTiers: Array<{
      upTo: number;
      costMetal: number;
      costEnergy: number;
    }>;
  };
  
  passiveIncome: {
    baseMetal: number;
    baseEnergy: number;
    scalingFactor: number;
    collectionHour: number;
  };
  
  territoryLimits: {
    absoluteMax: number;
    levelBasedCaps: Array<{
      minLevel: number;
      maxTerritories: number;
    }>;
  };
}

/**
 * Default warfare configuration
 */
export const DEFAULT_WARFARE_CONFIG: Omit<WarfareConfig, '_id' | 'lastUpdated' | 'updatedBy'> = {
  version: 1,
  
  warCosts: {
    baseMetal: 50000,
    baseEnergy: 50000,
    scalingPerTerritory: 400,
  },
  
  warRewards: {
    metalSpoilsPercent: 15,
    energySpoilsPercent: 15,
    rpSpoilsPercent: 10,
    victoryXP: 50000,
    defeatXPPenalty: 25000,
  },
  
  warDuration: {
    minimumHours: 48,
    cooldownHours: 168,
  },
  
  warRequirements: {
    minimumLevel: 10,
    minimumMembers: 5,
  },
  
  territoryCosts: {
    baseMetal: 2500,
    baseEnergy: 2500,
    costTiers: [
      { upTo: 10, costMetal: 2500, costEnergy: 2500 },
      { upTo: 25, costMetal: 3000, costEnergy: 3000 },
      { upTo: 50, costMetal: 3500, costEnergy: 3500 },
      { upTo: 100, costMetal: 4000, costEnergy: 4000 },
      { upTo: 250, costMetal: 5000, costEnergy: 5000 },
      { upTo: 500, costMetal: 6000, costEnergy: 6000 },
      { upTo: 750, costMetal: 7000, costEnergy: 7000 },
      { upTo: 1000, costMetal: 8000, costEnergy: 8000 },
    ],
  },
  
  passiveIncome: {
    baseMetal: 1000,
    baseEnergy: 1000,
    scalingFactor: 0.1,
    collectionHour: 0,
  },
  
  territoryLimits: {
    absoluteMax: 1000,
    levelBasedCaps: [
      { minLevel: 1, maxTerritories: 25 },
      { minLevel: 6, maxTerritories: 50 },
      { minLevel: 11, maxTerritories: 100 },
      { minLevel: 16, maxTerritories: 200 },
      { minLevel: 21, maxTerritories: 400 },
      { minLevel: 26, maxTerritories: 700 },
      { minLevel: 31, maxTerritories: 1000 },
    ],
  },
};

/**
 * Load warfare configuration from database
 * Returns default config if none exists
 * 
 * @returns Current warfare configuration
 */
export async function loadWarfareConfig(): Promise<WarfareConfig> {
  const results = await db
    .select()
    .from(gameConfig)
    .where(eq(gameConfig.type, 'warfare'))
    .orderBy(desc(sql`(${gameConfig.config}->>'version')::numeric`))
    .limit(1);

  if (results.length > 0) {
    const row = results[0];
    const configData = row.config as WarfareConfig;
    return configData;
  }

  const defaultConfig: WarfareConfig = {
    ...DEFAULT_WARFARE_CONFIG,
    lastUpdated: new Date(),
    updatedBy: 'system',
  };

  await db.insert(gameConfig).values({
    id: crypto.randomUUID().slice(0, 24),
    type: 'warfare',
    config: JSON.parse(JSON.stringify(defaultConfig)),
  });

  return defaultConfig;
}

/**
 * Save warfare configuration to database
 * Validates config before saving
 * 
 * @param config - Configuration to save
 * @param updatedBy - Username of admin making the change
 * @returns Saved configuration
 * @throws Error if validation fails
 */
export async function saveWarfareConfig(
  config: Omit<WarfareConfig, '_id' | 'lastUpdated' | 'updatedBy'>,
  updatedBy: string
): Promise<WarfareConfig> {
  const validation = validateWarfareConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  const currentConfig = await loadWarfareConfig();
  const newVersion = (currentConfig.version || 0) + 1;

  const newConfig: WarfareConfig = {
    ...config,
    version: newVersion,
    lastUpdated: new Date(),
    updatedBy,
  };

  await db.insert(gameConfig).values({
    id: crypto.randomUUID().slice(0, 24),
    type: 'warfare',
    config: JSON.parse(JSON.stringify(newConfig)),
  });

  await db.execute(sql`
    INSERT INTO system_logs (type, timestamp, updatedBy, version, changes)
    VALUES ('WARFARE_CONFIG_UPDATED', NOW(), ${updatedBy}, ${newVersion}, ${JSON.stringify(newConfig)})
  `);

  return newConfig;
}

/**
 * Validate warfare configuration
 * 
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateWarfareConfig(
  config: Omit<WarfareConfig, '_id' | 'lastUpdated' | 'updatedBy'>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.warCosts.baseMetal < 0) {
    errors.push('War cost (metal) must be non-negative');
  }
  if (config.warCosts.baseEnergy < 0) {
    errors.push('War cost (energy) must be non-negative');
  }
  if (config.warCosts.scalingPerTerritory < 0) {
    errors.push('War cost scaling must be non-negative');
  }
  
  if (config.warRewards.metalSpoilsPercent < 0 || config.warRewards.metalSpoilsPercent > 100) {
    errors.push('Metal spoils percent must be between 0 and 100');
  }
  if (config.warRewards.energySpoilsPercent < 0 || config.warRewards.energySpoilsPercent > 100) {
    errors.push('Energy spoils percent must be between 0 and 100');
  }
  if (config.warRewards.rpSpoilsPercent < 0 || config.warRewards.rpSpoilsPercent > 100) {
    errors.push('RP spoils percent must be between 0 and 100');
  }
  
  if (config.warDuration.minimumHours < 1) {
    errors.push('Minimum war duration must be at least 1 hour');
  }
  if (config.warDuration.cooldownHours < 0) {
    errors.push('Cooldown hours must be non-negative');
  }
  
  if (config.warRequirements.minimumLevel < 1) {
    errors.push('Minimum level must be at least 1');
  }
  if (config.warRequirements.minimumMembers < 1) {
    errors.push('Minimum members must be at least 1');
  }
  
  if (config.territoryLimits.absoluteMax < 1) {
    errors.push('Absolute max territories must be at least 1');
  }
  
  if (config.passiveIncome.scalingFactor < 0 || config.passiveIncome.scalingFactor > 1) {
    errors.push('Scaling factor must be between 0 and 1');
  }
  if (config.passiveIncome.collectionHour < 0 || config.passiveIncome.collectionHour > 23) {
    errors.push('Collection hour must be between 0 and 23');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get configuration history
 * 
 * @param limit - Maximum number of versions to return
 * @returns Array of past configurations
 */
export async function getConfigHistory(limit = 10): Promise<WarfareConfig[]> {
  const results = await db
    .select()
    .from(gameConfig)
    .where(eq(gameConfig.type, 'warfare'))
    .orderBy(desc(sql`(${gameConfig.config}->>'version')::numeric`))
    .limit(limit);

  return results.map(row => row.config as WarfareConfig);
}
