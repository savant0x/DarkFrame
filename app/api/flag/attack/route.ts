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
import { type FlagAttackResponse, type FlagAPIResponse, FLAG_CONFIG } from '@/types/flag.types';
import { 
  withRequestLogging, 
  createRouteLogger, 
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  FlagAttackSchema,
} from '@/lib';
import { ZodError } from 'zod';
import { verifyPresence } from '@/lib/presenceCheck';

/** Shape of the currentHolder blob stored in the flags row. */
interface FlagHolder {
  playerId?: string;
  botId?: string;
  username: string;
  hp?: number;
  position: { x: number; y: number };
}

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
    
    const holder = flagDoc.currentHolder as unknown as FlagHolder;
    
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
    
    // Validate attack range against the DATABASE position — the client-supplied
    // attackerPosition is never trusted (it was trivially spoofable).
    const presence = await verifyPresence(user.username, holder.position, FLAG_CONFIG.ATTACK_RANGE);
    if (!presence.ok) {
      return NextResponse.json({
        success: true,
        data: {
          success: false,
          error: presence.reason ?? 'Not in range',
          damage: 0
        },
        timestamp: new Date()
      });
    }
    const distance = calculateDistance(presence.attackerPosition!, holder.position);
    
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
    let target: typeof players.$inferSelect | null = null;
    if (holder.playerId || holder.botId) {
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
      
      void expiresAt; // trail persistence lands with the trail table (see SCOPE)
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
    
    // Bearer survived - report remaining HP. HP persistence lands with the
    // trail/HP storage work; per-hit state resets via the capture path.
    void initialHP;
    
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
