/**
 * @fileoverview Admin Bot Configuration API - View and update bot configs
 * @module app/api/admin/bot-config/route
 * @created 2025-10-18
 * @updated 2025-10-24 (FID-20251024-ADMIN: Production Infrastructure)
 * 
 * OVERVIEW:
 * Admin-only endpoint for viewing and modifying bot configurations.
 * Allows admins to inspect bot details and adjust bot behavior settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, modLog } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { generateId } from '@/lib/utils';
import { getGlobalBotConfig, saveGlobalBotConfig } from '@/lib/botConfigService';
import { z } from 'zod';
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
import { BotConfigPatchSchema } from '@/lib/validation/schemas';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

// ============================================================================
// GET - View Bot Configuration
// ============================================================================

/**
 * GET /api/admin/bot-config?username=BotName
 * Rate Limited: 500 req/min (admin dashboard)
 * Returns detailed configuration for a specific bot
 * Requires admin privileges (rank >= 5)
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBotConfigGetAPI');
  const endTimer = log.time('get-bot-config');

  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin privileges
    if (tokenPayload.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin privileges required',
      });
    }

    // Get bot username from query params; without `username`, return the
    // GLOBAL bot-system settings (FID-20260906-003 S1: this bare-GET path was
    // previously a guaranteed 400 — the panel's mount fetch never worked).
    const { searchParams } = new URL(request.url);
    const botUsername = searchParams.get('username');

    if (!botUsername) {
      const global = await getGlobalBotConfig();
      log.info('Global bot configuration retrieved', { adminUser: tokenPayload.username });
      return NextResponse.json({ success: true, data: global });
    }

    // Fetch bot
    const bot = await db.select()
      .from(players)
      .where(and(eq(players.username, botUsername), eq(players.isBot, 1)))
      .limit(1);

    if (!bot.length) {
      return createErrorResponse(ErrorCode.ADMIN_BOT_NOT_FOUND, {
        message: 'Bot not found',
        username: botUsername,
      });
    }

    const botData = bot[0];

    // Return bot configuration
    log.info('Bot configuration retrieved', {
      botUsername,
      tier: botData.botConfig?.tier,
      specialization: botData.botConfig?.specialization,
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      data: {
        username: botData.username,
        // FID-20260905-001 M2: real columns (currentPosition/resources were Mongo-era).
        currentPosition: { x: botData.currentPositionX, y: botData.currentPositionY },
        resources: { metal: botData.resourcesMetal, energy: botData.resourcesEnergy },
        botConfig: botData.botConfig,
        units: botData.units,
        totalAttack: botData.totalStrength,
        totalDefense: botData.totalDefense,
        level: botData.level,
        xp: botData.xp,
        createdAt: botData.createdAt,
        lastActivity: botData.lastLoginDate,
      },
    });
  } catch (error) {
    log.error('Failed to fetch bot configuration', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================================
// PATCH - Update Bot Configuration (per-bot) OR Global Bot Settings
// ============================================================================

/**
 * PATCH /api/admin/bot-config
 * Rate Limited: 30 req/hour (admin bot management)
 * Two disjoint request shapes, distinguished by the presence of `username`
 * (FID-20260906-003 S1):
 *
 * 1. GLOBAL (the admin panel's bot-system settings — previously 400'd on
 *    every save because only the per-bot shape existed):
 *    { totalBotCap?: 1..5000, dailySpawnCount?: 0..1000,
 *      migrationPercent?: 0..1, regenRates?: Record<string, 0..1> }
 *    → upserts the bot_config 'global' row via botConfigService.
 *
 * 2. PER-BOT (unchanged contract):
 *    { username, updates: { specialization?, tier?, position?, resources?,
 *      isSpecialBase? } }
 *
 * Both require admin privileges.
 */
const patchRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

/** Validation bounds for the global settings shape (FID-003 S1). */
const GlobalBotConfigPatchSchema = z.object({
  totalBotCap: z.number().int().min(1).max(5000).optional(),
  dailySpawnCount: z.number().int().min(0).max(1000).optional(),
  migrationPercent: z.number().min(0).max(1).optional(),
  regenRates: z.record(z.string(), z.number().min(0).max(1)).optional(),
}).strict();

