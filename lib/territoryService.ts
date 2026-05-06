/**
 * Territory Service
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Manages clan territory control system with tile claiming, abandonment, and
 * defense bonus calculations. Validates adjacency requirements and territory limits.
 * Integrates with research/perk bonuses for reduced claiming costs.
 * 
 * Features:
 * - Territory claiming with cost (500 Metal + 500 Energy per tile, reduced by perks)
 * - Adjacency validation (new claims must be adjacent to existing territory)
 * - Defense bonus calculation (+10% per adjacent clan tile, max +50%)
 * - Territory abandonment with confirmation
 * - Territory lookup by coordinates
 * - Clan territory listing
 * - Territory limit enforcement
 * 
 * Integration:
 * - Supabase tables: clans, clan_territories, clan_activity, clan_perks
 * - Perk system (territory cost reduction)
 * - Research bonuses (defense multipliers)
 * - Activity logging for claims/abandons
 * 
 * @module lib/territoryService
 */

import { createServiceClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const CLANS_TABLE = 'clans';
const ACTIVITIES_TABLE = 'clan_activity';

export const TERRITORY_CONSTANTS = {
  BASE_CLAIM_COST_METAL: 500,
  BASE_CLAIM_COST_ENERGY: 500,
  DEFENSE_BONUS_PER_TILE: 10,
  MAX_DEFENSE_BONUS: 50,
  MAX_TERRITORIES: 100,
};

export const TERRITORY_INCOME_CONSTANTS = {
  BASE_INCOME_METAL: 1000,
  BASE_INCOME_ENERGY: 1000,
  SCALING_FACTOR: 0.1,
  COLLECTION_HOUR: 0,
};

export const TERRITORY_LEVEL_CAPS = [
  { minLevel: 1, maxTerritories: 25 },
  { minLevel: 6, maxTerritories: 50 },
  { minLevel: 11, maxTerritories: 100 },
  { minLevel: 16, maxTerritories: 200 },
  { minLevel: 21, maxTerritories: 400 },
  { minLevel: 26, maxTerritories: 700 },
  { minLevel: 31, maxTerritories: 1000 },
];

export const TERRITORY_COST_TIERS = [
  { upTo: 10, costMetal: 2500, costEnergy: 2500 },
  { upTo: 25, costMetal: 3000, costEnergy: 3000 },
  { upTo: 50, costMetal: 3500, costEnergy: 3500 },
  { upTo: 100, costMetal: 4000, costEnergy: 4000 },
  { upTo: 250, costMetal: 5000, costEnergy: 5000 },
  { upTo: 500, costMetal: 6000, costEnergy: 6000 },
  { upTo: 750, costMetal: 7000, costEnergy: 7000 },
  { upTo: 1000, costMetal: 8000, costEnergy: 8000 },
];

export interface Territory {
  x: number;
  y: number;
  clan_id: string;
  clan_tag: string;
  claimed_at: string;
  claimed_by: string;
}

export async function claimTerritory(
  clanId: string,
  playerId: string,
  x: number,
  y: number
): Promise<{
  success: boolean;
  territory: Territory;
  cost: { metal: number; energy: number };
  defenseBonus: number;
}> {
  const supabase = createServiceClient();

  const { data: clan, error: clanError } = await supabase
    .from(CLANS_TABLE)
    .select('*')
    .eq('id', clanId)
    .single();

  if (clanError || !clan) {
    throw new Error('Clan not found');
  }

  const { data: members, error: membersError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);

  if (membersError || !members) {
    throw new Error('Failed to load clan members');
  }

  const member = members.find((m) => m.player_id === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
  if (!allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions to claim territory');
  }

  const { data: existingTerritory } = await supabase
    .from('clan_territories')
    .select('id')
    .eq('clan_id', clanId)
    .eq('tile_x', x)
    .eq('tile_y', y)
    .single();

  if (existingTerritory) {
    throw new Error('Territory already claimed by your clan');
  }

  const { data: otherClan } = await supabase
    .from('clan_territories')
    .select('clan_id')
    .eq('tile_x', x)
    .eq('tile_y', y)
    .neq('clan_id', clanId)
    .single();

  if (otherClan) {
    throw new Error('Territory already claimed by another clan');
  }

  const { data: currentTerritories } = await supabase
    .from('clan_territories')
    .select('*')
    .eq('clan_id', clanId);

  const territories = currentTerritories || [];

  if (territories.length > 0) {
    const isAdjacent = territories.some((t) => {
      const dx = Math.abs(t.tile_x - x);
      const dy = Math.abs(t.tile_y - y);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    });

    if (!isAdjacent) {
      throw new Error('Territory must be adjacent to existing clan territory');
    }
  }

  const clanLevel = (clan as Record<string, unknown>).clan_level as number || 1;
  const maxTerritories = getMaxTerritoriesByLevel(clanLevel);
  if (territories.length >= maxTerritories) {
    throw new Error(`Territory limit reached (${maxTerritories} for level ${clanLevel})`);
  }

  const territoryCount = territories.length;
  const baseCost = getTerritoryClaimCost(territoryCount);
  
  let costReduction = 0;
  const { data: perks } = await supabase
    .from('clan_perks')
    .select('*')
    .eq('clan_id', clanId);

  const activePerks = perks || [];
  for (const perk of activePerks) {
    if ((perk as Record<string, unknown>).bonus_type === 'territory_cost') {
      costReduction += (perk as Record<string, unknown>).bonus_value as number;
    }
  }

  const finalCostMetal = Math.floor(baseCost.metal * (1 - costReduction / 100));
  const finalCostEnergy = Math.floor(baseCost.energy * (1 - costReduction / 100));

  const bankMetal = (clan as Record<string, unknown>).bank_treasury_metal as number || 0;
  const bankEnergy = (clan as Record<string, unknown>).bank_treasury_energy as number || 0;

  if (bankMetal < finalCostMetal) {
    throw new Error(`Insufficient metal in clan bank (need ${finalCostMetal}, have ${bankMetal})`);
  }
  if (bankEnergy < finalCostEnergy) {
    throw new Error(`Insufficient energy in clan bank (need ${finalCostEnergy}, have ${bankEnergy})`);
  }

  const newTerritory: Territory = {
    x,
    y,
    clan_id: clanId,
    clan_tag: (clan as Record<string, unknown>).tag as string,
    claimed_at: new Date().toISOString(),
    claimed_by: playerId,
  };

  await supabase.from('clan_territories').insert({
    id: crypto.randomUUID(),
    clan_id: clanId,
    tile_x: x,
    tile_y: y,
    territory_type: 'STANDARD',
    claimed_at: new Date().toISOString(),
    claimed_by: playerId,
    defense_bonus: 0,
  });

  const totalTerritories = ((clan as Record<string, unknown>).total_territories as number || 0) + 1;
  await supabase
    .from(CLANS_TABLE)
    .update({
      bank_treasury_metal: bankMetal - finalCostMetal,
      bank_treasury_energy: bankEnergy - finalCostEnergy,
      total_territories: totalTerritories,
    })
    .eq('id', clanId);

  await supabase.from(ACTIVITIES_TABLE).insert({
    clan_id: clanId,
    activity_type: 'TERRITORY_CLAIMED',
    player_id: playerId,
    username: member.username,
    created_at: new Date().toISOString(),
    details: {
      x,
      y,
      cost: { metal: finalCostMetal, energy: finalCostEnergy },
      claimed_by: playerId,
    },
  });

  const defenseBonus = getDefenseBonus(clanId, x, y, [...territories.map((t) => ({
    x: t.tile_x,
    y: t.tile_y,
    clan_id: t.clan_id,
    clan_tag: '',
    claimed_at: t.claimed_at,
    claimed_by: t.claimed_by,
  })), newTerritory]);

  return {
    success: true,
    territory: newTerritory,
    cost: { metal: finalCostMetal, energy: finalCostEnergy },
    defenseBonus,
  };
}

export async function abandonTerritory(
  clanId: string,
  playerId: string,
  x: number,
  y: number
): Promise<{ success: boolean; message: string }> {
  const supabase = createServiceClient();

  const { data: clan, error: clanError } = await supabase
    .from(CLANS_TABLE)
    .select('*')
    .eq('id', clanId)
    .single();

  if (clanError || !clan) {
    throw new Error('Clan not found');
  }

  const { data: members, error: membersError } = await supabase
    .from('clan_members')
    .select('*')
    .eq('clan_id', clanId);

  if (membersError || !members) {
    throw new Error('Failed to load clan members');
  }

  const member = members.find((m) => m.player_id === playerId);
  if (!member) {
    throw new Error('Player is not a member of this clan');
  }

  const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
  if (!allowedRoles.includes(member.role)) {
    throw new Error('Insufficient permissions to abandon territory');
  }

  const { data: territory } = await supabase
    .from('clan_territories')
    .select('*')
    .eq('clan_id', clanId)
    .eq('tile_x', x)
    .eq('tile_y', y)
    .single();

  if (!territory) {
    throw new Error('Territory not found');
  }

  await supabase
    .from('clan_territories')
    .delete()
    .eq('clan_id', clanId)
    .eq('tile_x', x)
    .eq('tile_y', y);

  const totalTerritories = Math.max(0, ((clan as Record<string, unknown>).total_territories as number || 0) - 1);
  await supabase
    .from(CLANS_TABLE)
    .update({ total_territories: totalTerritories })
    .eq('id', clanId);

  await supabase.from(ACTIVITIES_TABLE).insert({
    clan_id: clanId,
    activity_type: 'TERRITORY_LOST',
    player_id: playerId,
    username: member.username,
    created_at: new Date().toISOString(),
    details: {
      x,
      y,
      abandoned_by: playerId,
    },
  });

  return {
    success: true,
    message: `Territory (${x}, ${y}) abandoned`,
  };
}

export async function getTerritoryAt(
  x: number,
  y: number
): Promise<{ clanId: string; clanTag: string; clanName: string; claimedAt: string } | null> {
  const supabase = createServiceClient();

  const { data: territory } = await supabase
    .from('clan_territories')
    .select('clan_id, claimed_at')
    .eq('tile_x', x)
    .eq('tile_y', y)
    .single();

  if (!territory) {
    return null;
  }

  const { data: clan } = await supabase
    .from(CLANS_TABLE)
    .select('id, tag, name')
    .eq('id', territory.clan_id)
    .single();

  if (!clan) {
    return null;
  }

  return {
    clanId: (territory as Record<string, unknown>).clan_id as string,
    clanTag: (clan as Record<string, unknown>).tag as string,
    clanName: (clan as Record<string, unknown>).name as string,
    claimedAt: (territory as Record<string, unknown>).claimed_at as string,
  };
}

export async function getClanTerritories(clanId: string): Promise<Territory[]> {
  const supabase = createServiceClient();

  const { data: clan } = await supabase
    .from(CLANS_TABLE)
    .select('tag')
    .eq('id', clanId)
    .single();

  if (!clan) {
    throw new Error('Clan not found');
  }

  const { data: territories } = await supabase
    .from('clan_territories')
    .select('*')
    .eq('clan_id', clanId);

  if (!territories) {
    return [];
  }

  return territories.map((t) => ({
    x: t.tile_x,
    y: t.tile_y,
    clan_id: t.clan_id,
    clan_tag: (clan as Record<string, unknown>).tag as string,
    claimed_at: t.claimed_at,
    claimed_by: t.claimed_by,
  }));
}

export function getDefenseBonus(
  _clanId: string,
  x: number,
  y: number,
  territories?: Territory[]
): number {
  if (!territories) {
    return 0;
  }

  let adjacentCount = 0;
  const adjacentOffsets = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  for (const offset of adjacentOffsets) {
    const adjX = x + offset.dx;
    const adjY = y + offset.dy;
    const hasAdjacentTile = territories.some((t) => t.x === adjX && t.y === adjY);
    if (hasAdjacentTile) {
      adjacentCount++;
    }
  }

  const bonus = Math.min(
    adjacentCount * TERRITORY_CONSTANTS.DEFENSE_BONUS_PER_TILE,
    TERRITORY_CONSTANTS.MAX_DEFENSE_BONUS
  );

  return bonus;
}

export async function validateTerritoryClaim(
  clanId: string,
  playerId: string,
  x: number,
  y: number
): Promise<{
  valid: boolean;
  errors: string[];
  cost?: { metal: number; energy: number };
  adjacencyValid?: boolean;
}> {
  const supabase = createServiceClient();
  const errors: string[] = [];

  try {
    const { data: clan, error: clanError } = await supabase
      .from(CLANS_TABLE)
      .select('*')
      .eq('id', clanId)
      .single();

    if (clanError || !clan) {
      errors.push('Clan not found');
      return { valid: false, errors };
    }

    const { data: members } = await supabase
      .from('clan_members')
      .select('*')
      .eq('clan_id', clanId);

    const member = (members || []).find((m) => m.player_id === playerId);
    if (!member) {
      errors.push('Player is not a member of this clan');
    }

    const allowedRoles = ['LEADER', 'CO_LEADER', 'OFFICER'];
    if (member && !allowedRoles.includes(member.role)) {
      errors.push('Insufficient permissions (Officer+ required)');
    }

    const { data: existingTerritory } = await supabase
      .from('clan_territories')
      .select('id')
      .eq('clan_id', clanId)
      .eq('tile_x', x)
      .eq('tile_y', y)
      .single();

    if (existingTerritory) {
      errors.push('Territory already claimed by your clan');
    }

    const { data: otherClans } = await supabase
      .from('clan_territories')
      .select('clan_id')
      .eq('tile_x', x)
      .eq('tile_y', y)
      .neq('clan_id', clanId);

    if (otherClans && otherClans.length > 0) {
      errors.push('Territory already claimed by another clan');
    }

    const { data: currentTerritories } = await supabase
      .from('clan_territories')
      .select('*')
      .eq('clan_id', clanId);

    const territories = currentTerritories || [];
    let adjacencyValid = true;
    if (territories.length > 0) {
      const isAdjacent = territories.some((t) => {
        const dx = Math.abs(t.tile_x - x);
        const dy = Math.abs(t.tile_y - y);
        return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
      });

      if (!isAdjacent) {
        errors.push('Territory must be adjacent to existing clan territory');
        adjacencyValid = false;
      }
    }

    const clanLevel = (clan as Record<string, unknown>).clan_level as number || 1;
    const maxTerritories = getMaxTerritoriesByLevel(clanLevel);
    if (territories.length >= maxTerritories) {
      errors.push(`Territory limit reached (${maxTerritories} for level ${clanLevel})`);
    }

    const territoryCount = territories.length;
    const baseCost = getTerritoryClaimCost(territoryCount);
    
    let costReduction = 0;
    const { data: perks } = await supabase
      .from('clan_perks')
      .select('*')
      .eq('clan_id', clanId);

    const activePerks = perks || [];
    for (const perk of activePerks) {
      if ((perk as Record<string, unknown>).bonus_type === 'territory_cost') {
        costReduction += (perk as Record<string, unknown>).bonus_value as number;
      }
    }

    const finalCostMetal = Math.floor(baseCost.metal * (1 - costReduction / 100));
    const finalCostEnergy = Math.floor(baseCost.energy * (1 - costReduction / 100));

    const bankMetal = (clan as Record<string, unknown>).bank_treasury_metal as number || 0;
    const bankEnergy = (clan as Record<string, unknown>).bank_treasury_energy as number || 0;

    if (bankMetal < finalCostMetal) {
      errors.push(`Insufficient metal (need ${finalCostMetal}, have ${bankMetal})`);
    }
    if (bankEnergy < finalCostEnergy) {
      errors.push(`Insufficient energy (need ${finalCostEnergy}, have ${bankEnergy})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      cost: { metal: finalCostMetal, energy: finalCostEnergy },
      adjacencyValid,
    };
  } catch (error: unknown) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors };
  }
}

export function getMaxTerritoriesByLevel(clanLevel: number): number {
  let maxTerritories = TERRITORY_LEVEL_CAPS[0].maxTerritories;
  
  for (const cap of TERRITORY_LEVEL_CAPS) {
    if (clanLevel >= cap.minLevel) {
      maxTerritories = cap.maxTerritories;
    } else {
      break;
    }
  }
  
  return maxTerritories;
}

export function getTerritoryClaimCost(currentTerritoryCount: number): { metal: number; energy: number } {
  let costMetal = TERRITORY_COST_TIERS[TERRITORY_COST_TIERS.length - 1].costMetal;
  let costEnergy = TERRITORY_COST_TIERS[TERRITORY_COST_TIERS.length - 1].costEnergy;
  
  for (const tier of TERRITORY_COST_TIERS) {
    if (currentTerritoryCount < tier.upTo) {
      costMetal = tier.costMetal;
      costEnergy = tier.costEnergy;
      break;
    }
  }
  
  return { metal: costMetal, energy: costEnergy };
}

export function calculateDailyPassiveIncome(
  clanLevel: number,
  territoryCount: number
): {
  metalPerDay: number;
  energyPerDay: number;
  perTerritory: number;
} {
  const incomePerTerritory = Math.floor(
    TERRITORY_INCOME_CONSTANTS.BASE_INCOME_METAL * 
    (1 + (clanLevel - 1) * TERRITORY_INCOME_CONSTANTS.SCALING_FACTOR)
  );
  
  const totalMetalPerDay = incomePerTerritory * territoryCount;
  const totalEnergyPerDay = incomePerTerritory * territoryCount;
  
  return {
    metalPerDay: totalMetalPerDay,
    energyPerDay: totalEnergyPerDay,
    perTerritory: incomePerTerritory,
  };
}

export async function collectDailyTerritoryIncome(
  clanId: string
): Promise<{
  success: boolean;
  metalCollected: number;
  energyCollected: number;
  territoryCount: number;
  timestamp: Date;
  message: string;
}> {
  const supabase = createServiceClient();
  
  try {
    const { data: clan, error: clanError } = await supabase
      .from(CLANS_TABLE)
      .select('*')
      .eq('id', clanId)
      .single();

    if (clanError || !clan) {
      throw new Error('Clan not found');
    }

    const { data: territories } = await supabase
      .from('clan_territories')
      .select('id')
      .eq('clan_id', clanId);

    const territoryCount = (territories || []).length;
    
    if (territoryCount === 0) {
      return {
        success: true,
        metalCollected: 0,
        energyCollected: 0,
        territoryCount: 0,
        timestamp: new Date(),
        message: 'No territories to collect income from',
      };
    }
    
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const clanRow = clan as Record<string, unknown>;
    const lastCollection = clanRow.last_territory_income_collection as string | undefined;
    if (lastCollection) {
      const lastCollectionDate = new Date(lastCollection);
      if (lastCollectionDate >= todayStart) {
        return {
          success: false,
          metalCollected: 0,
          energyCollected: 0,
          territoryCount,
          timestamp: now,
          message: 'Income already collected today',
        };
      }
    }
    
    const clanLevel = (clanRow.clan_level as number) || 1;
    const income = calculateDailyPassiveIncome(clanLevel, territoryCount);
    
    const bankMetal = ((clanRow.bank_treasury_metal as number) || 0) + income.metalPerDay;
    const bankEnergy = ((clanRow.bank_treasury_energy as number) || 0) + income.energyPerDay;

    await supabase
      .from(CLANS_TABLE)
      .update({
        bank_treasury_metal: bankMetal,
        bank_treasury_energy: bankEnergy,
      })
      .eq('id', clanId);
    
    await supabase.from(ACTIVITIES_TABLE).insert({
      clan_id: clanId,
      activity_type: 'TERRITORY_INCOME_COLLECTED',
      created_at: now.toISOString(),
      details: {
        territory_count: territoryCount,
        metal_collected: income.metalPerDay,
        energy_collected: income.energyPerDay,
        per_territory: income.perTerritory,
        clan_level: clanLevel,
      },
    });
    
    return {
      success: true,
      metalCollected: income.metalPerDay,
      energyCollected: income.energyPerDay,
      territoryCount,
      timestamp: now,
      message: `Collected ${income.metalPerDay} M + ${income.energyPerDay} E from ${territoryCount} territories`,
    };
  } catch (error: unknown) {
    return {
      success: false,
      metalCollected: 0,
      energyCollected: 0,
      territoryCount: 0,
      timestamp: new Date(),
      message: `Error collecting income: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function getProjectedTerritoryIncome(
  clanId: string
): Promise<{
  metalPerDay: number;
  energyPerDay: number;
  perTerritory: number;
  territoryCount: number;
  clanLevel: number;
  nextCollection: Date;
  canCollectNow: boolean;
}> {
  const supabase = createServiceClient();
  
  const { data: clan, error: clanError } = await supabase
    .from(CLANS_TABLE)
    .select('*')
    .eq('id', clanId)
    .single();

  if (clanError || !clan) {
    throw new Error('Clan not found');
  }

  const { data: territories } = await supabase
    .from('clan_territories')
    .select('id')
    .eq('clan_id', clanId);
  
  const territoryCount = (territories || []).length;
  const clanRow = clan as Record<string, unknown>;
  const clanLevel = (clanRow.clan_level as number) || 1;
  
  const income = calculateDailyPassiveIncome(clanLevel, territoryCount);
  
  const now = new Date();
  const nextCollection = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  nextCollection.setUTCHours(TERRITORY_INCOME_CONSTANTS.COLLECTION_HOUR, 0, 0, 0);
  
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastCollection = clanRow.last_territory_income_collection as string | undefined;
  const canCollectNow = !lastCollection || new Date(lastCollection) < todayStart;
  
  return {
    ...income,
    territoryCount,
    clanLevel,
    nextCollection,
    canCollectNow,
  };
}
