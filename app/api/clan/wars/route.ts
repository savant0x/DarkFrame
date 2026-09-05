/**
 * @file app/api/clan/wars/route.ts
 * @created 2026-09-04
 * @overview Clan war list (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/clan/wars?clanId=<id>
 * Session-authenticated + clan membership required. Wars persist as
 * WAR_DECLARED entries in mod_log (see clanWarfareService.declareWar — there is
 * no dedicated wars table); this endpoint reads those entries and reconstitutes
 * the ClanWar shape the ClanWarfarePanel renders, including stats defaults.
 * Details JSON written by declareWar: { warId, targetClanId, cost }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { modLog } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';

interface WarDto {
  _id: string;
  warId: string;
  attackerClanId: string;
  defenderClanId: string;
  status: string;
  declaredAt: string;
  declarationCost: { metal: number; energy: number };
  stats: {
    attackerTerritoryGained: number;
    defenderTerritoryGained: number;
    attackerBattlesWon: number;
    defenderBattlesWon: number;
  };
}

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

    // Wars where this clan is either side. moderator_id stores the declaring
    // PLAYER (username), so attacker attribution comes from the details JSON
    // (attackerClanId — written by declareWar); SQL filters on the target side
    // only, then the parsed side check below narrows to both sides.
    const rows = await db
      .select()
      .from(modLog)
      .where(eq(modLog.action, 'WAR_DECLARED'))
      .orderBy(desc(modLog.createdAt))
      .limit(200);

    const wars: WarDto[] = rows
      .map((r) => {
        let details: { warId?: string; attackerClanId?: string; targetClanId?: string; cost?: { metal: number; energy: number } } = {};
        try {
          details = r.details ? JSON.parse(r.details) : {};
        } catch {
          details = {};
        }
        const attackerClanId = details.attackerClanId || '';
        const defenderClanId = details.targetClanId || r.targetId;
        return { r, details, attackerClanId, defenderClanId };
      })
      .filter(({ attackerClanId, defenderClanId }) => attackerClanId === gate.clanId || defenderClanId === gate.clanId)
      .slice(0, 100)
      .map(({ r, details, attackerClanId, defenderClanId }) => ({
        _id: r.id,
        warId: details.warId || r.id,
        attackerClanId,
        defenderClanId,
        status: 'DECLARED',
        declaredAt: r.createdAt.toISOString(),
        declarationCost: details.cost || { metal: 0, energy: 0 },
        stats: {
          attackerTerritoryGained: 0,
          defenderTerritoryGained: 0,
          attackerBattlesWon: 0,
          defenderBattlesWon: 0,
        },
      }));

    return NextResponse.json({ success: true, wars }, { status: 200 });
  } catch (error) {
    console.error('[API /clan/wars GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load wars' },
      { status: 500 }
    );
  }
}
