/**
 * Bot Combat System - Zone-Based Targeting and Revenge Mechanics
 * Created: 2024-10-18
 * 
 * OVERVIEW:
 * Manages bot-initiated attacks on players with intelligent zone-based targeting,
 * revenge mechanics, specialization behavior modifiers, and Full Permanence defeat handling.
 * Bots use their built armies to attack players, creating dynamic PvE combat.
 * 
 * KEY FEATURES:
 * - Zone-Weighted Targeting: 50% same zone, 30% adjacent zones, 20% any zone
 * - Revenge System: 60% chance bots retaliate against players who defeated them
 * - Specialization Modifiers: Raiders 3x aggression, Ghosts 0.3x (elusive)
 * - Loot Bonuses: Tech tree unlocks increase player rewards
 * - Full Permanence: Defeated bots stay on map with 0 resources until regeneration
 * 
 * COMBAT FLOW:
 * 1. Bot selects target (zone-weighted or revenge)
 * 2. Calculate combat outcome (bot army vs player army)
 * 3. Apply results (resource transfer, XP, reputation updates)
 * 4. Handle defeat (Full Permanence: bot resources → 0, stays on map)
 * 5. Set cooldowns and revenge flags
 * 
 * ZONE SYSTEM:
 * Map is divided into 9 zones (50×50 each):
 * Zone 0: (0-49, 0-49)    | Zone 1: (50-99, 0-49)   | Zone 2: (100-149, 0-49)
 * Zone 3: (0-49, 50-99)   | Zone 4: (50-99, 50-99)  | Zone 5: (100-149, 50-99)
 * Zone 6: (0-49, 100-149) | Zone 7: (50-99, 100-149)| Zone 8: (100-149, 100-149)
 * 
 * DEPENDENCIES:
 * - lib/mongodb.ts: Database access
 * - types/game.types.ts: Player, BotConfig, BotReputation types
 */

import { connectToDatabase } from './mongodb';
import type { Player } from '@/types/game.types';
import { BotReputation } from '@/types/game.types';
import { removeBeerBase } from './beerBaseService';

/**
 * Zone adjacency map for zone-weighted targeting
 */
const ADJACENT_ZONES: Record<number, number[]> = {
  0: [1, 3, 4],           // NW corner
  1: [0, 2, 3, 4, 5],     // N center
  2: [1, 4, 5],           // NE corner
  3: [0, 1, 4, 6, 7],     // W center
  4: [0, 1, 2, 3, 5, 6, 7, 8], // Center (adjacent to all)
  5: [1, 2, 4, 7, 8],     // E center
  6: [3, 4, 7],           // SW corner
  7: [3, 4, 5, 6, 8],     // S center
  8: [4, 5, 7],           // SE corner
};

/**
 * Aggression multipliers by specialization
 */
const AGGRESSION_MULTIPLIERS = {
  raider: 3.0,    // Raiders attack 3x more frequently
  fortress: 0.5,  // Fortresses rarely attack (defensive)
  hoarder: 0.7,   // Hoarders prefer to hoard, not fight
  ghost: 0.3,     // Ghosts are elusive, rarely engage
  balanced: 1.0,  // Standard attack frequency
} as const;

/**
 * Base attack cooldown (modified by aggression multiplier)
 */
const BASE_ATTACK_COOLDOWN_HOURS = 6;

/**
 * Revenge attack chance (60%)
 */
const REVENGE_ATTACK_CHANCE = 0.60;

/**
 * Loot bonus multipliers by tech unlock
 */
const LOOT_BONUS_MULTIPLIERS = {
  'bot-hunter': 1.25,           // +25% loot (Tier 1)
  'advanced-tracking': 1.75,    // +75% loot total (Tier 2)
  // Future tech unlocks can add more bonuses
} as const;

/**
 * Calculate zone from coordinates
 */
function calculateZone(x: number, y: number): number {
  const zoneX = Math.floor(x / 50);
  const zoneY = Math.floor(y / 50);
  return zoneY * 3 + zoneX;
}

