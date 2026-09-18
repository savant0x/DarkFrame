/**
 * 📅 Created: 2025-01-18
 * 🎯 OVERVIEW:
 * Anti-Cheat Detection Service
 *
 * Comprehensive cheat detection system that monitors player behavior for:
 * - Speed hacking (impossible movement rates)
 * - Resource hacking (gains exceeding theoretical maximums)
 * - Cooldown violations (actions performed too quickly)
 * - Bot-like behavior (inhuman timing patterns)
 * - Session abuse (excessive play times)
 * - Theoretical max violations (stats exceeding game limits)
 *
 * All detections automatically create PlayerFlag records with evidence
 * for admin review and potential automated banning.
 *
 * FID-20260917-017 slice 1 (correctness rewrite): every query below previously
 * ran through the Mongo compat shim filtering on `username` / `actionType` —
 * neither is a `player_activity` column (`player_id`, `action`), and the
 * shim's buildWhere silently DROPS unmapped keys, so every "per-player"
 * analysis actually scanned all players' rows filtered on time alone. This
 * file now queries drizzle directly with real per-player predicates.
 *
 * Writer vocabulary (lib/activityLogger.ts — the only live writer):
 *   player_activity: id, player_id (= username), action, timestamp,
 *                    details (jsonb — reserved for lib/activityLogService),
 *                    session_id, metadata (jsonb).
 *   Detection fields live in `metadata`: movement writes
 *   {location, result} (logMovement) — the move route enriches it with
 *   {from, to} after calling logMovement so the rate detector has geometry.
 */

import { and, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerActivity, playerFlags, players } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';

/**
 * Detector action vocabulary → the writer's `player_activity.action` values.
 * lib/activityLogger.ts writes 'move' (logMovement) and 'harvest' (logHarvest);
 * the historical detector names ('movement', 'attack', 'factory') are kept as
 * the detector's own parameter vocabulary and translated here, so call sites
 * and cooldown tables stay readable.
 */
const ACTIVITY_ACTIONS = {
  movement: 'move',
  harvest: 'harvest',
  attack: 'attack',
  factory: 'factory_build',
} as const;

/** Shape of a `player_activity` row as consumed by the detector. */
interface ActivityRow {
  playerId: string;
  action: string;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}

/** Movement geometry written by the move route (after logMovement). */
interface MovementGeometry {
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

/** User-defined type guard for metadata point values (Law 6 trust boundary). */
function isPoint(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false;
  const p = value as Record<string, unknown>;
  return typeof p.x === 'number' && typeof p.y === 'number';
}

function readMovementGeometry(row: ActivityRow): MovementGeometry {
  const meta = row.metadata;
  if (!meta) return {};
  const from = meta.from;
  const to = meta.to;
  return {
    from: isPoint(from) ? { x: from.x, y: from.y } : undefined,
    to: isPoint(to) ? { x: to.x, y: to.y } : undefined,
  };
}

/** Narrow a drizzle metadata jsonb value to a plain JSON record (or null). */
function asMetadata(value: unknown): Record<string, DocumentValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, DocumentValue>)
    : null;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * DocumentValue is the detector's public metadata value type. It stays a
 * JSON-compatible union (the shim exported the type this file used to
 * import); the concrete pg rows below are plain jsonb records.
 */
type DocumentValue = string | number | boolean | null | DocumentValue[] | { [key: string]: DocumentValue };

export interface DetectionResult {
  suspicious: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  flagType: string;
  evidence: string;
  metadata?: Record<string, DocumentValue>;
}

