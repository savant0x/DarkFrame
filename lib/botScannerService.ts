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
 * - lib/supabase/server.ts: Database access
 * - lib/botNestService.ts: Nest location data
 */

import { createServiceClient } from '@/lib/supabase/server';
import { BOT_NESTS } from './botNestService';

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
  lastDefeated: string | null;
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
  cooldownUntil: string;
  botsFound: number;
}

interface PlayerRow {
  username: string;
  current_x: number;
  current_y: number;
  unlocked_techs: string[];
  resources_metal: number;
  resources_energy: number;
  total_strength: number;
  total_defense: number;
  last_bot_scan?: string | null;
}

interface BotRow {
  username: string;
  specialization: string;
  tier: number;
  current_x: number;
  current_y: number;
  resources_metal: number;
  resources_energy: number;
  reputation: string;
  last_defeated: string | null;
  is_special_base: boolean;
  total_strength: number;
  total_defense: number;
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
function hasScannerUnlocked(unlockedTechs: string[]): boolean {
  return unlockedTechs.includes('bot-hunter');
}

/**
 * Get scanner radius for player
 */
function getScannerRadius(unlockedTechs: string[]): number {
  if (unlockedTechs.includes('advanced-tracking')) {
    return SCANNER_RADIUS.ADVANCED;
  }
  return SCANNER_RADIUS.BASIC;
}

/**
 * Get scanner cooldown duration for player
 */
function getScannerCooldown(unlockedTechs: string[]): number {
  if (unlockedTechs.includes('advanced-tracking')) {
    return SCANNER_COOLDOWNS.ADVANCED;
  }
  return SCANNER_COOLDOWNS.BASIC;
}

/**
 * Check if scanner is on cooldown
 */
function isOnCooldown(
  lastBotScan: string | null | undefined,
  unlockedTechs: string[]
): { onCooldown: boolean; cooldownUntil: string | null } {
  if (!lastBotScan) {
    return { onCooldown: false, cooldownUntil: null };
  }

  const cooldownDuration = getScannerCooldown(unlockedTechs);
  const cooldownEnd = new Date(new Date(lastBotScan).getTime() + cooldownDuration);
  const now = new Date();

  if (now < cooldownEnd) {
    return { onCooldown: true, cooldownUntil: cooldownEnd.toISOString() };
  }

  return { onCooldown: false, cooldownUntil: null };
}

/**
 * Scan for bots within radius
 */
export async function scanForBots(username: string): Promise<ScannerResult> {
  const supabase = createServiceClient();

  try {
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('username, current_x, current_y, unlocked_techs, last_bot_scan')
      .eq('username', username)
      .single();

    if (playerError || !player) {
      return {
        success: false,
        message: 'Player not found',
        bots: [],
        nests: [],
        radius: 0,
        cooldownUntil: new Date().toISOString(),
        botsFound: 0,
      };
    }

    const unlockedTechs = player.unlocked_techs || [];

    if (!hasScannerUnlocked(unlockedTechs)) {
      return {
        success: false,
        message: 'Scanner locked. Unlock "Bot Hunter" tech to use this feature.',
        bots: [],
        nests: [],
        radius: 0,
        cooldownUntil: new Date().toISOString(),
        botsFound: 0,
      };
    }

    const cooldownCheck = isOnCooldown(player.last_bot_scan, unlockedTechs);
    if (cooldownCheck.onCooldown && cooldownCheck.cooldownUntil) {
      const timeLeft = Math.ceil((new Date(cooldownCheck.cooldownUntil).getTime() - Date.now()) / 1000 / 60);
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

    const radius = getScannerRadius(unlockedTechs);
    const playerX = player.current_x;
    const playerY = player.current_y;

    const { data: allBots, error: botsError } = await supabase
      .from('bots')
      .select('username, specialization, tier, current_x, current_y, resources_metal, resources_energy, reputation, last_defeated, is_special_base, total_strength, total_defense');

    if (botsError) {
      console.error('[Bot Scanner] Failed to fetch bots:', botsError);
      return {
        success: false,
        message: 'Scanner malfunction',
        bots: [],
        nests: [],
        radius: 0,
        cooldownUntil: new Date().toISOString(),
        botsFound: 0,
      };
    }

    const allBotsArr = (allBots || []) as BotRow[];

    const scannedBots: ScannedBot[] = allBotsArr
      .map((bot: BotRow) => {
        const botX = bot.current_x;
        const botY = bot.current_y;
        const distance = calculateDistance(playerX, playerY, botX, botY);

        if (distance > radius) return null;

        return {
          username: bot.username,
          specialization: bot.specialization || 'unknown',
          tier: bot.tier || 1,
          position: { x: botX, y: botY },
          distance: Math.round(distance * 10) / 10,
          resources: {
            metal: bot.resources_metal || 0,
            energy: bot.resources_energy || 0,
          },
          reputation: bot.reputation || 'unknown',
          lastDefeated: bot.last_defeated,
          isSpecialBase: bot.is_special_base || false,
          totalStrength: bot.total_strength || 0,
          totalDefense: bot.total_defense || 0,
          armySize: 0,
        };
      })
      .filter((bot): bot is ScannedBot => bot !== null)
      .sort((a, b) => a.distance - b.distance);

    const botUsernames = scannedBots.map(b => b.username);
    if (botUsernames.length > 0) {
      const { data: unitCounts } = await supabase
        .from('player_units')
        .select('player_username, quantity')
        .in('player_username', botUsernames);

      if (unitCounts) {
        const unitMap = new Map<string, number>();
        for (const row of unitCounts) {
          unitMap.set(row.player_username, (unitMap.get(row.player_username) || 0) + (row.quantity || 0));
        }
        for (const bot of scannedBots) {
          bot.armySize = unitMap.get(bot.username) || 0;
        }
      }
    }

    const nestsInRange = BOT_NESTS
      .map(nest => {
        const distance = calculateDistance(playerX, playerY, nest.position.x, nest.position.y);

        if (distance > radius) return null;

        return {
          id: nest.id,
          name: nest.name,
          position: nest.position,
          distance: Math.round(distance * 10) / 10,
        };
      })
      .filter((nest): nest is NonNullable<typeof nest> => nest !== null)
      .sort((a, b) => a.distance - b.distance);

    const cooldownEnd = new Date(Date.now() + getScannerCooldown(unlockedTechs));
    await supabase
      .from('players')
      .update({ last_bot_scan: new Date().toISOString() })
      .eq('username', username);

    return {
      success: true,
      message: `Scanner detected ${scannedBots.length} bots within ${radius} tiles`,
      bots: scannedBots,
      nests: nestsInRange,
      radius,
      cooldownUntil: cooldownEnd.toISOString(),
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
      cooldownUntil: new Date().toISOString(),
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
  cooldownUntil: string | null;
  hasAdvancedTracking: boolean;
}> {
  const supabase = createServiceClient();

  try {
    const { data: player, error } = await supabase
      .from('players')
      .select('unlocked_techs, last_bot_scan')
      .eq('username', username)
      .single();

    if (error || !player) {
      return {
        unlocked: false,
        radius: 0,
        cooldownMinutes: 60,
        onCooldown: false,
        cooldownUntil: null,
        hasAdvancedTracking: false,
      };
    }

    const unlockedTechs = player.unlocked_techs || [];
    const unlocked = hasScannerUnlocked(unlockedTechs);
    const radius = getScannerRadius(unlockedTechs);
    const cooldownMs = getScannerCooldown(unlockedTechs);
    const cooldownCheck = isOnCooldown(player.last_bot_scan, unlockedTechs);
    const hasAdvancedTracking = unlockedTechs.includes('advanced-tracking');

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
 *    - Timestamp stored in player.last_bot_scan
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
