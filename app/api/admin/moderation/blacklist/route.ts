/**
 * Admin Blacklist Word Management API
 * Tracks blacklist actions via admin_logs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBlacklistAddAPI');
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { word } = body;

    if (!word || typeof word !== 'string' || word.trim().length === 0) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'word is required' });
    }

    const supabase = createServiceClient();

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'BLACKLIST_ADD',
      target: word.toLowerCase(),
      details: { addedAt: new Date().toISOString() },
    });

    log.info('Word added to blacklist', { admin: auth.username, word });
    return NextResponse.json({ success: true, message: `Added "${word}" to blacklist` });
  } catch (error) {
    log.error('Error adding word to blacklist', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));

export const DELETE = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('AdminBlacklistRemoveAPI');
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = request.nextUrl;
    const word = searchParams.get('word');

    if (!word) {
      return createErrorResponse(ErrorCode.VALIDATION_FAILED, { message: 'word is required' });
    }

    const supabase = createServiceClient();

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'BLACKLIST_REMOVE',
      target: word.toLowerCase(),
      details: { removedAt: new Date().toISOString() },
    });

    log.info('Word removed from blacklist', { admin: auth.username, word });
    return NextResponse.json({ success: true, message: `Removed "${word}" from blacklist` });
  } catch (error) {
    log.error('Error removing word from blacklist', error as Error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  }
}));
