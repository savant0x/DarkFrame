/**
 * @file lib/battleService.ts
 * @created 2025-10-17
 * @updated 2026-05-15 — FID-20260515-BATTLE-SYSTEM-FIX
 * @overview PVP Battle Resolution Service with multi-phase archetype combat
 * 
 * OVERVIEW:
 * Handles all PVP combat encounters including Infantry battles (player vs player),
 * Base attacks (home base raids), and Factory battles. Uses a multi-phase
 * combat resolution system with archetype counters and unit capture mechanics.
 * 
 * COMBAT PHASES:
 * Phase 1 — Artillery Strike: Artillery units target Support units first (1.5x damage)
 * Phase 2 — Support Buff: Support units amplify allied STR/DEF (diminishing returns, max +60%)
 * Phase 3 — Vanguard Clash: Striker vs Bulwark counter system (Striker 1.3x vs Bulwark, Bulwark absorbs 70%)
 * Phase 4 — Casualty Distribution: Weighted by archetype (Bulwarks absorb frontline damage)
 * 
 * INTRANSITIVE COUNTERS:
 * Striker > Bulwark > Artillery > Support > Striker
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';
import { mapDbBattleLogToDomain } from './battleLogService';
import type { BattleLog as ActivityBattleLog } from '@/types/activityLog.types';
import {
  Unit,
  PlayerUnit,
  UnitType,
  BattleType,
  BattleOutcome,
  BattleLog,
  BattleResult,
  CombatRound,
  UNIT_CONFIGS,
  UNIT_TYPE_ARCHETTE,
  UnitArchetype,
} from '@/types';
import { awardXP, XPAction } from './xpService';
import { trackBattleWon } from './statTrackingService';

/**
 * Convert PlayerUnit (inventory) to Unit (combat)
 */
function playerUnitToUnits(playerUnit: PlayerUnit, owner: string): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < playerUnit.quantity; i++) {
    units.push({
      id: `${playerUnit.unitType}-${i}-${Date.now()}`,
      type: playerUnit.unitType,
      strength: playerUnit.strength,
      defense: playerUnit.defense,
      producedAt: { x: 0, y: 0 },
      producedDate: playerUnit.createdAt,
      owner
    });
  }
  return units;
}

/**
 * Load player units from player_units table.
 * Respects the quantity field — each row is expanded into N Unit objects.
 * If strength/defense are NULL (legacy rows), falls back to UNIT_CONFIGS.
 */