/**
 * Check if bot can attack (cooldown expired)
 */
function canAttack(bot: Player): boolean {
  if (!bot.botConfig?.attackCooldown) return true;
  
  const now = new Date();
  const cooldown = new Date(bot.botConfig.attackCooldown);
  return now >= cooldown;
}

/**
 * Calculate attack cooldown based on specialization
 */
function calculateCooldown(specialization: string): Date {
  const spec = specialization.toLowerCase();
  const multiplier = AGGRESSION_MULTIPLIERS[spec as keyof typeof AGGRESSION_MULTIPLIERS] || 1.0;
  
  // Higher aggression = shorter cooldown
  const cooldownHours = BASE_ATTACK_COOLDOWN_HOURS / multiplier;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  
  return new Date(Date.now() + cooldownMs);
}

/**
 * Select target player based on zone weighting and revenge
 */
async function selectTarget(bot: Player, allPlayers: Player[]): Promise<Player | null> {
  if (!bot.botConfig) return null;
  
  const botZone = bot.botConfig.zone;
  const revengeTarget = bot.botConfig.revengeTarget;
  
  // 60% chance to attack revenge target if available
  if (revengeTarget && Math.random() < REVENGE_ATTACK_CHANCE) {
    const target = allPlayers.find(p => p.username === revengeTarget && !p.isBot);
    if (target) {
      return target;
    }
  }
  
  // Zone-weighted target selection
  const eligiblePlayers = allPlayers.filter(p => !p.isBot);
  if (eligiblePlayers.length === 0) return null;
  
  const roll = Math.random();
  let targetPool: Player[] = [];
  
  if (roll < 0.50) {
    // 50% chance: Same zone
    targetPool = eligiblePlayers.filter(p => {
      const playerZone = calculateZone(p.currentPosition.x, p.currentPosition.y);
      return playerZone === botZone;
    });
  } else if (roll < 0.80) {
    // 30% chance: Adjacent zones
    const adjacentZones = ADJACENT_ZONES[botZone] || [];
    targetPool = eligiblePlayers.filter(p => {
      const playerZone = calculateZone(p.currentPosition.x, p.currentPosition.y);
      return adjacentZones.includes(playerZone);
    });
  } else {
    // 20% chance: Any zone
    targetPool = eligiblePlayers;
  }
  
  // If no targets in weighted pool, fall back to any player
  if (targetPool.length === 0) {
    targetPool = eligiblePlayers;
  }
  
  // Random selection from pool
  return targetPool[Math.floor(Math.random() * targetPool.length)];
}

/**
 * Calculate combat outcome
 */
function calculateCombat(bot: Player, target: Player): {
  botWins: boolean;
  botPower: number;
  targetPower: number;
  resourcesStolen: { metal: number; energy: number };
  xpAwarded: number;
} {
  // Bot power (with specialization bonuses)
  const botSTR = bot.totalStrength || 0;
  const botDEF = bot.totalDefense || 0;
  const botPower = botSTR + (botDEF * 0.5); // DEF contributes 50% to attack power
  
  // Target power (with balance effects)
  const targetSTR = target.totalStrength || 0;
  const targetDEF = target.totalDefense || 0;
  const targetBalanceMultiplier = target.balanceEffects?.powerMultiplier || 1.0;
  const targetPower = (targetSTR * 0.5 + targetDEF) * targetBalanceMultiplier; // STR contributes 50% to defense power
  
  // Combat calculation (with randomness for variety)
  const botRoll = botPower * (0.8 + Math.random() * 0.4); // 80-120% of power
  const targetRoll = targetPower * (0.8 + Math.random() * 0.4);
  
  const botWins = botRoll > targetRoll;
  
  // Calculate resources stolen if bot wins
  let resourcesStolen = { metal: 0, energy: 0 };
  if (botWins) {
    const targetMetal = target.resources?.metal || 0;
    const targetEnergy = target.resources?.energy || 0;
    
    // Bot steals 10-30% of target's resources
    const stealPercentage = 0.10 + Math.random() * 0.20;
    resourcesStolen = {
      metal: Math.floor(targetMetal * stealPercentage),
      energy: Math.floor(targetEnergy * stealPercentage),
    };
  }
  
  // XP awarded to target for defending (even if they lose)
  const xpAwarded = botWins ? 25 : 50; // Less XP if you lose
  
  return {
    botWins,
    botPower: Math.floor(botRoll),
    targetPower: Math.floor(targetRoll),
    resourcesStolen,
    xpAwarded,
  };
}

