/**
 * @file app/api/clan/alliance/create/route.ts
 * @created 2026-09-04
 * @overview Clan alliance creation (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/clan/alliance/create
 * Session-authenticated + clan membership required. Body (ClanWarfarePanel):
 * { clanIds: [myClanId, allyClanId], terms?: string }
 * The FIRST clanId is validated against the session's clan (never trusted from
 * the body alone). The panel's free-text `terms` is stored as metadata via the
 * NAP-default alliance type; formal contract terms are added separately through
 * the existing /api/clan/alliance/contract route. Delegates to
 * clanAllianceService.proposeAlliance (roles, dupes, cooldowns, costs inside).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { proposeAlliance, AllianceType } from '@/lib/clanAllianceService';

interface CreateBody {
  clanIds?: string[];
  terms?: string;
}

export async function POST(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    let body: CreateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const clanIds = Array.isArray(body.clanIds) ? body.clanIds : [];
    if (clanIds.length !== 2 || clanIds.some((id) => !id)) {
      return NextResponse.json(
        { success: false, error: 'clanIds must contain exactly two clan ids' },
        { status: 400 }
      );
    }

    const [declaredClanId, targetClanId] = clanIds;
    if (declaredClanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, error: 'The first clanId must be your own clan' },
        { status: 403 }
      );
    }

    const alliance = await proposeAlliance(
      gate.clanId,
      targetClanId,
      AllianceType.NAP,
      gate.auth.playerId
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Alliance proposed — the target clan must accept it',
        alliance: {
          ...alliance,
          _id: alliance._id ?? '',
          allianceId: alliance._id ?? '',
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create alliance';
    const status = /not found|cooldown|already exists|insufficient|leaders/i.test(message) ? 400 : 500;
    if (status === 500) {
      console.error('[API /clan/alliance/create POST] Error:', error);
    }
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
