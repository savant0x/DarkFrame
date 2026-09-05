/**
 * @file app/api/clan/kick/route.ts
 * @created 2026-09-04
 * @overview Clan member kick (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/kick
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, targetUsername: string }
 * Delegates to clanService.kickMember (canKick permission + hierarchy checks inside).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { kickMember } from '@/lib/clanService';

interface KickBody {
  clanId?: string;
  targetUsername?: string;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: KickBody;
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

    const { targetUsername } = body;
    if (!targetUsername) {
      return NextResponse.json(
        { success: false, message: 'targetUsername is required' },
        { status: 400 }
      );
    }

    const result = await kickMember(gate.clanId, gate.auth.playerId, targetUsername);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to kick member';
    console.error('[API /clan/kick POST] Error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
