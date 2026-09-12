/**
 * @file app/api/clan/wars/route.ts
 * @updated 2026-09-12 (FID-20260912-076 War Engine v2)
 * @overview Clan war list — now served from the REAL clan_wars table.
 *
 * GET /api/clan/wars?clanId=<id>
 * Session-authenticated + clan membership required. FID-076 replaced the
 * mod_log-scraping v1 (which showed only 'DECLARED' ghosts with hardcoded
 * zero stats) with reads against the war ledger populated by declareWar and
 * updated live by battle/capture hooks and the settlement job.
 *
 * DTO is the ClanWar shape ClanWarfarePanel renders: battles-won fields map
 * from attackerScore/defenderScore, territory fields from
 * attackerCaptures/defenderCaptures, winner derives from outcome on ENDED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireClanMembership } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { clanWars } from '@/lib/db/schema';
import { desc, or, eq } from 'drizzle-orm';

interface WarDto {
  _id: string;
  warId: string;
  attackerClanId: string;
  defenderClanId: string;
  attackerTag?: string;
  defenderTag?: string;
  status: 'ACTIVE' | 'ENDED' | 'TRUCE';
  declaredAt: string;
  startedAt?: string;
  endedAt?: string;
  endedReason?: string;
  winner?: string;
  declarationCost: { metal: number; energy: number };
  spoils?: { metal: number; energy: number; rp: number } | null;
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

    const rows = await db
      .select()
      .from(clanWars)
      .where(
        or(
          eq(clanWars.attackerClanId, gate.clanId),
          eq(clanWars.defenderClanId, gate.clanId)
        )
      )
      .orderBy(desc(clanWars.declaredAt))
      .limit(100);

    const wars: WarDto[] = rows.map((w) => ({
      _id: w.warId,
      warId: w.warId,
      attackerClanId: w.attackerClanId,
      defenderClanId: w.defenderClanId,
      attackerTag: w.attackerTag,
      defenderTag: w.defenderTag,
      status: w.status as WarDto['status'],
      declaredAt: w.declaredAt.toISOString(),
      startedAt: w.declaredAt.toISOString(),
      endedAt: w.endedAt ? w.endedAt.toISOString() : undefined,
      endedReason: w.endedReason ?? undefined,
      winner:
        w.status === 'ENDED' && w.outcome === 'ATTACKER_WIN'
          ? w.attackerClanId
          : w.status === 'ENDED' && w.outcome === 'DEFENDER_WIN'
            ? w.defenderClanId
            : undefined,
      declarationCost: w.declarationCost ?? { metal: 0, energy: 0 },
      spoils: w.spoils ?? null,
      stats: {
        attackerTerritoryGained: w.attackerCaptures,
        defenderTerritoryGained: w.defenderCaptures,
        attackerBattlesWon: w.attackerScore,
        defenderBattlesWon: w.defenderScore,
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