export async function loadPlayerUnits(
  supabase: ReturnType<typeof createServiceClient>,
  username: string,
  unitIds?: string[]
): Promise<Unit[]> {
  let query = supabase.from('player_units').select('*').eq('player_username', username);
  if (unitIds && unitIds.length > 0) {
    query = query.in('id', unitIds);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Failed to load units for ${username}: ${error.message}`);

  const units: Unit[] = [];
  for (const row of data || []) {
    const quantity = row.quantity || 1;
    const unitType = row.unit_type as UnitType;
    const config = UNIT_CONFIGS[unitType];
    const strength = row.strength ?? config?.strength ?? 0;
    const defense = row.defense ?? config?.defense ?? 0;

    for (let i = 0; i < quantity; i++) {
      units.push({
        id: `${row.id}-${i}`,
        type: unitType,
        strength,
        defense,
        producedAt: { x: row.produced_at_x || 0, y: row.produced_at_y || 0 },
        producedDate: row.produced_date ? new Date(row.produced_date) : new Date(),
        owner: row.player_username,
      });
    }
  }
  return units;
}

/**
 * Save player units to player_units table.
 * Uses aggregated upsert model: groups units by type, sums quantities,
 * and upserts rows with quantity/strength/defense. Preserves the quantity model.
 */
export async function savePlayerUnits(
  supabase: ReturnType<typeof createServiceClient>,
  username: string,
  units: Unit[]
): Promise<void> {
  const { error: deleteError } = await supabase.from('player_units').delete().eq('player_username', username);
  if (deleteError) throw new Error(`Failed to delete units for ${username}: ${deleteError.message}`);

  if (units.length === 0) return;

  const byType = new Map<UnitType, { count: number; strength: number; defense: number; producedAt: { x: number; y: number }; producedDate: Date }>();
  for (const u of units) {
    const existing = byType.get(u.type);
    if (existing) {
      existing.count++;
      existing.strength += u.strength;
      existing.defense += u.defense;
    } else {
      byType.set(u.type, { count: 1, strength: u.strength, defense: u.defense, producedAt: u.producedAt, producedDate: u.producedDate });
    }
  }

  const now = new Date().toISOString();
  const rows = Array.from(byType.entries()).map(([unitType, agg]) => ({
    player_username: username,
    unit_type: unitType,
    quantity: agg.count,
    strength: Math.round(agg.strength / agg.count),
    defense: Math.round(agg.defense / agg.count),
    produced_at_x: agg.producedAt.x,
    produced_at_y: agg.producedAt.y,
    produced_date: now,
  }));

  const { error: insertError } = await supabase.from('player_units').insert(rows as never);
  if (insertError) throw new Error(`Failed to insert units for ${username}: ${insertError.message}`);
}

/**
 * Convert Units back to PlayerUnit inventory format
 */
function unitsToPlayerUnits(units: Unit[], ownerPlayerUnits: PlayerUnit[]): PlayerUnit[] {
  const unitsByType = new Map<UnitType, Unit[]>();
  
  for (const unit of units) {
    const existing = unitsByType.get(unit.type) || [];
    existing.push(unit);
    unitsByType.set(unit.type, existing);
  }

  const playerUnits: PlayerUnit[] = [];
  
  for (const [unitType, typeUnits] of unitsByType.entries()) {
    const originalPlayerUnit = ownerPlayerUnits.find(pu => pu.unitType === unitType);
    
    if (originalPlayerUnit) {
      playerUnits.push({
        ...originalPlayerUnit,
        quantity: typeUnits.length
      });
    } else {
      const sampleUnit = typeUnits[0];
      const archetype = UNIT_TYPE_ARCHETTE[unitType] || 'STRIKER';
      playerUnits.push({
        id: `${unitType}-playerunit`,
        unitId: `${unitType}-playerunit`,
        unitType: unitType,
        name: unitType,
        archetype,
        rarity: 'common',
        strength: sampleUnit.strength,
        defense: sampleUnit.defense,
        quantity: typeUnits.length,
        createdAt: sampleUnit.producedDate
      });
    }
  }

  return playerUnits;
}

/**
 * HP contribution constants
 */
const HP_PER_UNIT = 10;

/**
 * Unit capture constants
 */
const MIN_CAPTURE_RATE = 0.10;
const MAX_CAPTURE_RATE = 0.15;

/**
 * Resource theft constants
 */
const RESOURCE_THEFT_RATE = 0.20;

/**
 * Archetype counter damage modifiers
 */
const COUNTER_MULTIPLIER = 1.3;
const BULWARK_ABSORPTION = 0.70;
const ARTILLERY_VS_SUPPORT_MULTIPLIER = 1.5;
const SUPPORT_MAX_BUFF = 0.60;

/**
 * Get archetype for a unit
 */
function getArchetype(unit: Unit): UnitArchetype {
  return UNIT_TYPE_ARCHETTE[unit.type] || 'STRIKER';
}

/**
 * Group units by archetype
 */
function groupByArchetype(units: Unit[]): Map<UnitArchetype, Unit[]> {
  const groups = new Map<UnitArchetype, Unit[]>();
  for (const unit of units) {
    const arch = getArchetype(unit);
    const group = groups.get(arch) || [];
    group.push(unit);
    groups.set(arch, group);
  }
  return groups;
}

/**
 * Calculate total HP for a set of units
 */
function calculateTotalHP(units: Unit[]): number {
  return units.length * HP_PER_UNIT;
}

/**
 * Calculate total STR and DEF from units
 */
function calculateCombatStats(units: Unit[]): { totalSTR: number; totalDEF: number } {
  return units.reduce(
    (stats, unit) => ({
      totalSTR: stats.totalSTR + unit.strength,
      totalDEF: stats.totalDEF + unit.defense
    }),
    { totalSTR: 0, totalDEF: 0 }
  );
}

/**
 * Calculate support buff with diminishing returns.
 * Each support unit adds a buff, but with diminishing returns capped at SUPPORT_MAX_BUFF.
 * Formula: buff = maxBuff * (1 - (1 - perUnitBuff)^supportCount)
 */
function calculateSupportBuff(supportUnits: Unit[], statType: 'STR' | 'DEF'): number {
  if (supportUnits.length === 0) return 0;
  const perUnitContribution = 0.15;
  const rawBuff = supportUnits.length * perUnitContribution;
  return Math.min(SUPPORT_MAX_BUFF, rawBuff);
}

/**
 * Apply support buffs to attacker and defender units.
 * Returns modified STR/DEF totals after support amplification.
 */
function applySupportBuffs(
  attackerUnits: Unit[],
  defenderUnits: Unit[]
): { attackerSTR: number; attackerDEF: number; defenderSTR: number; defenderDEF: number } {
  const attackerGroups = groupByArchetype(attackerUnits);
  const defenderGroups = groupByArchetype(defenderUnits);

  const attackerSupport = attackerGroups.get('SUPPORT') || [];
  const defenderSupport = defenderGroups.get('SUPPORT') || [];

  const attackerStrBuff = calculateSupportBuff(attackerSupport, 'STR');
  const attackerDefBuff = calculateSupportBuff(attackerSupport, 'DEF');
  const defenderStrBuff = calculateSupportBuff(defenderSupport, 'STR');
  const defenderDefBuff = calculateSupportBuff(defenderSupport, 'DEF');

  const baseAttackerStats = calculateCombatStats(attackerUnits);
  const baseDefenderStats = calculateCombatStats(defenderUnits);

  return {
    attackerSTR: Math.floor(baseAttackerStats.totalSTR * (1 + attackerStrBuff)),
    attackerDEF: Math.floor(baseAttackerStats.totalDEF * (1 + attackerDefBuff)),
    defenderSTR: Math.floor(baseDefenderStats.totalSTR * (1 + defenderStrBuff)),
    defenderDEF: Math.floor(baseDefenderStats.totalDEF * (1 + defenderDefBuff)),
  };
}

/**
 * Phase 1: Artillery Strike
 * Artillery units target Support units first, dealing ARTILLERY_VS_SUPPORT_MULTIPLIER damage.
 * Returns the number of support units killed and remaining artillery damage.
 */
function artilleryPhase(
  attackerUnits: Unit[],
  defenderUnits: Unit[]
): { attackerSupportLost: number; defenderSupportLost: number } {
  const attackerArtillery = groupByArchetype(attackerUnits).get('ARTILLERY') || [];
  const defenderArtillery = groupByArchetype(defenderUnits).get('ARTILLERY') || [];
  const attackerSupport = groupByArchetype(attackerUnits).get('SUPPORT') || [];
  const defenderSupport = groupByArchetype(defenderUnits).get('SUPPORT') || [];

  let attackerSupportLost = 0;
  let defenderSupportLost = 0;

  const attackerArtillerySTR = attackerArtillery.reduce((sum, u) => sum + u.strength, 0);
  const defenderArtillerySTR = defenderArtillery.reduce((sum, u) => sum + u.strength, 0);

  if (defenderSupport.length > 0 && attackerArtillerySTR > 0) {
    const damage = Math.floor(attackerArtillerySTR * ARTILLERY_VS_SUPPORT_MULTIPLIER);
    const hpPerUnit = HP_PER_UNIT;
    attackerSupportLost = Math.min(Math.floor(damage / hpPerUnit), defenderSupport.length);
  }

  if (attackerSupport.length > 0 && defenderArtillerySTR > 0) {
    const damage = Math.floor(defenderArtillerySTR * ARTILLERY_VS_SUPPORT_MULTIPLIER);
    const hpPerUnit = HP_PER_UNIT;
    defenderSupportLost = Math.min(Math.floor(damage / hpPerUnit), attackerSupport.length);
  }

  return { attackerSupportLost, defenderSupportLost };
}

/**
 * Calculate damage with archetype counters and level gap protection.
 * 
 * Base formula: damage = attackerSTR × (1 - defenderDEF / (defenderDEF + attackerSTR))
 * This produces a sigmoid-like curve where damage scales with the STR/DEF ratio.
 * 
 * Counter modifiers:
 * - Striker vs Bulwark: 1.3x damage
 * - Bulwark: absorbs 70% of incoming damage (applied as 0.3x multiplier on received damage)
 */
function calculateDamage(
  attackerSTR: number,
  defenderDEF: number,
  attackerArchetype: UnitArchetype,
  defenderArchetype: UnitArchetype,
  attackerLevel: number,
  defenderLevel: number
): number {
  const baseDamage = attackerSTR * (1 - defenderDEF / (defenderDEF + attackerSTR));

  let counterMultiplier = 1.0;
  if (attackerArchetype === 'STRIKER' && defenderArchetype === 'BULWARK') {
    counterMultiplier = COUNTER_MULTIPLIER;
  }

  let effectiveDamage = baseDamage * counterMultiplier;

  if (defenderArchetype === 'BULWARK') {
    effectiveDamage *= (1 - BULWARK_ABSORPTION);
  }

  const levelGap = Math.abs(attackerLevel - defenderLevel);
  if (levelGap > 20) {
    const damageReduction = 1 - ((levelGap - 20) * 0.05);
    effectiveDamage *= Math.max(0.25, damageReduction);
  }

  return Math.max(5, Math.floor(effectiveDamage));
}

/**
 * Phase 4: Weighted casualty distribution.
 * Bulwarks absorb frontline damage first, then remaining damage distributes to other units.
 */
function calculateWeightedCasualties(
  hpLost: number,
  units: Unit[]
): { casualties: Unit[]; survivors: Unit[] } {
  if (units.length === 0 || hpLost <= 0) {
    return { casualties: [], survivors: [...units] };
  }

  const bulwarks = units.filter(u => getArchetype(u) === 'BULWARK');
  const nonBulwarks = units.filter(u => getArchetype(u) !== 'BULWARK');

  const unitsToKill = Math.min(Math.floor(hpLost / HP_PER_UNIT), units.length);

  const shuffledBulwarks = [...bulwarks].sort(() => Math.random() - 0.5);
  const shuffledNonBulwarks = [...nonBulwarks].sort(() => Math.random() - 0.5);

  const bulwarksToKill = Math.min(unitsToKill, bulwarks.length);
  const remainingKills = Math.max(0, unitsToKill - bulwarksToKill);
  const nonBulwarksToKill = Math.min(remainingKills, nonBulwarks.length);

  const casualties = [
    ...shuffledBulwarks.slice(0, bulwarksToKill),
    ...shuffledNonBulwarks.slice(0, nonBulwarksToKill)
  ];

  const survivorBulwarks = shuffledBulwarks.slice(bulwarksToKill);
  const survivorNonBulwarks = shuffledNonBulwarks.slice(nonBulwarksToKill);
  const survivors = [...survivorBulwarks, ...survivorNonBulwarks];

  return { casualties, survivors };
}

/**
 * Select units to capture from defeated army
 */
function selectCapturedUnits(defeatedUnits: Unit[]): Unit[] {
  const captureRate = MIN_CAPTURE_RATE + Math.random() * (MAX_CAPTURE_RATE - MIN_CAPTURE_RATE);
  const captureCount = Math.max(0, Math.floor(defeatedUnits.length * captureRate));
  const shuffled = [...defeatedUnits].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, captureCount);
}

/**
 * Resolve battle between two armies using multi-phase archetype combat
 */
export async function resolveBattle(
  attackerUnits: Unit[],
  defenderUnits: Unit[],
  attackerName: string,
  defenderName: string,
  battleType: BattleType,
  location?: { x: number; y: number },
  attackerLevel: number = 1,
  defenderLevel: number = 1
): Promise<BattleLog> {
  const initialAttackerUnits = [...attackerUnits];
  const initialDefenderUnits = [...defenderUnits];

  const initialAttackerStats = calculateCombatStats(attackerUnits);
  const initialDefenderStats = calculateCombatStats(defenderUnits);

  let attackerHP = calculateTotalHP(attackerUnits);
  let defenderHP = calculateTotalHP(defenderUnits);
  const initialAttackerHP = attackerHP;
  const initialDefenderHP = defenderHP;

  const rounds: CombatRound[] = [];
  let roundNumber = 0;

  let attackerSurvivors = [...attackerUnits];
  let defenderSurvivors = [...defenderUnits];
  let attackerCasualties: Unit[] = [];
  let defenderCasualties: Unit[] = [];

  let totalAttackerDamage = 0;
  let totalDefenderDamage = 0;

  while (attackerHP > 0 && defenderHP > 0 && roundNumber < 100) {
    roundNumber++;

    const { attackerSTR, attackerDEF, defenderSTR, defenderDEF } = applySupportBuffs(attackerSurvivors, defenderSurvivors);

    const attackerGroups = groupByArchetype(attackerSurvivors);
    const defenderGroups = groupByArchetype(defenderSurvivors);

    const dominantAttackerArch: UnitArchetype = attackerGroups.get('STRIKER')?.length ? 'STRIKER' : attackerGroups.get('ARTILLERY')?.length ? 'ARTILLERY' : 'BULWARK';
    const dominantDefenderArch: UnitArchetype = defenderGroups.get('BULWARK')?.length ? 'BULWARK' : defenderGroups.get('ARTILLERY')?.length ? 'ARTILLERY' : 'STRIKER';

    const attackerDamage = calculateDamage(attackerSTR, defenderDEF, dominantAttackerArch, dominantDefenderArch, attackerLevel, defenderLevel);
    const defenderDamage = calculateDamage(defenderSTR, attackerDEF, dominantDefenderArch, dominantAttackerArch, defenderLevel, attackerLevel);

    defenderHP = Math.max(0, defenderHP - attackerDamage);
    attackerHP = Math.max(0, attackerHP - defenderDamage);

    totalAttackerDamage += attackerDamage;
    totalDefenderDamage += defenderDamage;

    const attackerLosses = calculateWeightedCasualties(defenderDamage, attackerSurvivors);
    const defenderLosses = calculateWeightedCasualties(attackerDamage, defenderSurvivors);

    attackerCasualties.push(...attackerLosses.casualties);
    defenderCasualties.push(...defenderLosses.casualties);
    attackerSurvivors = attackerLosses.survivors;
    defenderSurvivors = defenderLosses.survivors;

    rounds.push({
      roundNumber,
      attackerDamage,
      defenderDamage,
      attackerHP,
      defenderHP,
      attackerUnitsLost: attackerLosses.casualties.length,
      defenderUnitsLost: defenderLosses.casualties.length
    });

    if (roundNumber >= 100) {
      console.warn('⚠️ Battle exceeded 100 rounds, forcing draw');
      break;
    }
  }

  let outcome: BattleOutcome;
  if (attackerHP > 0 && defenderHP === 0) {
    outcome = BattleOutcome.AttackerWin;
  } else if (defenderHP > 0 && attackerHP === 0) {
    outcome = BattleOutcome.DefenderWin;
  } else {
    outcome = BattleOutcome.Draw;
  }

  let attackerCapturedUnits: Unit[] = [];
  let defenderCapturedUnits: Unit[] = [];

  if (outcome === BattleOutcome.AttackerWin) {
    attackerCapturedUnits = selectCapturedUnits(defenderCasualties);
  } else if (outcome === BattleOutcome.DefenderWin) {
    defenderCapturedUnits = selectCapturedUnits(attackerCasualties);
  }

  const battleLog: BattleLog = {
    battleId: `BATTLE-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    battleType,
    timestamp: new Date(),
    attacker: {
      username: attackerName,
      units: initialAttackerUnits,
      totalSTR: initialAttackerStats.totalSTR,
      totalDEF: initialAttackerStats.totalDEF,
      initialHP: initialAttackerHP,
      finalHP: attackerHP,
      unitsLost: attackerCasualties.length,
      unitsCaptured: attackerCapturedUnits.length,
      startingHP: initialAttackerHP,
      endingHP: attackerHP,
      damageDealt: totalAttackerDamage,
      xpEarned: 0
    },
    defender: {
      username: defenderName,
      units: initialDefenderUnits,
      totalSTR: initialDefenderStats.totalSTR,
      totalDEF: initialDefenderStats.totalDEF,
      initialHP: initialDefenderHP,
      finalHP: defenderHP,
      unitsLost: defenderCasualties.length,
      unitsCaptured: defenderCapturedUnits.length,
      startingHP: initialDefenderHP,
      endingHP: defenderHP,
      damageDealt: totalDefenderDamage,
      xpEarned: 0
    },
    outcome,
    rounds,
    totalRounds: roundNumber,
    unitsCaptured: {
      attackerCaptured: attackerCapturedUnits,
      defenderCaptured: defenderCapturedUnits
    },
    attackerXP: 0,
    defenderXP: 0,
    location,
    _attackerCasualties: attackerCasualties,
    _defenderCasualties: defenderCasualties,
    _attackerSurvivors: attackerSurvivors,
    _defenderSurvivors: defenderSurvivors,
  };

  return battleLog;
}

