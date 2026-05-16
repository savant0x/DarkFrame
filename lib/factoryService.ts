/**
 * @file lib/factoryService.ts
 * @created 2025-10-17
 * @updated 2026-05-11 — FID-20260511-FACTORY-UNIT-REDESIGN
 *
 * CHANGES:
 * - Burst+decay slot model: 80% on capture, 20% asymptotic decay
 * - Map entropy: degrade 1 level per 72h unoccupied
 * - Terrain modifiers from adjacent tiles
 * - Factory archetypes (MUNITIONS/HEAVY_ASSEMBLY/AEGIS)
 * - New capture probability formula with diminishing returns
 * - Level-gap penalties for high-rank vs low-level factories
 * - Removed broken produceUnit function
 * - Auth via server-side session (no username from body)
 * - Passive income calculated on collection (lazy evaluation)
 * - buildUnitsAtFactory replaces produceUnit with proper UNIT_CONFIGS
 * - abandonFactory awards Operational Data
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/types/database';
import { Factory, AttackResult, Unit, Position, UnitType, UNIT_CONFIGS } from '@/types';
import { awardXP, XPAction } from './xpService';
import {
  FACTORY_UPGRADE,
  getMaxSlots,
  getFactoryDefense,
  getBurstSlots,
  getDecaySlots,
  getTotalAvailableSlots,
  shouldDegrade,
  getTerrainModifier,
  getArchetypeBonus,
  getCaptureProbability,
  getLuckyStrikeChance,
  getLevelGapPenalty,
  getUpkeepCost,
  type FactoryArchetype,
  type TerrainModifier,
  calculateUpgradeCost,
  canUpgradeFactory,
} from './factoryUpgradeService';

const ATTACK_COOLDOWN_MS = 5 * 60 * 1000;
const BASE_PLAYER_POWER = 100;

// ─── PASSIVE INCOME ───────────────────────────────────────────────────────────

export function getFactoryIncomeRate(factoryLevel: number): { metal: number; energy: number } {
  return { metal: factoryLevel * 1000, energy: factoryLevel * 500 };
}

export function calculateFactoryIncome(factory: Tables<'factories'>): {
  metal: number; energy: number; hoursElapsed: number;
} {
  const lastGen = (factory as Record<string, unknown>).last_resource_generation ?? factory.last_interacted_at;
  if (!lastGen) return { metal: 0, energy: 0, hoursElapsed: 0 };
  const msElapsed = Date.now() - new Date(lastGen as string).getTime();
  const hoursElapsed = msElapsed / (1000 * 60 * 60);
  if (hoursElapsed < 0.0167) return { metal: 0, energy: 0, hoursElapsed: 0 };
  const rate = getFactoryIncomeRate(factory.level);
  return { metal: Math.floor(rate.metal * hoursElapsed), energy: Math.floor(rate.energy * hoursElapsed), hoursElapsed };
}

export async function collectAllFactoryIncome(username: string): Promise<{
  totalMetal: number; totalEnergy: number; factoriesCollected: number;
  factories: Array<{ position: { x: number; y: number }; level: number; metal: number; energy: number; hoursElapsed: number }>;
}> {
  const supabase = createServiceClient();
  const { data: factories, error } = await supabase.from('factories').select('*').eq('owner', username);
  if (error) throw new Error(error.message);
  if (!factories || factories.length === 0) return { totalMetal: 0, totalEnergy: 0, factoriesCollected: 0, factories: [] };

  let totalMetal = 0, totalEnergy = 0;
  const factoryDetails: Array<{ position: { x: number; y: number }; level: number; metal: number; energy: number; hoursElapsed: number }> = [];
  const updates: Array<{ x: number; y: number; last_resource_generation: string }> = [];

  for (const factory of factories) {
    const income = calculateFactoryIncome(factory);
    if (income.metal > 0 || income.energy > 0) {
      totalMetal += income.metal;
      totalEnergy += income.energy;
      factoryDetails.push({ position: { x: factory.x, y: factory.y }, level: factory.level, metal: income.metal, energy: income.energy, hoursElapsed: income.hoursElapsed });
      updates.push({ x: factory.x, y: factory.y, last_resource_generation: new Date().toISOString() });
    }
  }

  if (updates.length > 0) {
    const { error: batchError } = await supabase.from('factories').upsert(updates as never, { onConflict: 'x,y' });
    if (batchError) throw new Error(batchError.message);
  }

  if (totalMetal > 0 || totalEnergy > 0) {
    const { data: player } = await supabase.from('players').select('resources_metal, resources_energy').eq('username', username).single();
    if (player) {
      const { error: updateError } = await supabase.from('players').update({ resources_metal: player.resources_metal + totalMetal, resources_energy: player.resources_energy + totalEnergy }).eq('username', username);
      if (updateError) throw new Error(updateError.message);
    }
  }
  return { totalMetal, totalEnergy, factoriesCollected: factoryDetails.length, factories: factoryDetails };
}

// ─── PLAYER POWER ─────────────────────────────────────────────────────────────

export async function calculatePlayerPower(username: string): Promise<number> {
  const supabase = createServiceClient();
  const { data: player, error } = await supabase.from('players').select('*').eq('username', username).single();
  if (error || !player) return BASE_PLAYER_POWER;
  let power = BASE_PLAYER_POWER;
  power += (player.rank || 1) * 10;
  if (player.total_strength) power += player.total_strength;
  if (player.factory_count) power += player.factory_count * 50;
  return power;
}

// ─── FACTORY DATA ─────────────────────────────────────────────────────────────

export async function getFactoryData(x: number, y: number): Promise<Tables<'factories'> | null> {
  const supabase = createServiceClient();
  const { data: factory, error } = await supabase.from('factories').select('*').eq('x', x).eq('y', y).single();

  if (!factory || error) {
    const level = 1;
    const now = new Date().toISOString();
    const insert: TablesInsert<'factories'> = {
      x, y, owner: null,
      defense: getFactoryDefense(level),
      level,
      slots: getMaxSlots(level),
      used_slots: 0,
      production_rate: 1,
      last_slot_regen: now,
      last_resource_generation: now,
      last_interacted_at: now,
      last_attacked_by: null,
      last_attack_time: null,
      times_captured: 0,
      factory_archetype: 'MUNITIONS',
      terrain_modifier: 'WASTELAND',
    };
    const { data: newFactory, error: insertError } = await supabase.from('factories').insert(insert).select('*').single();
    if (insertError) throw new Error(insertError.message);
    return newFactory;
  }
  return factory;
}

// ─── MAP ENTROPY ──────────────────────────────────────────────────────────────

export async function applyMapEntropy(supabase: ReturnType<typeof createServiceClient>, factory: Tables<'factories'>): Promise<number> {
  if (!factory.last_interacted_at) return 0;
  const lastInteracted = new Date(factory.last_interacted_at);
  if (!shouldDegrade(lastInteracted)) return 0;
  const periods = Math.floor((Date.now() - lastInteracted.getTime()) / (1000 * 60 * 60 * FACTORY_UPGRADE.ENTROPY_HOURS));
  if (periods <= 0) return 0;
  const newLevel = Math.max(FACTORY_UPGRADE.MIN_LEVEL, factory.level - periods);
  const levelsLost = factory.level - newLevel;
  if (levelsLost > 0) {
    await supabase.from('factories').update({
      level: newLevel,
      defense: getFactoryDefense(newLevel),
      slots: getMaxSlots(newLevel),
      used_slots: 0,
      last_interacted_at: new Date().toISOString(),
    }).eq('x', factory.x).eq('y', factory.y);
  }
  return levelsLost;
}

// ─── FACTORY CAPTURE ──────────────────────────────────────────────────────────

export async function attackFactory(username: string, x: number, y: number): Promise<AttackResult> {
  const supabase = createServiceClient();
  const factory = await getFactoryData(x, y);
  if (!factory) return { success: false, message: 'Factory not found', playerPower: 0, factoryDefense: 0, captured: false };

  await applyMapEntropy(supabase, factory);
  const freshFactory = await getFactoryData(x, y);
  if (!freshFactory) return { success: false, message: 'Factory not found', playerPower: 0, factoryDefense: 0, captured: false };

  if (freshFactory.owner === username) return { success: false, message: 'You already control this factory!', playerPower: 0, factoryDefense: freshFactory.defense, captured: false };

  const { count } = await supabase.from('factories').select('*', { count: 'exact', head: true }).eq('owner', username);
  const ownedCount = count || 0;
  if (ownedCount >= 10) return { success: false, message: `You already control ${ownedCount} factories (max 10). Abandon one to capture another.`, playerPower: 0, factoryDefense: freshFactory.defense, captured: false };

  if (freshFactory.last_attacked_by === username && freshFactory.last_attack_time) {
    const timeSince = Date.now() - new Date(freshFactory.last_attack_time).getTime();
    if (timeSince < ATTACK_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((ATTACK_COOLDOWN_MS - timeSince) / 60000);
      return { success: false, message: `You must wait ${minutesLeft} minutes before attacking this factory again`, playerPower: 0, factoryDefense: freshFactory.defense, captured: false };
    }
  }

  const basePlayerPower = await calculatePlayerPower(username);
  const { data: player } = await supabase.from('players').select('rank').eq('username', username).single();
  const levelGapMultiplier = getLevelGapPenalty(player?.rank || 1, freshFactory.level);
  let effectivePower = Math.floor(basePlayerPower * levelGapMultiplier);

  const luckyChance = getLuckyStrikeChance(freshFactory.level, basePlayerPower);
  if (luckyChance > 0 && Math.random() < luckyChance) effectivePower = Math.floor(freshFactory.defense * 1.1);

  const terrainMod = getTerrainModifier((freshFactory.terrain_modifier as TerrainModifier) || 'WASTELAND');
  const effectiveDefense = Math.floor(freshFactory.defense * terrainMod.defenseMultiplier);
  const successChance = getCaptureProbability(effectivePower, effectiveDefense);
  const success = Math.random() < successChance;
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = { last_attacked_by: username, last_attack_time: now, last_interacted_at: now };
  if (success) {
    updateData.owner = username;
    updateData.used_slots = 0;
    updateData.slots = getBurstSlots(freshFactory.level);
    updateData.last_resource_generation = now;
    updateData.times_captured = (freshFactory.times_captured || 0) + 1;
  }

  const { error: updateError } = await supabase.from('factories').update(updateData as never).eq('x', x).eq('y', y);
  if (updateError) throw new Error(updateError.message);

  if (success) {
    const xpResult = await awardXP(username, XPAction.FACTORY_CAPTURE);
    return {
      success: true,
      message: `Victory! You have captured the factory!\n\nYour Power: ${effectivePower.toLocaleString()}\nFactory Defense: ${effectiveDefense.toLocaleString()}\nCapture Chance: ${(successChance * 100).toFixed(1)}%`,
      playerPower: effectivePower, factoryDefense: effectiveDefense, captured: true,
      xpAwarded: xpResult.xpAwarded, levelUp: xpResult.levelUp, newLevel: xpResult.newLevel,
    };
  }
  return {
    success: false,
    message: `Attack failed!\n\nYour Power: ${effectivePower.toLocaleString()}\nFactory Defense: ${effectiveDefense.toLocaleString()}\nCapture Chance: ${(successChance * 100).toFixed(1)}%`,
    playerPower: effectivePower, factoryDefense: effectiveDefense, captured: false,
  };
}

// ─── UNIT PRODUCTION ──────────────────────────────────────────────────────────

export async function buildUnitsAtFactory(
  username: string, x: number, y: number,
  builds: Array<{ unitType: UnitType; quantity: number }>
): Promise<{ success: boolean; message: string; units?: Unit[]; totalCost?: { metal: number; energy: number; rp: number } }> {
  const supabase = createServiceClient();
  const factory = await getFactoryData(x, y);
  if (!factory) return { success: false, message: 'Factory not found' };
  if (factory.owner !== username) return { success: false, message: 'You do not control this factory' };

  let totalSlotsNeeded = 0, totalMetalCost = 0, totalEnergyCost = 0, totalRpCost = 0;
  for (const build of builds) {
    const config = UNIT_CONFIGS[build.unitType];
    if (!config) return { success: false, message: `Unknown unit type: ${build.unitType}` };
    totalSlotsNeeded += config.slotCost * build.quantity;
    totalMetalCost += config.metalCost * build.quantity;
    totalEnergyCost += config.energyCost * build.quantity;
    totalRpCost += config.rpRequired;
  }

  const minutesSinceCapture = factory.last_interacted_at ? (Date.now() - new Date(factory.last_interacted_at).getTime()) / (1000 * 60) : 0;
  const availableSlots = getTotalAvailableSlots(factory.level, minutesSinceCapture);
  const remainingSlots = availableSlots - factory.used_slots;
  if (totalSlotsNeeded > remainingSlots) return { success: false, message: `Insufficient factory slots. Need ${totalSlotsNeeded.toLocaleString()}, have ${remainingSlots.toLocaleString()} available.` };

  const { data: player, error: playerError } = await supabase.from('players').select('*').eq('username', username).single();
  if (playerError || !player) return { success: false, message: 'Player not found' };
  if (player.resources_metal < totalMetalCost || player.resources_energy < totalEnergyCost) {
    return { success: false, message: `Insufficient resources. Need ${totalMetalCost.toLocaleString()} Metal and ${totalEnergyCost.toLocaleString()} Energy.` };
  }

  const units: Unit[] = [];
  for (const build of builds) {
    const config = UNIT_CONFIGS[build.unitType];
    for (let i = 0; i < build.quantity; i++) {
      units.push({ id: crypto.randomUUID(), type: build.unitType, strength: config.strength, defense: config.defense, producedAt: { x, y }, producedDate: new Date(), owner: username });
    }
  }

  const { error: resourceError } = await supabase.from('players').update({ resources_metal: player.resources_metal - totalMetalCost, resources_energy: player.resources_energy - totalEnergyCost }).eq('username', username);
  if (resourceError) throw new Error(resourceError.message);

  const { error: factoryError } = await supabase.from('factories').update({ used_slots: factory.used_slots + totalSlotsNeeded, last_interacted_at: new Date().toISOString() }).eq('x', x).eq('y', y);
  if (factoryError) throw new Error(factoryError.message);

  const armyRows = units.map((u) => ({ id: u.id, player_username: username, unit_type: u.type, strength: u.strength, defense: u.defense, produced_at_x: x, produced_at_y: y, created_at: new Date().toISOString() }));
  const { error: armyError } = await supabase.from('player_units').insert(armyRows as never);
  if (armyError) throw new Error(armyError.message);

  return {
    success: true,
    message: `Built ${units.length} units!\n\nCost: ${totalMetalCost.toLocaleString()} Metal + ${totalEnergyCost.toLocaleString()} Energy\nSlots used: ${(factory.used_slots + totalSlotsNeeded).toLocaleString()}/${availableSlots.toLocaleString()}`,
    units,
    totalCost: { metal: totalMetalCost, energy: totalEnergyCost, rp: totalRpCost },
  };
}

// ─── FACTORY ABANDON ──────────────────────────────────────────────────────────

export async function abandonFactory(username: string, x: number, y: number): Promise<{ success: boolean; message: string; operationalDataEarned?: number }> {
  const supabase = createServiceClient();
  const factory = await getFactoryData(x, y);
  if (!factory) return { success: false, message: 'Factory not found' };
  if (factory.owner !== username) return { success: false, message: 'You do not control this factory' };

  const slotsConsumed = factory.used_slots;
  const operationalDataEarned = Math.floor(slotsConsumed / 100);

  const { error: updateError } = await supabase.from('factories').update({ owner: null, used_slots: 0, last_interacted_at: new Date().toISOString() }).eq('x', x).eq('y', y);
  if (updateError) throw new Error(updateError.message);

  if (operationalDataEarned > 0) {
    // Award operational data via direct player update (RPC may not exist yet)
    const { data: p } = await supabase.from('players').select('operational_data').eq('username', username).single();
    if (p) {
      await supabase.from('players').update({ operational_data: (p.operational_data || 0) + operationalDataEarned } as never).eq('username', username);
    }
  }

  return { success: true, message: `Factory abandoned!\n\nSlots consumed: ${slotsConsumed.toLocaleString()}\nOperational Data earned: ${operationalDataEarned}`, operationalDataEarned };
}

// ─── PLAYER FACTORIES ─────────────────────────────────────────────────────────

export async function getPlayerFactories(username: string): Promise<Tables<'factories'>[]> {
  const supabase = createServiceClient();
  const { data: factories, error } = await supabase.from('factories').select('*').eq('owner', username);
  if (error) throw new Error(error.message);
  return factories || [];
}

// ─── FACTORY UPGRADE ──────────────────────────────────────────────────────────

export async function upgradeFactory(username: string, x: number, y: number): Promise<{ success: boolean; message: string; newLevel?: number }> {
  const supabase = createServiceClient();
  const factory = await getFactoryData(x, y);
  if (!factory) return { success: false, message: 'Factory not found' };
  if (factory.owner !== username) return { success: false, message: 'You do not control this factory' };
  if (factory.level >= FACTORY_UPGRADE.MAX_LEVEL) return { success: false, message: 'Factory is already at maximum level (10)' };

  const cost = calculateUpgradeCost(factory.level);
  const { data: player } = await supabase.from('players').select('*').eq('username', username).single();
  if (!player) return { success: false, message: 'Player not found' };

  const playerRp = ((player as Record<string, unknown>).research_points as number) || 0;
  const check = canUpgradeFactory({ ...factory, owner: username, usedSlots: factory.used_slots, productionRate: factory.production_rate, lastSlotRegen: factory.last_slot_regen } as unknown as Factory, player.resources_metal, player.resources_energy, playerRp);
  if (!check.canUpgrade) return { success: false, message: check.reason || 'Cannot upgrade' };

  const newLevel = factory.level + 1;
  const { error: updateError } = await supabase.from('players').update({ resources_metal: player.resources_metal - cost.metal, resources_energy: player.resources_energy - cost.energy, research_points: playerRp - cost.rp } as never).eq('username', username);
  if (updateError) throw new Error(updateError.message);

  const { error: factoryError } = await supabase.from('factories').update({ level: newLevel, defense: getFactoryDefense(newLevel), slots: getMaxSlots(newLevel), last_interacted_at: new Date().toISOString() }).eq('x', x).eq('y', y);
  if (factoryError) throw new Error(factoryError.message);

  return { success: true, message: `Factory upgraded to Level ${newLevel}!\n\nCost: ${cost.metal.toLocaleString()} Metal + ${cost.energy.toLocaleString()} Energy + ${cost.rp} RP\nNew max slots: ${getMaxSlots(newLevel).toLocaleString()}`, newLevel };
}
