/**
 * Bot Scanner Service - Tech-Gated Bot Detection System
 * Created: 2024-10-18
 * 
 * OVERVIEW:
 * Provides bot detection capabilities for players who have unlocked the Bot Hunter
 * tech tree. Scans for bots within a radius, showing their type, resources, reputation,
 * and location information. Includes cooldown management and nest detection.
 * 
 * KEY FEATURES:
 * - Tech-Gated: Requires "BOT_HUNTER" unlock to use
 * - Radius Scanning: 50 tiles (100 with "ADVANCED_TRACKING")
 * - Cooldown System: 1 hour (30 min with upgrade)
 * - Bot Information: Type, coords, distance, resources, reputation, last defeated
 * - Nest Detection: Shows all bot nests on map
 * - Beer Base Highlighting: Special markers for Beer Bases
 * 
 * TECH REQUIREMENTS:
 * - Tier 1 (BOT_HUNTER): Basic scanner (50 tiles, 1-hour cooldown)
 * - Tier 2 (ADVANCED_TRACKING): Enhanced scanner (100 tiles, 30-min cooldown, movement history)
 * 
 * DEPENDENCIES:
 * - lib/mongodb.ts: Database access
 * - lib/botNestService.ts: Nest location data
 * - types/game.types.ts: Player types
 */

import { connectToDatabase } from './mongodb';
import { BOT_NESTS } from './botNestService';
import type { Player } from '@/types/game.types';

/**
 * Scanner cooldown durations (in milliseconds)
 */
const SCANNER_COOLDOWNS = {
  BASIC: 60 * 60 * 1000,      // 1 hour
  ADVANCED: 30 * 60 * 1000,   // 30 minutes
} as const;

/**
 * Scanner radius limits
 */
const SCANNER_RADIUS = {
  BASIC: 50,      // 50 tiles
  ADVANCED: 100,  // 100 tiles
} as const;

/**
 * Scanned bot information
 */
export interface ScannedBot {
  username: string;
  specialization: string;
  tier: number;
  position: { x: number; y: number };
  distance: number;
  resources: { metal: number; energy: number };
  reputation: string;
  lastDefeated: Date | null;
  isSpecialBase: boolean;
  totalStrength: number;
  totalDefense: number;
  armySize: number;
}

/**
 * Scanner result
 */
export interface ScannerResult {
  success: boolean;
  message: string;
  bots: ScannedBot[];
  nests: Array<{
    id: number;
    name: string;
    position: { x: number; y: number };
    distance: number;
  }>;
  radius: number;
  cooldownUntil: Date;
  botsFound: number;
}

/**
 * Calculate distance between two points
 */
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if player has scanner unlocked
 */
function hasScannerUnlocked(player: Player): boolean {
  const unlockedTechs = player.unlockedTechs || [];
  return unlockedTechs.includes('bot-hunter');
}

/**
 * Get scanner radius for player
 */
function getScannerRadius(player: Player): number {
  const unlockedTechs = player.unlockedTechs || [];
  
  if (unlockedTechs.includes('advanced-tracking')) {
    return SCANNER_RADIUS.ADVANCED;
  }
  
  return SCANNER_RADIUS.BASIC;
}

/**
 * Get scanner cooldown duration for player
 */
function getScannerCooldown(player: Player): number {
  const unlockedTechs = player.unlockedTechs || [];
  
  if (unlockedTechs.includes('advanced-tracking')) {
    return SCANNER_COOLDOWNS.ADVANCED;
  }
  
  return SCANNER_COOLDOWNS.BASIC;
}

/**
 * Check if scanner is on cooldown
 */
function isOnCooldown(player: Player): { onCooldown: boolean; cooldownUntil: Date | null } {
  // Cooldown tracking would be stored in player document
  // For now, we'll use a simple timestamp check
  const lastScan = (player as any).lastBotScan as Date | undefined;
  
  if (!lastScan) {
    return { onCooldown: false, cooldownUntil: null };
  }
  
  const cooldownDuration = getScannerCooldown(player);
  const cooldownEnd = new Date(new Date(lastScan).getTime() + cooldownDuration);
  const now = new Date();
  
  if (now < cooldownEnd) {
    return { onCooldown: true, cooldownUntil: cooldownEnd };
  }
  
  return { onCooldown: false, cooldownUntil: null };
}

