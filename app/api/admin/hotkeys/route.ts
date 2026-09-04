// ============================================================
// FILE: app/api/admin/hotkeys/route.ts
// CREATED: 2025-01-23
// ============================================================
// OVERVIEW:
// Admin API endpoint for managing global hotkey configuration.
// Supports GET (retrieve), PUT (update), and POST (reset to defaults).
// Requires admin authentication for all operations.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { gameConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/authMiddleware';
import { DEFAULT_HOTKEYS, HotkeyConfig, HotkeySettings } from '@/types/hotkey.types';
import { findHotkeyConflicts } from '@/lib/hotkeyRegistry';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

/** Single-row convention for this config: one game_config row, id/type = 'hotkeys'. */
const HOTKEY_CONFIG_TYPE = 'hotkeys';

/** Shape stored in the game_config jsonb `config` column. */
interface StoredHotkeyConfig {
  version: number;
  hotkeys: HotkeyConfig[];
  modifiedBy: string;
  lastModified: string;
}

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);
const putRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

async function getHotkeySettings(): Promise<HotkeySettings | null> {
  const result = await db.select().from(gameConfig).where(eq(gameConfig.type, HOTKEY_CONFIG_TYPE)).limit(1);
  if (!result || result.length === 0) return null;
  const stored = result[0].config as Partial<StoredHotkeyConfig> | null;
  return {
    version: Number(stored?.version) || 1,
    lastModified: stored?.lastModified ? new Date(stored.lastModified) : new Date(),
    modifiedBy: stored?.modifiedBy || 'system',
    hotkeys: stored?.hotkeys || DEFAULT_HOTKEYS,
  };
}

/**
 * GET /api/admin/hotkeys
 * Retrieve current hotkey configuration
 */
export const GET = withRequestLogging(rateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('admin/hotkeys');
  const endTimer = log.time('get-hotkeys');

  try {
    const settings = await getHotkeySettings();
    
    if (!settings) {
      log.info('Returned default hotkeys (no custom config)');
      return NextResponse.json({
        success: true,
        hotkeys: DEFAULT_HOTKEYS,
        version: 1,
        isDefault: true,
      });
    }
    
    log.info('Hotkey config retrieved', {
      version: settings.version,
      modifiedBy: settings.modifiedBy,
      hotkeyCount: settings.hotkeys.length,
    });

    return NextResponse.json({
      success: true,
      hotkeys: settings.hotkeys,
      version: settings.version,
      lastModified: settings.lastModified,
      modifiedBy: settings.modifiedBy,
      isDefault: false,
    });
  } catch (error) {
    log.error('Failed to fetch hotkey settings', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * PUT /api/admin/hotkeys
 * Update hotkey configuration (admin only)
 */
export const PUT = withRequestLogging(putRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/hotkeys');
  const endTimer = log.time('update-hotkeys');

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }
    
    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }
    
    const { hotkeys } = await request.json();
    
    if (!Array.isArray(hotkeys) || hotkeys.length === 0) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Hotkeys must be a non-empty array');
    }
    
    for (const hotkey of hotkeys) {
      if (!hotkey.action || !hotkey.type || !hotkey.displayName || !hotkey.category) {
        return createErrorResponse(
          ErrorCode.VALIDATION_MISSING_FIELD, 
          'Each hotkey must have action, key, displayName, and category'
        );
      }
    }
    
    // Single-mapping invariant (lib/hotkeyRegistry): no bare movement key binds,
    // no duplicate combos. Rejected server-side so a tampered admin client cannot
    // install a conflicting config that then ships to every panel.
    const conflicts = findHotkeyConflicts(hotkeys as HotkeyConfig[]);
    if (conflicts.length > 0) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, {
        message: 'Hotkey configuration violates the single-mapping invariant',
        conflicts,
      });
    }
    
    const existingSettings = await getHotkeySettings();
    
    const newVersion = (existingSettings?.version || 0) + 1;
    
    const storedConfig: StoredHotkeyConfig = {
      version: newVersion,
      hotkeys: hotkeys as HotkeyConfig[],
      modifiedBy: user.username,
      lastModified: new Date().toISOString(),
    };
    
    await db.insert(gameConfig).values({
      id: HOTKEY_CONFIG_TYPE,
      type: HOTKEY_CONFIG_TYPE,
      config: storedConfig,
    }).onConflictDoUpdate({
      target: gameConfig.id,
      set: { config: storedConfig },
    });
    
    log.info('Hotkey settings updated', {
      adminUsername: user.username,
      version: storedConfig.version,
      hotkeyCount: hotkeys.length,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Hotkey settings updated successfully',
      version: storedConfig.version,
    });
  } catch (error) {
    log.error('Failed to update hotkey settings', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/admin/hotkeys/reset
 * Reset hotkeys to default configuration (admin only)
 */
export const POST = withRequestLogging(postRateLimiter(async (_request: NextRequest) => {
  const log = createRouteLogger('admin/hotkeys');
  const endTimer = log.time('reset-hotkeys');

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }
    
    if (user.isAdmin !== true) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }
    
    const storedConfig: StoredHotkeyConfig = {
      version: 1,
      hotkeys: DEFAULT_HOTKEYS,
      modifiedBy: user.username,
      lastModified: new Date().toISOString(),
    };
    
    await db.insert(gameConfig).values({
      id: HOTKEY_CONFIG_TYPE,
      type: HOTKEY_CONFIG_TYPE,
      config: storedConfig,
    }).onConflictDoUpdate({
      target: gameConfig.id,
      set: { config: storedConfig },
    });
    
    log.info('Hotkey settings reset to defaults', {
      adminUsername: user.username,
      hotkeyCount: DEFAULT_HOTKEYS.length,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Hotkey settings reset to defaults',
      hotkeys: DEFAULT_HOTKEYS,
    });
  } catch (error) {
    log.error('Failed to reset hotkey settings', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - GET: Returns current hotkeys or defaults if none exist
// - PUT: Updates hotkeys (admin only), increments version
// - POST: Resets to DEFAULT_HOTKEYS (admin only)
// - All write operations require admin authentication
// - Version tracking for configuration changes
// - Validates hotkey structure before saving
// - Single row in gameConfig table with key 'hotkey_settings'
// ============================================================
// END OF FILE
// ============================================================
