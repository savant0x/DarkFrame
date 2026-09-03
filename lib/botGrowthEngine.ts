/**
 * Bot Growth Engine - Hourly Growth and Unit Building System
 * Created: 2024-10-18
 * 
 * OVERVIEW:
 * Manages all bot growth mechanics including resource regeneration, unit building,
 * movement, and nest attraction. Runs hourly via cron job to create dynamic,
 * challenging bot populations that scale in difficulty over time.
 * 
 * KEY FEATURES:
 * - Full Permanence: Bots regenerate resources hourly (5-20% by type)
 * - Unit Building: Bots build BOTH STR and DEF armies that scale with age/tier
 * - Growth Patterns: 70% grow, 20% stable, 10% decrease for dynamic economy
 * - Movement System: Raiders roam, Ghosts teleport, others stationary
 * - Nest Attraction: Bots drift toward their affiliated nest over time
 * - Scaling Difficulty: Older bots = larger armies, newer bots = weaker
 * 
 * UNIT BUILDING SYSTEM:
 * - Specialization Build Rates:
 *   * Fortress: 1 unit/2 hours (slow, defensive focus)
 *   * Raider: 1 unit/hour (fast, aggressive focus)
 *   * Hoarder: 1 unit/4 hours (minimal units, resource priority)
 *   * Ghost: 1 unit/1.5 hours (moderate, balanced)
 *   * Balanced: 1 unit/hour (standard build rate)
 * 
 * - Army Composition by Type:
 *   * Fortress: 70% DEF, 30% STR (defensive wall)
 *   * Raider: 70% STR, 30% DEF (offensive powerhouse)
 *   * Hoarder: 50% STR, 50% DEF (minimal but balanced)
 *   * Ghost: 50% STR, 50% DEF (balanced threat)
 *   * Balanced: 50% STR, 50% DEF (even armies)
 * 
 * - Age-Based Scaling:
 *   * < 7 days old: Base build rate (1x)
 *   * 7-30 days: 1.5x build rate (veteran)
 *   * 30+ days: 2x build rate (legendary)
 * 
 * - Tier Multipliers:
 *   * Tier 1: 1x army size cap
 *   * Tier 2: 2x army size cap
 *   * Tier 3: 3x army size cap
 * 
 * DEPENDENCIES:
 * - lib/botService.ts: Bot data management
 * - lib/botNestService.ts: Nest locations and attraction
 * - lib/unitService.ts: Unit creation and management
 * - types/game.types.ts: Player, PlayerUnit, BotConfig types
 */

import { connectToDatabase } from './mongodb';
import { getNestById } from './botNestService';
import type { Player, PlayerUnit, BotSpecialization, UnitType } from '@/types/game.types';

/**
 * Resource regeneration rates by bot specialization (percentage per hour)
 */
const REGENERATION_RATES = {
  Hoarder: 0.05,   // 5% per hour - slow regeneration, focuses on hoarding
  Fortress: 0.10,  // 10% per hour - moderate regeneration
  Raider: 0.15,    // 15% per hour - faster regeneration for aggressive play
  Ghost: 0.20,     // 20% per hour - fastest regeneration for hit-and-run
  Balanced: 0.12,  // 12% per hour - balanced regeneration
} as const;

/**
 * Unit building rates by specialization (units built per hour)
 */
const BUILD_RATES = {
  Fortress: 0.5,   // 1 unit every 2 hours - slow but defensive
  Raider: 1.0,     // 1 unit per hour - fast aggressive builds
  Hoarder: 0.25,   // 1 unit every 4 hours - minimal unit focus
  Ghost: 0.67,     // 1 unit every 1.5 hours - moderate build
  Balanced: 1.0,   // 1 unit per hour - standard build rate
} as const;

/**
 * Army composition by specialization (STR vs DEF percentages)
 */
const ARMY_COMPOSITION = {
  Fortress: { str: 0.3, def: 0.7 },  // 30% STR, 70% DEF - defensive wall
  Raider: { str: 0.7, def: 0.3 },    // 70% STR, 30% DEF - offensive power
  Hoarder: { str: 0.5, def: 0.5 },   // 50/50 - minimal but balanced
  Ghost: { str: 0.5, def: 0.5 },     // 50/50 - balanced threat
  Balanced: { str: 0.5, def: 0.5 },  // 50/50 - even armies
} as const;