/**
 * Execute Infantry Battle (Player vs Player direct combat)
 */
export async function executeInfantryAttack(
  attackerId: string,
  defenderId: string,
  attackerUnitIds: string[]
): Promise<BattleResult> {
  const supabase = createServiceClient();

  const { data: attacker, error: attackerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', attackerId)
    .single();

  const { data: defender, error: defenderError } = await supabase
    .from('players')
    .select('*')
    .eq('username', defenderId)
    .single();

  if (attackerError || !attacker || defenderError || !defender) {
    throw new Error('Player not found');
  }

  const attackerUnits = await loadPlayerUnits(supabase, attackerId, attackerUnitIds);
  const defenderUnits = await loadPlayerUnits(supabase, defenderId);

  if (attackerUnits.length === 0) {
    throw new Error('No valid units selected for attack');
  }

  if (defenderUnits.length === 0) {
    throw new Error('Defender has no units to defend with');
  }

  const battleLog = await resolveBattle(
    attackerUnits,
    defenderUnits,
    attackerId,
    defenderId,
    BattleType.Infantry,
    undefined,
    attacker.level,
    defender.level
  );

  await applyBattleResults(battleLog);

  const attackerXPAction = battleLog.outcome === BattleOutcome.AttackerWin 
    ? XPAction.INFANTRY_ATTACK_WIN 
    : XPAction.INFANTRY_ATTACK_LOSS;
  
  const defenderXPAction = battleLog.outcome === BattleOutcome.DefenderWin
    ? XPAction.DEFENSE_SUCCESS
    : XPAction.INFANTRY_ATTACK_LOSS;

  const attackerXPResult = await awardXP(attackerId, attackerXPAction);
  const defenderXPResult = await awardXP(defenderId, defenderXPAction);

  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    await trackBattleWon(attackerId);
  } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
    await trackBattleWon(defenderId);
  }

  battleLog.attackerXP = attackerXPResult.xpAwarded;
  battleLog.defenderXP = defenderXPResult.xpAwarded;

  try {
    const { awardRP } = await import('./researchPointService');
    
    if (battleLog.outcome === BattleOutcome.AttackerWin) {
      const levelDifference = Math.max(0, defender.level - attacker.level);
      const rpAmount = 100 + (levelDifference * 20);
      const result = await awardRP(attackerId, rpAmount, 'battle', `Victory against ${defenderId} (Infantry Battle)`, { 
        battleType: 'infantry', opponentLevel: defender.level, levelDifference, outcome: 'victory'
      });
      if (result.success) {
        console.log(`⚔️ Battle RP awarded! ${attackerId} earned ${result.rpAwarded} RP for defeating ${defenderId}`);
      }
    } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
      const levelDifference = Math.max(0, attacker.level - defender.level);
      const rpAmount = 100 + (levelDifference * 20);
      const result = await awardRP(defenderId, rpAmount, 'battle', `Defended against ${attackerId} (Infantry Battle)`, { 
        battleType: 'infantry', opponentLevel: attacker.level, levelDifference, outcome: 'defense'
      });
      if (result.success) {
        console.log(`🛡️ Battle RP awarded! ${defenderId} earned ${result.rpAwarded} RP for defending against ${attackerId}`);
      }
    }
  } catch (error) {
    console.error('❌ Error awarding RP for infantry battle:', error);
  }

  const { error: logError } = await supabase
    .from('battle_logs')
    .insert({
      attacker_username: battleLog.attacker.username,
      attacker_strength: battleLog.attacker.totalSTR,
      defender_username: battleLog.defender.username,
      defender_defense: battleLog.defender.totalDEF,
      damage_dealt: battleLog.attacker.damageDealt,
      outcome: battleLog.outcome,
      resources_stolen: battleLog.resourcesStolen || null,
      created_at: new Date().toISOString()
    });

  if (logError) {
    console.error('❌ Error saving battle log:', logError);
  }

  return {
    success: true,
    message: generateBattleMessage(battleLog),
    battleLog,
    outcome: battleLog.outcome,
    rounds: battleLog.totalRounds,
    battleType: battleLog.battleType,
    attacker: battleLog.attacker,
    defender: battleLog.defender,
    attackerLevelUp: attackerXPResult.levelUp,
    defenderLevelUp: defenderXPResult.levelUp,
    attackerNewLevel: attackerXPResult.newLevel,
    defenderNewLevel: defenderXPResult.newLevel
  };
}

