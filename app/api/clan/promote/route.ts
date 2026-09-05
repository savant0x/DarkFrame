/**
 * @file app/api/clan/promote/route.ts
 * @created 2026-09-04
 * @overview Clan member promotion (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/promote
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, targetUsername: string, newRole: ClanRole }
 * Members are keyed by username (ClanMember.playerId IS the username in the
 * members jsonb), so the body's targetUsername is the member key — validated
 * against the session-derived clan, never against a body-supplied clanId.
 * Delegates to clanService.promoteMember (role-hierarchy checks inside).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { promoteMember } from '@/lib/clanService';
import { ClanRole } from '@/types/clan.types';

interface PromoteBody {
  clanId?: string;
  targetUsername?: string;
  newRole?: string;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: PromoteBody;
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

    const { targetUsername, newRole } = body;
    if (!targetUsername || !newRole) {
      return NextResponse.json(
        { success: false, message: 'targetUsername and newRole are required' },
        { status: 400 }
      );
    }

    if (!Object.values(ClanRole).includes(newRole as ClanRole)) {
      return NextResponse.json(
        { success: false, message: `newRole must be one of: ${Object.values(ClanRole).join(', ')}` },
        { status: 400 }
      );
    }

    const result = await promoteMember(
      gate.clanId,
      gate.auth.playerId,
      targetUsername,
      newRole as ClanRole
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to promote member';
    console.error('[API /clan/promote POST] Error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
