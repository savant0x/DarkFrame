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
import { eq, and } from 'drizzle-orm';
import { trackResourcesBanked } from '@/lib/statTrackingService';
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

    const currentBankAmount = Number(resourceType === 'metal' ? player.bankMetal : player.bankEnergy);
    const newResourceAmount = BigInt(currentAmount - totalNeeded);
    const newBankAmount = BigInt(currentBankAmount + depositAmount);

    if (resourceType === 'metal') {
      await db.update(players).set({
        resourcesMetal: Number(newResourceAmount),
        bankMetal: Number(newBankAmount),
        bankLastDeposit: new Date(),
      }).where(eq(players.username, username));
    } else {
      await db.update(players).set({
        resourcesEnergy: Number(newResourceAmount),
        bankEnergy: Number(newBankAmount),
        bankLastDeposit: new Date(),
      }).where(eq(players.username, username));
    }

    await trackResourcesBanked(username, depositAmount);

    const updatedPlayerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
    const updatedPlayer = updatedPlayerResult[0];

    log.info('Deposit successful', { 
      username, 
      resourceType, 
      amount: depositAmount, 
      fee: feeAmount,
      newBankTotal: currentBankAmount + depositAmount
    });

    return NextResponse.json({
      success: true,
      message: `Deposited ${depositAmount.toLocaleString()} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} to bank (${feeAmount.toLocaleString()} fee)`,
      inventory: {
        metal: Number(updatedPlayer!.resourcesMetal),
        energy: Number(updatedPlayer!.resourcesEnergy),
      },
      bank: {
        metal: Number(updatedPlayer!.bankMetal),
        energy: Number(updatedPlayer!.bankEnergy),
        lastDeposit: updatedPlayer!.bankLastDeposit,
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
