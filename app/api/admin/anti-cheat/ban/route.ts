/**
 * Admin Ban Player API (Anti-Cheat)
 * Updated 2026-05-15: Fixed auth bypass, actually bans the player
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdminAuth } from '@/lib/authMiddleware';
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

export const POST = withRequestLogging(rateLimiter(async (req: NextRequest) => {
  const log = createRouteLogger('AdminAntiCheatBanAPI');
  const endTimer = log.time('anti-cheat-ban');

  try {
    const auth = await requireAdminAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const { username, reason } = body;
    if (!username) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'Username required');

    const supabase = createServiceClient();

    // Check if target player exists
    const { data: player } = await supabase
      .from('players')
      .select('is_admin, rank')
      .eq('username', username)
      .single();

    if (!player) {
      return createErrorResponse(ErrorCode.ADMIN_PLAYER_NOT_FOUND, {
        message: 'Player not found',
        username,
      });
    }

    // Prevent banning admins
    if (player.is_admin || (player.rank && player.rank >= 5)) {
      return createErrorResponse(ErrorCode.ADMIN_CANNOT_BAN_ADMIN, {
        message: 'Cannot ban admin accounts',
        username,
      });
    }

    // Actually ban the player
    await supabase.from('players').update({
      is_banned: true,
      banned_at: new Date().toISOString(),
      ban_reason: reason || 'Admin anti-cheat ban',
    }).eq('username', username);

    await supabase.from('admin_logs').insert({
      admin_username: auth.username,
      action: 'ANTI_CHEAT_BAN',
      target: username,
      details: { reason: reason || 'Admin anti-cheat ban' },
    });

    log.info('Anti-cheat ban recorded', {
      adminUsername: auth.username,
      targetUsername: username,
    });

    return NextResponse.json({ success: true, message: `${username} has been banned` });
  } catch (error) {
    log.error('Ban error', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
