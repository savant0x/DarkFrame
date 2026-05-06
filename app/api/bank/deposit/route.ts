/**
 * @file app/api/bank/deposit/route.ts
 * @created 2025-10-17
 * @updated 2026-05-03 — Migrated from MongoDB to Supabase
 * @overview Bank deposit API endpoint with 1,000 resource fee
 * 
 * OVERVIEW:
 * Handles resource deposits to player's bank account. Charges a 1,000 unit fee
 * per deposit transaction. Players must be at a bank tile to deposit.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import type { Tables } from '@/types/database';
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

type PlayerRow = Tables<'players'>;
type TileRow = Tables<'tiles'>;

const DEPOSIT_FEE = 1000;
const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.bankDeposit);

export const POST = withRequestLogging(rateLimiter(async (request: Request) => {
  const log = createRouteLogger('BankDeposit');
  const endTimer = log.time('depositOperation');
  
  try {
    const body = await request.json();
    const validated = BankDepositSchema.parse(body);
    const { resourceType, amount } = validated;
    const username = body.username;
    if (!username) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, { message: 'Username is required' });
    }
    
    log.debug('Processing deposit', { username, resourceType, amount });

    const supabase = createServiceClient();

    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }

    // Check if player is at a bank tile
    const { data: currentTile } = await supabase
      .from('tiles')
      .select('terrain')
      .eq('x', player.current_x)
      .eq('y', player.current_y)
      .maybeSingle();

    if (!currentTile || currentTile.terrain !== 'Bank') {
      log.warn('Deposit attempt not at bank', { username, position: { x: player.current_x, y: player.current_y } });
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'You must be at a Bank tile to deposit resources' });
    }

    // Calculate total amount needed (amount + fee)
    const totalNeeded = amount + DEPOSIT_FEE;
    const currentResource = resourceType === 'metal' ? player.resources_metal : player.resources_energy;

    if (currentResource < totalNeeded) {
      log.warn('Insufficient resources for deposit', { username, resourceType, needed: totalNeeded, have: currentResource });
      return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, { 
        resourceType, needed: totalNeeded, have: currentResource, fee: DEPOSIT_FEE
      });
    }

    const currentBank = resourceType === 'metal' ? (player.bank_metal || 0) : (player.bank_energy || 0);

    // Update player resources and bank
    if (resourceType === 'metal') {
      await supabase
        .from('players')
        .update({
          resources_metal: player.resources_metal - totalNeeded,
          bank_metal: currentBank + amount,
          bank_last_deposit: new Date().toISOString(),
        })
        .eq('username', username);
    } else {
      await supabase
        .from('players')
        .update({
          resources_energy: player.resources_energy - totalNeeded,
          bank_energy: currentBank + amount,
          bank_last_deposit: new Date().toISOString(),
        })
        .eq('username', username);
    }

    // Track banked resources
    await trackResourcesBanked(username, amount);

    log.info('Deposit successful', { username, resourceType, amount, fee: DEPOSIT_FEE, newBankTotal: currentBank + amount });

    return NextResponse.json({
      success: true,
      message: `Deposited ${amount.toLocaleString()} ${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)} to bank (${DEPOSIT_FEE.toLocaleString()} fee)`,
      inventory: {
        metal: resourceType === 'metal' ? player.resources_metal - totalNeeded : player.resources_metal,
        energy: resourceType === 'energy' ? player.resources_energy - totalNeeded : player.resources_energy,
      },
      bank: {
        metal: resourceType === 'metal' ? currentBank + amount : (player.bank_metal || 0),
        energy: resourceType === 'energy' ? currentBank + amount : (player.bank_energy || 0),
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