/**
 * Scan for bots within radius
 */
export async function scanForBots(username: string): Promise<ScannerResult> {
  const db = await connectToDatabase();
  
  try {
    // Get player
    const player = await db.collection<Player>('players').findOne({ username });
    
    if (!player) {
      return {
        success: false,
        message: 'Player not found',
        bots: [],
        nests: [],
        radius: 0,
        cooldownUntil: new Date(),
        botsFound: 0,
      };
    }
    
    // Check if player has scanner unlocked
    if (!hasScannerUnlocked(player)) {
      return {
        success: false,
        message: 'Scanner locked. Unlock "Bot Hunter" tech to use this feature.',
        bots: [],
        nests: [],
        radius: 0,
        cooldownUntil: new Date(),
        botsFound: 0,
      };
    }
    
    // Check cooldown
    const cooldownCheck = isOnCooldown(player);
    if (cooldownCheck.onCooldown && cooldownCheck.cooldownUntil) {
      const timeLeft = Math.ceil((cooldownCheck.cooldownUntil.getTime() - Date.now()) / 1000 / 60);
      return {
        success: false,
        message: `Scanner on cooldown. Available in ${timeLeft} minutes.`,
        bots: [],
        nests: [],
        radius: 0,
        cooldownUntil: cooldownCheck.cooldownUntil,
        botsFound: 0,
      };
    }
    
    // Get scanner parameters
    const radius = getScannerRadius(player);
    const playerX = player.currentPosition.x;
    const playerY = player.currentPosition.y;
    
    // Find all bots
    const allBots = await db.collection<Player>('players')
      .find({ isBot: true })
      .toArray();
    
    // Filter bots within radius and map to ScannedBot format
    const scannedBots: ScannedBot[] = allBots
      .map((bot: any) => {
        const botX = bot.currentPosition.x;
        const botY = bot.currentPosition.y;
        const distance = calculateDistance(playerX, playerY, botX, botY);
        
        if (distance > radius) return null;
        
        return {
          username: bot.username,
          specialization: bot.botConfig?.specialization || 'unknown',
          tier: bot.botConfig?.tier || 1,
          position: { x: botX, y: botY },
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal
          resources: {
            metal: bot.resources?.metal || 0,
            energy: bot.resources?.energy || 0,
          },
          reputation: bot.botConfig?.reputation || 'unknown',
          lastDefeated: bot.botConfig?.lastDefeated || null,
          isSpecialBase: bot.botConfig?.isSpecialBase || false,
          totalStrength: bot.totalStrength || 0,
          totalDefense: bot.totalDefense || 0,
          armySize: bot.units?.length || 0,
        };
      })
      .filter((bot: any): bot is ScannedBot => bot !== null)
      .sort((a: any, b: any) => a.distance - b.distance); // Sort by distance (closest first)
    
    // Find nests within radius
    const nestsInRange = BOT_NESTS
      .map((nest: any) => {
        const distance = calculateDistance(playerX, playerY, nest.position.x, nest.position.y);
        
        if (distance > radius) return null;
        
        return {
          id: nest.id,
          name: nest.name,
          position: nest.position,
          distance: Math.round(distance * 10) / 10,
        };
      })
      .filter((nest: any) => nest !== null)
      .sort((a: any, b: any) => a!.distance - b!.distance);
    
    // Update last scan timestamp and set cooldown
    const cooldownEnd = new Date(Date.now() + getScannerCooldown(player));
    await db.collection<Player>('players').updateOne(
      { username },
      { $set: { lastBotScan: new Date() } }
    );
    
    return {
      success: true,
      message: `Scanner detected ${scannedBots.length} bots within ${radius} tiles`,
      bots: scannedBots,
      nests: nestsInRange as any,
      radius,
      cooldownUntil: cooldownEnd,
      botsFound: scannedBots.length,
    };
    
  } catch (error) {
    console.error('[Bot Scanner] Scan failed:', error);
    return {
      success: false,
      message: 'Scanner malfunction',
      bots: [],
      nests: [],
      radius: 0,
      cooldownUntil: new Date(),
      botsFound: 0,
    };
  }
}

