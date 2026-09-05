/**
 * @file app/api/clan/alliances/route.ts
 * @created 2026-09-04
 * @overview Clan alliance list (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/alliances?clanId=<id>
 * Session-authenticated + clan membership required. Delegates to
 * clanAllianceService.getAlliancesForClan (pg jsonb containment queries fixed
 * earlier in this phase) and maps to the panel's field names, including the
 * `terms` summary the ClanWarfarePanel renders (contract types joined).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { getAlliancesForClan, ContractType } from '@/lib/clanAllianceService';

export async function GET(request: NextRequest) {
  const gate = await requireClanMembership(request);
  if (gate instanceof NextResponse) {
    return gate;
  }

  try {
    const { searchParams } = new URL(request.url);
    const requestedClanId = searchParams.get('clanId');

    if (requestedClanId && requestedClanId !== gate.clanId) {
      return NextResponse.json(
        { success: false, error: 'clanId does not match your clan' },
        { status: 403 }
      );
    }

    const alliances = await getAlliancesForClan(gate.clanId, true);

    return NextResponse.json(
      {
        success: true,
        alliances: alliances.map((a) => ({
          ...a,
          _id: a._id ?? '',
          allianceId: a._id ?? '',
          terms:
            a.contracts.length > 0
              ? a.contracts.map((c) => contractLabel(c.type)).join(', ')
              : 'No contracts',
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /clan/alliances GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load alliances' },
      { status: 500 }
    );
  }
}

function contractLabel(type: ContractType): string {
  switch (type) {
    case ContractType.RESOURCE_SHARING:
      return 'Resource Sharing';
    case ContractType.DEFENSE_PACT:
      return 'Defense Pact';
    case ContractType.WAR_SUPPORT:
      return 'War Support';
    case ContractType.JOINT_RESEARCH:
      return 'Joint Research';
    default:
      return type;
  }
}
