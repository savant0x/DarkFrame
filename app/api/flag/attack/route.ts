/**
 * @file app/api/flag/attack/route.ts
 * @created 2025-01-23
 * @overview Flag Bearer attack endpoint
 * 
 * OVERVIEW:
 * Dedicated endpoint for attacking the Flag Bearer.
 * Validates attack range, calculates damage, and updates bearer HP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, flags } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { type FlagAttackRequest, type FlagAttackResponse, type FlagAPIResponse, FLAG_CONFIG } from '@/types/flag.types';
import { Player } from '@/types/game.types';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  FlagAttackSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

/**
 * Calculate distance between two points
 */
function calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
  const dx = Math.abs(pos1.x - pos2.x);
  const dy = Math.abs(pos1.y - pos2.y);
  return Math.sqrt(dx * dx + dy * dy);
}

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.FLAG_ATTACK);

/**
 * POST /api/flag/attack
 * 
 * Attack the current Flag Bearer
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagAttackResponse>>> => {
  const log = createRouteLogger('FlagAttackAPI');
  const endTimer = log.time('flagAttack');

  try {
    // Authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      log.warn('Unauthenticated flag attack attempt');
      return NextResponse.json({
        success: false,
        error: 'Unauthorized - please log in',
        timestamp: new Date()
      }, { status: 401 });
    }
    
    const body = await request.json();
    const validated = FlagAttackSchema.parse(body);
    
    log.debug('Flag attack request', { 
      attacker: user.username, 
      target: validated.targetPlayerId,
      position: validated.attackerPosition 
    });
    
    // Get flag document
    const [flagDoc] = await db.select().from(flags).limit(1);
    
    if (!flagDoc || !flagDoc.currentHolder) {
      return NextResponse.json({
        success: true,
        data: {
          success: false,
          error: 'No one is holding the flag',
          damage: 0
        },
        timestamp: new Date()
      });
    }
    
    const holder = flagDoc.currentHolder as any;
    
    // Verify target is current bearer (handle bot attacks)
    const holderId = holder.playerId || holder.botId || '';
    const targetIdNormalized = validated.targetPlayerId === 'BOT' || validated.targetPlayerId === '' 
      ? holderId 
      : validated.targetPlayerId;
      
    if (holderId !== targetIdNormalized && targetIdNormalized !== holderId) {
      return NextResponse.json({
        success: true,
        data: {
          success: false,
          error: 'Target is not the current Flag Bearer',
          damage: 0
        },
        timestamp: new Date()
      });
    }
    
    // Get attacker
    const [attacker] = await db.select().from(players).where(eq(players.username, user.username));
    
    if (!attacker) {
      return NextResponse.json({
        success: false,
        error: 'Attacker not found',
        timestamp: new Date()
      }, { status: 404 });
    }
    
    // Validate attack range
    const distance = calculateDistance(validated.attackerPosition, holder.position);
    
    if (distance > FLAG_CONFIG.ATTACK_RANGE) {
      return NextResponse.json({
        success: true,
        data: {
          success: false,
          error: `Out of range! You are ${Math.round(distance)} tiles away (max ${FLAG_CONFIG.ATTACK_RANGE})`,
          damage: 0,
          distance: Math.round(distance),
          maxRange: FLAG_CONFIG.ATTACK_RANGE
        },
        timestamp: new Date()
      });
    }
    
    // Get target (bearer)
    let target: any = null;
    if (holder.playerId) {
      [target] = await db.select().from(players).where(eq(players.username, holder.username));
    } else if (holder.botId) {
      [target] = await db.select().from(players).where(eq(players.username, holder.username));
    }
    
    if (!target) {
      return NextResponse.json({
        success: false,
        error: 'Flag Bearer not found',
        timestamp: new Date()
      }, { status: 404 });
    }
    
    // Calculate damage based on attacker's army strength
    const attackerPower = attacker.totalStrength || 0;
    const baseDamage = FLAG_CONFIG.BASE_ATTACK_DAMAGE;
    const powerMultiplier = 1 + (attackerPower / 100000); // +1% per 1K power
    const damage = Math.round(baseDamage * powerMultiplier);
    
    // Get current bearer HP (from flag doc or default to 1000)
    const initialHP = 1000;
    let bearerHP = holder.hp || initialHP;
    
    // Apply damage
    bearerHP -= damage;
    
    // Check if bearer was defeated
    if (bearerHP <= 0) {
      // Flag dropped! Attacker claims it
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 8 * 60 * 1000); // 8 minutes from now
      
      const trailData = [{
        x: attacker.currentPositionX,
        y: attacker.currentPositionY,
        timestamp: now,
        expiresAt: expiresAt
      }];
      
      await db.update(flags).set({
        currentHolder: attacker.username,
        currentHolderUsername: attacker.username,
        lastCapturedAt: new Date(),
        lastCapturedBy: attacker.username,
        totalCaptures: (flagDoc.totalCaptures || 0) + 1,
      }).where(eq(flags.id, flagDoc.id));
      
      return NextResponse.json({
        success: true,
        data: {
          success: true,
          message: `Flag captured! You are now the Flag Bearer!`,
          damage,
          bearerDefeated: true,
          newBearer: attacker.username
        },
        timestamp: new Date()
      });
    }
    
    // Bearer survived - update HP in holder data
    const updatedHolder = { ...holder, hp: bearerHP };
    
    return NextResponse.json({
      success: true,
      data: {
        success: true,
        message: `Hit for ${damage} damage! Bearer HP: ${bearerHP}/${initialHP}`,
        damage,
        bearerDefeated: false,
        remainingHP: bearerHP
      },
      timestamp: new Date()
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      log.warn('Flag attack validation failed', { issues: error.issues });
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        timestamp: new Date()
      }, { status: 400 });
    }

    log.error('Flag attack error', error as Error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to attack Flag Bearer',
      timestamp: new Date()
    }, { status: 500 });
  } finally {
    endTimer();
  }
}));