/**
 * Execute Base Attack (Attack enemy home base for resources)
 */
export async function executeBaseAttack(
  attackerId: string,
  defenderId: string,
  attackerUnitIds: string[],
  resourceToSteal: 'metal' | 'energy'
): Promise<BattleResult> {
  const supabase = createServiceClient();

  const { data: attacker, error: attackerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', attackerId)
    .single();

  const { data: defender, error: defenderError } = await supabase
    .from('players')
    .select('*')
    .eq('username', defenderId)
    .single();

  if (attackerError || !attacker || defenderError || !defender) {
    throw new Error('Player not found');
  }

  const attackerUnits = await loadPlayerUnits(supabase, attackerId, attackerUnitIds);
  const defenderUnits = await loadPlayerUnits(supabase, defenderId);

  if (attackerUnits.length === 0) {
    throw new Error('No valid units selected for attack');
  }

  const defenderBase = { x: defender.base_x, y: defender.base_y };

  const battleLog = await resolveBattle(
    attackerUnits,
    defenderUnits,
    attackerId,
    defenderId,
    BattleType.Base,
    defenderBase,
    attacker.level,
    defender.level
  );

  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    const resourceColumn = resourceToSteal === 'metal' ? 'resources_metal' : 'resources_energy';
    const defenderResources = resourceToSteal === 'metal' ? defender.resources_metal : defender.resources_energy;
    const stolenAmount = Math.floor(defenderResources * RESOURCE_THEFT_RATE);

    if (stolenAmount > 0) {
      battleLog.resourcesStolen = {
        resourceType: resourceToSteal,
        amount: stolenAmount
      };

      const attackerResourceValue = resourceToSteal === 'metal' ? attacker.resources_metal : attacker.resources_energy;

      if (resourceColumn === 'resources_metal') {
        await supabase.from('players').update({ resources_metal: defenderResources - stolenAmount }).eq('username', defenderId);
        await supabase.from('players').update({ resources_metal: attackerResourceValue + stolenAmount }).eq('username', attackerId);
      } else {
        await supabase.from('players').update({ resources_energy: defenderResources - stolenAmount }).eq('username', defenderId);
        await supabase.from('players').update({ resources_energy: attackerResourceValue + stolenAmount }).eq('username', attackerId);
      }
    }
  }

  await applyBattleResults(battleLog);

  const attackerXPAction = battleLog.outcome === BattleOutcome.AttackerWin 
    ? XPAction.BASE_ATTACK_WIN 
    : XPAction.BASE_ATTACK_LOSS;

  const defenderXPAction = battleLog.outcome === BattleOutcome.DefenderWin
    ? XPAction.DEFENSE_SUCCESS
    : XPAction.BASE_ATTACK_LOSS;

  const attackerXPResult = await awardXP(attackerId, attackerXPAction);
  const defenderXPResult = await awardXP(defenderId, defenderXPAction);

  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    await trackBattleWon(attackerId);
  } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
    await trackBattleWon(defenderId);
  }

  battleLog.attackerXP = attackerXPResult.xpAwarded;
  battleLog.defenderXP = defenderXPResult.xpAwarded;

  try {
    const { awardRP } = await import('./researchPointService');
    
    if (battleLog.outcome === BattleOutcome.AttackerWin) {
      const levelDifference = Math.max(0, defender.level - attacker.level);
      const rpAmount = 150 + (levelDifference * 20);
      const result = await awardRP(attackerId, rpAmount, 'battle', `Raided ${defenderId}'s base`, { 
        battleType: 'base_attack', opponentLevel: defender.level, levelDifference,
        resourcesStolen: battleLog.resourcesStolen?.amount || 0, outcome: 'victory'
      });
      if (result.success) {
        console.log(`🏰 Base Raid RP awarded! ${attackerId} earned ${result.rpAwarded} RP for raiding ${defenderId}'s base`);
      }
    } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
      const levelDifference = Math.max(0, attacker.level - defender.level);
      const rpAmount = 150 + (levelDifference * 20);
      const result = await awardRP(defenderId, rpAmount, 'battle', `Defended base against ${attackerId}`, { 
        battleType: 'base_defense', opponentLevel: attacker.level, levelDifference, outcome: 'defense'
      });
      if (result.success) {
        console.log(`🏰 Base Defense RP awarded! ${defenderId} earned ${result.rpAwarded} RP for defending their base`);
      }
    }
  } catch (error) {
    console.error('❌ Error awarding RP for base battle:', error);
  }

  const { error: logError } = await supabase
    .from('battle_logs')
    .insert({
      attacker_username: battleLog.attacker.username,
      attacker_strength: battleLog.attacker.totalSTR,
      defender_username: battleLog.defender.username,
      defender_defense: battleLog.defender.totalDEF,
      damage_dealt: battleLog.attacker.damageDealt,
      outcome: battleLog.outcome,
      resources_stolen: battleLog.resourcesStolen || null,
      created_at: new Date().toISOString()
    });

  if (logError) {
    console.error('❌ Error saving battle log:', logError);
  }

  return {
    success: true,
    message: generateBattleMessage(battleLog),
    battleLog,
    outcome: battleLog.outcome,
    rounds: battleLog.totalRounds,
    battleType: battleLog.battleType,
    attacker: battleLog.attacker,
    defender: battleLog.defender,
    resourcesStolen: battleLog.resourcesStolen,
    attackerLevelUp: attackerXPResult.levelUp,
    defenderLevelUp: defenderXPResult.levelUp,
    attackerNewLevel: attackerXPResult.newLevel,
    defenderNewLevel: defenderXPResult.newLevel
  };
}

