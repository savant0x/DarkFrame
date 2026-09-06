/**
 * @file app/api/bank/withdraw/route.ts
 * @created 2025-10-17
 * @modified 2025-10-24 - Phase 2: Production infrastructure - validation, errors, rate limiting
 * @overview Bank withdrawal API endpoint (no fee)
 * 
 * OVERVIEW:
 * Handles resource withdrawals from player's bank account. No fee charged.
 * Players must be at a bank tile to withdraw. Creates audit trail.
 */

import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getBonusStack, assertHolderMayTransact } from '@/lib/flagBonusService';
import { db } from '@/lib/db';
import { players, tiles } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  BankWithdrawSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.bankWithdraw);

export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('BankWithdraw');
  const endTimer = log.time('withdrawOperation');
  
  try {
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      log.warn('Unauthenticated withdrawal attempt');
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const body = await request.json();
    const validated = BankWithdrawSchema.parse(body);
    const { resourceType, amount } = validated;
    const username = authResult.username;

    // FID-20260906-001 §5.5: bearer restriction — the Flag Bearer cannot do this while holding.
    const flagStack = await getBonusStack(username);
    const flagGate = assertHolderMayTransact(flagStack, 'bank-withdraw');
    if (!flagGate.ok) {
      return NextResponse.json({ success: false, error: flagGate.reason }, { status: 403 });
    }
    
    log.debug('Processing withdrawal', { username, resourceType, amount });

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
      log.warn('Withdrawal attempt not at bank', { username, position: { x: player.currentPositionX, y: player.currentPositionY } });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'You must be at a Bank tile to withdraw resources' });
    }

    const bankMetal = Number(player.bankMetal);
    const bankEnergy = Number(player.bankEnergy);

    if (bankMetal === 0 && bankEnergy === 0) {
      log.warn('No bank account found', { username });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'No bank account found' });
    }

    const bankAmount = resourceType === 'metal' ? bankMetal : bankEnergy;
    if (bankAmount < amount) {
      log.warn('Insufficient bank balance', { 
        username, 
        resourceType, 
        requested: amount, 
        have: bankAmount 
      });
      return createErrorResponse(
        ErrorCode.BANK_BALANCE_INSUFFICIENT,
        { resourceType, requested: amount, have: bankAmount }
      );
    }

    const currentResource = Number(resourceType === 'metal' ? Number(player.resourcesMetal) : Number(player.resourcesEnergy));
    const newBankAmount = BigInt(bankAmount - amount);
    const newResourceAmount = BigInt(currentResource + amount);

    if (resourceType === 'metal') {
      await db.update(players).set({
        resourcesMetal: Number(newResourceAmount),
        bankMetal: Number(newBankAmount),
      }).where(eq(players.username, username));
    } else {
      await db.update(players).set({
        resourcesEnergy: Number(newResourceAmount),
        bankEnergy: Number(newBankAmount),
      }).where(eq(players.username, username));
    }

    const updatedPlayerResult = await db.select().from(players).where(eq(players.username, username)).limit(1);
    const updatedPlayer = updatedPlayerResult[0];

    log.info('Withdrawal successful', { 
      username, 
      resourceType, 
      amount,
      remainingInBank: bankAmount - amount
    });

    return NextResponse.json({
      success: true,
      message: `Withdrew ${amount.toLocaleString()} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} from bank`,
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
    log.error('Bank withdrawal error', error as Error);
    
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
