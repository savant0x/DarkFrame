/**
 * @file lib/battleService.ts
 * @created 2025-10-17
 * @overview PVP Battle Resolution Service with HP-based combat
 * 
 * OVERVIEW:
 * Handles all PVP combat encounters including Infantry battles (player vs player),
 * Base attacks (home base raids), and enhanced Factory battles. Uses HP-based
 * combat resolution with unit capture mechanics and resource theft.
 * 
 * COMBAT MECHANICS:
 * - Each unit contributes to total HP pool (STR units = 10 HP each, DEF units = 15 HP each)
 * - Damage dealt per round = (AttackerSTR - DefenderDEF/2) for attacker
 * - Damage dealt per round = (DefenderDEF - AttackerSTR/2) for defender
 * - Battle continues until one side reaches 0 HP
 * - HP loss translates to unit casualties (distributed across unit types)
 * - Winners capture 10-15% of defeated enemy units
 * - Base attacks allow 20% resource theft (capped)
 */

import { db } from '@/lib/db';
import { players, battleLogs } from '@/lib/db/schema';
import { eq, or, desc } from 'drizzle-orm';
import {
  Player,
  Unit,
  PlayerUnit,
  UnitType,
  BattleType,
  BattleOutcome,
  BattleLog,
  BattleResult,

  CombatRound
} from '@/types';
import { awardXP, XPAction } from './xpService';
import { trackBattleWon } from './statTrackingService';

/**
 * Convert PlayerUnit (inventory) to Unit (combat)
 * Expands quantity into individual Unit objects for battle resolution
 * Each unit gets a unique ID based on its type and index
 * 
 * @param playerUnit - Player inventory unit
 * @param owner - Owner username
 * @returns Array of Unit objects for combat
 */
function playerUnitToUnits(playerUnit: PlayerUnit, owner: string): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < playerUnit.quantity; i++) {
    units.push({
      id: `${playerUnit.unitType}-${i}`, // Type-based ID for tracking
      type: playerUnit.unitType,
      strength: playerUnit.strength,
      defense: playerUnit.defense,
      producedAt: { x: 0, y: 0 }, // Placeholder - not relevant for infantry battles
      producedDate: playerUnit.createdAt,
      owner
    });
  }
  return units;
}

/**
 * Convert Units back to PlayerUnit inventory format
 * Collapses individual Unit objects back into quantity-based PlayerUnits
 * Groups by unitType and aggregates quantities
 * 
 * @param units - Array of Unit objects from battle
 * @param ownerPlayerUnits - Original PlayerUnit array for metadata (name, category, rarity, etc.)
 * @returns Array of PlayerUnit objects with updated quantities
 */
