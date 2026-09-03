/**
 * @file app/api/admin/warfare/config/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * 
 * OVERVIEW:
 * Admin-only endpoint for viewing and updating warfare system configuration.
 * All parameters can be modified in real-time without server restart.
 * Supports config history tracking and validation.
 * 
 * ROUTES:
 * - GET /api/admin/warfare/config - View current config (optional history)
 * - POST /api/admin/warfare/config - Update config (admin password required)
 * 
 * AUTHENTICATION:
 * - requireAuth() for both handlers
 * - Admin password verification for POST
 * 
 * BUSINESS RULES:
 * - Only authenticated users can view config
 * - Admin password required to update config
 * - All config changes validated before saving
 * - Config history maintained (last 10 versions)
 * - Changes attributed to username/playerId
 */

/* diagnostics-refresh: touched file to force VS Code diagnostics refresh */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  loadWarfareConfig,
  saveWarfareConfig,
  validateWarfareConfig,
  getConfigHistory,
  type WarfareConfig,
} from '@/lib/warfareConfigService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

/**
 * GET /api/admin/warfare/config
 * View current warfare configuration
 * 
 * @param request - NextRequest with auth cookie and optional query params
 * @returns NextResponse with config and optional history
 * 
 * @example
 * GET /api/admin/warfare/config
 * Response: {
 *   success: true,
 *   config: {
 *     flagCapturePoints: 1000,
 *     defenderBonus: 1.2,
 *     ...
 *   }
 * }
 * 
 * @example
 * GET /api/admin/warfare/config?history=true
 * Response: {
 *   success: true,
 *   config: {...},
 *   history: [
 *     { version: 5, config: {...}, updatedAt: "...", updatedBy: "admin" },
 *     ...
 *   ]
 * }
 * 
 * @throws {401} Not authenticated
 * @throws {500} Server error
 */
export const GET = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('admin-warfare-config-get');
  const endTimer = log.time('admin-warfare-config-get');

  try {
    const result = await requireAuth(request);
    if (result instanceof NextResponse) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

    // Check if history requested
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('history') === 'true';

    // Load current config
    const config = await loadWarfareConfig();

    if (includeHistory) {
      const history = await getConfigHistory(10);
      log.info('Warfare config loaded with history', { 
        historyEntries: history.length,
        includeHistory: true 
      });
      return NextResponse.json({
        success: true,
        config,
        history,
      });
    }

    log.info('Warfare config loaded', { includeHistory: false });
    return NextResponse.json({
      success: true,
      config,
    });

  } catch (error) {
    log.error('Error loading warfare config', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

/**
 * POST /api/admin/warfare/config
 * Update warfare configuration (admin only)
 * 
 * @param request - NextRequest with auth cookie and body data
 * @returns NextResponse with updated config
 * 
 * @example
 * POST /api/admin/warfare/config
 * Body: {
 *   config: {
 *     flagCapturePoints: 1200,
 *     defenderBonus: 1.3,
 *     ...
 *   },
 *   adminPassword: "secret123"
 * }
 * Response: {
 *   success: true,
 *   config: {...},
 *   version: 6,
 *   message: "Configuration updated successfully"
 * }
 * 
 * @throws {400} Missing config or validation errors
 * @throws {401} Not authenticated
 * @throws {403} Invalid admin password
 * @throws {500} Server error
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('admin-warfare-config-post');
  const endTimer = log.time('admin-warfare-config-post');

  try {
        const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, 'Authentication required');
    }

            // Parse request body
    const body = await request.json();
    const { config, adminPassword } = body;

    if (!config) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'config is required');
    }

    // Verify admin password
    if (adminPassword !== ADMIN_PASSWORD) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED, 'Admin authorization required');
    }

    // Validate configuration first
    const validation = validateWarfareConfig(config);
    if (!validation.valid) {
      log.warn('Invalid warfare config validation', { validationErrors: validation.errors });
      return NextResponse.json(
        { 
          error: 'Invalid configuration',
          validationErrors: validation.errors,
        },
        { status: 400 }
      );
    }

    // Save configuration
    const savedConfig = await saveWarfareConfig(config, auth.username || auth.playerId);

    log.info('Warfare config updated', {
      version: savedConfig.version,
      updatedBy: auth.username || auth.playerId,
      changedFields: Object.keys(config).length
    });

    return NextResponse.json({
      success: true,
      config: savedConfig,
      version: savedConfig.version,
      message: 'Configuration updated successfully',
    });

  } catch (error) {
    log.error('Error updating warfare config', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