/**
 * Maximum army size by tier (base units per tier level)
 */
const TIER_ARMY_CAPS = {
  1: 20,   // Tier 1: Max 20 units
  2: 40,   // Tier 2: Max 40 units
  3: 60,   // Tier 3: Max 60 units
} as const;

/**
 * Age-based build rate multipliers
 */
const AGE_MULTIPLIERS = {
  YOUNG: 1.0,    // < 7 days - base build rate
  VETERAN: 1.5,  // 7-30 days - 50% faster builds
  LEGENDARY: 2.0, // 30+ days - 2x build rate
} as const;

/**
 * Available unit types for bot armies
 */
const UNIT_TYPES = {
  STR: [
    { id: 'warrior', name: 'Warrior', tier: 1, str: 10, def: 5, cost: 100 },
    { id: 'berserker', name: 'Berserker', tier: 2, str: 25, def: 10, cost: 250 },
    { id: 'champion', name: 'Champion', tier: 3, str: 50, def: 20, cost: 500 },
  ],
  DEF: [
    { id: 'guard', name: 'Guard', tier: 1, str: 5, def: 10, cost: 100 },
    { id: 'sentinel', name: 'Sentinel', tier: 2, str: 10, def: 25, cost: 250 },
    { id: 'bastion', name: 'Bastion', tier: 3, str: 20, def: 50, cost: 500 },
  ],
} as const;

/**
 * Calculate bot age in days
 */
function getBotAgeDays(createdAt: Date): number {
  const now = new Date();
  const ageMs = now.getTime() - new Date(createdAt).getTime();
  return ageMs / (1000 * 60 * 60 * 24);
}

/**
 * Get age-based build rate multiplier
 */
function getAgeMultiplier(ageDays: number): number {
  if (ageDays < 7) return AGE_MULTIPLIERS.YOUNG;
  if (ageDays < 30) return AGE_MULTIPLIERS.VETERAN;
  return AGE_MULTIPLIERS.LEGENDARY;
}

/**
 * Get maximum army size for a bot based on tier and age
 */
function getMaxArmySize(tier: number, ageDays: number): number {
  const baseCap = TIER_ARMY_CAPS[tier as keyof typeof TIER_ARMY_CAPS] || TIER_ARMY_CAPS[1];
  const ageMultiplier = getAgeMultiplier(ageDays);
  return Math.floor(baseCap * ageMultiplier);
}

/**
 * Select appropriate unit type based on bot tier and unit category (STR/DEF)
 */
function selectUnitType(tier: number, category: 'STR' | 'DEF') {
  const units = UNIT_TYPES[category];
  
  // Select unit tier matching bot tier (or closest available)
  const matchingUnit = units.find(u => u.tier === tier) || units[0];
  return matchingUnit;
}

/**
 * Build new units for a bot based on specialization, age, and tier
 * 
 * @param bot - Bot player to build units for
 * @returns Array of newly built units (empty if none built this cycle)
 */
function buildUnits(bot: Player): PlayerUnit[] {
  if (!bot.botConfig) return [];
  
  const { specialization, tier } = bot.botConfig;
  const ageDays = getBotAgeDays(bot.createdAt || new Date());
  const currentArmySize = bot.units?.length || 0;
  const maxArmySize = getMaxArmySize(tier, ageDays);
  
  // Check if bot has reached max army size
  if (currentArmySize >= maxArmySize) {
    return [];
  }
  
  // Calculate build rate with age multiplier
  const baseBuildRate = BUILD_RATES[specialization.charAt(0).toUpperCase() + specialization.slice(1) as keyof typeof BUILD_RATES];
  const ageMultiplier = getAgeMultiplier(ageDays);
  const effectiveBuildRate = baseBuildRate * ageMultiplier;
  
  // Determine how many units to build this hour (probabilistic)
  const buildChance = effectiveBuildRate; // e.g., 1.0 = 100% chance, 0.5 = 50% chance
  const shouldBuild = Math.random() < buildChance;
  
  if (!shouldBuild) {
    return [];
  }
  
  // Get army composition for this specialization
  const composition = ARMY_COMPOSITION[specialization.charAt(0).toUpperCase() + specialization.slice(1) as keyof typeof ARMY_COMPOSITION];
  
  // Decide whether to build STR or DEF unit based on composition percentages
  const isStrUnit = Math.random() < composition.str;
  const unitCategory = isStrUnit ? 'STR' : 'DEF';
  
  // Select appropriate unit type for bot's tier
  const unitType = selectUnitType(tier, unitCategory);
  
  // Create the new unit matching PlayerUnit interface
  const newUnit: PlayerUnit = {
    id: unitType.id,                  // NEW: Alias for unitId
    unitId: unitType.id,
    unitType: unitType.id as UnitType, // NEW: Type assertion for bot's simplified unit system
    name: unitType.name,
    category: unitCategory,
    rarity: tier === 1 ? 'common' : tier === 2 ? 'uncommon' : 'rare',
    strength: unitType.str,
    defense: unitType.def,
    quantity: 1,                      // NEW: Single unit
    createdAt: new Date(),
  };
  
  return [newUnit];
}

