/**
 * @file app/api/cron/flag-bot-movement/route.ts
 * @created 2025-10-23
 * @overview Cron job for flag bot movement and reset (Postgres rewrite, FID-20260905-001 §7.3)
 *
 * OVERVIEW:
 * Scheduled job that runs every 30 minutes to manage flag bot lifecycle.
 * Postgres-native via drizzle: holder identity is the flat `flags.current_holder`
 * username (a players row). The previous implementation read a Mongo-era nested
 * `currentHolder` doc that Postgres rows never carried, so bot detection never
 * matched and bot teleportation was dead code.
 *
 * Actions:
 * 1. If the flag has been held > 1 hour by the BOT → respawn a fresh bot.
 *    A HUMAN holder is never reset (the legacy path deleted the holder's player
 *    row — a data-destroying bug; players now keep the flag until defeated).
 * 2. If held by the bot → teleport the bot to a random location.
 * 3. If held by a human → no action.
 *
 * Security: Requires CRON_SECRET in Authorization header (fail-closed 500 when
 * unset so misconfiguration is loud, 401 on bad token).
 *
 * Cron Schedule: Every 30 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { moveFlagBot, shouldResetFlag, resetFlagBot } from '@/lib/flagBotService';
import { db } from '@/lib/db';
import { flags, players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/cron/flag-bot-movement
 *
 * Cron endpoint for flag bot management
 * Called by Vercel Cron every 30 minutes
 *
 * Security: Requires CRON_SECRET in Authorization header
 *
 * @returns JSON response with action taken
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('⚠️ CRON_SECRET not configured in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('⚠️ Unauthorized cron job attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const [flagRow] = await db.select().from(flags).limit(1);
    const holder = flagRow?.currentHolder ?? null;

    // Reset check only applies while the BOT holds the flag. `shouldResetFlag`
    // is true whenever the claim is older than 1 hour (bot or human) — the
    // legacy cron then DELETED the holder row, destroying human accounts.
    const heldTooLong = await shouldResetFlag();
    const isBotHolder = !!holder && /^Flag-Bearer-/.test(holder);

    if (heldTooLong && isBotHolder) {
      const newBot = await resetFlagBot();

      console.log(`🔄 Flag reset: New bot spawned at (${newBot.currentPosition.x}, ${newBot.currentPosition.y})`);

      return NextResponse.json({
        success: true,
        action: 'reset',
        message: 'Flag bot reset and respawned at new random location',
        newBot: {
          username: newBot.username,
          position: newBot.currentPosition,
        },
        timestamp: new Date(),
      });
    }

    if (heldTooLong && holder && !isBotHolder) {
      // Human holder past the 1-hour mark: the flag stays with them until they
      // are defeated in combat. Log for observability.
      console.log(`ℹ️ Flag held by player ${holder} for >1h — no reset (player retention rule)`);

      return NextResponse.json({
        success: true,
        action: 'none',
        message: 'Flag held by player - no reset applied',
        holder: { username: holder },
        timestamp: new Date(),
      });
    }

    // Only move bot if flag is held by the bot
    if (holder && isBotHolder) {
      const [botRow] = await db.select().from(players).where(eq(players.username, holder)).limit(1);
      if (botRow) {
        const newPosition = await moveFlagBot(holder);
        const oldPosition = { x: botRow.currentPositionX, y: botRow.currentPositionY };

        console.log(`🚁 Flag bot teleported to (${newPosition.x}, ${newPosition.y})`);

        return NextResponse.json({
          success: true,
          action: 'moved',
          message: 'Flag bot teleported to new random location',
          oldPosition,
          newPosition,
          timestamp: new Date(),
        });
      }
    }

    if (holder) {
      // Human holder inside the 1-hour window — no action needed.
      return NextResponse.json({
        success: true,
        action: 'none',
        message: 'Flag held by player - no bot movement needed',
        holder: { username: holder },
        timestamp: new Date(),
      });
    }

    // No flag holder found - unusual state
    console.warn('⚠️ No flag holder found in database');

    return NextResponse.json({
      success: true,
      action: 'none',
      message: 'No flag holder found',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('❌ Flag bot movement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