/**
 * Calculate loot bonus multiplier based on tech unlocks
 */
function calculateLootBonus(target: Player): number {
  const unlockedTechs = target.unlockedTechs || [];
  let bonusMultiplier = 1.0;
  
  if (unlockedTechs.includes('bot-hunter')) {
    bonusMultiplier = LOOT_BONUS_MULTIPLIERS['bot-hunter'];
  }
  
  if (unlockedTechs.includes('advanced-tracking')) {
    bonusMultiplier = LOOT_BONUS_MULTIPLIERS['advanced-tracking'];
  }
  
  return bonusMultiplier;
}

/**
 * Update bot reputation based on defeats
 */
function updateReputation(defeatedCount: number): BotReputation {
  if (defeatedCount >= 31) return BotReputation.Legendary;
  if (defeatedCount >= 16) return BotReputation.Infamous;
  if (defeatedCount >= 6) return BotReputation.Notorious;
  return BotReputation.Unknown;
}

/**
 * Process a single bot attack
 */
export async function processBotAttack(bot: Player, target: Player): Promise<{
  success: boolean;
  botWon: boolean;
  message: string;
  combatLog: {
    attacker: string;
    defender: string;
    botPower: number;
    targetPower: number;
    resourcesStolen: { metal: number; energy: number };
    xpAwarded: number;
    timestamp: Date;
  };
}> {
  const db = await connectToDatabase();
  
  try {
    // Calculate combat
    const combat = calculateCombat(bot, target);
    
    // Prepare updates
    const botUpdates: Record<string, any> = {
      'botConfig.attackCooldown': calculateCooldown(bot.botConfig?.specialization || 'balanced'),
    };
    
    const targetUpdates: Record<string, any> = {
      xp: (target.xp || 0) + combat.xpAwarded,
    };
    
    let message = '';
    
    if (combat.botWins) {
      // Bot wins: Steal resources from target
      botUpdates['resources.metal'] = (bot.resources?.metal || 0) + combat.resourcesStolen.metal;
      botUpdates['resources.energy'] = (bot.resources?.energy || 0) + combat.resourcesStolen.energy;
      
      targetUpdates['resources.metal'] = Math.max(0, (target.resources?.metal || 0) - combat.resourcesStolen.metal);
      targetUpdates['resources.energy'] = Math.max(0, (target.resources?.energy || 0) - combat.resourcesStolen.energy);
      
      message = `${bot.username} attacked and stole ${combat.resourcesStolen.metal} Metal and ${combat.resourcesStolen.energy} Energy!`;
    } else {
      // Target wins: Bot is defeated
      const lootBonus = calculateLootBonus(target);
      const botMetal = bot.resources?.metal || 0;
      const botEnergy = bot.resources?.energy || 0;
      
      const lootMetal = Math.floor(botMetal * lootBonus);
      const lootEnergy = Math.floor(botEnergy * lootBonus);
      
      // Check if this is a Beer Base (special handling)
      const isBeerBase = bot.botConfig?.isSpecialBase === true;
      
      if (isBeerBase) {
        // Beer Bases: Remove completely from database (NOT Full Permanence)
        try {
          await removeBeerBase(bot.username);
          message = `🍺 You defeated Beer Base ${bot.username} and looted ${lootMetal} Metal and ${lootEnergy} Energy! The base has been destroyed! (+${50 + (bot.botConfig?.tier || 1) * 25} XP)`;
        } catch (error) {
          console.error('Failed to remove Beer Base:', error);
          // Fallback to normal defeat handling if removal fails
          botUpdates['resources.metal'] = 0;
          botUpdates['resources.energy'] = 0;
          botUpdates['botConfig.lastDefeated'] = new Date();
        }
      } else {
        // Regular bots: Full Permanence (resources → 0, stay on map)
        botUpdates['resources.metal'] = 0;
        botUpdates['resources.energy'] = 0;
        botUpdates['botConfig.lastDefeated'] = new Date();
        botUpdates['botConfig.defeatedCount'] = (bot.botConfig?.defeatedCount || 0) + 1;
        botUpdates['botConfig.reputation'] = updateReputation((bot.botConfig?.defeatedCount || 0) + 1);
        botUpdates['botConfig.revengeTarget'] = target.username; // Set revenge target
        botUpdates['botConfig.lastResourceRegen'] = new Date(); // Start regeneration timer
        
        message = `You defended against ${bot.username} and looted ${lootMetal} Metal and ${lootEnergy} Energy! (+${50 + (bot.botConfig?.tier || 1) * 25} XP)`;
      }
      
      targetUpdates['resources.metal'] = (target.resources?.metal || 0) + lootMetal;
      targetUpdates['resources.energy'] = (target.resources?.energy || 0) + lootEnergy;
      
      // Bonus XP for defeating bots (extra bonus for Beer Bases)
      const bonusXP = isBeerBase 
        ? (50 + (bot.botConfig?.tier || 1) * 25) * 1.5  // 50% more XP for Beer Bases
        : 50 + (bot.botConfig?.tier || 1) * 25;         // Standard: 75-125 XP
      targetUpdates.xp = (target.xp || 0) + bonusXP;
    }
    
    // Apply updates to database (only if bot still exists - Beer Bases are removed)
    if (Object.keys(botUpdates).length > 0) {
      await db.collection<Player>('players').updateOne(
        { username: bot.username },
        { $set: botUpdates }
      );
    }
    
    await db.collection<Player>('players').updateOne(
      { username: target.username },
      { $set: targetUpdates }
    );
    
    // Create combat log entry
    const combatLog = {
      attacker: bot.username,
      defender: target.username,
      botPower: combat.botPower,
      targetPower: combat.targetPower,
      resourcesStolen: combat.resourcesStolen,
      xpAwarded: combat.xpAwarded,
      timestamp: new Date(),
    };
    
    return {
      success: true,
      botWon: combat.botWins,
      message,
      combatLog,
    };
    
  } catch (error) {
    console.error('[Bot Combat] Attack failed:', error);
    return {
      success: false,
      botWon: false,
      message: 'Combat processing failed',
      combatLog: {
        attacker: bot.username,
        defender: target.username,
        botPower: 0,
        targetPower: 0,
        resourcesStolen: { metal: 0, energy: 0 },
        xpAwarded: 0,
        timestamp: new Date(),
      },
    };
  }
}