/**
 * Calculate total STR from unit array
 */
function calculateTotalSTR(units: PlayerUnit[]): number {
  return units.reduce((total, unit) => total + unit.strength, 0);
}

/**
 * Calculate total DEF from unit array
 */
function calculateTotalDEF(units: PlayerUnit[]): number {
  return units.reduce((total, unit) => total + unit.defense, 0);
}

/**
 * Regenerate resources for a bot based on specialization and Full Permanence model
 * 
 * @param bot - Bot to regenerate resources for
 * @returns Updated resource values
 */
function regenerateBotResources(bot: Player): { metal: number; energy: number; food: number } {
  if (!bot.botConfig) {
    return { 
      metal: bot.resources?.metal || 0, 
      energy: bot.resources?.energy || 0, 
      food: 0 
    };
  }
  
  const { specialization } = bot.botConfig;
  const regenKey = specialization.charAt(0).toUpperCase() + specialization.slice(1) as keyof typeof REGENERATION_RATES;
  const regenRate = REGENERATION_RATES[regenKey];
  
  const currentMetal = bot.resources?.metal || 0;
  const currentEnergy = bot.resources?.energy || 0;
  
  // Calculate regenerated amounts (percentage of current resources)
  const metalRegen = Math.floor(currentMetal * regenRate);
  const energyRegen = Math.floor(currentEnergy * regenRate);
  const foodRegen = 0; // Food not used in this system
  
  return {
    metal: currentMetal + metalRegen,
    energy: currentEnergy + energyRegen,
    food: foodRegen,
  };
}

/**
 * Apply growth pattern to bot resources (70% grow, 20% stay, 10% decrease)
 * 
 * @param current - Current resource amount
 * @param specialization - Bot specialization type
 * @returns Modified resource amount
 */
function applyGrowthPattern(current: number, specialization: string): number {
  const roll = Math.random();
  
  if (roll < 0.70) {
    // 70% chance to grow by 5-15%
    const growthRate = 0.05 + Math.random() * 0.10;
    return Math.floor(current * (1 + growthRate));
  } else if (roll < 0.90) {
    // 20% chance to stay the same
    return current;
  } else {
    // 10% chance to decrease by 5-10%
    const decreaseRate = 0.05 + Math.random() * 0.05;
    return Math.floor(current * (1 - decreaseRate));
  }
}

/**
 * Move bot based on specialization movement pattern
 * 
 * @param bot - Bot to move
 * @returns New coordinates or null if no movement
 */
function moveBot(bot: Player): { x: number; y: number } | null {
  if (!bot.botConfig?.movement) return null;
  
  const { movement } = bot.botConfig;
  const currentX = bot.currentPosition?.x || 0;
  const currentY = bot.currentPosition?.y || 0;
  
  switch (movement) {
    case 'stationary':
      return null; // No movement
      
    case 'roam':
      // Move 1-3 tiles in random direction (Raiders)
      const roamDistance = 1 + Math.floor(Math.random() * 3);
      const roamAngle = Math.random() * 2 * Math.PI;
      return {
        x: Math.max(0, Math.min(149, currentX + Math.floor(Math.cos(roamAngle) * roamDistance))),
        y: Math.max(0, Math.min(149, currentY + Math.floor(Math.sin(roamAngle) * roamDistance))),
      };
      
    case 'teleport':
      // 5% chance to teleport to random location (Ghosts)
      if (Math.random() < 0.05) {
        return {
          x: Math.floor(Math.random() * 150),
          y: Math.floor(Math.random() * 150),
        };
      }
      return null;
      
    default:
      return null;
  }
}