export interface PlayerFlag {
  username: string;
  flagType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  evidence: string;
  metadata?: Record<string, DocumentValue>;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// ============================================================================
// Detection Thresholds & Configuration
// ============================================================================

const THRESHOLDS = {
  // Movement detection
  MAX_MOVEMENT_RATE: 1.5, // tiles per second (1 tile/action + buffer)
  IMPOSSIBLE_DISTANCE: 10, // tiles in single action

  // Resource detection
  HARVEST_VARIANCE_TOLERANCE: 1.2, // 20% over max acceptable
  MAX_SINGLE_HARVEST: 10000, // Per-action maximum

  // Cooldown detection
  MIN_ACTION_DELAY: 500, // milliseconds between actions
  HARVEST_COOLDOWN: 3000, // 3 seconds
  ATTACK_COOLDOWN: 5000, // 5 seconds

  // Bot behavior detection
  PERFECT_TIMING_THRESHOLD: 0.98, // 98% identical timing = suspicious
  MIN_ACTIONS_FOR_PATTERN: 10, // Need this many to detect patterns

  // Session abuse
  MAX_SESSION_HOURS: 14, // Hours in single session
  SUSPICIOUS_SESSION_HOURS: 10, // Flag for review

  // Theoretical maximums
  MAX_RESOURCES_PER_HOUR: 100000, // Based on game mechanics
  MAX_TIER_LEVEL: 6,
  MAX_RANK: 10
};

// ============================================================================
// Speed Hack Detection
// ============================================================================

/**
 * Detect impossible movement speeds
 * Checks if player moved too far in too little time
 *
 * @param username - Player username
 * @param fromPos - Starting position {x, y}
 * @param toPos - Ending position {x, y}
 * @param timestamp - Current time
 * @returns Detection result with evidence
 */
export async function detectSpeedHack(
  username: string,
  fromPos: { x: number; y: number },
  toPos: { x: number; y: number },
  timestamp: number,
  // FID-20260914-001: step-normalized thresholds — a troop-transport move
  // legitimately covers up to 5 tiles per action (gated server-side on tech
  // ownership), so both thresholds scale with the verified step count.
  // Default 1 keeps every pre-existing call site behavior-identical.
  steps = 1
): Promise<DetectionResult> {
  try {
    // Calculate distance moved (accounting for map wrapping on 1-150 grid)
    const MAP_SIZE = 150;
    const dx = Math.abs(toPos.x - fromPos.x);
    const dy = Math.abs(toPos.y - fromPos.y);

    // For wrapping maps, shortest distance could be direct or wrapped
    // Example: x=1 to x=150 is distance 1 (wrapping), not 149 (direct)
    const wrappedDx = Math.min(dx, MAP_SIZE - dx);
    const wrappedDy = Math.min(dy, MAP_SIZE - dy);
    const distance = wrappedDx + wrappedDy;

    // Check for impossible single-move distance (scaled by verified steps)
    if (distance > THRESHOLDS.IMPOSSIBLE_DISTANCE * steps) {
      await createFlag({
        username,
        flagType: 'SPEED_HACK',
        severity: 'CRITICAL',
        description: 'Impossible movement distance detected',
        evidence: `Moved ${distance} tiles in single action (max: ${THRESHOLDS.IMPOSSIBLE_DISTANCE * steps})`,
        metadata: { fromPos, toPos, distance, timestamp }
      });

      return {
        suspicious: true,
        severity: 'CRITICAL',
        flagType: 'SPEED_HACK',
        evidence: `Teleportation detected: ${distance} tiles`,
        metadata: { distance, fromPos, toPos }
      };
    }

    // Get the suspect's recent movement activities — the per-player predicate
    // (player_id = username) is the whole point of this rewrite; the shim
    // version silently dropped it and analyzed ALL players' rows.
    const windowStart = new Date(timestamp - 10000); // Last 10 seconds
    const rows = await db
      .select({
        playerId: playerActivity.playerId,
        action: playerActivity.action,
        timestamp: playerActivity.timestamp,
        metadata: playerActivity.metadata,
      })
      .from(playerActivity)
      .where(
        and(
          eq(playerActivity.playerId, username),
          eq(playerActivity.action, ACTIVITY_ACTIONS.movement),
          gt(playerActivity.timestamp, windowStart)
        )
      )
      .orderBy(desc(playerActivity.timestamp))
      .limit(5);

    const recentMoves: ActivityRow[] = rows.map((r) => ({
      playerId: r.playerId,
      action: r.action,
      timestamp: r.timestamp,
      metadata: asMetadata(r.metadata),
    }));

    if (recentMoves.length < 2) {
      return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Insufficient data' };
    }

    // Calculate movement rate
    const oldestMove = recentMoves[recentMoves.length - 1];
    const timeDiff = (timestamp - oldestMove.timestamp.getTime()) / 1000; // seconds
    if (timeDiff <= 0) {
      return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Insufficient data' };
    }
    const totalDistance = recentMoves.reduce((sum, move) => {
      const geometry = readMovementGeometry(move);
      if (!geometry.from || !geometry.to) return sum;
      return sum + Math.abs(geometry.to.x - geometry.from.x) + Math.abs(geometry.to.y - geometry.from.y);
    }, 0);

    const movementRate = totalDistance / timeDiff;

    // Flag if movement rate exceeds threshold (scaled by verified steps)
    if (movementRate > THRESHOLDS.MAX_MOVEMENT_RATE * steps) {
      const severity =
        movementRate > THRESHOLDS.MAX_MOVEMENT_RATE * steps * 2 ? 'HIGH' : 'MEDIUM';

      await createFlag({
        username,
        flagType: 'SPEED_HACK',
        severity,
        description: 'Excessive movement speed detected',
        evidence: `Moving at ${movementRate.toFixed(2)} tiles/sec (max: ${THRESHOLDS.MAX_MOVEMENT_RATE * steps})`,
        metadata: { movementRate, recentMoves: recentMoves.length, timeDiff }
      });

      return {
        suspicious: true,
        severity,
        flagType: 'SPEED_HACK',
        evidence: `Speed: ${movementRate.toFixed(2)} tiles/sec`,
        metadata: { movementRate, threshold: THRESHOLDS.MAX_MOVEMENT_RATE }
      };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Movement rate normal' };

  } catch (error) {
    console.error('Speed hack detection error:', error);
    return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Detection error' };
  }
}

// ============================================================================
// Resource Hack Detection
// ============================================================================

/**
 * Detect impossible resource gains
 * Checks if harvested resources exceed tier maximums
 *
 * @param username - Player username
 * @param resourceType - Type of resource gained
 * @param amount - Amount gained
 * @param playerTier - Player's current tier
 * @returns Detection result with evidence
 */
export async function detectResourceHack(
  username: string,
  resourceType: string,
  amount: number,
  playerTier: number
): Promise<DetectionResult> {
  try {
    // Get player data to calculate actual bonuses (flat pg numeric columns).
    const [player] = await db
      .select({
        gatheringBonusMetalBonus: players.gatheringBonusMetalBonus,
        gatheringBonusEnergyBonus: players.gatheringBonusEnergyBonus,
        activeBoostsGatheringBoost: players.activeBoostsGatheringBoost,
        shrineBoosts: players.shrineBoosts,
      })
      .from(players)
      .where(eq(players.username, username))
      .limit(1);

    if (!player) {
      return { suspicious: false, severity: 'LOW', flagType: 'RESOURCE_HACK', evidence: 'Player not found' };
    }

    // Calculate base tier maximums (base harvest range is 800-1500)
    const tierMaximumsPerAction: Record<number, number> = {
      1: 1500,   // Base max
      2: 2000,
      3: 3000,
      4: 5000,
      5: 8000,
      6: 12000
    };

    const baseTierMax = tierMaximumsPerAction[playerTier] || 1500;

    // Calculate player's actual bonuses
    let totalBonusPercent = 0;

    // 1. Permanent gathering bonus (from digger items) — flat numeric columns
    const permanentBonus = resourceType === 'metal'
      ? Number(player.gatheringBonusMetalBonus)
      : Number(player.gatheringBonusEnergyBonus);
    totalBonusPercent += permanentBonus;

    // 2. Shrine boosts (jsonb array of {tier, expiresAt, yieldBonus})
    let shrineBonus = 0;
    if (Array.isArray(player.shrineBoosts)) {
      const now = new Date();
      const activeShrineBoosts = player.shrineBoosts.filter(
        (boost) => new Date(boost.expiresAt) > now
      );
      shrineBonus = activeShrineBoosts.reduce((sum, boost) => {
        return sum + ((boost.yieldBonus || 0) * 100); // Convert 0.25 to 25%
      }, 0);
      totalBonusPercent += shrineBonus;
    }

    // 3. Temporary gathering boost — flat numeric column (percent units)
    const temporaryBonus = player.activeBoostsGatheringBoost
      ? Number(player.activeBoostsGatheringBoost)
      : 0;
    totalBonusPercent += temporaryBonus;

    // 4. Balance effects (can add up to ~50% bonus or penalty)
    // We'll add a buffer for balance bonuses
    const balanceBuffer = 50; // Assume max 50% bonus from perfect balance

    // Calculate theoretical maximum with all bonuses
    // Formula: baseTierMax * (1 + totalBonusPercent/100 + balanceBuffer/100)
    const theoreticalMax = baseTierMax * (1 + totalBonusPercent / 100 + balanceBuffer / 100);

    // Add generous tolerance (3x multiplier for edge cases and future-proofing)
    // This allows for unexpected bonus stacking and future features
    const toleranceMax = theoreticalMax * 3;

    // Absolute maximum (should never exceed this under any circumstances)
    // Set to 15,000 to allow max tier + max bonuses to reach ~10k with breathing room
    const ABSOLUTE_MAX = 15000;

    // Check for blatant hacking (exceeds absolute maximum)
    if (amount > ABSOLUTE_MAX) {
      await createFlag({
        username,
        flagType: 'RESOURCE_HACK',
        severity: 'CRITICAL',
        description: 'Impossible resource gain detected',
        evidence: `Gained ${amount} ${resourceType} in single action (absolute max: ${ABSOLUTE_MAX})`,
        metadata: {
          resourceType,
          amount,
          playerTier,
          baseTierMax,
          totalBonusPercent,
          theoreticalMax,
          absoluteMax: ABSOLUTE_MAX
        }
      });

      return {
        suspicious: true,
        severity: 'CRITICAL',
        flagType: 'RESOURCE_HACK',
        evidence: `Impossible gain: ${amount} ${resourceType} (max possible: ${ABSOLUTE_MAX})`,
        metadata: { amount, maxPossible: ABSOLUTE_MAX }
      };
    }

    // Check for exceeding calculated maximum with tolerance
    if (amount > toleranceMax) {
      await createFlag({
        username,
        flagType: 'RESOURCE_HACK',
        severity: 'HIGH',
        description: 'Resource gain exceeds calculated maximum',
        evidence: `Gained ${amount} ${resourceType} (tier ${playerTier} base: ${baseTierMax}, bonuses: ${totalBonusPercent.toFixed(1)}%, theoretical: ${theoreticalMax.toFixed(0)}, tolerance: ${toleranceMax.toFixed(0)})`,
        metadata: {
          resourceType,
          amount,
          playerTier,
          baseTierMax,
          totalBonusPercent,
          theoreticalMax,
          toleranceMax,
          permanentBonus,
          shrineBonus
        }
      });

      return {
        suspicious: true,
        severity: 'HIGH',
        flagType: 'RESOURCE_HACK',
        evidence: `Exceeded calculated max: ${amount} vs ${toleranceMax.toFixed(0)} (with bonuses)`,
        metadata: { amount, theoreticalMax, toleranceMax, totalBonusPercent }
      };
    }

    // Log successful validation for debugging (optional)
    if (amount > baseTierMax) {
      console.log(`✅ Large harvest validated for ${username}: ${amount} ${resourceType} (base: ${baseTierMax}, bonuses: ${totalBonusPercent.toFixed(1)}%, theoretical: ${theoreticalMax.toFixed(0)})`);
    }

    return { suspicious: false, severity: 'LOW', flagType: 'RESOURCE_HACK', evidence: 'Resource gain normal' };

  } catch (error) {
    console.error('Resource hack detection error:', error);
    return { suspicious: false, severity: 'LOW', flagType: 'RESOURCE_HACK', evidence: 'Detection error' };
  }
}

// ============================================================================
// Cooldown Violation Detection
// ============================================================================

/**
 * Detect actions performed before cooldown expires
 * Checks timestamps between consecutive actions
 *
 * @param username - Player username
 * @param actionType - Type of action (harvest, attack, etc)
 * @param timestamp - Current action timestamp
 * @returns Detection result with evidence
 */
export async function detectCooldownViolation(
  username: string,
  actionType: string,
  timestamp: number
): Promise<DetectionResult> {
  try {
    // Get the suspect's last action of this type. The shim version filtered on
    // `username` + `actionType` — two non-existent columns — so the "last
    // action" was actually the newest row from ANY player of ANY type.
    const writerAction =
      ACTIVITY_ACTIONS[actionType as keyof typeof ACTIVITY_ACTIONS] ?? actionType;
    const [lastAction] = await db
      .select({ timestamp: playerActivity.timestamp })
      .from(playerActivity)
      .where(
        and(
          eq(playerActivity.playerId, username),
          eq(playerActivity.action, writerAction),
          lt(playerActivity.timestamp, new Date(timestamp))
        )
      )
      .orderBy(desc(playerActivity.timestamp))
      .limit(1);

    if (!lastAction) {
      return { suspicious: false, severity: 'LOW', flagType: 'COOLDOWN_VIOLATION', evidence: 'First action' };
    }

    const timeSinceLastAction = timestamp - lastAction.timestamp.getTime();

    // Determine required cooldown
    const cooldownRequirements: Record<string, number> = {
      harvest: THRESHOLDS.HARVEST_COOLDOWN,
      attack: THRESHOLDS.ATTACK_COOLDOWN,
      movement: THRESHOLDS.MIN_ACTION_DELAY,
      factory: THRESHOLDS.MIN_ACTION_DELAY
    };

    const requiredCooldown = cooldownRequirements[actionType] || THRESHOLDS.MIN_ACTION_DELAY;

    // Check for violation
    if (timeSinceLastAction < requiredCooldown) {
      const severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' =
        timeSinceLastAction < requiredCooldown / 2 ? 'HIGH' : 'MEDIUM';

      await createFlag({
        username,
        flagType: 'COOLDOWN_VIOLATION',
        severity,
        description: 'Action performed before cooldown expired',
        evidence: `${actionType} performed ${timeSinceLastAction}ms after last action (required: ${requiredCooldown}ms)`,
        metadata: { actionType, timeSinceLastAction, requiredCooldown }
      });

      return {
        suspicious: true,
        severity,
        flagType: 'COOLDOWN_VIOLATION',
        evidence: `Cooldown: ${timeSinceLastAction}ms vs ${requiredCooldown}ms`,
        metadata: { timeSinceLastAction, requiredCooldown, actionType }
      };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'COOLDOWN_VIOLATION', evidence: 'Cooldown respected' };

  } catch (error) {
    console.error('Cooldown violation detection error:', error);
    return { suspicious: false, severity: 'LOW', flagType: 'COOLDOWN_VIOLATION', evidence: 'Detection error' };
  }
}

// ============================================================================
// Bot Behavior Detection
// ============================================================================

/**
 * Detect inhuman timing patterns
 * Analyzes action timestamps for perfect consistency
 *
 * @param username - Player username
 * @returns Detection result with evidence
 */
export async function detectBotBehavior(username: string): Promise<DetectionResult> {
  try {
    // Get the suspect's recent actions (all types) — per-player predicate.
    const rows = await db
      .select({ timestamp: playerActivity.timestamp })
      .from(playerActivity)
      .where(eq(playerActivity.playerId, username))
      .orderBy(desc(playerActivity.timestamp))
      .limit(THRESHOLDS.MIN_ACTIONS_FOR_PATTERN * 2);

    if (rows.length < THRESHOLDS.MIN_ACTIONS_FOR_PATTERN) {
      return { suspicious: false, severity: 'LOW', flagType: 'BOT_BEHAVIOR', evidence: 'Insufficient data' };
    }

    // Calculate time intervals between actions
    const intervals: number[] = [];
    for (let i = 0; i < rows.length - 1; i++) {
      intervals.push(rows[i].timestamp.getTime() - rows[i + 1].timestamp.getTime());
    }

    // Calculate variance in timing
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    if (avgInterval <= 0) {
      return { suspicious: false, severity: 'LOW', flagType: 'BOT_BEHAVIOR', evidence: 'Timing patterns human' };
    }
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgInterval;

    // Low variation = bot-like behavior
    if (coefficientOfVariation < (1 - THRESHOLDS.PERFECT_TIMING_THRESHOLD)) {
      await createFlag({
        username,
        flagType: 'BOT_BEHAVIOR',
        severity: 'HIGH',
        description: 'Inhuman timing consistency detected',
        evidence: `Action timing 98%+ consistent (CV: ${(coefficientOfVariation * 100).toFixed(2)}%)`,
        metadata: { coefficientOfVariation, avgInterval, stdDev, actionCount: intervals.length }
      });

      return {
        suspicious: true,
        severity: 'HIGH',
        flagType: 'BOT_BEHAVIOR',
        evidence: `Perfect timing: ${(coefficientOfVariation * 100).toFixed(2)}% variation`,
        metadata: { coefficientOfVariation, avgInterval }
      };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'BOT_BEHAVIOR', evidence: 'Timing patterns human' };

  } catch (error) {
    console.error('Bot behavior detection error:', error);
    return { suspicious: false, severity: 'LOW', flagType: 'BOT_BEHAVIOR', evidence: 'Detection error' };
  }
}

// ============================================================================
// Session Abuse Detection
// ============================================================================

/**
 * Detect excessive session durations
 * Flags sessions exceeding reasonable play times
 *
 * @param username - Player username
 * @param sessionDuration - Duration in milliseconds
 * @returns Detection result with evidence
 */
export async function detectSessionAbuse(
  username: string,
  sessionDuration: number
): Promise<DetectionResult> {
  try {
    const hours = sessionDuration / (1000 * 60 * 60);

    // Critical flag for extreme sessions
    if (hours > THRESHOLDS.MAX_SESSION_HOURS) {
      await createFlag({
        username,
        flagType: 'SESSION_ABUSE',
        severity: 'CRITICAL',
        description: 'Excessive session duration detected',
        evidence: `Session duration: ${hours.toFixed(1)} hours (max: ${THRESHOLDS.MAX_SESSION_HOURS})`,
        metadata: { sessionDuration, hours }
      });

      return {
        suspicious: true,
        severity: 'CRITICAL',
        flagType: 'SESSION_ABUSE',
        evidence: `Session: ${hours.toFixed(1)} hours`,
        metadata: { hours, maxHours: THRESHOLDS.MAX_SESSION_HOURS }
      };
    }

    // Medium flag for suspicious but possible sessions
    if (hours > THRESHOLDS.SUSPICIOUS_SESSION_HOURS) {
      await createFlag({
        username,
        flagType: 'SESSION_ABUSE',
        severity: 'MEDIUM',
        description: 'Unusually long session detected',
        evidence: `Session duration: ${hours.toFixed(1)} hours (suspicious threshold: ${THRESHOLDS.SUSPICIOUS_SESSION_HOURS})`,
        metadata: { sessionDuration, hours }
      });

      return {
        suspicious: true,
        severity: 'MEDIUM',
        flagType: 'SESSION_ABUSE',
        evidence: `Long session: ${hours.toFixed(1)} hours`,
        metadata: { hours, threshold: THRESHOLDS.SUSPICIOUS_SESSION_HOURS }
      };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'SESSION_ABUSE', evidence: 'Session duration normal' };

  } catch (error) {
    console.error('Session abuse detection error:', error);
    return { suspicious: false, severity: 'LOW', flagType: 'SESSION_ABUSE', evidence: 'Detection error' };
  }
}

// ============================================================================
// Theoretical Maximum Violations
// ============================================================================

/**
 * Detect stats that exceed game-defined maximums
 * Checks player stats against theoretical limits
 *
 * @param username - Player username
 * @param playerData - Player's current stats
 * @returns Detection result with evidence
 */
/** Player snapshot consumed by the theoretical-max detector (detected fields only). */
interface TheoreticalMaxPlayerData {
  tier: number;
  rank: number;
  createdAt?: Date | string;
  resources?: { metal?: number; energy?: number };
}

export async function detectTheoreticalMaxViolation(
  username: string,
  playerData: TheoreticalMaxPlayerData
): Promise<DetectionResult> {
  try {
    const violations: string[] = [];

    // Check tier
    if (playerData.tier > THRESHOLDS.MAX_TIER_LEVEL) {
      violations.push(`Tier ${playerData.tier} exceeds max ${THRESHOLDS.MAX_TIER_LEVEL}`);
    }

    // Check rank
    if (playerData.rank > THRESHOLDS.MAX_RANK) {
      violations.push(`Rank ${playerData.rank} exceeds max ${THRESHOLDS.MAX_RANK}`);
    }

    // Check resource accumulation rate (if timestamps available)
    if (playerData.createdAt && playerData.resources) {
      const accountAgeHours = (Date.now() - new Date(playerData.createdAt).getTime()) / (1000 * 60 * 60);
      const totalResources = (playerData.resources.metal || 0) + (playerData.resources.energy || 0);
      const resourcesPerHour = totalResources / accountAgeHours;

      if (resourcesPerHour > THRESHOLDS.MAX_RESOURCES_PER_HOUR) {
        violations.push(`Resource rate ${Math.floor(resourcesPerHour)}/hr exceeds max ${THRESHOLDS.MAX_RESOURCES_PER_HOUR}/hr`);
      }
    }

    if (violations.length > 0) {
      await createFlag({
        username,
        flagType: 'THEORETICAL_MAX_VIOLATION',
        severity: 'HIGH',
        description: 'Stats exceed theoretical game maximums',
        evidence: violations.join('; '),
        metadata: { violations, playerData: { tier: playerData.tier, rank: playerData.rank } }
      });

      return {
        suspicious: true,
        severity: 'HIGH',
        flagType: 'THEORETICAL_MAX_VIOLATION',
        evidence: violations.join('; '),
        metadata: { violations }
      };
    }

    return { suspicious: false, severity: 'LOW', flagType: 'THEORETICAL_MAX_VIOLATION', evidence: 'Stats within limits' };

  } catch (error) {
    console.error('Theoretical max violation detection error:', error);
    return { suspicious: false, severity: 'LOW', flagType: 'THEORETICAL_MAX_VIOLATION', evidence: 'Detection error' };
  }
}

// ============================================================================
// Flag Management
// ============================================================================

/**
 * Create a new player flag record (or fold into a recent unresolved duplicate)
 * Automatically generates timestamp and default values
 *
 * pg shape (lib/db/schema/config.ts player_flags): id varchar(24) PK (no
 * default — generated here), username, flagType, severity, evidence,
 * metadata jsonb, resolved smallint, occurrence_count integer, createdAt.
 * (The legacy playerId/flag/details columns are nullable pivot leftovers;
 * no reader consumes them.)
 *
 * @param flag - Flag data
 * @returns Created flag ID
 */
export async function createFlag(flag: Omit<PlayerFlag, 'createdAt' | 'resolved'>): Promise<string> {
  try {
    // Check if similar flag exists recently (within last hour)
    const [recentSimilarFlag] = await db
      .select({ id: playerFlags.id })
      .from(playerFlags)
      .where(
        and(
          eq(playerFlags.username, flag.username),
          eq(playerFlags.flagType, flag.flagType),
          eq(playerFlags.resolved, 0),
          gt(playerFlags.createdAt, new Date(Date.now() - 3600000))
        )
      )
      .limit(1);

    if (recentSimilarFlag) {
      // Update existing flag instead of creating duplicate
      await db
        .update(playerFlags)
        .set({
          evidence: flag.evidence,
          metadata: flag.metadata ?? null,
          severity: flag.severity,
          occurrenceCount: sql`${playerFlags.occurrenceCount} + 1`,
        })
        .where(eq(playerFlags.id, recentSimilarFlag.id));
      return recentSimilarFlag.id;
    }

    // Create new flag
    const id = generateId();
    await db.insert(playerFlags).values({
      id,
      username: flag.username,
      flagType: flag.flagType,
      severity: flag.severity,
      evidence: flag.evidence,
      metadata: flag.metadata ?? null,
      resolved: 0,
      occurrenceCount: 1,
      createdAt: new Date(),
    });

    return id;

  } catch (error) {
    console.error('Flag creation error:', error);
    throw error;
  }
}

/** Aggregated suspicious-player row produced by the flags query. */
export interface SuspiciousPlayerSummary {
  _id: string;
  flagCount: number;
  criticalFlags: number;
  highFlags: number;
  mediumFlags: number;
  lowFlags: number;
  flags: PlayerFlagDoc[];
  latestFlag: Date;
}

/** Unresolved flag row as surfaced in SuspiciousPlayerSummary.flags. */
interface PlayerFlagDoc {
  _id: string;
  username: string;
  flagType: string;
  severity: string;
  evidence?: string;
  metadata?: Record<string, DocumentValue>;
  resolved?: boolean;
  occurrenceCount?: number;
  createdAt?: Date;
}

/**
 * Get all suspicious players with active flags
 * Sorted by severity and flag count
 *
 * Direct SQL GROUP BY over player_flags — replaces the shim aggregate() call
 * (which ignored its pipeline and returned raw rows, pre-FID-20260914-004).
 *
 * @returns Array of players with flag summaries
 */
export async function getSuspiciousPlayers(): Promise<SuspiciousPlayerSummary[]> {
  try {
    const rows = await db
      .select({
        username: playerFlags.username,
        flagCount: sql<number>`count(*)::int`,
        criticalFlags: sql<number>`count(*) filter (where ${playerFlags.severity} = 'CRITICAL')::int`,
        highFlags: sql<number>`count(*) filter (where ${playerFlags.severity} = 'HIGH')::int`,
        mediumFlags: sql<number>`count(*) filter (where ${playerFlags.severity} = 'MEDIUM')::int`,
        lowFlags: sql<number>`count(*) filter (where ${playerFlags.severity} = 'LOW')::int`,
        latestFlag: sql<Date>`max(${playerFlags.createdAt})`,
      })
      .from(playerFlags)
      .where(eq(playerFlags.resolved, 0))
      .groupBy(playerFlags.username)
      .orderBy(
        desc(sql`count(*) filter (where ${playerFlags.severity} = 'CRITICAL')`),
        desc(sql`count(*) filter (where ${playerFlags.severity} = 'HIGH')`),
        desc(sql`count(*) filter (where ${playerFlags.severity} = 'MEDIUM')`),
        desc(sql`count(*)`)
      );

    if (rows.length === 0) return [];

    // Attach each player's unresolved flag rows (the $push '$$ROOT' stage).
    const usernames = rows.map((r) => r.username).filter((u): u is string => !!u);
    const flagRows = await db
      .select()
      .from(playerFlags)
      .where(and(eq(playerFlags.resolved, 0), inArray(playerFlags.username, usernames)))
      .orderBy(desc(playerFlags.createdAt));

    const flagsByUsername = new Map<string, PlayerFlagDoc[]>();
    for (const row of flagRows) {
      if (!row.username) continue;
      const list = flagsByUsername.get(row.username) ?? [];
      list.push({
        _id: row.id,
        username: row.username,
        flagType: row.flagType ?? 'UNKNOWN',
        severity: row.severity ?? 'LOW',
        evidence: row.evidence ?? undefined,
        metadata: asMetadata(row.metadata) ?? undefined,
        resolved: row.resolved === 1,
        occurrenceCount: row.occurrenceCount ?? 1,
        createdAt: row.createdAt,
      });
      flagsByUsername.set(row.username, list);
    }

    return rows.map((r) => ({
      _id: r.username ?? 'unknown',
      flagCount: r.flagCount,
      criticalFlags: r.criticalFlags,
      highFlags: r.highFlags,
      mediumFlags: r.mediumFlags,
      lowFlags: r.lowFlags,
      flags: flagsByUsername.get(r.username ?? '') ?? [],
      latestFlag: r.latestFlag,
    }));

  } catch (error) {
    console.error('Get suspicious players error:', error);
    return [];
  }
}

/**
 * 📝 IMPLEMENTATION NOTES:
 *
 * Detection Strategy:
 * - Multi-layered approach combining statistical analysis and rule-based checks
 * - Automatic flag creation with deduplication (1-hour window)
 * - Severity-based prioritization for admin review
 * - Evidence collection for each detection
 *
 * Storage (FID-20260917-017 slice 1):
 * - Direct drizzle over player_activity / player_flags — the previous shim
 *   calls filtered on non-existent username/actionType keys that buildWhere
 *   silently dropped, collapsing all per-player analysis to time-only scans
 *   across every player.
 * - player_activity carries NO username column: player_id IS the username
 *   (lib/activityLogger writes userId there; activityLogService writes
 *   playerId). Both writers converge on action values 'move'/'harvest'/
 *   'attack'/... — mapped via ACTIVITY_ACTIONS.
 * - Movement geometry ({from,to} in metadata) is written by the move route;
 *   without it the rate detector sees 'Insufficient data' (2+ moves needed).
 *
 * Performance Considerations:
 * - Indexed predicates: (player_id, timestamp) on player_activity; username /
 *   resolved on player_flags — all filters are index-eligible now.
 * - Configurable thresholds for easy tuning
 *
 * False Positive Mitigation:
 * - Tolerance buffers (20% over max acceptable)
 * - Minimum data requirements for pattern detection
 * - Severity levels allow graduated response
 * - Manual admin review before bans
 */
