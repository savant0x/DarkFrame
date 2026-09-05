/**
 * @file app/api/clan/demote/route.ts
 * @created 2026-09-04
 * @overview Clan member demotion (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/demote
 * Session-authenticated + clan membership required. Body:
 * { clanId?: string, targetUsername: string, newRole: ClanRole }
 * Uses clanService.promoteMember — despite the name it sets an arbitrary new
 * role and enforces the role hierarchy in both directions (promotion/demotion),
 * which is exactly the demote semantics. The panel supplies the target role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { promoteMember } from '@/lib/clanService';
import { ClanRole } from '@/types/clan.types';

interface DemoteBody {
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
    let body: DemoteBody;
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
    const message = error instanceof Error ? error.message : 'Failed to demote member';
    console.error('[API /clan/demote POST] Error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