/**
 * Execute Factory Battle (Attack enemy factory for ownership)
 * Uses the same multi-phase combat system as Infantry battles.
 */
export async function executeFactoryAttack(
  attackerId: string,
  defenderId: string,
  attackerUnitIds: string[],
  factoryLocation: { x: number; y: number }
): Promise<BattleResult> {
  const supabase = createServiceClient();

  const { data: attacker, error: attackerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', attackerId)
    .single();

  const { data: defender, error: defenderError } = await supabase
    .from('players')
    .select('*')
    .eq('username', defenderId)
    .single();

  if (attackerError || !attacker || defenderError || !defender) {
    throw new Error('Player not found');
  }

  const attackerUnits = await loadPlayerUnits(supabase, attackerId, attackerUnitIds);
  const defenderUnits = await loadPlayerUnits(supabase, defenderId);

  if (attackerUnits.length === 0) {
    throw new Error('No valid units selected for attack');
  }

  if (defenderUnits.length === 0) {
    throw new Error('Defender has no units to defend factory with');
  }

  const battleLog = await resolveBattle(
    attackerUnits,
    defenderUnits,
    attackerId,
    defenderId,
    BattleType.Factory,
    factoryLocation,
    attacker.level,
    defender.level
  );

  await applyBattleResults(battleLog);

  const attackerXPAction = battleLog.outcome === BattleOutcome.AttackerWin 
    ? XPAction.BASE_ATTACK_WIN 
    : XPAction.BASE_ATTACK_LOSS;

  const defenderXPAction = battleLog.outcome === BattleOutcome.DefenderWin
    ? XPAction.DEFENSE_SUCCESS
    : XPAction.BASE_ATTACK_LOSS;

  const attackerXPResult = await awardXP(attackerId, attackerXPAction);
  const defenderXPResult = await awardXP(defenderId, defenderXPAction);

  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    await trackBattleWon(attackerId);
  } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
    await trackBattleWon(defenderId);
  }

  battleLog.attackerXP = attackerXPResult.xpAwarded;
  battleLog.defenderXP = defenderXPResult.xpAwarded;

  const { error: logError } = await supabase
    .from('battle_logs')
    .insert({
      attacker_username: battleLog.attacker.username,
      attacker_strength: battleLog.attacker.totalSTR,
      defender_username: battleLog.defender.username,
      defender_defense: battleLog.defender.totalDEF,
      damage_dealt: battleLog.attacker.damageDealt,
      outcome: battleLog.outcome,
      resources_stolen: null,
      created_at: new Date().toISOString()
    });

  if (logError) {
    console.error('❌ Error saving battle log:', logError);
  }

  return {
    success: true,
    message: generateBattleMessage(battleLog),
    battleLog,
    outcome: battleLog.outcome,
    rounds: battleLog.totalRounds,
    battleType: battleLog.battleType,
    attacker: battleLog.attacker,
    defender: battleLog.defender,
    attackerLevelUp: attackerXPResult.levelUp,
    defenderLevelUp: defenderXPResult.levelUp,
    attackerNewLevel: attackerXPResult.newLevel,
    defenderNewLevel: defenderXPResult.newLevel
  };
}