function unitsToPlayerUnits(units: Unit[], ownerPlayerUnits: PlayerUnit[]): PlayerUnit[] {
  // Group units by type and count quantities
  const unitsByType = new Map<UnitType, Unit[]>();
  
  for (const unit of units) {
    const existing = unitsByType.get(unit.type) || [];
    existing.push(unit);
    unitsByType.set(unit.type, existing);
  }

  // Convert back to PlayerUnit format, preserving metadata from original PlayerUnits
  const playerUnits: PlayerUnit[] = [];
  
  for (const [unitType, typeUnits] of unitsByType.entries()) {
    // Find original PlayerUnit to get metadata
    const originalPlayerUnit = ownerPlayerUnits.find(pu => pu.unitType === unitType);
    
    if (originalPlayerUnit) {
      // Update existing PlayerUnit with new quantity
      playerUnits.push({
        ...originalPlayerUnit,
        quantity: typeUnits.length
      });
    } else {
      // New unit type (captured from enemy) - create new PlayerUnit
      const sampleUnit = typeUnits[0];
      playerUnits.push({
        id: `${unitType}-playerunit`,
        unitId: `${unitType}-playerunit`,
        unitType: unitType,
        name: unitType, // TODO: Look up proper name from UNIT_CONFIGS
        category: sampleUnit.strength > sampleUnit.defense ? 'STR' : 'DEF',
        rarity: 'common', // TODO: Look up proper rarity from UNIT_CONFIGS
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
const HP_PER_STR_UNIT = 10;  // Offensive units are glass cannons
const HP_PER_DEF_UNIT = 15;  // Defensive units have more HP

/**
 * Unit capture constants
 */
const MIN_CAPTURE_RATE = 0.10; // Minimum 10% of defeated units
const MAX_CAPTURE_RATE = 0.15; // Maximum 15% of defeated units

/**
 * Resource theft constants
 */
const RESOURCE_THEFT_RATE = 0.20; // 20% of defender's resources (capped)

/**
 * Calculate total HP for a set of units
 * STR units: 10 HP each
 * DEF units: 15 HP each
 */
function calculateTotalHP(units: Unit[]): number {
  return units.reduce((total, unit) => {
    const hpValue = unit.strength > 0 ? HP_PER_STR_UNIT : HP_PER_DEF_UNIT;
    return total + hpValue;
  }, 0);
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
 * Calculate damage dealt per round with level gap protection
 * Attacker damage = max(5, AttackerSTR - DefenderDEF/2)
 * Defender damage = max(5, DefenderDEF - AttackerSTR/2)
 * 
 * LEVEL GAP PROTECTION:
 * - If level difference > 20, damage is capped with progressive reduction
 * - Reduction: 5% per level above 20 (e.g., 30-level gap = 50% damage)
 * - Minimum damage: 25% of calculated damage (prevents complete immunity)
 * - Preserves fairness for high-level vs. low-level matchups
 * 
 * @param attackerSTR - Attacker's total strength
 * @param defenderDEF - Defender's total defense
 * @param attackerLevel - Attacker's player level (for gap protection)
 * @param defenderLevel - Defender's player level (for gap protection)
 * @returns Damage per round (minimum 5)
 */
function calculateDamage(
  attackerSTR: number,
  defenderDEF: number,
  attackerLevel: number,
  defenderLevel: number
): number {
  const baseDamage = attackerSTR - defenderDEF / 2;
  const levelGap = Math.abs(attackerLevel - defenderLevel);
  
  // Apply level gap protection if gap > 20 levels
  if (levelGap > 20) {
    const damageReduction = 1 - ((levelGap - 20) * 0.05); // -5% per level above 20
    const cappedDamage = baseDamage * Math.max(0.25, damageReduction); // Min 25% damage
    return Math.max(5, Math.floor(cappedDamage));
  }
  
  return Math.max(5, Math.floor(baseDamage)); // Minimum 5 damage per round
}

/**
 * Convert HP loss to unit casualties
 * Distributes damage across units proportionally
 */
function calculateUnitLosses(hpLost: number, units: Unit[]): { casualties: Unit[]; survivors: Unit[] } {
  const avgHPPerUnit = units.length > 0 ? calculateTotalHP(units) / units.length : 0;
  const unitsToKill = Math.min(Math.floor(hpLost / avgHPPerUnit), units.length);

  // Randomly select units to kill (simulate battle chaos)
  const shuffled = [...units].sort(() => Math.random() - 0.5);
  const casualties = shuffled.slice(0, unitsToKill);
  const survivors = shuffled.slice(unitsToKill);

  return { casualties, survivors };
}

/**
 * Select units to capture from defeated army
 * Captures 10-15% of defeated units randomly
 */
function selectCapturedUnits(defeatedUnits: Unit[]): Unit[] {
  const captureRate = MIN_CAPTURE_RATE + Math.random() * (MAX_CAPTURE_RATE - MIN_CAPTURE_RATE);
  const captureCount = Math.floor(defeatedUnits.length * captureRate);

  // Randomly select units to capture
  const shuffled = [...defeatedUnits].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, captureCount);
}

/**
 * Resolve battle between two armies using HP-based combat
 * 
 * @param attackerUnits - Attacker's units
 * @param defenderUnits - Defender's units
 * @param attackerName - Attacker username
 * @param defenderName - Defender username
 * @param battleType - Type of battle (Infantry/Base/Factory)
 * @param location - Battle location (optional)
 * @param attackerLevel - Attacker's player level (for level gap protection)
 * @param defenderLevel - Defender's player level (for level gap protection)
 * @returns Complete battle result with logs
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
  // Calculate initial combat stats
  const attackerStats = calculateCombatStats(attackerUnits);
  const defenderStats = calculateCombatStats(defenderUnits);

  // FID-20260906-001 §5.4: Flag bearer fights at +25% unit STR/DEF (doc bonus
  // stack). Applied here — the single combat-resolution seam — so every battle
  // type (infantry, base, factory) respects the bearer advantage without
  // persisting inflated stats to players.totalStrength/totalDefense.
  try {
    const { getBonusStack } = await import('@/lib/flagBonusService');
    const [attackerFlag, defenderFlag] = await Promise.all([
      getBonusStack(attackerName),
      getBonusStack(defenderName),
    ]);
    if (attackerFlag.isBearer) {
      attackerStats.totalSTR = Math.floor(attackerStats.totalSTR * attackerFlag.unitStrengthMultiplier);
      attackerStats.totalDEF = Math.floor(attackerStats.totalDEF * attackerFlag.unitDefenseMultiplier);
    }
    if (defenderFlag.isBearer) {
      defenderStats.totalSTR = Math.floor(defenderStats.totalSTR * defenderFlag.unitStrengthMultiplier);
      defenderStats.totalDEF = Math.floor(defenderStats.totalDEF * defenderFlag.unitDefenseMultiplier);
    }
  } catch {
    // Never fail battle resolution because of the flag check.
  }

  let attackerHP = calculateTotalHP(attackerUnits);
  let defenderHP = calculateTotalHP(defenderUnits);

  const initialAttackerHP = attackerHP;
  const initialDefenderHP = defenderHP;

  // Combat rounds
  const rounds: CombatRound[] = [];
  let roundNumber = 0;

  // Track surviving units
  let attackerSurvivors = [...attackerUnits];
  let defenderSurvivors = [...defenderUnits];
  const attackerCasualties: Unit[] = [];
  const defenderCasualties: Unit[] = [];

  // Battle loop
  while (attackerHP > 0 && defenderHP > 0 && roundNumber < 100) {
    roundNumber++;

    // Calculate damage for this round WITH LEVEL GAP PROTECTION
    const attackerDamage = calculateDamage(attackerStats.totalSTR, defenderStats.totalDEF, attackerLevel, defenderLevel);
    const defenderDamage = calculateDamage(defenderStats.totalDEF, attackerStats.totalSTR, defenderLevel, attackerLevel);

    // Apply damage
    defenderHP = Math.max(0, defenderHP - attackerDamage);
    attackerHP = Math.max(0, attackerHP - defenderDamage);

    // Calculate unit losses for this round
    const attackerLosses = calculateUnitLosses(defenderDamage, attackerSurvivors);
    const defenderLosses = calculateUnitLosses(attackerDamage, defenderSurvivors);

    attackerCasualties.push(...attackerLosses.casualties);
    defenderCasualties.push(...defenderLosses.casualties);
    attackerSurvivors = attackerLosses.survivors;
    defenderSurvivors = defenderLosses.survivors;

    // Record round
    rounds.push({
      roundNumber,
      attackerDamage,
      defenderDamage,
      attackerHP,
      defenderHP,
      attackerUnitsLost: attackerLosses.casualties.length,
      defenderUnitsLost: defenderLosses.casualties.length
    });

    // Safety limit
    if (roundNumber >= 100) {
      console.warn('⚠️ Battle exceeded 100 rounds, forcing draw');
      break;
    }
  }

  // Determine outcome
  let outcome: BattleOutcome;
  if (attackerHP > 0 && defenderHP === 0) {
    outcome = BattleOutcome.AttackerWin;
  } else if (defenderHP > 0 && attackerHP === 0) {
    outcome = BattleOutcome.DefenderWin;
  } else {
    outcome = BattleOutcome.Draw;
  }

  // Unit captures (winner captures from loser)
  let attackerCapturedUnits: Unit[] = [];
  let defenderCapturedUnits: Unit[] = [];

  if (outcome === BattleOutcome.AttackerWin) {
    attackerCapturedUnits = selectCapturedUnits(defenderCasualties);
  } else if (outcome === BattleOutcome.DefenderWin) {
    defenderCapturedUnits = selectCapturedUnits(attackerCasualties);
  }

  // Calculate total damage dealt by each side (sum of all rounds)
  const attackerTotalDamage = rounds.reduce((sum, r) => sum + r.attackerDamage, 0);
  const defenderTotalDamage = rounds.reduce((sum, r) => sum + r.defenderDamage, 0);

  // Create battle log with complete participant data
  const battleLog: BattleLog = {
    battleId: `BATTLE-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    battleType,
    timestamp: new Date(),
    attacker: {
      username: attackerName,
      units: attackerUnits,
      totalSTR: attackerStats.totalSTR,
      totalDEF: attackerStats.totalDEF,
      initialHP: initialAttackerHP,
      finalHP: attackerHP,
      unitsLost: attackerCasualties.length,
      unitsCaptured: attackerCapturedUnits.length,
      // Aliases for component compatibility
      startingHP: initialAttackerHP,
      endingHP: attackerHP,
      damageDealt: attackerTotalDamage,
      xpEarned: 0 // Will be set by caller after XP calculation
    },
    defender: {
      username: defenderName,
      units: defenderUnits,
      totalSTR: defenderStats.totalSTR,
      totalDEF: defenderStats.totalDEF,
      initialHP: initialDefenderHP,
      finalHP: defenderHP,
      unitsLost: defenderCasualties.length,
      unitsCaptured: defenderCapturedUnits.length,
      // Aliases for component compatibility
      startingHP: initialDefenderHP,
      endingHP: defenderHP,
      damageDealt: defenderTotalDamage,
      xpEarned: 0 // Will be set by caller after XP calculation
    },
    outcome,
    rounds,
    totalRounds: roundNumber,
    unitsCaptured: {
      attackerCaptured: attackerCapturedUnits,
      defenderCaptured: defenderCapturedUnits
    },
    attackerXP: 0, // Will be set by caller
    defenderXP: 0, // Will be set by caller
    location
  };

  return battleLog;
}

/**
 * Helper: Convert BattleLog to DB insert format for battleLogs table
 */
function battleLogToDbInsert(battleLog: BattleLog) {
  return {
    battleId: battleLog.battleId,
    battleType: battleLog.battleType,
    timestamp: battleLog.timestamp,
    attackerUsername: battleLog.attacker.username,
    attackerUnits: battleLog.attacker.units,
    attackerTotalSTR: battleLog.attacker.totalSTR,
    attackerTotalDEF: battleLog.attacker.totalDEF,
    attackerInitialHP: battleLog.attacker.initialHP,
    attackerFinalHP: battleLog.attacker.finalHP,
    attackerUnitsLost: battleLog.attacker.unitsLost,
    attackerUnitsCaptured: battleLog.attacker.unitsCaptured,
    attackerStartingHP: battleLog.attacker.startingHP,
    attackerEndingHP: battleLog.attacker.endingHP,
    attackerDamageDealt: battleLog.attacker.damageDealt,
    attackerXpEarned: battleLog.attacker.xpEarned,
    defenderUsername: battleLog.defender.username,
    defenderUnits: battleLog.defender.units,
    defenderTotalSTR: battleLog.defender.totalSTR,
    defenderTotalDEF: battleLog.defender.totalDEF,
    defenderInitialHP: battleLog.defender.initialHP,
    defenderFinalHP: battleLog.defender.finalHP,
    defenderUnitsLost: battleLog.defender.unitsLost,
    defenderUnitsCaptured: battleLog.defender.unitsCaptured,
    defenderStartingHP: battleLog.defender.startingHP,
    defenderEndingHP: battleLog.defender.endingHP,
    defenderDamageDealt: battleLog.defender.damageDealt,
    defenderXpEarned: battleLog.defender.xpEarned,
    outcome: battleLog.outcome,
    rounds: battleLog.rounds,
    totalRounds: battleLog.totalRounds,
    unitsCapturedAttackerCaptured: battleLog.unitsCaptured?.attackerCaptured || [],
    unitsCapturedDefenderCaptured: battleLog.unitsCaptured?.defenderCaptured || [],
    attackerXP: battleLog.attackerXP,
    defenderXP: battleLog.defenderXP,
    resourcesStolenResourceType: battleLog.resourcesStolen?.resourceType || null,
    resourcesStolenAmount: battleLog.resourcesStolen?.amount || null,
    locationX: battleLog.location?.x || null,
    locationY: battleLog.location?.y || null,
  };
}

/**
 * Execute Infantry Battle (Player vs Player direct combat)
 * 
 * @param attackerId - Attacker username
 * @param defenderId - Defender username
 * @param attackerUnitIds - Unit IDs attacker brings to battle
 * @returns Battle result with XP awards
 */
export async function executeInfantryAttack(
  attackerId: string,
  defenderId: string,
  attackerUnitIds: string[]
): Promise<BattleResult> {
  // Get both players
  const [attackerResult] = await db.select().from(players).where(eq(players.username, attackerId)).limit(1);
  const [defenderResult] = await db.select().from(players).where(eq(players.username, defenderId)).limit(1);

  if (!attackerResult || !defenderResult) {
    throw new Error('Player not found');
  }

  const attacker: Player = playerRowToPlayer(attackerResult);
  const defender: Player = playerRowToPlayer(defenderResult);

  // Validate attacker units (PlayerUnit format)
  const attackerPlayerUnits = attacker.units.filter(u => attackerUnitIds.includes(u.unitId));
  if (attackerPlayerUnits.length === 0) {
    throw new Error('No valid units selected for attack');
  }

  // Convert PlayerUnits to Units for battle resolution
  const attackerUnits = attackerPlayerUnits.flatMap(pu => playerUnitToUnits(pu, attackerId));
  
  // Defender brings ALL their units to defend
  const defenderPlayerUnits = defender.units;
  if (defenderPlayerUnits.length === 0) {
    throw new Error('Defender has no units to defend with');
  }
  
  const defenderUnits = defenderPlayerUnits.flatMap(pu => playerUnitToUnits(pu, defenderId));

  // Resolve battle WITH LEVEL GAP PROTECTION
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

  // Apply battle results to database
  await applyBattleResults(battleLog);

  // Award XP
  const attackerXPAction = battleLog.outcome === BattleOutcome.AttackerWin 
    ? XPAction.INFANTRY_ATTACK_WIN 
    : XPAction.INFANTRY_ATTACK_LOSS;
  
  const defenderXPAction = battleLog.outcome === BattleOutcome.DefenderWin
    ? XPAction.DEFENSE_SUCCESS
    : XPAction.INFANTRY_ATTACK_LOSS;

  const attackerXPResult = await awardXP(attackerId, attackerXPAction);
  const defenderXPResult = await awardXP(defenderId, defenderXPAction);

  // Track battle wins for achievements (Infantry Battle)
  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    await trackBattleWon(attackerId);
  } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
    await trackBattleWon(defenderId);
  }

  battleLog.attackerXP = attackerXPResult.xpAwarded;
  battleLog.defenderXP = defenderXPResult.xpAwarded;

  // Award RP for PvP battle victory
  try {
    const { awardRP } = await import('./researchPointService');
    
    if (battleLog.outcome === BattleOutcome.AttackerWin) {
      // Base RP: 100, +20 per defender level above attacker
      const levelDifference = Math.max(0, defender.level - attacker.level);
      const rpAmount = 100 + (levelDifference * 20);
      
      const result = await awardRP(
        attackerId,
        rpAmount,
        'battle',
        `Victory against ${defenderId} (Infantry Battle)`,
        { 
          battleType: 'infantry',
          opponentLevel: defender.level,
          levelDifference,
          outcome: 'victory'
        }
      );
      
      if (result.success) {
        console.log(`⚔️ Battle RP awarded! ${attackerId} earned ${result.rpAwarded} RP for defeating ${defenderId}`);
      }
    } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
      // Base RP: 100, +20 per attacker level above defender
      const levelDifference = Math.max(0, attacker.level - defender.level);
      const rpAmount = 100 + (levelDifference * 20);
      
      const result = await awardRP(
        defenderId,
        rpAmount,
        'battle',
        `Defended against ${attackerId} (Infantry Battle)`,
        { 
          battleType: 'infantry',
          opponentLevel: attacker.level,
          levelDifference,
          outcome: 'defense'
        }
      );
      
      if (result.success) {
        console.log(`🛡️ Battle RP awarded! ${defenderId} earned ${result.rpAwarded} RP for defending against ${attackerId}`);
      }
    }
  } catch (error) {
    console.error('❌ Error awarding RP for infantry battle:', error);
    // Battle still succeeds even if RP award fails
  }

  // Save battle log to database
  await db.insert(battleLogs).values(battleLogToDbInsert(battleLog));

  return {
    success: true,
    message: generateBattleMessage(battleLog),
    battleLog,
    // Flattened properties for convenience
    outcome: battleLog.outcome,
    rounds: battleLog.totalRounds,
    battleType: battleLog.battleType,
    attacker: battleLog.attacker,
    defender: battleLog.defender,
    // Level up info
    attackerLevelUp: attackerXPResult.levelUp,
    defenderLevelUp: defenderXPResult.levelUp,
    attackerNewLevel: attackerXPResult.newLevel,
    defenderNewLevel: defenderXPResult.newLevel
  };
}

/**
 * Execute Base Attack (Attack enemy home base for resources)
 * 
 * @param attackerId - Attacker username
 * @param defenderId - Defender username (base owner)
 * @param attackerUnitIds - Unit IDs attacker brings
 * @param resourceToSteal - 'metal' or 'energy'
 * @returns Battle result with resource theft if victorious
 */
export async function executeBaseAttack(
  attackerId: string,
  defenderId: string,
  attackerUnitIds: string[],
  resourceToSteal: 'metal' | 'energy'
): Promise<BattleResult> {
  // Get both players
  const [attackerResult] = await db.select().from(players).where(eq(players.username, attackerId)).limit(1);
  const [defenderResult] = await db.select().from(players).where(eq(players.username, defenderId)).limit(1);

  if (!attackerResult || !defenderResult) {
    throw new Error('Player not found');
  }

  const attacker: Player = playerRowToPlayer(attackerResult);
  const defender: Player = playerRowToPlayer(defenderResult);

  // Validate attacker units (PlayerUnit format)
  const attackerPlayerUnits = attacker.units.filter(u => attackerUnitIds.includes(u.unitId));
  if (attackerPlayerUnits.length === 0) {
    throw new Error('No valid units selected for attack');
  }

  // Convert PlayerUnits to Units for battle resolution
  const attackerUnits = attackerPlayerUnits.flatMap(pu => playerUnitToUnits(pu, attackerId));

  // Defender brings ALL units to defend base
  const defenderPlayerUnits = defender.units;
  const defenderUnits = defenderPlayerUnits.flatMap(pu => playerUnitToUnits(pu, defenderId));

  // Resolve battle at defender's base WITH LEVEL GAP PROTECTION
  const battleLog = await resolveBattle(
    attackerUnits,
    defenderUnits,
    attackerId,
    defenderId,
    BattleType.Base,
    defender.base,
    attacker.level,
    defender.level
  );

  // If attacker wins, steal resources
  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    const defenderResources = defender.resources[resourceToSteal] || 0;
    const stolenAmount = Math.floor(defenderResources * RESOURCE_THEFT_RATE);

    if (stolenAmount > 0) {
      battleLog.resourcesStolen = {
        resourceType: resourceToSteal,
        amount: stolenAmount
      };

      // Transfer resources
      const defenderResourceCol = resourceToSteal === 'metal' ? 'resourcesMetal' : 'resourcesEnergy';
      const attackerResourceCol = resourceToSteal === 'metal' ? 'resourcesMetal' : 'resourcesEnergy';

      await db.update(players)
        .set({ [defenderResourceCol]: BigInt(Number(defenderResult[defenderResourceCol]) - stolenAmount) })
        .where(eq(players.username, defenderId));

      await db.update(players)
        .set({ [attackerResourceCol]: BigInt(Number(attackerResult[attackerResourceCol]) + stolenAmount) })
        .where(eq(players.username, attackerId));
    }
  }

  // Apply battle results
  await applyBattleResults(battleLog);

  // Award XP
  const attackerXPAction = battleLog.outcome === BattleOutcome.AttackerWin 
    ? XPAction.BASE_ATTACK_WIN 
    : XPAction.BASE_ATTACK_LOSS;

  const defenderXPAction = battleLog.outcome === BattleOutcome.DefenderWin
    ? XPAction.DEFENSE_SUCCESS
    : XPAction.BASE_ATTACK_LOSS;

  const attackerXPResult = await awardXP(attackerId, attackerXPAction);
  const defenderXPResult = await awardXP(defenderId, defenderXPAction);

  // Track battle wins for achievements (Base Attack)
  if (battleLog.outcome === BattleOutcome.AttackerWin) {
    await trackBattleWon(attackerId);
  } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
    await trackBattleWon(defenderId);
  }

  battleLog.attackerXP = attackerXPResult.xpAwarded;
  battleLog.defenderXP = defenderXPResult.xpAwarded;

  // Award RP for base attack victory
  try {
    const { awardRP } = await import('./researchPointService');
    
    if (battleLog.outcome === BattleOutcome.AttackerWin) {
      // Base RP: 150 (higher for base raids), +20 per defender level above attacker
      const levelDifference = Math.max(0, defender.level - attacker.level);
      const rpAmount = 150 + (levelDifference * 20);
      
      const result = await awardRP(
        attackerId,
        rpAmount,
        'battle',
        `Raided ${defenderId}'s base`,
        { 
          battleType: 'base_attack',
          opponentLevel: defender.level,
          levelDifference,
          resourcesStolen: battleLog.resourcesStolen?.amount || 0,
          outcome: 'victory'
        }
      );
      
      if (result.success) {
        console.log(`🏰 Base Raid RP awarded! ${attackerId} earned ${result.rpAwarded} RP for raiding ${defenderId}'s base`);
      }
    } else if (battleLog.outcome === BattleOutcome.DefenderWin) {
      // Base RP: 150, +20 per attacker level above defender
      const levelDifference = Math.max(0, attacker.level - defender.level);
      const rpAmount = 150 + (levelDifference * 20);
      
      const result = await awardRP(
        defenderId,
        rpAmount,
        'battle',
        `Defended base against ${attackerId}`,
        { 
          battleType: 'base_defense',
          opponentLevel: attacker.level,
          levelDifference,
          outcome: 'defense'
        }
      );
      
      if (result.success) {
        console.log(`🏰 Base Defense RP awarded! ${defenderId} earned ${result.rpAwarded} RP for defending their base`);
      }
    }
  } catch (error) {
    console.error('❌ Error awarding RP for base battle:', error);
    // Battle still succeeds even if RP award fails
  }

  // Save battle log to database
  await db.insert(battleLogs).values(battleLogToDbInsert(battleLog));

  return {
    success: true,
    message: generateBattleMessage(battleLog),
    battleLog,
    // Flattened properties for convenience
    outcome: battleLog.outcome,
    rounds: battleLog.totalRounds,
    battleType: battleLog.battleType,
    attacker: battleLog.attacker,
    defender: battleLog.defender,
    resourcesStolen: battleLog.resourcesStolen,
    // Level up info
    attackerLevelUp: attackerXPResult.levelUp,
    defenderLevelUp: defenderXPResult.levelUp,
    attackerNewLevel: attackerXPResult.newLevel,
    defenderNewLevel: defenderXPResult.newLevel
  };
}