/**
 * Apply nest attraction - bots drift toward their affiliated nest over time
 * 
 * @param bot - Bot to apply attraction to
 * @returns Adjusted coordinates or null if no nest affinity
 */
function applyNestAttraction(bot: Player): { x: number; y: number } | null {
  if (!bot.botConfig?.nestAffinity) return null;
  
  const nest = getNestById(bot.botConfig.nestAffinity);
  
  if (!nest) return null;
  
  const currentX = bot.currentPosition?.x || 0;
  const currentY = bot.currentPosition?.y || 0;
  
  // 20% chance to drift 1 tile toward nest
  if (Math.random() < 0.20) {
    const dx = nest.position.x - currentX;
    const dy = nest.position.y - currentY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If already at nest, no drift needed
    if (distance < 1) return null;
    
    // Move 1 tile toward nest
    return {
      x: currentX + Math.sign(dx),
      y: currentY + Math.sign(dy),
    };
  }
  
  return null;
}

/**
 * Main growth cycle - runs hourly to update all bots
 * 
 * EXECUTION ORDER:
 * 1. Resource Regeneration (Full Permanence model)
 * 2. Growth Pattern Application (70/20/10)
 * 3. Movement (roam/teleport based on specialization)
 * 4. Unit Building (age and tier-based scaling)
 * 5. Nest Attraction (drift toward affiliated nest)
 * 
 * @returns Summary of changes applied
 */
