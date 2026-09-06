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
import { players } from '@/lib/db/schema';
import type { PlayerUnit, BotConfig } from '@/types/game.types';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,

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

    // Generate bots
    const spawnedBots: string[] = [];
    const MAP_SIZE = 5000;

    for (let i = 0; i < count; i++) {
      // Generate bot username
      const botNumber = Math.floor(Math.random() * 100000);
      const username = `${specialization}Bot_${botNumber}`;

      // Determine position
      const botPosition = position || {
        x: Math.floor(Math.random() * MAP_SIZE),
        y: Math.floor(Math.random() * MAP_SIZE),
      };

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
