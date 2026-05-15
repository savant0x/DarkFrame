// ============================================================
// FILE: app/api/admin/hotkeys/route.ts
// CREATED: 2025-01-23
// UPDATED: 2026-05-15 — Fixed auth bypass: use requireAdminAuth for PUT and POST
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { DEFAULT_HOTKEYS, HotkeyConfig, HotkeySettings } from '@/types/hotkey.types';
import type { Json } from '@/types/database';
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
const putRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);
const postRateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/hotkeys');
  const endTimer = log.time('get-hotkeys');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();
    
    const { data: configRow, error } = await supabase
      .from('bot_config')
      .select('*')
      .eq('config_key', 'hotkey_settings')
      .maybeSingle();
    
    if (error || !configRow) {
      log.info('Returned default hotkeys (no custom config)');
      return NextResponse.json({
        success: true,
        hotkeys: DEFAULT_HOTKEYS,
        version: 1,
        isDefault: true,
      });
    }
    
    const settings = configRow.config_value as Record<string, unknown>;
    
    log.info('Hotkey config retrieved', {
      version: settings.version,
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

export const PUT = withRequestLogging(putRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/hotkeys');
  const endTimer = log.time('update-hotkeys');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { hotkeys } = body;
    
    if (!Array.isArray(hotkeys) || hotkeys.length === 0) {
      return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Hotkeys must be a non-empty array');
    }
    
    for (const hotkey of hotkeys) {
      if (!hotkey.action || !hotkey.key || !hotkey.displayName || !hotkey.category) {
        return createErrorResponse(
          ErrorCode.VALIDATION_MISSING_FIELD, 
          'Each hotkey must have action, key, displayName, and category'
        );
      }
    }
    
    const supabase = createServiceClient();

    const { data: configRow } = await supabase
      .from('bot_config')
      .select('config_value')
      .eq('config_key', 'hotkey_settings')
      .maybeSingle();
    
    const existingSettings = configRow?.config_value as Record<string, unknown> | undefined;
    const currentVersion = (existingSettings?.version as number) || 0;
    
    const newSettings: HotkeySettings = {
      version: currentVersion + 1,
      lastModified: new Date(),
      modifiedBy: auth.username,
      hotkeys: hotkeys as HotkeyConfig[],
    };
    
    if (configRow) {
      await supabase
        .from('bot_config')
        .update({ config_value: newSettings as unknown as Json })
        .eq('config_key', 'hotkey_settings');
    } else {
      await supabase
        .from('bot_config')
        .insert({
          config_key: 'hotkey_settings',
          config_value: newSettings as unknown as Json,
        });
    }
    
    log.info('Hotkey settings updated', {
      adminUsername: auth.username,
      version: newSettings.version,
      hotkeyCount: hotkeys.length,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Hotkey settings updated successfully',
      version: newSettings.version,
    });
  } catch (error) {
    log.error('Failed to update hotkey settings', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

export const POST = withRequestLogging(postRateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/hotkeys');
  const endTimer = log.time('reset-hotkeys');

  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const supabase = createServiceClient();

    const resetSettings: HotkeySettings = {
      version: 1,
      lastModified: new Date(),
      modifiedBy: auth.username,
      hotkeys: DEFAULT_HOTKEYS,
    };
    
    const { data: configRow } = await supabase
      .from('bot_config')
      .select('id')
      .eq('config_key', 'hotkey_settings')
      .maybeSingle();
    
    if (configRow) {
      await supabase
        .from('bot_config')
        .update({ config_value: resetSettings as unknown as Json })
        .eq('config_key', 'hotkey_settings');
    } else {
      await supabase
        .from('bot_config')
        .insert({
          config_key: 'hotkey_settings',
          config_value: resetSettings as unknown as Json,
        });
    }
    
    log.info('Hotkey settings reset to defaults', {
      adminUsername: auth.username,
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