/**
 * Get scanner status (for UI display)
 */
export async function getScannerStatus(username: string): Promise<{
  unlocked: boolean;
  radius: number;
  cooldownMinutes: number;
  onCooldown: boolean;
  cooldownUntil: Date | null;
  hasAdvancedTracking: boolean;
}> {
  const db = await connectToDatabase();
  
  try {
    const player = await db.collection<Player>('players').findOne({ username });
    
    if (!player) {
      return {
        unlocked: false,
        radius: 0,
        cooldownMinutes: 60,
        onCooldown: false,
        cooldownUntil: null,
        hasAdvancedTracking: false,
      };
    }
    
    const unlocked = hasScannerUnlocked(player);
    const radius = getScannerRadius(player);
    const cooldownMs = getScannerCooldown(player);
    const cooldownCheck = isOnCooldown(player);
    const hasAdvancedTracking = (player.unlockedTechs || []).includes('advanced-tracking');
    
    return {
      unlocked,
      radius,
      cooldownMinutes: cooldownMs / (60 * 1000),
      onCooldown: cooldownCheck.onCooldown,
      cooldownUntil: cooldownCheck.cooldownUntil,
      hasAdvancedTracking,
    };
    
  } catch (error) {
    console.error('[Bot Scanner] Failed to get status:', error);
    return {
      unlocked: false,
      radius: 0,
      cooldownMinutes: 60,
      onCooldown: false,
      cooldownUntil: null,
      hasAdvancedTracking: false,
    };
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. TECH GATING:
 *    - Scanner requires "BOT_HUNTER" tech unlock (Tier 1)
 *    - Enhanced features require "ADVANCED_TRACKING" (Tier 2)
 *    - Future techs can add more scanner abilities
 * 
 * 2. RADIUS SYSTEM:
 *    - Basic: 50 tiles (covers ~7,850 tiles)
 *    - Advanced: 100 tiles (covers ~31,400 tiles)
 *    - Distance calculated using Euclidean formula
 *    - Results sorted by distance (closest first)
 * 
 * 3. COOLDOWN MANAGEMENT:
 *    - Basic: 1 hour between scans
 *    - Advanced: 30 minutes between scans
 *    - Timestamp stored in player.lastBotScan
 *    - Cooldown set when scan is executed
 * 
 * 4. INFORMATION DISPLAYED:
 *    - Bot username, specialization, tier
 *    - Exact coordinates and distance
 *    - Resources (Metal/Energy)
 *    - Reputation tier (Unknown/Notorious/Infamous/Legendary)
 *    - Last defeated timestamp
 *    - Beer Base indicator (isSpecialBase)
 *    - Army stats (STR/DEF/size)
 * 
 * 5. NEST DETECTION:
 *    - All nests within radius shown
 *    - Nest name, position, distance
 *    - Helps players find bot clusters
 *    - Strategic farming zone identification
 * 
 * 6. SPECIAL BASE HIGHLIGHTING:
 *    - Beer Bases flagged with isSpecialBase
 *    - UI can show special icon/color
 *    - Higher value targets for players
 * 
 * 7. PERFORMANCE:
 *    - Single query for all bots
 *    - Client-side filtering by radius
 *    - Efficient distance calculations
 *    - Sorted results for better UX
 * 
 * 8. FUTURE ENHANCEMENTS:
 *    - Movement history tracking (Advanced Tracking)
 *    - Prediction of bot movement patterns
 *    - Notification when Beer Base spawns nearby
 *    - Bookmarking favorite bot locations
 *    - Scanner range visualization on map
 */
