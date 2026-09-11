/**
 * @file app/api/player/battle-history/route.ts
 * @overview FID-20260911-045 — compact battle-history feed for the game HUD.
 *
 * Returns slim, already-parsed summaries of the player's recent raids,
 * sourced from the `battle_result` system messages written by
 * lib/battleNotification.ts (FID-20260911-043). The headline + meta lines of
 * each report carry everything the HUD needs (battle type, location, outcome,
 * round count, timestamp, battle id) — no message bodies ever leave the
 * server, so the feed costs ~40 bytes per row on the wire (egress rule from
 * the FID-037 remediation: never ship 39 KB rows where 40 bytes suffice).
 *
 * GET /api/player/battle-history?limit=8
 * Auth: session cookie; the feed shows only the caller's own reports.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { conversations, messages } from '@/lib/db/schema';
import { sql, desc, eq } from 'drizzle-orm';

interface BattleSummary {
  battleId: string | null;
  battleType: string | null;
  location: { x: number; y: number } | null;
  outcome: 'VICTORY' | 'DEFEAT' | 'DRAW' | null;
  totalRounds: number | null;
  timestamp: string | null;
  /** ISO time of the message row — the feed's sort key. */
  reportedAt: string;
}

const OUTCOMES = new Set(['VICTORY', 'DEFEAT', 'DRAW']);

/** Parse the report headline + meta line. Mirrors lib/battleReportParser.ts. */
function summarize(content: string): Omit<BattleSummary, 'reportedAt'> | null {
  const lines = content.split('\n');

  // Headline: "⚔️ BATTLE REPORT — FACTORY at (44, 2) — DEFEAT"
  const hm = lines[0]?.trim().match(
    /^⚔️\s*BATTLE REPORT\s+—\s+(.+?)\s+at\s+\(?(?:(\d+),\s*(\d+)|the field)\)?\s+—\s+(VICTORY|DEFEAT|DRAW)\s*$/i,
  );
  if (!hm) return null;

  // Meta: "🗓 9/11/2026, 1:37:37 PM · Battle ID BATTLE-17891 · 1 round"
  const mm = lines[1]?.trim().match(/^🗓\s*(.+?)\s*·\s*Battle ID\s+(\S+)\s*·\s*(\d+)\s+round/i);

  return {
    battleType: hm[1].trim(),
    location: hm[2] !== undefined && hm[3] !== undefined
      ? { x: Number.parseInt(hm[2], 10), y: Number.parseInt(hm[3], 10) }
      : null,
    outcome: OUTCOMES.has(hm[4].toUpperCase()) ? (hm[4].toUpperCase() as BattleSummary['outcome']) : null,
    battleId: mm ? mm[2].trim() : null,
    totalRounds: mm ? Number.parseInt(mm[3], 10) : null,
    timestamp: mm ? mm[1].trim() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser?.username) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const limitParam = Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '8', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 20) : 8;

    // Conversations where the caller is a participant and the partner is the
    // SYSTEM sender (battle reports live in the SYSTEM ↔ player 1:1 thread).
    const rows = await db
      .select({
        content: messages.content,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        sql`${conversations.participants} @> ${JSON.stringify(['SYSTEM', authUser.username])}::jsonb
          AND jsonb_array_length(${conversations.participants}) = 2
          AND ${messages.metadataSystemType} = 'battle_result'`,
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    const battles: BattleSummary[] = [];
    for (const row of rows) {
      const s = summarize(row.content);
      if (s) {
        battles.push({ ...s, reportedAt: new Date(row.createdAt).toISOString() });
      }
    }

    return NextResponse.json(
      { success: true, data: { battles } },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Error in GET /api/player/battle-history:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load battle history' },
      { status: 500 },
    );
  }
}
