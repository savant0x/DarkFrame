/**
 * @file app/api/clan/war/truce/route.ts
 * @created 2026-09-12
 * @overview FID-20260912-076 — truce proposal endpoint.
 *
 * POST /api/clan/war/truce
 * Session-authenticated + clan membership required; Officer+ role is enforced
 * inside the service. Delegates to clanWarfareService.proposeTruce: mutual
 * proposals settle immediately (TRUCE, no spoils); a unilateral proposal
 * auto-settles only after the 7-day mark. Errors surface as 400/404 with the
 * service's reason string.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { proposeTruce } from '@/lib/clanWarfareService';

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    const result = await proposeTruce(gate.clanId, gate.auth.playerId);
    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Officer') || message.includes('permission')) {
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
    if (message.includes('not found') || message.includes('No active war')) {
      return NextResponse.json({ success: false, error: message }, { status: 404 });
    }
    console.error('[API /clan/war/truce POST] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to propose truce' }, { status: 500 });
  }
}