export const PATCH = withRequestLogging(patchRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBotConfigPatchAPI');
  const endTimer = log.time('patch-bot-config');

  try {
    // Authenticate user
    const tokenPayload = await getAuthenticatedUser();
    if (!tokenPayload) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
        message: 'Authentication required',
      });
    }

    // Check admin privileges
    if (tokenPayload.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, {
        message: 'Admin privileges required',
      });
    }

    const body: unknown = await request.json();

    // ---- Shape 1: global bot-system settings ----
    if (
      body !== null && typeof body === 'object' &&
      !('username' in body) &&
      ('totalBotCap' in body || 'dailySpawnCount' in body || 'migrationPercent' in body || 'regenRates' in body)
    ) {
      const globalPatch = GlobalBotConfigPatchSchema.parse(body);
      const current = await getGlobalBotConfig();
      const next = {
        totalBotCap: globalPatch.totalBotCap ?? current.totalBotCap,
        dailySpawnCount: globalPatch.dailySpawnCount ?? current.dailySpawnCount,
        migrationPercent: globalPatch.migrationPercent ?? current.migrationPercent,
        regenRates: { ...current.regenRates, ...(globalPatch.regenRates ?? {}) },
      };
      await saveGlobalBotConfig(next);

      // FID-003 S6: global config changes are audited.
      await db.insert(modLog).values({
        id: generateId().slice(0, 24),
        moderatorId: tokenPayload.username.slice(0, 20),
        action: 'ADMIN_BOT_CONFIG_GLOBAL',
        targetId: 'global',
        details: JSON.stringify({ changes: globalPatch, next }),
        createdAt: new Date(),
      });

      log.info('Global bot configuration saved', {
        changes: Object.keys(globalPatch),
        adminUser: tokenPayload.username,
      });
      return NextResponse.json({ success: true, message: 'Bot configuration saved successfully', data: next });
    }

    // ---- Shape 2: per-bot configuration (unchanged) ----
    const validated = BotConfigPatchSchema.parse(body);
    const { username, updates } = validated;

    // Verify bot exists
    const bot = await db.select()
      .from(players)
      .where(and(eq(players.username, username), eq(players.isBot, 1)))
      .limit(1);

    if (!bot.length) {
      return createErrorResponse(ErrorCode.ADMIN_BOT_NOT_FOUND, {
        message: 'Bot not found',
        username,
      });
    }

    // Build a typed update set (FID-20260905-001 M2: real columns, no doc-shaped update).
    const botData = bot[0];
    const mergedBotConfig = {
      ...((botData.botConfig as Record<string, unknown> | null) ?? {}),
    } as Record<string, unknown>;
    const setClause: Partial<typeof players.$inferInsert> = {};

    if (updates.specialization) {
      mergedBotConfig.specialization = updates.specialization;
      setClause.botConfig = mergedBotConfig as unknown as typeof players.$inferInsert.botConfig;
    }

    if (updates.tier !== undefined) {
      mergedBotConfig.tier = updates.tier;
      setClause.botConfig = mergedBotConfig as unknown as typeof players.$inferInsert.botConfig;
    }

    if (updates.position) {
      setClause.currentPositionX = Math.round(updates.position.x);
      setClause.currentPositionY = Math.round(updates.position.y);
    }

    if (updates.resources) {
      // Pre-existing bug the nocheck hid: the schema field is updates.resources.metal,
      // never `updates.resourcesMetal`. Preserving live-resource floors at 0.
      setClause.resourcesMetal = Math.max(0, Math.round(updates.resources.metal ?? botData.resourcesMetal));
      setClause.resourcesEnergy = Math.max(0, Math.round(updates.resources.energy ?? botData.resourcesEnergy));
    }

    if (updates.isSpecialBase !== undefined) {
      mergedBotConfig.isSpecialBase = Boolean(updates.isSpecialBase);
      setClause.botConfig = mergedBotConfig as unknown as typeof players.$inferInsert.botConfig;
    }

    // Apply updates
    if (Object.keys(setClause).length > 0) {
      await db.update(players)
        .set(setClause)
        .where(and(eq(players.username, username), eq(players.isBot, 1)));

      // FID-003 S6: per-bot config changes are audited.
      await db.insert(modLog).values({
        id: generateId().slice(0, 24),
        moderatorId: tokenPayload.username.slice(0, 20),
        action: 'ADMIN_BOT_CONFIG',
        targetId: username.slice(0, 24),
        details: JSON.stringify({ updatesApplied: Object.keys(setClause) }),
        createdAt: new Date(),
      });
    }

    log.info('Bot configuration updated successfully', {
      username,
      updatesApplied: Object.keys(setClause),
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      message: 'Bot configuration updated successfully',
      updates: setClause,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Failed to update bot configuration', error instanceof Error ? error : new Error(String(error)));
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
 * - Requires rank >= 5 for both GET and PATCH
 * - All updates validated before applying
 * - Position changes bounded to map limits
 * 
 * USAGE:
 * View bot config:
 * GET /api/admin/bot-config?username=RaiderBot_42
 * 
 * Update bot position:
 * PATCH /api/admin/bot-config
 * { "username": "RaiderBot_42", "updates": { "position": { "x": 2500, "y": 2500 } } }
 * 
 * Change bot tier and resources:
 * PATCH /api/admin/bot-config
 * { "username": "HoarderBot_13", "updates": { "tier": 5, "resources": { "metal": 500000 } } }
 * 
 * FUTURE ENHANCEMENTS:
 * - Batch updates (multiple bots at once)
 * - Configuration templates
 * - Undo/rollback functionality
 * - Audit logging for all changes
 */
