import { NextRequest, NextResponse } from 'next/server';
import {
  requireClanMembership,
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
  logger,
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

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('clan-bank-get');
  const endTimer = log.time('bank-get');
  
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const [bankStats, transactions] = await Promise.all([
      getBankStats(clanId),
      getBankTransactionHistory(clanId, limit),
    ]);

    log.info('Bank info retrieved', { clanId, transactionCount: transactions.length });
    return NextResponse.json({ success: true, bankStats, transactions });
  } catch (error: unknown) {
    log.error('Failed to get bank info', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export async function POST(request: NextRequest) {
  try {
    const result = await requireClanMembership(request);
    if (result instanceof NextResponse) return result;
    
    const { auth, clanId } = result;

    const body = await request.json();
    const { action, resources, taxRates } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Action is required' }, { status: 400 });
    }

    let bank;
    let message;

    switch (action) {
      case 'deposit':
        if (!resources) return NextResponse.json({ success: false, error: 'Resources are required for deposit' }, { status: 400 });
        bank = await depositToBank(clanId, auth.playerId, resources);
        message = 'Resources deposited successfully';
        break;
      case 'withdraw':
        if (!resources) return NextResponse.json({ success: false, error: 'Resources are required for withdrawal' }, { status: 400 });
        bank = await withdrawFromBank(clanId, auth.playerId, resources);
        message = 'Resources withdrawn successfully';
        break;
      case 'setTaxRates':
        if (!taxRates) return NextResponse.json({ success: false, error: 'Tax rates are required' }, { status: 400 });
        bank = await setTaxRates(clanId, auth.playerId, taxRates);
        message = 'Tax rates updated successfully';
        break;
      case 'upgrade':
        bank = await upgradeBankCapacity(clanId, auth.playerId);
        message = `Bank upgraded to level ${bank.upgradeLevel}`;
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true, bank, message });
  } catch (error: unknown) {
    logger.error('Bank operation error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('permission')) return NextResponse.json({ success: false, error: errorMessage }, { status: 403 });
    if (errorMessage.includes('Insufficient')) return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    if (errorMessage.includes('capacity')) return NextResponse.json({ success: false, error: errorMessage }, { status: 400 });
    if (errorMessage.includes('maximum level')) return NextResponse.json({ success: false, error: 'Bank is already at maximum level' }, { status: 400 });
    return NextResponse.json({ success: false, error: 'Banking operation failed' }, { status: 500 });
  }
}
