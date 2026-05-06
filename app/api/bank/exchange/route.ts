/**
 * @file app/api/bank/exchange/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Resource exchange API endpoint with 20% fee
 * 
 * OVERVIEW:
 * Handles Metal ↔ Energy exchanges with 20% conversion fee.
 * Formula: receivedAmount = Math.floor(givenAmount * 0.80)
 * Players must be at an Exchange Bank tile.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { ExchangeSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

const EXCHANGE_FEE_RATE = 0.20;
const EXCHANGE_RATE = 0.80;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.BANK);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('BankExchangeAPI');
  const endTimer = log.time('bank-exchange');
  
  try {
    const validated = ExchangeSchema.parse(await request.json());
    const username = (validated as Record<string, unknown>).username as string;
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'Username required' });
    }

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      return createErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, { message: 'Player not found', context: { username } });
    }

    // Check if player is at an exchange bank tile
    const { data: currentTile } = await supabase
      .from('tiles')
      .select('terrain, bank_type')
      .eq('x', player.current_x)
      .eq('y', player.current_y)
      .maybeSingle();

    if (!currentTile || currentTile.terrain !== 'Bank' || currentTile.bank_type !== 'exchange') {
      return createErrorResponse(ErrorCode.BANK_INVALID_LOCATION, {
        message: 'You must be at an Exchange Bank tile to exchange resources',
        context: { position: { x: player.current_x, y: player.current_y } },
      });
    }

    const toResource = validated.fromResource === 'metal' ? 'energy' : 'metal';
    const receivedAmount = Math.floor(validated.amount * EXCHANGE_RATE);
    const feeAmount = validated.amount - receivedAmount;

    const currentFrom = validated.fromResource === 'metal' ? player.resources_metal : player.resources_energy;
    if (currentFrom < validated.amount) {
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, {
        message: `Insufficient ${validated.fromResource}`,
        context: { have: currentFrom, need: validated.amount, fromResource: validated.fromResource },
      });
    }

    const currentTo = toResource === 'metal' ? player.resources_metal : player.resources_energy;

    if (validated.fromResource === 'metal') {
      await supabase
        .from('players')
        .update({
          resources_metal: currentFrom - validated.amount,
          resources_energy: currentTo + receivedAmount,
        })
        .eq('username', username);
    } else {
      await supabase
        .from('players')
        .update({
          resources_energy: currentFrom - validated.amount,
          resources_metal: currentTo + receivedAmount,
        })
        .eq('username', username);
    }

    log.info('Resource exchange completed', { username, from: validated.fromResource, to: toResource, given: validated.amount, received: receivedAmount });

    return NextResponse.json({
      success: true,
      message: `Exchanged ${validated.amount.toLocaleString()} ${validated.fromResource.charAt(0).toUpperCase() + validated.fromResource.slice(1)} for ${receivedAmount.toLocaleString()} ${toResource.charAt(0).toUpperCase() + toResource.slice(1)} (20% fee)`,
      inventory: {
        metal: validated.fromResource === 'metal' ? currentFrom - validated.amount : currentTo + receivedAmount,
        energy: validated.fromResource === 'energy' ? currentFrom - validated.amount : currentTo + receivedAmount,
      },
      exchangeDetails: {
        given: { type: validated.fromResource, amount: validated.amount },
        received: { type: toResource, amount: receivedAmount },
        feeAmount
      }
    });

  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Bank exchange error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
