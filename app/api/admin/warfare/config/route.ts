/**
 * @file app/api/admin/warfare/config/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * @updated 2026-05-03 — Migrated to Supabase
 * @updated 2026-05-15 — Removed hardcoded password, fixed auth response, use requireAdminAuth
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
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

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('admin-warfare-config-get');
  const endTimer = log.time('admin-warfare-config-get');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

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

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('admin-warfare-config-post');
  const endTimer = log.time('admin-warfare-config-post');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Parse request body
    const body = await request.json();
    const { config } = body;

    if (!config) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'config is required');
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
    const savedConfig = await saveWarfareConfig(config, auth.username);

    log.info('Warfare config updated', {
      version: savedConfig.version,
      updatedBy: auth.username,
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