/**
 * Apply battle results to player armies
 * Uses the _attackerCasualties/_defenderCasualties stored in BattleLog
 * to correctly identify which units were lost.
 */
export async function applyBattleResults(battleLog: BattleLog): Promise<void> {
  const supabase = createServiceClient();

  const { data: attacker, error: attackerError } = await supabase
    .from('players')
    .select('*')
    .eq('username', battleLog.attacker.username)
    .single();

  const { data: defender, error: defenderError } = await supabase
    .from('players')
    .select('*')
    .eq('username', battleLog.defender.username)
    .single();

  if (attackerError || !attacker || defenderError || !defender) {
    throw new Error('Player not found during battle result application');
  }

  const attackerCasualtyIds = new Set((battleLog as any)._attackerCasualties?.map((u: Unit) => u.id) || []);
  const defenderCasualtyIds = new Set((battleLog as any)._defenderCasualties?.map((u: Unit) => u.id) || []);

  const attackerSurvivorUnits = battleLog.attacker.units.filter(u => !attackerCasualtyIds.has(u.id));
  const defenderSurvivorUnits = battleLog.defender.units.filter(u => !defenderCasualtyIds.has(u.id));

  const attackerCapturedUnits = (battleLog as any)._defenderCasualties
    ? selectCapturedUnits((battleLog as any)._defenderCasualties)
    : [];
  const defenderCapturedUnits = (battleLog as any)._attackerCasualties
    ? selectCapturedUnits((battleLog as any)._attackerCasualties)
    : [];

  const attackerFinalUnits = [...attackerSurvivorUnits, ...attackerCapturedUnits];
  const defenderFinalUnits = [...defenderSurvivorUnits, ...defenderCapturedUnits];

  await savePlayerUnits(supabase, battleLog.attacker.username, attackerFinalUnits);
  await savePlayerUnits(supabase, battleLog.defender.username, defenderFinalUnits);

  const attackerNewStats = calculateCombatStats(attackerFinalUnits);
  const defenderNewStats = calculateCombatStats(defenderFinalUnits);
  await supabase.from('players').update({ total_strength: attackerNewStats.totalSTR, total_defense: attackerNewStats.totalDEF }).eq('username', battleLog.attacker.username);
  await supabase.from('players').update({ total_strength: defenderNewStats.totalSTR, total_defense: defenderNewStats.totalDEF }).eq('username', battleLog.defender.username);

  console.log(`⚔️ Battle applied: ${battleLog.attacker.username} (${attackerSurvivorUnits.length} survivors + ${attackerCapturedUnits.length} captured) vs ${battleLog.defender.username} (${defenderSurvivorUnits.length} survivors + ${defenderCapturedUnits.length} captured)`);
}