/**
 * Apply battle results to player armies
 * - Remove casualties (reduce quantities)
 * - Transfer captured units (add to winner's army)
 * - Update total STR/DEF
 * 
 * This function properly handles the Unit → PlayerUnit conversion after battle.
 */
async function applyBattleResults(battleLog: BattleLog): Promise<void> {
  // Get current player states
  const [attackerResult] = await db.select().from(players).where(eq(players.username, battleLog.attacker.username)).limit(1);
  const [defenderResult] = await db.select().from(players).where(eq(players.username, battleLog.defender.username)).limit(1);

  if (!attackerResult || !defenderResult) {
    throw new Error('Player not found during battle result application');
  }

  const attacker: Player = playerRowToPlayer(attackerResult);
  const defender: Player = playerRowToPlayer(defenderResult);

  // Get casualty IDs from battle log
  const attackerCasualtyIds = battleLog.attacker.units
    .slice(0, battleLog.attacker.unitsLost)
    .map(u => u.id);
  
  const defenderCasualtyIds = battleLog.defender.units
    .slice(0, battleLog.defender.unitsLost)
    .map(u => u.id);

  // Get survivor Units from battle
  const attackerSurvivorUnits = battleLog.attacker.units.filter(u => !attackerCasualtyIds.includes(u.id));
  const defenderSurvivorUnits = battleLog.defender.units.filter(u => !defenderCasualtyIds.includes(u.id));

  // Get captured Units from battle
  const attackerCapturedUnits = battleLog.unitsCaptured?.attackerCaptured || [];
  const defenderCapturedUnits = battleLog.unitsCaptured?.defenderCaptured || [];

  // Combine survivors + captured for each side
  const attackerFinalUnits = [...attackerSurvivorUnits, ...attackerCapturedUnits];
  const defenderFinalUnits = [...defenderSurvivorUnits, ...defenderCapturedUnits];

  // Convert Units back to PlayerUnit format (collapse quantities)
  const attackerFinalPlayerUnits = unitsToPlayerUnits(attackerFinalUnits, attacker.units);
  const defenderFinalPlayerUnits = unitsToPlayerUnits(defenderFinalUnits, defender.units);

  // Calculate new totals from final PlayerUnit arrays
  const attackerNewStats = calculatePlayerUnitStats(attackerFinalPlayerUnits);
  const defenderNewStats = calculatePlayerUnitStats(defenderFinalPlayerUnits);

  // Update databases with PlayerUnit arrays
  await db.update(players)
    .set({
      units: attackerFinalPlayerUnits as any,
      totalStrength: attackerNewStats.totalSTR,
      totalDefense: attackerNewStats.totalDEF
    })
    .where(eq(players.username, battleLog.attacker.username));

  await db.update(players)
    .set({
      units: defenderFinalPlayerUnits as any,
      totalStrength: defenderNewStats.totalSTR,
      totalDefense: defenderNewStats.totalDEF
    })
    .where(eq(players.username, battleLog.defender.username));
}

