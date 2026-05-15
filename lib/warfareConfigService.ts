/**
 * Warfare Configuration Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages warfare system configuration stored in Supabase. Allows admin
 * to modify war costs, rewards, durations, territory limits, and passive
 * income parameters in real-time without server restart.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { fromJsonb, toJsonb } from '@/lib/supabase/jsonb';
import type { Database } from '@/types/database';

export interface WarfareConfig {
  version: number;
  last_updated: string;
  updated_by: string;
  
  war_costs: {
    base_metal: number;
    base_energy: number;
    scaling_per_territory: number;
  };
  
  war_rewards: {
    metal_spoils_percent: number;
    energy_spoils_percent: number;
    rp_spoils_percent: number;
    victory_xp: number;
    defeat_xp_penalty: number;
  };
  
  war_duration: {
    minimum_hours: number;
    cooldown_hours: number;
  };
  
  war_requirements: {
    minimum_level: number;
    minimum_members: number;
  };
  
  territory_costs: {
    base_metal: number;
    base_energy: number;
    cost_tiers: Array<{
      up_to: number;
      cost_metal: number;
      cost_energy: number;
    }>;
  };
  
  passive_income: {
    base_metal: number;
    base_energy: number;
    scaling_factor: number;
    collection_hour: number;
  };
  
  territory_limits: {
    absolute_max: number;
    level_based_caps: Array<{
      min_level: number;
      max_territories: number;
    }>;
  };
}

export const DEFAULT_WARFARE_CONFIG: Omit<WarfareConfig, 'last_updated' | 'updated_by'> = {
  version: 1,
  
  war_costs: {
    base_metal: 50000,
    base_energy: 50000,
    scaling_per_territory: 400,
  },
  
  war_rewards: {
    metal_spoils_percent: 15,
    energy_spoils_percent: 15,
    rp_spoils_percent: 10,
    victory_xp: 50000,
    defeat_xp_penalty: 25000,
  },
  
  war_duration: {
    minimum_hours: 48,
    cooldown_hours: 168,
  },
  
  war_requirements: {
    minimum_level: 10,
    minimum_members: 5,
  },
  
  territory_costs: {
    base_metal: 2500,
    base_energy: 2500,
    cost_tiers: [
      { up_to: 10, cost_metal: 2500, cost_energy: 2500 },
      { up_to: 25, cost_metal: 3000, cost_energy: 3000 },
      { up_to: 50, cost_metal: 3500, cost_energy: 3500 },
      { up_to: 100, cost_metal: 4000, cost_energy: 4000 },
      { up_to: 250, cost_metal: 5000, cost_energy: 5000 },
      { up_to: 500, cost_metal: 6000, cost_energy: 6000 },
      { up_to: 750, cost_metal: 7000, cost_energy: 7000 },
      { up_to: 1000, cost_metal: 8000, cost_energy: 8000 },
    ],
  },
  
  passive_income: {
    base_metal: 1000,
    base_energy: 1000,
    scaling_factor: 0.1,
    collection_hour: 0,
  },
  
  territory_limits: {
    absolute_max: 1000,
    level_based_caps: [
      { min_level: 1, max_territories: 25 },
      { min_level: 6, max_territories: 50 },
      { min_level: 11, max_territories: 100 },
      { min_level: 16, max_territories: 200 },
      { min_level: 21, max_territories: 400 },
      { min_level: 26, max_territories: 700 },
      { min_level: 31, max_territories: 1000 },
    ],
  },
};

const TABLE = 'bot_config';
const CONFIG_KEY = 'warfare_config';

export async function loadWarfareConfig(): Promise<WarfareConfig> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase
    .from(TABLE)
    .select('config_value')
    .eq('config_key', CONFIG_KEY)
    .maybeSingle();
  
  if (error) {
    console.error('[WarfareConfig] Failed to load config:', error);
  }
  
  if (data && data.config_value) {
    return fromJsonb<WarfareConfig>(data.config_value) ?? { ...DEFAULT_WARFARE_CONFIG, last_updated: '', updated_by: 'system' };
  }
  
  return { ...DEFAULT_WARFARE_CONFIG, version: 1, last_updated: '', updated_by: 'system' };
}

export async function saveWarfareConfig(
  config: Omit<WarfareConfig, 'last_updated' | 'updated_by'>,
  updatedBy: string
): Promise<WarfareConfig> {
  const supabase = createServiceClient();
  
  const validation = validateWarfareConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }
  
  const currentConfig = await loadWarfareConfig();
  const newVersion = (currentConfig.version || 0) + 1;
  
  const newConfig = {
    ...config,
    version: newVersion,
    last_updated: new Date().toISOString(),
    updated_by: updatedBy,
  };
  
  const { error: upsertErr } = await supabase
    .from(TABLE)
    .upsert({
      config_key: CONFIG_KEY,
      config_value: newConfig,
    });
  
  if (upsertErr) {
    console.error('[WarfareConfig] Failed to save config:', upsertErr);
    throw new Error(`Failed to save warfare config: ${upsertErr.message}`);
  }
  
  return newConfig;
}

export function validateWarfareConfig(
  config: Omit<WarfareConfig, 'last_updated' | 'updated_by'>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (config.war_costs.base_metal < 0) {
    errors.push('War cost (metal) must be non-negative');
  }
  if (config.war_costs.base_energy < 0) {
    errors.push('War cost (energy) must be non-negative');
  }
  if (config.war_costs.scaling_per_territory < 0) {
    errors.push('War cost scaling must be non-negative');
  }
  
  if (config.war_rewards.metal_spoils_percent < 0 || config.war_rewards.metal_spoils_percent > 100) {
    errors.push('Metal spoils percent must be between 0 and 100');
  }
  if (config.war_rewards.energy_spoils_percent < 0 || config.war_rewards.energy_spoils_percent > 100) {
    errors.push('Energy spoils percent must be between 0 and 100');
  }
  if (config.war_rewards.rp_spoils_percent < 0 || config.war_rewards.rp_spoils_percent > 100) {
    errors.push('RP spoils percent must be between 0 and 100');
  }
  
  if (config.war_duration.minimum_hours < 1) {
    errors.push('Minimum war duration must be at least 1 hour');
  }
  if (config.war_duration.cooldown_hours < 0) {
    errors.push('Cooldown hours must be non-negative');
  }
  
  if (config.war_requirements.minimum_level < 1) {
    errors.push('Minimum level must be at least 1');
  }
  if (config.war_requirements.minimum_members < 1) {
    errors.push('Minimum members must be at least 1');
  }
  
  if (config.territory_limits.absolute_max < 1) {
    errors.push('Absolute max territories must be at least 1');
  }
  
  if (config.passive_income.scaling_factor < 0 || config.passive_income.scaling_factor > 1) {
    errors.push('Scaling factor must be between 0 and 1');
  }
  if (config.passive_income.collection_hour < 0 || config.passive_income.collection_hour > 23) {
    errors.push('Collection hour must be between 0 and 23');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function getConfigHistory(_limit = 10): Promise<WarfareConfig[]> {
  const config = await loadWarfareConfig();
  return [config];
}
