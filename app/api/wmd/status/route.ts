/**
 * @file app/api/wmd/status/route.ts
 * @created 2025-10-22
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
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/authMiddleware';
import { getDatabase } from '@/lib/mongodb';

/** Player document fields read by this route. */
interface PlayerClanFields {
  clanId?: string | null;
}
/** WMD research document fields read by this route. */
interface WmdResearchFields {
  currentRP?: number;
}
/** WMD missile document fields read by this route. */
interface WmdMissileFields {
  status?: string;
}
/** WMD battery document fields read by this route. */
interface WmdBatteryFields {
  status?: string;
}
/** WMD spy document fields read by this route. */
interface WmdSpyFields {
  status?: string;
}
/** WMD notification document fields read by this route. */
interface WmdNotificationFields {
  priority?: string;
}
/** WMD clan-vote document (counted only). */
interface WmdVoteDoc {
  clanId?: string;
  status?: string;
}

export async function GET(_req: NextRequest) {
  try {
    // Verify authentication using the same method as other APIs
    const authResult = await verifyAuth();
    if (!authResult || !authResult.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDatabase();
    const player = await db.collection<PlayerClanFields>('players').findOne({ username: authResult.username });
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const playerId = authResult.username;

    // Query all collections in parallel for performance
    const [research, missiles, batteries, spies, votes, notifications] = await Promise.all([
      db.collection<WmdResearchFields>('wmd_research').findOne({ playerId }),
      db.collection<WmdMissileFields>('wmd_missiles').find({ ownerId: playerId }).toArray(),
      db.collection<WmdBatteryFields>('wmd_batteries').find({ playerId }).toArray(),
      db.collection<WmdSpyFields>('wmd_spies').find({ playerId }).toArray(),
      player.clanId
        ? db.collection<object>('wmd_votes').find({ clanId: player.clanId, status: 'ACTIVE' }).toArray()
        : Promise.resolve([] as WmdVoteDoc[]),
      db.collection<WmdNotificationFields>('wmd_notifications').find({ playerId, status: 'UNREAD' }).limit(10).toArray(),
    ]);

    // Calculate stats
    const rp = research?.currentRP ?? 0;
    const missilesReady = missiles.filter((m) => m.status === 'READY').length;
    const batteriesActive = batteries.filter((b) =>
      b.status === 'IDLE' || b.status === 'ACTIVE'
    ).length;
    const spiesAvailable = spies.filter((s) => s.status === 'AVAILABLE').length;
    const pendingVotes = votes.length;
    const hasAlerts = notifications.some((n) =>
      n.priority === 'ALERT' || n.priority === 'CRITICAL'
    );

    return NextResponse.json({
      success: true,
      status: {
        rp,
        missilesReady,
        batteriesActive,
        spiesAvailable,
        pendingVotes,
        hasAlerts,
      },
    });
  } catch (error) {
    console.error('Error fetching WMD status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch WMD status' },
      { status: 500 }
    );
  }
}
