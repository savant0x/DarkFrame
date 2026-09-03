// @ts-nocheck
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
import { players } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
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

    // Get bot username from query params
    const { searchParams } = new URL(request.url);
    const botUsername = searchParams.get('username');

    if (!botUsername) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, {
        message: 'Bot username is required',
      });
    }

    // Fetch bot
    const bot = await db.select()
      .from(players)
      .where(and(eq(players.username, botUsername), eq(players.isBot, true)))
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
      tier: (botData.botConfig as any)?.tier,
      specialization: (botData.botConfig as any)?.specialization,
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      data: {
        username: botData.username,
        currentPosition: botData.currentPosition,
        resources: botData.resources,
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
// PATCH - Update Bot Configuration
// ============================================================================

/**
 * PATCH /api/admin/bot-config
 * Rate Limited: 30 req/hour (admin bot management)
 * Updates bot configuration settings
 * Requires admin privileges (rank >= 5)
 * 
 * Request body:
 * {
 *   username: string,
 *   updates: {
 *     specialization?: string,
 *     tier?: number,
 *     position?: { x: number, y: number },
 *     resources?: { metal?: number, energy?: number },
 *     isSpecialBase?: boolean
 *   }
 * }
 */
const patchRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

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

    // Parse request body
    const body = await request.json();
    const validated = BotConfigPatchSchema.parse(body);
    const { username, updates } = validated;

    // Verify bot exists
    const bot = await db.select()
      .from(players)
      .where(and(eq(players.username, username), eq(players.isBot, true)))
      .limit(1);

    if (!bot.length) {
      return createErrorResponse(ErrorCode.ADMIN_BOT_NOT_FOUND, {
        message: 'Bot not found',
        username,
      });
    }

    // Build update document
    const botData = bot[0];
    const updateDoc: Record<string, unknown> = {};

    if (updates.specialization) {
      const botConfig = { ...(botData.botConfig as any) || {}, specialization: updates.specialization };
      updateDoc.botConfig = botConfig;
    }

    if (updates.tier !== undefined) {
      const botConfig = { ...(updateDoc.botConfig || botData.botConfig) as any, tier: updates.tier };
      updateDoc.botConfig = botConfig;
    }

    if (updates.position) {
      updateDoc.currentPosition = updates.position;
    }

    if (updates.resources) {
      const currentResources = botData.resources as any || {};
      const newResources = {
        metal: updates.resourcesMetal !== undefined ? Math.max(0, updates.resourcesMetal) : currentResources.metal,
        energy: updates.resourcesEnergy !== undefined ? Math.max(0, updates.resourcesEnergy) : currentResources.energy,
      };
      updateDoc.resources = newResources;
    }

    if (updates.isSpecialBase !== undefined) {
      const botConfig = { ...(updateDoc.botConfig || botData.botConfig) as any, isSpecialBase: Boolean(updates.isSpecialBase) };
      updateDoc.botConfig = botConfig;
    }

    // Apply updates
    if (Object.keys(updateDoc).length > 0) {
      await db.update(players)
        .set(updateDoc)
        .where(and(eq(players.username, username), eq(players.isBot, true)));
    }

    log.info('Bot configuration updated successfully', {
      username,
      updatesApplied: Object.keys(updateDoc),
      adminUser: tokenPayload.username,
    });

    return NextResponse.json({
      success: true,
      message: 'Bot configuration updated successfully',
      updates: updateDoc,
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