/**
 * Run bot attack cycle - processes all bots that can attack
 * Should be run hourly via cron job
 */
export async function runBotAttackCycle(): Promise<{
  processed: number;
  attacks: number;
  botVictories: number;
  playerVictories: number;
  errors: string[];
}> {
  const db = await connectToDatabase();
  const errors: string[] = [];
  let processed = 0;
  let attacks = 0;
  let botVictories = 0;
  let playerVictories = 0;
  
  try {
    // Get all bots and players
    const [bots, players] = await Promise.all([
      db.collection<Player>('players').find({ isBot: true }).toArray(),
      db.collection<Player>('players').find({ isBot: { $ne: true } }).toArray(),
    ]);
    
    console.log(`[Bot Attacks] Processing ${bots.length} bots...`);
    
    for (const bot of bots) {
      try {
        processed++;
        
        // Check if bot can attack (cooldown expired)
        if (!canAttack(bot)) {
          continue;
        }
        
        // Check if bot has any units to attack with
        if (!bot.units || bot.units.length === 0) {
          continue;
        }
        
        // Select target
        const target = await selectTarget(bot, players);
        if (!target) {
          continue;
        }
        
        // Process attack
        const result = await processBotAttack(bot, target);
        if (result.success) {
          attacks++;
          if (result.botWon) {
            botVictories++;
          } else {
            playerVictories++;
          }
          
          console.log(`[Bot Attacks] ${result.message}`);
        }
        
      } catch (botError) {
        const errorMsg = `Failed to process bot attack for ${bot.username}: ${botError}`;
        console.error(`[Bot Attacks] ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    console.log(`[Bot Attacks] Complete - Processed: ${processed}, Attacks: ${attacks}, Bot Wins: ${botVictories}, Player Wins: ${playerVictories}`);
    
    return {
      processed,
      attacks,
      botVictories,
      playerVictories,
      errors,
    };
    
  } catch (error) {
    const errorMsg = `Bot attack cycle failed: ${error}`;
    console.error(`[Bot Attacks] ${errorMsg}`);
    errors.push(errorMsg);
    
    return {
      processed,
      attacks,
      botVictories,
      playerVictories,
      errors,
    };
  }
}

/**
 * Get bot attack history for a player (for UI display)
 */
export async function getBotAttackHistory(username: string, limit: number = 10): Promise<any[]> {
  const db = await connectToDatabase();
  
  try {
    // This would require a combat_log collection in production
    // For now, return empty array (implement when combat log collection is created)
    return [];
  } catch (error) {
    console.error('[Bot Combat] Failed to fetch attack history:', error);
    return [];
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. ZONE-BASED TARGETING:
 *    - Map divided into 9 zones (50×50 each)
 *    - 50% chance to target same zone
 *    - 30% chance to target adjacent zones
 *    - 20% chance to target any zone
 *    - Creates localized combat hotspots
 * 
 * 2. REVENGE SYSTEM:
 *    - 60% chance bot retaliates against last defeater
 *    - Adds personal conflict and consequence to defeating bots
 *    - Revenge target cleared after successful revenge attack
 * 
 * 3. SPECIALIZATION BEHAVIOR:
 *    - Raider: 3x aggression (2-hour cooldown)
 *    - Fortress: 0.5x aggression (12-hour cooldown)
 *    - Hoarder: 0.7x aggression (~8.5-hour cooldown)
 *    - Ghost: 0.3x aggression (20-hour cooldown)
 *    - Balanced: 1x aggression (6-hour cooldown)
 * 
 * 4. COMBAT CALCULATION:
 *    - Bot Power: STR + (DEF × 0.5) - offensive focus
 *    - Player Power: (STR × 0.5) + DEF - defensive focus
 *    - 80-120% randomness for variation
 *    - Balance effects applied to player power
 * 
 * 5. FULL PERMANENCE DEFEAT:
 *    - Defeated bots: resources → 0, stay on map
 *    - lastDefeated timestamp recorded
 *    - defeatedCount incremented
 *    - Reputation updated (Unknown/Notorious/Infamous/Legendary)
 *    - Revenge target set
 *    - Regeneration timer started
 * 
 * 6. LOOT SYSTEM:
 *    - Tech tree unlocks increase loot:
 *      * Bot Hunter: 1.25x (25% bonus)
 *      * Advanced Tracking: 1.75x (75% bonus total)
 *    - Loot = bot's resources × loot multiplier
 *    - XP bonus: 50 + (tier × 25) = 75-125 XP
 * 
 * 7. ATTACK FREQUENCY:
 *    - Base cooldown: 6 hours
 *    - Modified by aggression multiplier
 *    - Bots with no units cannot attack
 *    - Hourly cron job processes all eligible bots
 * 
 * 8. FUTURE ENHANCEMENTS:
 *    - Combat log collection for history tracking
 *    - Notification system for attacks
 *    - Defense structures (walls, turrets)
 *    - Diplomatic options (truces, alliances)
 *    - Territory control mechanics
 */
