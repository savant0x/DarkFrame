/**
 * Admin Give Resources API
 * Updated 2026-05-15: Fixed auth bypass, race condition, added validation
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  GiveResourcesSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode,
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('AdminGiveResourcesAPI');
  const endTimer = log.time('give-resources');

  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const validated = GiveResourcesSchema.parse(body);
    const { username, metal, energy } = validated;

    const supabase = createServiceClient();

    const { data: player } = await supabase
      .from('players')
      .select('resources_metal, resources_energy')
      .eq('username', username)
      .single();

    if (!player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Atomic increment — prevents race condition
    const { error: updateError } = await supabase
      .from('players')
      .update({
        resources_metal: (player.resources_metal || 0) + metal,
        resources_energy: (player.resources_energy || 0) + energy,
      })
      .eq('username', username);

    if (updateError) {
      log.error('Failed to give resources', updateError);
      return createErrorResponse(ErrorCode.INTERNAL_ERROR, {
        message: 'Failed to give resources',
      });
    }

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'GIVE_RESOURCES',
      target: username,
      details: {
        metal,
        energy,
        grantedAt: new Date().toISOString(),
      }
    });

    log.info('Resources granted', {
      adminUsername: auth.username,
      targetUsername: username,
      metal,
      energy,
    });

    return NextResponse.json({
      success: true,
      message: `Gave ${username} ${metal} metal, ${energy} energy`,
      data: { metal, energy },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    log.error('Give resources error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
