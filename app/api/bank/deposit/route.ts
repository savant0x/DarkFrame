/**
 * @file app/api/bank/deposit/route.ts
 * @created 2025-10-17
 * @modified 2025-10-24 - Phase 2: Production infrastructure - validation, errors, rate limiting
 * @overview Bank deposit API endpoint with 1,000 resource fee
 * 
 * OVERVIEW:
 * Handles resource deposits to player's bank account. Charges a 1,000 unit fee
 * per deposit transaction. Players must be at a bank tile to deposit.
 * Creates audit trail via BankTransaction records.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getBonusStack, assertHolderMayTransact } from '@/lib/flagBonusService';
import { db } from '@/lib/db';
import { players, tiles } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { trackResourcesBanked } from '@/lib/statTrackingService';
import { logBanking } from '@/lib/activityLogger';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  BankDepositSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const DEPOSIT_FEE = 1000;
const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.bankDeposit);

export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('BankDeposit');
  const endTimer = log.time('depositOperation');
  
  try {
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated deposit attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const validated = BankDepositSchema.parse(body);
    const { resourceType, amount } = validated;
    const username = authResult.username;

    // FID-20260906-001 §5.5: bearer restriction — the Flag Bearer cannot do this while holding.
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'bank-deposit');
    if (!flagGate.ok) {
      return NextResponse.json({ success: false, error: flagGate.reason }, { status: 403 });
    }
    
    log.debug('Processing deposit', { username, resourceType, amount });

    const playerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
    const player = playerResult[0];

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const tileResult = await db.select().from(tiles).where(
      and(
        eq(tiles.x, player.currentPositionX),
        eq(tiles.y, player.currentPositionY)
      )
    ).limit(1);
    const currentTile = tileResult[0];

    if (!currentTile || currentTile.terrain !== 'bank') {
      log.warn('Deposit attempt not at bank', { username, position: { x: player.currentPositionX, y: player.currentPositionY } });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'You must be at a Bank tile to deposit resources' });
    }

    const totalNeeded = amount + DEPOSIT_FEE;
    const currentAmount = Number(resourceType === 'metal' ? Number(player.resourcesMetal) : Number(player.resourcesEnergy));

    if (currentAmount < totalNeeded) {
      log.warn('Insufficient resources for deposit', { 
        username, 
        resourceType, 
        needed: totalNeeded, 
        have: currentAmount 
      });
      return createErrorResponse(
        ErrorCode.INSUFFICIENT_RESOURCES, 
        { 
          resourceType, 
          needed: totalNeeded, 
          have: currentAmount,
          fee: DEPOSIT_FEE
        }
      );
    }

    const depositAmount = amount;
    const feeAmount = DEPOSIT_FEE;

    // FID-20260909-026 §2.HIGH: atomic deposit — resources side is guarded
    // (`gte(resources, amount + fee)`) and debited in the same statement; the
    // bank credit is a pure SQL delta. No read-compute-write window.
    const isMetal = resourceType === 'metal';
    const deposited = await db.update(players).set(
      isMetal
        ? {
            resourcesMetal: sql`${players.resourcesMetal} - ${totalNeeded}`,
            bankMetal: sql`${players.bankMetal} + ${depositAmount}`,
            bankLastDeposit: new Date(),
          }
        : {
            resourcesEnergy: sql`${players.resourcesEnergy} - ${totalNeeded}`,
            bankEnergy: sql`${players.bankEnergy} + ${depositAmount}`,
            bankLastDeposit: new Date(),
          }
    )
      .where(and(eq(players.username, username), isMetal ? gte(players.resourcesMetal, totalNeeded) : gte(players.resourcesEnergy, totalNeeded)))
      .returning({ metal: players.resourcesMetal, energy: players.resourcesEnergy, bankMetal: players.bankMetal, bankEnergy: players.bankEnergy });

    if (deposited.length === 0) {
      // Race loser: concurrent deposit/withdraw moved the balance between our
      // read and write — report honestly against fresh state.
      log.warn('Concurrent deposit lost the atomic guard', { username, resourceType, needed: totalNeeded });
      return createErrorResponse(
        ErrorCode.INSUFFICIENT_RESOURCES, 
        { 
          resourceType, 
          needed: totalNeeded,
          fee: DEPOSIT_FEE
        }
      );
    }

    const updatedPlayer = deposited[0];

    await trackResourcesBanked(username, depositAmount);

    // FID-20260909-029 §2.4: anti-cheat telemetry — this action class was
    // previously invisible to the admin Activity tab (logger defined, never
    // wired). Logging failures are swallowed inside the logger.
    await logBanking(
      username,
      request.headers.get('cookie')?.match(/sessionId=([^;]+)/)?.[1] || 'unknown',
      true,
      isMetal ? { metal: depositAmount } : { energy: depositAmount }
    );

    log.info('Deposit successful', { 
      username, 
      resourceType, 
      amount: depositAmount, 
      fee: feeAmount
    });

    return NextResponse.json({
      success: true,
      message: `Deposited ${depositAmount.toLocaleString()} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} to bank (${feeAmount.toLocaleString()} fee)`,
      inventory: {
        metal: Number(updatedPlayer.metal),
        energy: Number(updatedPlayer.energy),
      },
      bank: {
        metal: Number(updatedPlayer.bankMetal),
        energy: Number(updatedPlayer.bankEnergy),
        lastDeposit: player.bankLastDeposit,
      }
    });

  } catch (error) {
    log.error('Bank deposit error', error as Error);
    
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
