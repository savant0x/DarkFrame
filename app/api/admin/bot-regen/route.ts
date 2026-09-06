/**
 * @fileoverview Admin Bot Regeneration API - Force resource regeneration
 * @module app/api/admin/bot-regen/route
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Admin-only endpoint for forcing bot resource regeneration cycles.
 * Allows admins to manually trigger hourly resource growth for bots.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import type { BotConfig } from '@/types/game.types';
import { eq, and } from 'drizzle-orm';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createValidationErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { BotRegenSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

// ============================================================================
// POST - Force Bot Resource Regeneration
// ============================================================================

/**
 * POST /api/admin/bot-regen
 * Rate Limited: 30 req/hour (admin bot management)
 * Manually triggers resource regeneration for all bots or specific bot
 * Requires admin privileges (rank >= 5)
 * 
 * Request body (optional):
 * {
 *   username?: string // Specific bot username, or omit for all bots
 * }
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBotRegenAPI');
  const endTimer = log.time('bot-regen');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const tokenPayload = adminAuth;

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const validated = BotRegenSchema.parse(body);
    const { username } = validated;

    // Build query
    const bots = username
      ? await db.select().from(players).where(and(eq(players.isBot, 1), eq(players.username, username)))
      : await db.select().from(players).where(eq(players.isBot, 1));

    if (bots.length === 0) {
      return createErrorResponse(ErrorCode.ADMIN_BOT_NOT_FOUND, {
        message: username ? 'Bot not found' : 'No bots found',
        username,
      });
    }

    // Resource tier mapping
    const TIER_RESOURCES = [
      { metal: 10000, energy: 6000 },
      { metal: 25000, energy: 15000 },
      { metal: 50000, energy: 30000 },
      { metal: 100000, energy: 60000 },
      { metal: 200000, energy: 120000 },
      { metal: 400000, energy: 240000 },
    ];

    // Regenerate resources for each bot
    let regeneratedCount = 0;

    for (const bot of bots) {
      const tier = bot.botConfig?.tier || 1;
      const isSpecialBase = bot.botConfig?.isSpecialBase || false;
      const tierResources = TIER_RESOURCES[tier - 1] || TIER_RESOURCES[0];

      // Special bases have 3x resources
      const multiplier = isSpecialBase ? 3 : 1;
      const maxMetal = BigInt(tierResources.metal * multiplier);
      const maxEnergy = BigInt(tierResources.energy * multiplier);

      // Update bot config with new timestamps
      const existingBotConfig = bot.botConfig;
      const updatedBotConfig: BotConfig = {
        ...existingBotConfig,
        lastResourceRegen: new Date(),
        lastGrowth: new Date(),
      } as BotConfig;

      // Set resources to max and reset regen timestamp
      await db.update(players)
        .set({
          resourcesMetal: Number(maxMetal),
          resourcesEnergy: Number(maxEnergy),
          botConfig: updatedBotConfig,
        })
        .where(eq(players.username, bot.username));

      regeneratedCount++;
    }

    log.info('Bot resources regenerated', {
      botsAffected: regeneratedCount,
      username: username || 'all',
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      message: `Regenerated resources for ${regeneratedCount} bot(s)`,
      botsAffected: regeneratedCount,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to regenerate bot resources', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================

/**
 * ADMIN PERMISSIONS:
 * - Requires rank >= 5 to trigger regeneration
 * - Can target specific bot or all bots
 * - Sets resources to tier maximum instantly
 * 
 * USAGE:
 * Regenerate all bots:
 * POST /api/admin/bot-regen
 * {}
 * 
 * Regenerate specific bot:
 * POST /api/admin/bot-regen
 * { "username": "HoarderBot_42" }
 * 
 * INTEGRATION:
 * This resets both lastResourceRegen and lastGrowth timestamps,
 * ensuring bots are ready for next hourly cycle.
 * 
 * FUTURE ENHANCEMENTS:
 * - Partial regeneration (percentage-based)
 * - Regeneration preview (show what will change)
 * - Scheduled regeneration cycles
 * - Regeneration cooldown limits
 */