/**
 * Calculate combat stats from PlayerUnit array
 * Similar to calculateCombatStats but works with PlayerUnits
 * 
 * @param playerUnits - Array of PlayerUnits
 * @returns Combat statistics
 */
function calculatePlayerUnitStats(playerUnits: PlayerUnit[]): { totalSTR: number; totalDEF: number } {
  let totalSTR = 0;
  let totalDEF = 0;

  for (const playerUnit of playerUnits) {
    totalSTR += playerUnit.strength * playerUnit.quantity;
    totalDEF += playerUnit.defense * playerUnit.quantity;
  }

  return { totalSTR, totalDEF };
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
): Promise<BattleLog[]> {
  const rows = await db.select().from(battleLogs)
    .where(or(
      eq(battleLogs.attackerUsername, username),
      eq(battleLogs.defenderUsername, username)
    ))
    .orderBy(desc(battleLogs.timestamp))
    .limit(limit);

  return rows.map(dbBattleLogToBattleLog);
}

/**
 * Convert a DB battle log row to a BattleLog object
 */
function dbBattleLogToBattleLog(row: typeof battleLogs.$inferSelect): BattleLog {
  return {
    battleId: row.battleId,
    battleType: row.battleType as BattleType,
    timestamp: row.timestamp,
    attacker: {
      username: row.attackerUsername,
      units: (row.attackerUnits || []) as Unit[],
      totalSTR: row.attackerTotalSTR,
      totalDEF: row.attackerTotalDEF,
      initialHP: row.attackerInitialHP,
      finalHP: row.attackerFinalHP,
      unitsLost: row.attackerUnitsLost,
      unitsCaptured: row.attackerUnitsCaptured,
      startingHP: row.attackerStartingHP,
      endingHP: row.attackerEndingHP,
      damageDealt: row.attackerDamageDealt,
      xpEarned: row.attackerXpEarned
    },
    defender: {
      username: row.defenderUsername,
      units: (row.defenderUnits || []) as Unit[],
      totalSTR: row.defenderTotalSTR,
      totalDEF: row.defenderTotalDEF,
      initialHP: row.defenderInitialHP,
      finalHP: row.defenderFinalHP,
      unitsLost: row.defenderUnitsLost,
      unitsCaptured: row.defenderUnitsCaptured,
      startingHP: row.defenderStartingHP,
      endingHP: row.defenderEndingHP,
      damageDealt: row.defenderDamageDealt,
      xpEarned: row.defenderXpEarned
    },
    outcome: row.outcome as BattleOutcome,
    rounds: (row.rounds || []) as CombatRound[],
    totalRounds: row.totalRounds,
    unitsCaptured: {
      attackerCaptured: (row.unitsCapturedAttackerCaptured || []) as Unit[],
      defenderCaptured: (row.unitsCapturedDefenderCaptured || []) as Unit[]
    },
    attackerXP: row.attackerXP,
    defenderXP: row.defenderXP,
    resourcesStolen: row.resourcesStolenResourceType
      ? { resourceType: row.resourcesStolenResourceType as 'metal' | 'energy', amount: row.resourcesStolenAmount || 0 }
      : undefined,
    location: row.locationX != null && row.locationY != null
      ? { x: row.locationX, y: row.locationY }
      : undefined
  };
}

