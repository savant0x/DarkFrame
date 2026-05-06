/**
 * @file app/api/bank/withdraw/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Bank withdrawal API endpoint (no fee)
 * 
 * OVERVIEW:
 * Handles resource withdrawals from player's bank account. No fee charged.
 * Players must be at a bank tile to withdraw.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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
    const body = await request.json();
    const validated = BankWithdrawSchema.parse(body);
    const { resourceType, amount } = validated;
    const username = body.username;
    if (!username) {
      log.warn('Username required for withdrawal');
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Username required' });
    }
    
    log.debug('Processing withdrawal', { username, resourceType, amount });

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    const { data: currentTile } = await supabase
      .from('tiles')
      .select('terrain')
      .eq('x', player.current_x)
      .eq('y', player.current_y)
      .maybeSingle();

    if (!currentTile || currentTile.terrain !== 'Bank') {
      log.warn('Withdrawal attempt not at bank', { username, position: { x: player.current_x, y: player.current_y } });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'You must be at a Bank tile to withdraw resources' });
    }

    const bankAmount = resourceType === 'metal' ? (player.bank_metal || 0) : (player.bank_energy || 0);
    if (bankAmount < amount) {
      log.warn('Insufficient bank balance', { username, resourceType, requested: amount, have: bankAmount });
      return createErrorResponse(ErrorCode.BANK_BALANCE_INSUFFICIENT, { resourceType, requested: amount, have: bankAmount });
    }

    if (resourceType === 'metal') {
      await supabase
        .from('players')
        .update({
          resources_metal: player.resources_metal + amount,
          bank_metal: bankAmount - amount,
        })
        .eq('username', username);
    } else {
      await supabase
        .from('players')
        .update({
          resources_energy: player.resources_energy + amount,
          bank_energy: bankAmount - amount,
        })
        .eq('username', username);
    }

    log.info('Withdrawal successful', { username, resourceType, amount, remainingInBank: bankAmount - amount });

    return NextResponse.json({
      success: true,
      message: `Withdrew ${amount.toLocaleString()} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} from bank`,
      inventory: {
        metal: resourceType === 'metal' ? player.resources_metal + amount : player.resources_metal,
        energy: resourceType === 'energy' ? player.resources_energy + amount : player.resources_energy,
      },
      bank: {
        metal: resourceType === 'metal' ? bankAmount - amount : (player.bank_metal || 0),
        energy: resourceType === 'energy' ? bankAmount - amount : (player.bank_energy || 0),
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
