/**
 * Clan Bank API Routes
 * Handles all clan banking operations
 * 
 * POST /api/clan/bank - Deposit/withdraw/set tax rates/upgrade
 * GET /api/clan/bank - Get bank status and transaction history
 * 
 * Updated: 2025-10-23 (FID-20251023-001: Refactored to use centralized auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getClientAndDatabase,
  requireClanMembership,
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import {
  depositToBank,
  withdrawFromBank,
  setTaxRates,
  upgradeBankCapacity,
  getBankTransactionHistory,
  getBankStats,
} from '@/lib/clanBankService';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

/**
 * GET /api/clan/bank
 * Get bank status and transaction history
 * 
 * Query params:
 * - limit: number (transaction history limit, default 50)
 * 
 * Response:
 * {
 *   success: true,
 *   bankStats: { treasury, capacity, taxRates, usage, nextUpgradeCost },
 *   transactions: ClanBankTransaction[]
 * }
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-bank-get');
  const endTimer = log.time('bank-get');
  
  try {
    // Get database connection
    const { client, db } = await getClientAndDatabase();

    // Authenticate and get clan (returns error response if fails)
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Initialize services

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    // Get bank stats and transaction history
    const [bankStats, transactions] = await Promise.all([
      getBankStats(clanId),
      getBankTransactionHistory(clanId, limit),
    ]);

    log.info('Bank info retrieved', { clanId, transactionCount: transactions.length });
    return NextResponse.json({
      success: true,
      bankStats,
      transactions,
    });

  } catch (error: any) {
    log.error('Failed to get bank info', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/clan/bank
 * Perform banking operations
 * 
 * Request body (operation-specific):
 * 
 * Deposit:
 * {
 *   action: 'deposit',
 *   resources: { metal?: number, energy?: number, researchPoints?: number }
 * }
 * 
 * Withdraw:
 * {
 *   action: 'withdraw',
 *   resources: { metal?: number, energy?: number, researchPoints?: number }
 * }
 * 
 * Set Tax Rates:
 * {
 *   action: 'setTaxRates',
 *   taxRates: { metal?: number, energy?: number, researchPoints?: number }
 * }
 * 
 * Upgrade Bank:
 * {
 *   action: 'upgrade'
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   bank: ClanBank,
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Get database connection
    const { client, db } = await getClientAndDatabase();

    // Authenticate and get clan (returns error response if fails)
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    // Initialize services

    // Parse request body
    const body = await request.json();
    const { action, resources, taxRates } = body;

    // Validate action
    if (!action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    // Handle different actions
    let bank;
    let message;

    switch (action) {
      case 'deposit':
        if (!resources) {
          return NextResponse.json(
            { success: false, error: 'Resources are required for deposit' },
            { status: 400 }
          );
        }
        bank = await depositToBank(clanId, auth.playerId, resources);
        message = 'Resources deposited successfully';
        break;

      case 'withdraw':
        if (!resources) {
          return NextResponse.json(
            { success: false, error: 'Resources are required for withdrawal' },
            { status: 400 }
          );
        }
        bank = await withdrawFromBank(clanId, auth.playerId, resources);
        message = 'Resources withdrawn successfully';
        break;

      case 'setTaxRates':
        if (!taxRates) {
          return NextResponse.json(
            { success: false, error: 'Tax rates are required' },
            { status: 400 }
          );
        }
        bank = await setTaxRates(clanId, auth.playerId, taxRates);
        message = 'Tax rates updated successfully';
        break;

      case 'upgrade':
        bank = await upgradeBankCapacity(clanId, auth.playerId);
        message = `Bank upgraded to level ${bank.upgradeLevel}`;
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      bank,
      message,
    });

  } catch (error: any) {
    console.error('Bank operation error:', error);

    // Handle specific errors
    if (error.message?.includes('permission')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    if (error.message?.includes('Insufficient')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (error.message?.includes('capacity')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    if (error.message?.includes('maximum level')) {
      return NextResponse.json(
        { success: false, error: 'Bank is already at maximum level' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Banking operation failed' },
      { status: 500 }
    );
  }
}