/**
 * Convert a player DB row to a Player object
 */
function playerRowToPlayer(row: typeof players.$inferSelect): Player {
  let units: PlayerUnit[] = [];
  try {
    units = typeof row.units === 'string' ? JSON.parse(row.units) : (row.units || []);
  } catch {
    units = [];
  }

  return {
    username: row.username,
    email: row.email,
    password: row.password,
    base: { x: row.baseX, y: row.baseY },
    currentPosition: { x: row.currentPositionX, y: row.currentPositionY },
    resources: {
      metal: Number(row.resourcesMetal),
      energy: Number(row.resourcesEnergy)
    },
    bank: {
      metal: Number(row.bankMetal),
      energy: Number(row.bankEnergy),
      lastDeposit: row.bankLastDeposit
    },
    rank: row.rank,
    inventoryItems: row.inventoryItems || [],
    inventoryCapacity: row.inventoryCapacity,
    inventoryMetalDiggerCount: row.inventoryMetalDiggerCount,
    inventoryEnergyDiggerCount: row.inventoryEnergyDiggerCount,
    gatheringBonus: {
      metalBonus: Number(row.gatheringBonusMetalBonus),
      energyBonus: Number(row.gatheringBonusEnergyBonus)
    },
    activeBoosts: {
      gatheringBoost: row.activeBoostsGatheringBoost ? Number(row.activeBoostsGatheringBoost) : undefined,
      expiresAt: row.activeBoostsExpiresAt
    },
    shrineBoosts: row.shrineBoosts || [],
    units,
    totalStrength: row.totalStrength,
    totalDefense: row.totalDefense,
    balanceEffects: row.balanceEffects,
    xp: row.xp,
    level: row.level,
    researchPoints: row.researchPoints,
    unlockedTiers: row.unlockedTiers || [],
    unlockedTechs: row.unlockedTechs,
    concentrationZones: row.concentrationZones,
    lastBotSummon: row.lastBotSummon,
    fastTravelWaypoints: row.fastTravelWaypoints,
    lastFastTravel: row.lastFastTravel,
    dailyBounties: row.dailyBounties,
    specialization: row.specialization,
    discoveries: row.discoveries,
    achievements: row.achievements,
    stats: row.stats,
    factoryCount: row.factoryCount,
    lastXPAward: row.lastXPAward,
    lastLevelUp: row.lastLevelUp,
    rpHistory: row.rpHistory,
    baseGreeting: row.baseGreeting,
    battleStats: row.battleStats,
    isBot: row.isBot === 1,
    isSpecialBase: row.isSpecialBase === 1,
    botConfig: row.botConfig,
    clanId: row.clanId,
    clanName: row.clanName,
    clanRole: row.clanRole,
    clanLevel: row.clanLevel,
    isAdmin: row.isAdmin === 1,
    vip: row.vip === 1,
    vipExpiration: row.vipExpiration,
    vipTier: row.vipTier,
    stripeCustomerId: row.stripeCustomerId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    vipLastUpdated: row.vipLastUpdated,
    lastLoginDate: row.lastLoginDate,
    loginStreak: row.loginStreak,
    lastStreakReward: row.lastStreakReward,
    currentHP: row.currentHP,
    maxHP: row.maxHP,
    lastFlagAttack: row.lastFlagAttack,
    referralCode: row.referralCode,
    referralLink: row.referralLink,
    referredBy: row.referredBy,
    referredByUsername: row.referredByUsername,
    referralValidated: row.referralValidated === 1,
    referralValidatedAt: row.referralValidatedAt,
    totalReferrals: row.totalReferrals,
    pendingReferrals: row.pendingReferrals,
    referralRewards: {
      metal: row.referralRewardsMetal ? Number(row.referralRewardsMetal) : 0,
      energy: row.referralRewardsEnergy ? Number(row.referralRewardsEnergy) : 0,
      rp: row.referralRewardsRp || 0,
      xp: row.referralRewardsXp || 0,
      vipDays: row.referralRewardsVipDays || 0
    },
    referralTitles: row.referralTitles,
    referralBadges: row.referralBadges,
    referralMultiplier: row.referralMultiplier || '1.0',
    lastReferralValidated: row.lastReferralValidated,
    referralMilestonesReached: row.referralMilestonesReached,
    signupIP: row.signupIP,
    createdAt: row.createdAt
  } as unknown as Player;
}

