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
 */

import clientPromise from '@/lib/mongodb';
import type { DocumentValue } from '@/lib/mongodb';
import type { Player } from '@/types/game.types';

/** Shape of a `playerActivity` document as consumed by the detector. */
interface PlayerActivityDoc {
  username?: string;
  playerId?: string;
  action?: string;
  timestamp: number;
  metadata?: {
    from?: { x: number; y: number };
    to?: { x: number; y: number };
    [key: string]: unknown;
  };
}

/** Shape of a `playerFlags` document as written/read by the detector. */
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

// ============================================================================
// Types & Interfaces
// ============================================================================

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
  timestamp: number
): Promise<DetectionResult> {
  try {
    const client = await clientPromise;
    const db = client.db('game');
    const activities = db.collection<PlayerActivityDoc>('playerActivity');

      // Calculate distance moved (accounting for map wrapping on 1-150 grid)
      const MAP_SIZE = 150;
      const dx = Math.abs(toPos.x - fromPos.x);
      const dy = Math.abs(toPos.y - fromPos.y);
    
      // For wrapping maps, shortest distance could be direct or wrapped
      // Example: x=1 to x=150 is distance 1 (wrapping), not 149 (direct)
      const wrappedDx = Math.min(dx, MAP_SIZE - dx);
      const wrappedDy = Math.min(dy, MAP_SIZE - dy);
      const distance = wrappedDx + wrappedDy;

    // Check for impossible single-move distance
    if (distance > THRESHOLDS.IMPOSSIBLE_DISTANCE) {
      await createFlag({
        username,
        flagType: 'SPEED_HACK',
        severity: 'CRITICAL',
        description: 'Impossible movement distance detected',
        evidence: `Moved ${distance} tiles in single action (max: ${THRESHOLDS.IMPOSSIBLE_DISTANCE})`,
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

    // Get recent movement activities
    const recentMoves = await activities
      .find({
        username,
        actionType: 'movement',
        timestamp: { $gt: timestamp - 10000 } // Last 10 seconds
      })
      .sort({ timestamp: -1 })
      .limit(5)
      .toArray();

    if (recentMoves.length < 2) {
      return { suspicious: false, severity: 'LOW', flagType: 'SPEED_HACK', evidence: 'Insufficient data' };
    }

    // Calculate movement rate
    const oldestMove = recentMoves[recentMoves.length - 1];
    const timeDiff = (timestamp - oldestMove.timestamp) / 1000; // seconds
    const totalDistance = recentMoves.reduce((sum: number, move: any) => {
      const metadata = move.metadata;
      if (!metadata?.from || !metadata?.to) return sum;
      return sum + Math.abs(metadata.to.x - metadata.from.x) + Math.abs(metadata.to.y - metadata.from.y);
    }, 0);

    const movementRate = totalDistance / timeDiff;

    // Flag if movement rate exceeds threshold
    if (movementRate > THRESHOLDS.MAX_MOVEMENT_RATE) {
      const severity = movementRate > THRESHOLDS.MAX_MOVEMENT_RATE * 2 ? 'HIGH' : 'MEDIUM';
      
      await createFlag({
        username,
        flagType: 'SPEED_HACK',
        severity,
        description: 'Excessive movement speed detected',
        evidence: `Moving at ${movementRate.toFixed(2)} tiles/sec (max: ${THRESHOLDS.MAX_MOVEMENT_RATE})`,
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
    const client = await clientPromise;
    const db = client.db('game');
    const playersCollection = db.collection<Player>('players');
    
    // Get player data to calculate actual bonuses
    const player = await playersCollection.findOne({ username });
    
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
    
    // 1. Permanent gathering bonus (from digger items)
    const permanentBonus = resourceType === 'metal' 
      ? (player.gatheringBonus?.metalBonus || 0)
      : (player.gatheringBonus?.energyBonus || 0);
    totalBonusPercent += permanentBonus;
    
    // 2. Shrine boosts
    if (player.shrineBoosts && Array.isArray(player.shrineBoosts)) {
      const now = new Date();
      const activeShrineBoosts = player.shrineBoosts.filter(
        (boost: any) => new Date(boost.expiresAt) > now
      );
      const shrineBonus = activeShrineBoosts.reduce((sum: number, boost: any) => {
        return sum + ((boost.yieldBonus || 0) * 100); // Convert 0.25 to 25%
      }, 0);
      totalBonusPercent += shrineBonus;
    }
    
    // 3. Temporary gathering boosts
    const temporaryBonus = player.activeBoosts?.gatheringBoost || 0;
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
          shrineBonus: totalBonusPercent - permanentBonus - temporaryBonus
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
    const client = await clientPromise;
    const db = client.db('game');
    const activities = db.collection<PlayerActivityDoc>('playerActivity');

    // Get last action of this type
    const lastAction = await activities.findOne(
      { username, actionType },
      { sort: { timestamp: -1 } }
    );

    if (!lastAction) {
      return { suspicious: false, severity: 'LOW', flagType: 'COOLDOWN_VIOLATION', evidence: 'First action' };
    }

    const timeSinceLastAction = timestamp - lastAction.timestamp;

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
    const client = await clientPromise;
    const db = client.db('game');
    const activities = db.collection<PlayerActivityDoc>('playerActivity');

    // Get recent actions
    const recentActions = await activities
      .find({ username })
      .sort({ timestamp: -1 })
      .limit(THRESHOLDS.MIN_ACTIONS_FOR_PATTERN * 2)
      .toArray();

    if (recentActions.length < THRESHOLDS.MIN_ACTIONS_FOR_PATTERN) {
      return { suspicious: false, severity: 'LOW', flagType: 'BOT_BEHAVIOR', evidence: 'Insufficient data' };
    }

    // Calculate time intervals between actions
    const intervals: number[] = [];
    for (let i = 0; i < recentActions.length - 1; i++) {
      intervals.push(recentActions[i].timestamp - recentActions[i + 1].timestamp);
    }

    // Calculate variance in timing
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
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
export async function detectTheoreticalMaxViolation(
  username: string,
  playerData: any
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
 * Create a new player flag record
 * Automatically generates timestamp and default values
 * 
 * @param flag - Flag data
 * @returns Created flag ID
 */
export async function createFlag(flag: Omit<PlayerFlag, 'createdAt' | 'resolved'>): Promise<string> {
  try {
    const client = await clientPromise;
    const db = client.db('game');
    const flags = db.collection<PlayerFlagDoc>('playerFlags');

    // Check if similar flag exists recently (within last hour)
    const recentSimilarFlag = await flags.findOne({
      username: flag.username,
      flagType: flag.flagType,
      resolved: false,
      createdAt: { $gt: new Date(Date.now() - 3600000) }
    });

    if (recentSimilarFlag) {
      // Update existing flag instead of creating duplicate
      await flags.updateOne(
        { _id: recentSimilarFlag._id },
        { 
          $set: { 
            evidence: flag.evidence,
            metadata: flag.metadata ?? null,
            severity: flag.severity
          },
          $inc: { occurrenceCount: 1 }
        }
      );
      return recentSimilarFlag._id.toString();
    }

    // Create new flag
    const result = await flags.insertOne({
      ...flag,
      resolved: false,
      createdAt: new Date(),
      occurrenceCount: 1
    });

    return result.insertedId || "unknown".toString();

  } catch (error) {
    console.error('Flag creation error:', error);
    throw error;
  }
}

/**
 * Get all suspicious players with active flags
 * Sorted by severity and flag count
 * 
 * @returns Array of players with flag summaries
 */
export async function getSuspiciousPlayers(): Promise<any[]> {
  try {
    const client = await clientPromise;
    const db = client.db('game');
    const flags = db.collection<PlayerFlagDoc>('playerFlags');

    // Aggregate flags by player
    const suspiciousPlayers = await flags.aggregate([
      { $match: { resolved: false } },
      { 
        $group: {
          _id: '$username',
          flagCount: { $sum: 1 },
          criticalFlags: { 
            $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] }
          },
          highFlags: { 
            $sum: { $cond: [{ $eq: ['$severity', 'HIGH'] }, 1, 0] }
          },
          mediumFlags: { 
            $sum: { $cond: [{ $eq: ['$severity', 'MEDIUM'] }, 1, 0] }
          },
          lowFlags: { 
            $sum: { $cond: [{ $eq: ['$severity', 'LOW'] }, 1, 0] }
          },
          flags: { $push: '$$ROOT' },
          latestFlag: { $max: '$createdAt' }
        }
      },
      { 
        $sort: { 
          criticalFlags: -1, 
          highFlags: -1, 
          mediumFlags: -1,
          flagCount: -1 
        } 
      }
    ]).toArray();

    return suspiciousPlayers;

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
 * Performance Considerations:
 * - Efficient MongoDB queries with indexes on username, timestamp, actionType
 * - Configurable thresholds for easy tuning
 * - Background job integration for pattern analysis
 * 
 * False Positive Mitigation:
 * - Tolerance buffers (20% over max acceptable)
 * - Minimum data requirements for pattern detection
 * - Severity levels allow graduated response
 * - Manual admin review before bans
 * 
 * Future Enhancements:
 * - Machine learning for behavior pattern analysis
 * - IP-based multi-account detection
 * - Automated temporary bans for CRITICAL flags
 * - Player appeal system for false positives
 * - Historical pattern tracking for repeat offenders
 */
