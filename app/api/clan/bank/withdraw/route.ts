/**
 * @file app/api/clan/bank/withdraw/route.ts
 * @created 2026-09-04
 * @overview Clan bank withdraw (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/bank/withdraw
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, metal?: number, energy?: number, researchPoints?: number }
 * Delegates to clanBankService.withdrawFromBank (permission + balance checks inside).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { withdrawFromBank } from '@/lib/clanBankService';

interface WithdrawBody {
  clanId?: string;
  metal?: number;
  energy?: number;
  researchPoints?: number;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: WithdrawBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (body.clanId && body.clanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, message: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    const resources = {
      metal: body.metal,
      energy: body.energy,
      researchPoints: body.researchPoints,
    };

    const anyPositive = Object.values(resources).some((v) => typeof v === 'number' && v > 0);
    if (!anyPositive) {
      return NextResponse.json(
        { success: false, message: 'Provide at least one positive resource amount' },
        { status: 400 }
      );
    }

    const bank = await withdrawFromBank(gate.clanId, gate.auth.playerId, resources);

    return NextResponse.json(
      {
        success: true,
        message: 'Resources withdrawn successfully',
        bank: {
          treasury: bank.treasury,
          capacity: bank.capacity,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to withdraw';
    const status = /not in clan|not found/i.test(message) ? 403 : 500;
    if (status === 500) {
      console.error('[API /clan/bank/withdraw POST] Error:', error);
    }
    return NextResponse.json({ success: false, message }, { status });
  }
}
