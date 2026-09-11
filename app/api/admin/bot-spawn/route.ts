/**
 * @fileoverview Admin Bot Spawn Control API - Manual bot creation
 * @module app/api/admin/bot-spawn/route
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Admin-only endpoint for manually spawning bots with custom configurations.
 * Allows admins to create bots of specific types, tiers, and positions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players, modLog, tiles } from '@/lib/db/schema';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { getGlobalBotConfig } from '@/lib/botConfigService';
import { generateBotName, claimBotBaseTile } from '@/lib/botService';
import { generateId } from '@/lib/utils';
import type { PlayerUnit, BotConfig } from '@/types/game.types';
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
import { BotSpawnSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

// ============================================================================
// POST - Spawn Bot
// ============================================================================

/**
 * POST /api/admin/bot-spawn
 * Rate Limited: 30 req/hour (admin bot management)
 * Manually spawn a bot with custom configuration
 * Requires admin privileges (rank >= 5)
 * 
 * Request body:
 * {
 *   specialization: 'Hoarder' | 'Fortress' | 'Raider' | 'Balanced' | 'Ghost',
 *   tier: 1-6,
 *   position?: { x: number, y: number },
 *   isSpecialBase?: boolean,
 *   count?: number (default 1, max 10)
 * }
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBotSpawnAPI');
  const endTimer = log.time('bot-spawn');

  try {
    // FID-20260905-001: requireAdmin (isAdmin JWT flag) replaces the rank<5 gate.
    const adminAuth = await requireAdmin(request);
    if (adminAuth instanceof NextResponse) {
      return adminAuth;
    }
    const tokenPayload = adminAuth;

    // Parse request body
    const body = await request.json();
    const validated = BotSpawnSchema.parse(body);
    const { specialization, tier, position, isSpecialBase, count = 1 } = validated;

    // FID-20260906-003 S1: enforce the admin-configured population cap. Pre-FID
    // the panel's totalBotCap setting was never read by anything.
    const globalConfig = await getGlobalBotConfig();
    const [currentBots] = await db
      .select({ botCount: sql<number>`count(*)::int` })
      .from(players)
      .where(eq(players.isBot, 1));
    const currentCount = currentBots?.botCount ?? 0;
    if (currentCount + count > globalConfig.totalBotCap) {
      return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, {
        message: `Spawn refused: ${currentCount} bots exist and spawning ${count} would exceed the configured cap of ${globalConfig.totalBotCap}.`,
      });
    }

    // Generate bots
    const spawnedBots: string[] = [];

    for (let i = 0; i < count; i++) {
      // FID-20260906-007 contract: ALL bot names come from the themed
      // generator (UsernameSchema-safe by contract test). The old inline
      // `${specialization}Bot_${n}` slug bypassed the lexicon entirely and
      // produced names like "infantryBot_48213".
      const username = generateBotName();

      // FID-20260909-030: placement legality is enforced, not assumed. An
      // admin-supplied position is honored ONLY if it is an unoccupied
      // Wasteland tile; otherwise 400 with the reason. The default path      // claims a legal tile through the shared helper (the old      // `Math.random() * 5000` could land OFF the 150×150 map entirely —      // bases at coordinates with no tile).
      let botPosition: { x: number; y: number };
      if (position) {
        const tileRows = await db
          .select({ terrain: tiles.terrain, occupied: tiles.occupiedByBase })
          .from(tiles)
          .where(and(eq(tiles.x, position.x), eq(tiles.y, position.y)))
          .limit(1);
        const tile = tileRows[0];
        if (!tile) {
          return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, {
            message: `Position (${position.x}, ${position.y}) does not exist on the 150×150 map.`,
          });
        }
        if (tile.terrain !== 'Wasteland') {
          return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, {
            message: `Position (${position.x}, ${position.y}) is ${tile.terrain} — bases can only be placed on Wasteland (spawn terrain per docs/README_NEW.md).`,
          });
        }
        if (tile.occupied !== null) {
          return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, {
            message: `Position (${position.x}, ${position.y}) is already occupied by a base.`,
          });
        }
        botPosition = { x: position.x, y: position.y };
        await db
          .update(tiles)
          .set({ occupiedByBase: 1, baseOwner: username })
          .where(and(eq(tiles.x, position.x), eq(tiles.y, position.y), isNull(tiles.occupiedByBase)));
      } else {
        const claimed = await claimBotBaseTile({ zone: null, ownerUsername: username });
        botPosition = { x: claimed.x, y: claimed.y };
      }

      // Calculate resources based on tier
      const baseResources = [10000, 25000, 50000, 100000, 200000, 400000];
      const resourceAmount = baseResources[tier - 1] || 10000;
      const multiplier = isSpecialBase ? 3 : 1;

      // Create bot document
      const botDoc = {
        username,
        email: `${username}@bot.local`,
        password: 'BOT_NO_LOGIN',
        isBot: 1,
        baseX: botPosition.x,
        baseY: botPosition.y,
        currentPositionX: botPosition.x,
        currentPositionY: botPosition.y,
        resourcesMetal: Number(BigInt(resourceAmount * multiplier)),
        resourcesEnergy: Number(BigInt(Math.floor(resourceAmount * 0.6 * multiplier))),
        units: [
          { soldiers: { ATK: 0, DEF: 0, count: 0 } },
          { tanks: { ATK: 0, DEF: 0, count: 0 } },
          { aircraft: { ATK: 0, DEF: 0, count: 0 } },
        ] as unknown as PlayerUnit[],
        totalStrength: 0,
        totalDefense: 0,
        xp: 0,
        level: 1,
        researchPoints: 0,
        unlockedTiers: [1],
        botConfig: {
          specialization,
          tier,
          lastGrowth: new Date(),
          lastResourceRegen: new Date(),
          attackCooldown: new Date(0),
          revengeTarget: undefined,
          isSpecialBase: isSpecialBase || false,
          defeatedCount: 0,
          reputation: { defeatedCount: 0, lastDefeated: undefined, threatLevel: 0 },
          movement: 'stationary',
          zone: Math.floor((botPosition.x + botPosition.y) / 33),
          nestAffinity: null,
          bountyValue: 0,
          permanentBase: false,
        } as unknown as BotConfig,
        createdAt: new Date(),
      };

      // Insert bot
      await db.insert(players).values(botDoc);
      spawnedBots.push(username);
    }

    // FID-20260906-003 S6: bot-population mutation → mod_log audit row.
    if (spawnedBots.length > 0) {
      await db.insert(modLog).values({
        id: generateId().slice(0, 24),
        moderatorId: tokenPayload.username.slice(0, 20),
        action: 'ADMIN_BOT_SPAWN',
        targetId: spawnedBots[0].slice(0, 24),
        details: JSON.stringify({ count: spawnedBots.length, specialization, tier, bots: spawnedBots }),
        createdAt: new Date(),
      });
    }

    log.info('Bots spawned successfully', {
      count,
      specialization,
      tier,
      bots: spawnedBots,
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      message: `Spawned ${count} bot(s) successfully`,
      bots: spawnedBots,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to spawn bot', error instanceof Error ? error : new Error(String(error)));
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
 * - Requires rank >= 5 to spawn bots
 * - Max 10 bots per request to prevent abuse
 * - Special bases have 3x resources
 * 
 * USAGE:
 * Spawn a single Raider bot at position:
 * POST /api/admin/bot-spawn
 * { "specialization": "Raider", "tier": 4, "position": { "x": 1000, "y": 1000 } }
 * 
 * Spawn 5 random Hoarder bots:
 * POST /api/admin/bot-spawn
 * { "specialization": "Hoarder", "tier": 3, "count": 5 }
 * 
 * FUTURE ENHANCEMENTS:
 * - Custom bot names
 * - Predefined bot templates
 * - Spawn in formations (circle, line, grid)
 * - Immediate army composition
 */
