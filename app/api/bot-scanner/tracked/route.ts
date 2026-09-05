/**
 * @file app/api/bot-scanner/tracked/route.ts
 * @created 2026-09-04
 * @overview Tracked-bot reputation list (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/bot-scanner/tracked
 * Requires an authenticated session. Serves components/ReputationPanel.tsx:
 * the tracked-bots list previously fed by hardcoded mock fixtures.
 *
 * Data source: players rows with is_bot=1 — their botConfig jsonb carries the
 * live defeat counters (defeatedCount, reputation, lastDefeated) maintained by
 * botCombatService on every player-vs-bot victory. `totalLoot` is NOT tracked
 * anywhere for bots (bot defeats are not written to battle_logs); it is served
 * as 0 rather than fabricated, flagged in FID-20260904-005 §7 as a data gap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import type { BotConfig } from '@/types/game.types';

interface TrackedBotDto {
  botId: string;
  botName: string;
  specialization: string;
  tier: number;
  defeats: number;
  reputation: string;
  lastDefeatAt: string | null;
  totalLoot: { metal: number; energy: number };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const rows = await db
      .select({
        username: players.username,
        botConfig: players.botConfig,
      })
      .from(players)
      .where(eq(players.isBot, 1))
      .orderBy(desc(players.level))
      .limit(100);

    const bots: TrackedBotDto[] = rows.map((r) => {
      const cfg: Partial<BotConfig> = r.botConfig ?? {};
      return {
        botId: r.username,
        botName: r.username,
        specialization: String(cfg.specialization ?? 'unknown'),
        tier: Number(cfg.tier ?? 1),
        defeats: Number(cfg.defeatedCount ?? 0),
        reputation: String(cfg.reputation ?? 'unknown'),
        lastDefeatAt: cfg.lastDefeated ? new Date(cfg.lastDefeated).toISOString() : null,
        totalLoot: { metal: 0, energy: 0 }, // not tracked for bots (see header note)
      };
    });

    return NextResponse.json(
      { success: true, bots },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /bot-scanner/tracked GET] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load tracked bots' },
      { status: 500 }
    );
  }
}