// ============================================================
// IMPLEMENTATION NOTES
// ============================================================
/**
 * COMBAT SYSTEM:
 * 
 * HP CALCULATION:
 * - STR units: 10 HP each (glass cannons)
 * - DEF units: 15 HP each (tanks)
 * - Total army HP = sum of all unit HP
 * 
 * DAMAGE FORMULA:
 * - Attacker Damage = max(5, AttackerSTR - DefenderDEF/2)
 * - Defender Damage = max(5, DefenderDEF - AttackerSTR/2)
 * - Minimum 5 damage ensures battles don't stalemate
 * 
 * UNIT CASUALTIES:
 * - HP loss converts to unit deaths
 * - Deaths distributed randomly (battle chaos)
 * - Casualties permanent (units removed from army)
 * 
 * UNIT CAPTURE:
 * - Winner captures 10-15% of defeated units
 * - Captured units change ownership
 * - Adds strategic value to winning battles
 * 
 * RESOURCE THEFT (Base Attacks Only):
 * - Attacker steals 20% of chosen resource
 * - Only on attacker victory
 * - Encourages base defense preparation
 * 
 * XP INTEGRATION:
 * - Infantry Win: +150 XP | Loss: +25 XP
 * - Base Win: +200 XP | Loss: +30 XP
 * - Defense Success: +75 XP
 * - Both sides earn XP (participation rewards)
 */