export async function runGrowthCycle(): Promise<{
  processed: number;
  regenerated: number;
  moved: number;
  unitsBuilt: number;
  errors: string[];
}> {
  const db = await connectToDatabase();
  const errors: string[] = [];
  let processed = 0;
  let regenerated = 0;
  let moved = 0;
  let unitsBuilt = 0;
  
  try {
    // Get all bots from database
    const bots = await db.collection<Player>('players')
      .find({ isBot: true })
      .toArray();
    
    console.log(`[Growth Cycle] Processing ${bots.length} bots...`);
    
    // Process each bot
    for (const bot of bots) {
      try {
        const updates: Record<string, any> = {};
        
        // 1. Resource Regeneration (Full Permanence)
        const regeneratedResources = regenerateBotResources(bot);
        const currentMetal = bot.resources?.metal || 0;
        const currentEnergy = bot.resources?.energy || 0;
        
        if (regeneratedResources.metal !== currentMetal || 
            regeneratedResources.energy !== currentEnergy) {
          updates['resources.metal'] = regeneratedResources.metal;
          updates['resources.energy'] = regeneratedResources.energy;
          regenerated++;
        }
        
        // 2. Apply Growth Pattern (70/20/10)
        if (bot.botConfig) {
          const grownMetal = applyGrowthPattern(regeneratedResources.metal, bot.botConfig.specialization);
          const grownEnergy = applyGrowthPattern(regeneratedResources.energy, bot.botConfig.specialization);
          
          if (grownMetal !== regeneratedResources.metal) updates['resources.metal'] = grownMetal;
          if (grownEnergy !== regeneratedResources.energy) updates['resources.energy'] = grownEnergy;
        }
        
        // 3. Movement System
        const newPosition = moveBot(bot);
        if (newPosition) {
          updates['currentPosition.x'] = newPosition.x;
          updates['currentPosition.y'] = newPosition.y;
          moved++;
        }
        
        // 4. Unit Building (NEW - creates challenging armies)
        const newUnits = buildUnits(bot);
        if (newUnits.length > 0) {
          const currentUnits = bot.units || [];
          const updatedUnits = [...currentUnits, ...newUnits];
          
          updates.units = updatedUnits;
          updates.totalStrength = calculateTotalSTR(updatedUnits);
          updates.totalDefense = calculateTotalDEF(updatedUnits);
          
          unitsBuilt += newUnits.length;
          
          console.log(`[Growth Cycle] ${bot.username} built ${newUnits[0].name} (${newUnits[0].unitId}) - Army: ${updatedUnits.length} units, STR: ${updates.totalStrength}, DEF: ${updates.totalDefense}`);
        }
        
        // 5. Nest Attraction (drift toward nest)
        const nestPosition = applyNestAttraction(bot);
        if (nestPosition && !newPosition) {
          // Only apply if movement didn't already change position
          updates['currentPosition.x'] = nestPosition.x;
          updates['currentPosition.y'] = nestPosition.y;
        }
        
        // Update lastGrowth timestamp
        updates['botConfig.lastGrowth'] = new Date();
        
        // Apply all updates to database
        if (Object.keys(updates).length > 0) {
          await db.collection<Player>('players').updateOne(
            { username: bot.username },
            { $set: updates }
          );
          processed++;
        }
        
      } catch (botError) {
        const errorMsg = `Failed to process bot ${bot.username}: ${botError}`;
        console.error(`[Growth Cycle] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`[Growth Cycle] Complete - Processed: ${processed}, Regenerated: ${regenerated}, Moved: ${moved}, Units Built: ${unitsBuilt}`);
    
    return {
      processed,
      regenerated,
      moved,
      unitsBuilt,
      errors,
    };
    
  } catch (error) {
    const errorMsg = `Growth cycle failed: ${error}`;
    console.error(`[Growth Cycle] ${errorMsg}`);
    errors.push(errorMsg);
    
    return {
      processed,
      regenerated,
      moved,
      unitsBuilt,
      errors,
    };
  }
}

/**
 * Force regeneration for all bots (admin function)
 * Useful for testing or manual intervention
 */
export async function forceRegeneration(): Promise<{ success: boolean; count: number; errors: string[] }> {
  console.log('[Force Regen] Initiating manual regeneration cycle...');
  const result = await runGrowthCycle();
  
  return {
    success: result.errors.length === 0,
    count: result.processed,
    errors: result.errors,
  };
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. UNIT BUILDING SYSTEM:
 *    - Bots build BOTH STR and DEF units based on specialization composition
 *    - Fortress: 70% DEF builds (defensive wall strategy)
 *    - Raider: 70% STR builds (offensive powerhouse)
 *    - Others: 50/50 balanced armies
 * 
 * 2. SCALING DIFFICULTY:
 *    - Young bots (< 7 days): Base build rate, smaller armies
 *    - Veteran bots (7-30 days): 1.5x build rate, medium armies
 *    - Legendary bots (30+ days): 2x build rate, large armies
 *    - Tier multipliers: T1 (20 units), T2 (40 units), T3 (60 units)
 * 
 * 3. PROBABILISTIC BUILDS:
 *    - Build rates are chances per hour (e.g., 0.5 = 50% chance)
 *    - Ensures gradual army growth without guaranteed builds
 *    - Creates variation in bot army sizes
 * 
 * 4. ARMY COMPOSITION:
 *    - Units selected based on bot tier (T1 bots get T1 units, etc.)
 *    - STR units: Warrior (T1), Berserker (T2), Champion (T3)
 *    - DEF units: Guard (T1), Sentinel (T2), Bastion (T3)
 * 
 * 5. FULL PERMANENCE MODEL:
 *    - Bots regenerate 5-20% resources hourly (never despawn)
 *    - Growth pattern adds economic variation (70/20/10)
 *    - Movement creates dynamic map presence
 *    - Nest attraction maintains strategic clustering
 * 
 * 6. PERFORMANCE CONSIDERATIONS:
 *    - Processes all bots in single pass (efficient batch operation)
 *    - Probabilistic builds prevent army explosion
 *    - Age/tier caps prevent unlimited growth
 *    - Logging tracks unit builds for monitoring
 * 
 * 7. CRON INTEGRATION:
 *    - Schedule runGrowthCycle() to run hourly
 *    - Recommended: Use Vercel cron or external service
 *    - Example cron expression: "0 * * * *" (every hour at :00)
 * 
 * FUTURE ENHANCEMENTS:
 * - Unit merging (combine low-tier units into high-tier)
 * - Army maintenance costs (resource drain for large armies)
 * - Unit training time (staged builds over multiple hours)
 * - Specialization evolution (change type based on combat experience)
 */