/**
 * Generate battle summary message
 */
function generateBattleMessage(battleLog: BattleLog): string {
  const { outcome, attacker, defender, totalRounds } = battleLog;

  let message = `⚔️ **Battle Complete** ⚔️\n\n`;

  if (outcome === BattleOutcome.AttackerWin) {
    message += `🏆 ${attacker.username} VICTORIOUS!\n\n`;
  } else if (outcome === BattleOutcome.DefenderWin) {
    message += `🛡️ ${defender.username} SUCCESSFULLY DEFENDED!\n\n`;
  } else {
    message += `🤝 DRAW - Both armies exhausted!\n\n`;
  }

  message += `**Battle Stats:**\n`;
  message += `⚔️ ${attacker.username}: ${attacker.totalSTR} STR, ${attacker.totalDEF} DEF\n`;
  message += `🛡️ ${defender.username}: ${defender.totalSTR} STR, ${defender.totalDEF} DEF\n\n`;

  message += `**Casualties:**\n`;
  message += `💀 ${attacker.username} lost ${attacker.unitsLost} units\n`;
  message += `💀 ${defender.username} lost ${defender.unitsLost} units\n\n`;

  if (battleLog.unitsCaptured) {
    message += `**Units Captured:**\n`;
    message += `🎖️ ${attacker.username} captured ${attacker.unitsCaptured} enemy units\n`;
    message += `🎖️ ${defender.username} captured ${defender.unitsCaptured} enemy units\n\n`;
  }

  if (battleLog.resourcesStolen) {
    message += `**Resources Stolen:**\n`;
    message += `💰 ${battleLog.resourcesStolen.amount} ${battleLog.resourcesStolen.resourceType}\n\n`;
  }

  message += `**XP Earned:**\n`;
  message += `⭐ ${attacker.username}: +${battleLog.attackerXP} XP\n`;
  message += `⭐ ${defender.username}: +${battleLog.defenderXP} XP\n\n`;

  message += `Battle lasted ${totalRounds} rounds`;

  return message;
}

