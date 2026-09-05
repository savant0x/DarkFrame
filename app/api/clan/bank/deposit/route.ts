/**
 * @file app/api/clan/bank/deposit/route.ts
 * @created 2026-09-04
 * @overview Clan bank deposit (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/bank/deposit
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, metal?: number, energy?: number, researchPoints?: number }
 * The caller's clanId from the session (clans.members jsonb) is authoritative —
 * a body-supplied clanId is only accepted when it matches (defensive, not trusted).
 * Delegates to clanBankService.depositToBank (permission + resource checks inside).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { depositToBank } from '@/lib/clanBankService';

interface DepositBody {
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
    let body: DepositBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Body clanId, when present, must agree with the session-derived clan
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

    const bank = await depositToBank(gate.clanId, gate.auth.playerId, resources);

    return NextResponse.json(
      {
        success: true,
        message: 'Resources deposited successfully',
        bank: {
          treasury: bank.treasury,
          capacity: bank.capacity,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to deposit';
    const status = /not in clan|not found/i.test(message) ? 403 : 500;
    if (status === 500) {
      console.error('[API /clan/bank/deposit POST] Error:', error);
    }
    return NextResponse.json({ success: false, message }, { status });
  }
}
