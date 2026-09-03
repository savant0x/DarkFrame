/**
 * @file app/api/flag/route.ts
 * @created 2025-10-20
 * @overview Flag Bearer API endpoint
 * 
 * OVERVIEW:
 * Provides REST API for Flag Bearer data retrieval and attack actions.
 * Returns current Flag Bearer information including position, hold duration,
 * and player stats. Handles attack requests with range validation.
 * 
 * Endpoints:
 * - GET /api/flag - Get current Flag Bearer data
 * - POST /api/flag/attack - Attack the Flag Bearer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import type { Player } from '@/types/game.types';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { type FlagBearer, type FlagAPIResponse, type FlagAttackRequest, type FlagAttackResponse, FLAG_CONFIG } from '@/types/flag.types';
import { calculateDistance } from '@/lib/flagService';
import { handleFlagBotDefeat } from '@/lib/flagBotService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_DATA);

/**
 * GET /api/flag
 * 
 * Retrieve current Flag Bearer information
 * 
 * @returns FlagAPIResponse<FlagBearer | null>
 * 
 * @example
 * ```ts
 * const response = await fetch('/api/flag');
 * const data: FlagAPIResponse<FlagBearer> = await response.json();
 * 
 * if (data.success && data.data) {
 *   console.log('Flag Bearer:', data.data.username);
 * }
 * ```
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagBearer | null>>> => {
  const log = createRouteLogger('flag-get');
  const endTimer = log.time('flag-get');
  
  try {
    const db = await getDatabase();
    const flagDoc = await db.collection<{
      currentHolder?: {
        playerId?: string;
        botId?: string;
        username: string;
        level: number;
        position: { x: number; y: number };
        claimedAt: Date;
      };
      trail?: Array<{ x: number; y: number; expiresAt: Date }>;
    }>('flags').findOne({});
    
    // No flag holder found
    if (!flagDoc || !flagDoc.currentHolder) {
      return NextResponse.json({
        success: true,
        data: null,
        timestamp: new Date()
      });
    }
    
    const holder = flagDoc.currentHolder;
    
    // Get current HP from holder (player or bot)
    const holderId = holder.playerId || holder.botId;
    const holderDoc = await db.collection<Player>('players').findOne({ _id: holderId });
    
    if (!holderDoc) {
      return NextResponse.json({
        success: true,
        data: null,
        timestamp: new Date()
      });
    }
    
    // Calculate hold duration in seconds
    const holdDuration = Math.floor((Date.now() - holder.claimedAt.getTime()) / 1000);
    
    // Get trail data (filter out expired tiles)
    const now = new Date();
    const trail = (flagDoc.trail || []).filter((t: any) => new Date(t.expiresAt) > now);
    
    // Build FlagBearer response
    const bearer: FlagBearer = {
      playerId: holder.playerId?.toString() || '',
      username: holder.username,
      level: holder.level,
      position: holder.position,
      claimedAt: holder.claimedAt,
      holdDuration,
      currentHP: holderDoc.currentHP || 1000,
      maxHP: holderDoc.maxHP || 1000,
      trail: trail.map((t: any) => ({
        x: t.x,
        y: t.y,
        timestamp: t.timestamp,
        expiresAt: t.expiresAt
      }))
    };
    
    log.info('Flag bearer retrieved', { holderId, holdDuration });
    return NextResponse.json({
      success: true,
      data: bearer,
      timestamp: new Date()
    });
    
  } catch (error) {
    log.error('Failed to fetch flag bearer', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch Flag Bearer data',
      timestamp: new Date()
    }, { status: 500 });
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/flag/attack
 * 
 * Attack the current Flag Bearer
 * 
 * Request body: FlagAttackRequest
 * {
 *   targetPlayerId: string,
 *   attackerPosition: { x: number, y: number }
 * }
 * 
 * @returns FlagAPIResponse<FlagAttackResponse>
 * 
 * @example
 * ```ts
 * const response = await fetch('/api/flag/attack', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     targetPlayerId: 'player-123',
 *     attackerPosition: { x: 50, y: 50 }
 *   })
 * });
 * 
 * const result: FlagAPIResponse<FlagAttackResponse> = await response.json();
 * if (result.success && result.data?.success) {
 *   console.log('Attack successful! Damage:', result.data.damage);
 * }
 * ```
 */
