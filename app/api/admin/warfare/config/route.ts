/**
 * @file app/api/admin/warfare/config/route.ts
 * @created 2025-10-18
 * @updated 2025-10-23 (FID-20251023-001: Auth deduplication + JSDoc)
 * @updated 2026-05-03 — Migrated to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
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

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('admin-warfare-config-get');
  const endTimer = log.time('admin-warfare-config-get');

  try {
    const supabase = createServiceClient();
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

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest): Promise<NextResponse> => {
  const log = createRouteLogger('admin-warfare-config-post');
  const endTimer = log.time('admin-warfare-config-post');

  try {
    const supabase = createServiceClient();
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
