/**
 * @file app/api/wmd/status/route.ts
 * @created 2025-10-22
 * @updated 2026-09-06 (FID-20260906-002 G1) — drizzle-native seam rewrite
 * @overview WMD Status Summary API
 *
 * OVERVIEW:
 * Provides summary status for WMDMiniStatus widget.
 * Returns key metrics: RP, missiles ready, batteries active, spies available, pending votes.
 *
 * Endpoint: GET /api/wmd/status
 *
 * Response:
 * {
 *   success: true,
 *   status: {
 *     rp: number,
 *     missilesReady: number,
 *     batteriesActive: number,
 *     spiesAvailable: number,
 *     pendingVotes: number,
 *     hasAlerts: boolean
 *   }
 * }
 *
 * Data model (FID-20260906-002 W1):
 * - WMD identity is the players row (username-keyed); `getAuthenticatedPlayer`
 *   normalizes `playerId === username`.
 * - Batteries are CLAN-scoped (`wmd_defense_batteries.clanId`); "active" = IDLE
 *   (the only operational status `defenseService` writes).
 * - Votes live in `wmd_clan_votes` (`wmd_votes` is a legacy aggregate table).
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, getAuthenticatedPlayer } from '@/lib/wmd/apiHelpers';
import { ensureWmdJobsTicked } from '@/lib/wmd/jobs/missileTracker';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import {
  missiles,
  wmdDefenseBatteries,
  wmdSpies,
  wmdClanVotes,
  wmdNotifications,
} from '@/lib/db/schema/wmd';
import { and, eq, inArray, desc } from 'drizzle-orm';
import { NotificationPriority, NotificationScope } from '@/types/wmd';
import { MissileStatus } from '@/types/wmd';

export async function GET(_req: NextRequest) {
  try {
    // G6: lazy self-tick so missile impacts fire even without the server.ts scheduler.
    void ensureWmdJobsTicked();

    // Session identity only — client-supplied usernames are never trusted.
    // verifyAuth returns the username string (null when unauthenticated).
    const username = await verifyAuth(_req);
    if (!username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const auth = await getAuthenticatedPlayer(_req);
    if (!auth) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const playerId = auth.playerId; // === username
    const clanId = auth.player.clanId;

    const [
      playerRow,
      readyMissiles,
      idleBatteries,
      availableSpies,
      pendingVotes,
      recentNotifications,
    ] = await Promise.all([
      db.select({ researchPoints: players.researchPoints })
        .from(players)
        .where(eq(players.username, playerId))
        .limit(1),
      db.select({ status: missiles.status })
        .from(missiles)
        .where(and(eq(missiles.ownerId, playerId), eq(missiles.status, MissileStatus.READY))),
      clanId
        ? db.select({ status: wmdDefenseBatteries.status })
            .from(wmdDefenseBatteries)
            .where(and(eq(wmdDefenseBatteries.clanId, clanId), eq(wmdDefenseBatteries.status, 'IDLE')))
        : Promise.resolve([] as { status: string }[]),
      db.select({ status: wmdSpies.status })
        .from(wmdSpies)
        .where(and(eq(wmdSpies.ownerId, playerId), eq(wmdSpies.status, 'AVAILABLE'))),
      clanId
        ? db.select({ id: wmdClanVotes.id })
            .from(wmdClanVotes)
            .where(and(eq(wmdClanVotes.clanId, clanId), eq(wmdClanVotes.status, 'ACTIVE')))
        : Promise.resolve([] as { id: string }[]),
      db.select({ priority: wmdNotifications.priority })
        .from(wmdNotifications)
        .where(and(
          eq(wmdNotifications.scope, NotificationScope.PERSONAL),
          eq(wmdNotifications.targetId, playerId),
          inArray(wmdNotifications.priority, [NotificationPriority.ALERT, NotificationPriority.CRITICAL]),
        ))
        .orderBy(desc(wmdNotifications.broadcastAt))
        .limit(10),
    ]);

    const status = {
      rp: playerRow[0]?.researchPoints ?? 0,
      missilesReady: readyMissiles.length,
      batteriesActive: idleBatteries.length,
      spiesAvailable: availableSpies.length,
      pendingVotes: pendingVotes.length,
      hasAlerts: recentNotifications.length > 0,
    };

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Error fetching WMD status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WMD status' },
      { status: 500 }
    );
  }
}
