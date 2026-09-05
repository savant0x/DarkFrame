/**
 * @file app/api/clan/alliance/break/route.ts
 * @created 2026-09-04
 * @overview Clan alliance break (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/alliance/break
 * Session-authenticated + clan membership required. Body (ClanWarfarePanel):
 * { clanId?: string, allianceId: string }
 * Delegates to clanAllianceService.breakAlliance — the service verifies the
 * breaking clan is part of the alliance and that the caller is the clan leader
 * (LEADER role on the members jsonb), then applies the 72h re-alliance cooldown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { breakAlliance } from '@/lib/clanAllianceService';

interface BreakBody {
  clanId?: string;
  allianceId?: string;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: BreakBody;
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

    const { allianceId } = body;
    if (!allianceId) {
      return NextResponse.json(
        { success: false, message: 'allianceId is required' },
        { status: 400 }
      );
    }

    const alliance = await breakAlliance(allianceId, gate.clanId, gate.auth.playerId);

    return NextResponse.json(
      {
        success: true,
        message: 'Alliance broken',
        alliance: { ...alliance, _id: alliance._id ?? '' },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to break alliance';
    const status = /not found|not active|not part|only clan leaders/i.test(message) ? 400 : 500;
    if (status === 500) {
      console.error('[API /clan/alliance/break POST] Error:', error);
    }
    return NextResponse.json({ success: false, message }, { status });
  }
}