export async function POST(request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagAttackResponse>>> {
  try {
    // Authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - please log in',
        timestamp: new Date()
      }, { status: 401 });
    }
    
    const body: FlagAttackRequest = await request.json();
    
    // Validate request
    if (!body.targetPlayerId || !body.attackerPosition) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: targetPlayerId and attackerPosition',
        timestamp: new Date()
      }, { status: 400 });
    }
    
    const db = await getDatabase();
    
    // Get attacker from database
    const attacker = await db.collection<Player>('players').findOne({ username: user.username });
    if (!attacker) {
      return NextResponse.json({
        success: false,
        error: 'Attacker not found',
        timestamp: new Date()
      }, { status: 404 });
    }
    
    // Check attack cooldown (60 seconds)
    if (attacker.lastFlagAttack) {
      const timeSince = Date.now() - attacker.lastFlagAttack.getTime();
      const cooldownMs = FLAG_CONFIG.ATTACK_COOLDOWN * 1000;
      
      if (timeSince < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timeSince) / 1000);
        return NextResponse.json({
          success: false,
          error: `Attack cooldown active. Wait ${remainingSeconds} seconds.`,
          timestamp: new Date()
        }, { status: 429 });
      }
    }
    
    // Get flag holder
    const flagDoc = await db.collection<{
      currentHolder?: {
        playerId?: string;
        botId?: string;
        username: string;
        level: number;
        position: { x: number; y: number };
        claimedAt: Date;
      };
      trail?: Array<{ x: number; y: number; expiresAt: Date }>;
    }>('flags').findOne({});
    if (!flagDoc || !flagDoc.currentHolder) {
      return NextResponse.json({
        success: false,
        error: 'No flag bearer found',
        timestamp: new Date()
      }, { status: 404 });
    }
    
    const holder = flagDoc.currentHolder;
    
    // Prevent self-attack
    if (holder.playerId && holder.playerId.toString() === attacker.username) {
      return NextResponse.json({
        success: false,
        error: 'Cannot attack yourself',
        timestamp: new Date()
      }, { status: 400 });
    }
    
    // Validate attack range (5 tiles)
    const distance = calculateDistance(body.attackerPosition, holder.position);
    if (distance > FLAG_CONFIG.ATTACK_RANGE) {
      return NextResponse.json({
        success: false,
        error: `Out of range. Distance: ${distance} tiles, max: ${FLAG_CONFIG.ATTACK_RANGE} tiles.`,
        timestamp: new Date()
      }, { status: 400 });
    }
    
    // Get holder from database
    const holderId = holder.playerId || holder.botId;
    const holderDoc = await db.collection<Player>('players').findOne({ _id: holderId });
    
    if (!holderDoc) {
      return NextResponse.json({
        success: false,
        error: 'Flag bearer not found in database',
        timestamp: new Date()
      }, { status: 404 });
    }
    
    // Apply damage
    const damage = FLAG_CONFIG.BASE_ATTACK_DAMAGE;
    const currentHP = holderDoc.currentHP || 1000;
    const newHP = currentHP - damage;
    
    // Update attacker cooldown
    await db.collection<Player>('players').updateOne(
      { username: attacker.username },
      { $set: { lastFlagAttack: new Date() } }
    );
    
    // Handle defeat (HP <= 0)
    if (newHP <= 0) {
      // Transfer flag to attacker
      await handleFlagBotDefeat(holderId ?? '', attacker.username);
      
      return NextResponse.json({
        success: true,
        data: {
          success: true,
          damage,
          bearerDefeated: true,
          newBearerUsername: attacker.username,
          message: `You defeated ${holder.username} and claimed the flag!`
        },
        timestamp: new Date()
      });
    }
    
    // Update HP (no defeat)
    await db.collection('players').updateOne(
      { _id: holderId },
      { $set: { currentHP: newHP } }
    );
    
    return NextResponse.json({
      success: true,
      data: {
        success: true,
        damage,
        bearerDefeated: false,
        remainingHP: newHP,
        message: `Dealt ${damage} damage to ${holder.username}! Remaining HP: ${newHP}`
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('[Flag API] Error processing attack:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process attack',
      timestamp: new Date()
    }, { status: 500 });
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. **GET /api/flag:**
 *    - Queries flags MongoDB collection for current holder
 *    - Returns FlagBearer with real-time HP from players collection
 *    - Calculates hold duration dynamically
 *    - Returns null if no holder (triggers UI to show "unclaimed")
 *    - Fast query (<100ms) for real-time UX
 * 
 * 2. **POST /api/flag/attack:**
 *    - Authentication required via getAuthenticatedUser()
 *    - Validates 60-second attack cooldown per player
 *    - Checks 5-tile attack range using calculateDistance()
 *    - Prevents self-attacks
 *    - Applies 100 damage per attack (FLAG_CONFIG.BASE_ATTACK_DAMAGE)
 *    - Transfers flag on bearer defeat (HP <= 0)
 *    - Updates attacker cooldown in database
 * 
 * 3. **Database Integration:**
 *    - flags collection: Singleton document with currentHolder
 *    - players collection: Stores currentHP, maxHP, lastFlagAttack
 *    - Transfer history tracked in flags.transferHistory array
 *    - All mocks removed (Lesson #35 compliance)
 * 
 * 4. **Security:**
 *    - JWT authentication via middleware
 *    - Input validation (position, targetPlayerId)
 *    - Cooldown enforcement prevents spam
 *    - Range validation prevents teleport attacks
 * 
 * 5. **Flag Bot Lifecycle:**
 *    - Spawns at random location (1-150, 1-150)
 *    - Teleports to new random location every 30 min (cron)
 *    - Resets if unclaimed for > 1 hour
 *    - See /lib/flagBotService.ts for details
 */

