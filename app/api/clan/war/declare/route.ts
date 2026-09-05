/**
 * @file app/api/clan/war/declare/route.ts
 * @created 2026-09-04
 * @overview Clan war declaration (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/war/declare
 * Session-authenticated + clan membership required. Body (ClanWarfarePanel):
 * { attackerClanId?: string, defenderClanId: string }
 * attackerClanId, when present, must match the session's clan (defensive only —
 * identity is session-derived). Delegates to clanWarfareService.declareWar
 * (role checks, self-war guard, cost debit, mod_log WAR_DECLARED record inside).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { declareWar } from '@/lib/clanWarfareService';

interface DeclareBody {
  attackerClanId?: string;
  defenderClanId?: string;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: DeclareBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (body.attackerClanId && body.attackerClanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, error: 'attackerClanId does not match your clan' },
        { status: 403 }
      );
    }

    const { defenderClanId } = body;
    if (!defenderClanId) {
      return NextResponse.json(
        { success: false, error: 'defenderClanId is required' },
        { status: 400 }
      );
    }

    const result = await declareWar(gate.clanId, defenderClanId, gate.auth.playerId);

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        war: { ...result.war, _id: result.war.warId },
        cost: result.cost,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to declare war';
    const status = /not found|own clan|not in clan|only leaders|insufficient|already/i.test(message) ? 400 : 500;
    if (status === 500) {
      console.error('[API /clan/war/declare POST] Error:', error);
    }
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