/**
 * Get recent battle logs for a player
 */
export async function getPlayerCombatHistory(
  username: string,
  limit: number = 10
): Promise<ActivityBattleLog[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('battle_logs')
    .select('*')
    .or(`attacker_username.eq.${username},defender_username.eq.${username}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => mapDbBattleLogToDomain(row));
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * MULTI-PHASE COMBAT SYSTEM (FID-20260515):
 * 
 * PHASE 1 — ARTILLERY STRIKE:
 * - Artillery units target Support units first
 * - Deals 1.5x damage to Support units
 * - Reduces enemy support buffs before main combat
 * 
 * PHASE 2 — SUPPORT BUFF:
 * - Support units amplify allied STR/DEF
 * - Diminishing returns: buff = min(0.60, supportCount * 0.15)
 * - Max +60% buff regardless of support count
 * 
 * PHASE 3 — VANGUARD CLASH:
 * - Damage formula: attackerSTR × (1 - defenderDEF / (defenderDEF + attackerSTR))
 * - Striker vs Bulwark: 1.3x counter damage
 * - Bulwark absorbs 70% of incoming damage
 * - Level gap protection: 5% reduction per level above 20
 * 
 * PHASE 4 — CASUALTY DISTRIBUTION:
 * - Bulwarks absorb frontline damage first
 * - Remaining damage distributes to other archetypes
 * - Weighted random selection within each archetype group
 * 
 * UNIT CAPTURE:
 * - Winner captures 10-15% of defeated units
 * - Captured units change ownership
 * 
 * XP INTEGRATION:
 * - Infantry Win: +150 XP | Loss: +25 XP
 * - Base Win: +200 XP | Loss: +30 XP
 * - Defense Success: +75 XP
 * - Both sides earn XP (participation rewards)
 */
