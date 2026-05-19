import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import {
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  ErrorCode,
  calculateDistance,
  logger,
} from '@/lib';
import { calculateFleeCost, canAffordFlee, getRandomFleePosition } from '@/lib/flagService';
import type { FlagAPIResponse, FlagBearer } from '@/types/flag.types';
import { FLAG_CONFIG } from '@/types/flag.types';
import type { Tables } from '@/types/database';

type FlagRecord = Tables<'flags'>;
type PlayerRecord = Tables<'players'>;

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STRICT);

export const GET = rateLimiter(async (_request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagBearer | null>>> => {
  const supabase = createServiceClient();
  const { data: rawFlag, error: flagError } = await supabase.from('flags').select('*').maybeSingle();
  if (flagError) {
    logger.error('[Flag API] Error fetching flag:', flagError);
    return NextResponse.json({ success: true, data: null, timestamp: new Date() });
  }
  const f = (rawFlag || null) as FlagRecord | null;
  if (!f || !f.bearer_username) return NextResponse.json({ success: true, data: null, timestamp: new Date() });

  const now = Date.now();
  if (f.challenge_active && f.challenge_expires_at) {
    const expiresAt = new Date(f.challenge_expires_at as string).getTime();
    if (now > expiresAt) {
      await supabase.from('flags').update({
        challenge_active: false, challenge_challenger_id: null,
        challenge_started_at: null, challenge_expires_at: null, challenge_lock_expires_at: null,
      } as never).eq('id', f.id as string);
      f.challenge_active = false;
    }
  }

  if (f.max_hold_expires_at) {
    const maxHoldExpires = new Date(f.max_hold_expires_at as string).getTime();
    if (now > maxHoldExpires) {
      await supabase.from('flags').update({
        bearer_id: null, bearer_username: null, is_bot: false,
        claimed_at: null, position_x: null, position_y: null,
        current_hp: 0, max_hp: 0,
        session_metal_earned: 0, session_energy_earned: 0,
        flee_count: 0, grace_until: null, max_hold_expires_at: null,
        challenge_active: false, challenge_challenger_id: null,
        challenge_started_at: null, challenge_expires_at: null, challenge_lock_expires_at: null,
        respawn_at: new Date(now + FLAG_CONFIG.RESPAWN_COUNTDOWN_MINUTES * 60 * 1000).toISOString(),
      } as never).eq('id', f.id as string);
      return NextResponse.json({ success: true, data: null, timestamp: new Date() });
    }
  }

  const bearerId = f.bearer_id as string;
  const { data: rawHolder } = await supabase.from('players').select('*').eq('username', bearerId).maybeSingle();
  const h = rawHolder as PlayerRecord | null;
  if (!h) return NextResponse.json({ success: true, data: null, timestamp: new Date() });

  const holdDuration = Math.floor((Date.now() - new Date(f.claimed_at as string).getTime()) / 1000);
  const bearer: FlagBearer = {
    playerId: bearerId,
    username: f.bearer_username as string,
    level: (h.level as number) || 1,
    position: { x: f.position_x as number, y: f.position_y as number },
    claimedAt: new Date(f.claimed_at as string),
    holdDuration,
    currentHP: f.current_hp as number,
    maxHP: f.max_hp as number,
    sessionEarnings: { metal: (f.session_metal_earned as number) || 0, energy: (f.session_energy_earned as number) || 0 },
    fleeCount: (f.flee_count as number) || 0,
    graceUntil: f.grace_until ? new Date(f.grace_until as string) : null,
    maxHoldExpiresAt: f.max_hold_expires_at ? new Date(f.max_hold_expires_at as string) : null,
  };
  return NextResponse.json({ success: true, data: bearer, timestamp: new Date() });
});

export const POST = rateLimiter(async (request: NextRequest) => {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth as NextResponse<FlagAPIResponse>;

  const supabase = createServiceClient();
  const { data: rawFlag } = await supabase.from('flags').select('*').maybeSingle();
  const f = rawFlag as FlagRecord | null;
  if (!f?.bearer_username) return createErrorResponse(ErrorCode.NOT_FOUND, 'No flag bearer');

  const body = await request.json();
  const username = auth.username;

  const action: string = body.action || '';

  if (action === 'flee') return handleFlee(supabase, f, { username });
  if (action === 'challenge') return handleChallenge(supabase, f, { username }, body);
  return createErrorResponse(ErrorCode.VALIDATION_INVALID_FORMAT, 'Invalid action');
});

async function handleChallenge(
  supabase: ReturnType<typeof createServiceClient>, f: FlagRecord,
  challenger: { username: string }, body: Record<string, unknown>
): Promise<NextResponse> {
  const bearerUsername = f.bearer_username as string;
  if (!bearerUsername || bearerUsername === challenger.username) {
    return createErrorResponse(ErrorCode.BATTLE_CANNOT_ATTACK_SELF);
  }
  if (f.challenge_active) {
    return createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Already being challenged');
  }
  const graceUntil = f.grace_until;
  if (typeof graceUntil === 'string' && new Date(graceUntil) > new Date()) {
    return createErrorResponse(ErrorCode.BATTLE_TARGET_PROTECTED, 'Bearer has grace period');
  }

  const { data: rawPlayer } = await supabase.from('players').select('current_x,current_y,flag_challenge_cooldown_until,flag_times_held').eq('username', challenger.username).maybeSingle();
  if (!rawPlayer) return createErrorResponse(ErrorCode.NOT_FOUND, 'Player not found');

  if (rawPlayer.flag_challenge_cooldown_until && new Date(rawPlayer.flag_challenge_cooldown_until) > new Date()) {
    return createErrorResponse(ErrorCode.BATTLE_COOLDOWN_ACTIVE, 'Challenge cooldown active');
  }

  const rawBody = body;
  const attackerPos = rawBody && typeof rawBody === 'object' && 'attackerPosition' in rawBody && rawBody.attackerPosition && typeof rawBody.attackerPosition === 'object' && 'x' in rawBody.attackerPosition && 'y' in rawBody.attackerPosition
    ? { x: Number(rawBody.attackerPosition.x), y: Number(rawBody.attackerPosition.y) }
    : undefined;
  if (!attackerPos) return createErrorResponse(ErrorCode.VALIDATION_MISSING_FIELD, 'attackerPosition required');

  const distance = calculateDistance(Number(attackerPos.x), Number(attackerPos.y), Number(f.position_x), Number(f.position_y));
  if (distance > FLAG_CONFIG.CHALLENGE_RANGE) {
    return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, `Out of range: ${Math.round(distance)} tiles`);
  }

  const now = new Date();

  if (f.is_bot) {
    const flagId = f.id;
    const { data: botClaimResult, error: botClaimError } = await supabase.from('flags').update({
      is_bot: false,
      bearer_id: challenger.username,
      bearer_username: challenger.username,
      position_x: attackerPos.x,
      position_y: attackerPos.y,
      claimed_at: now.toISOString(),
      current_hp: f.max_hp as number,
      session_metal_earned: 0,
      session_energy_earned: 0,
      flee_count: 0,
      grace_until: new Date(now.getTime() + FLAG_CONFIG.GRACE_PERIOD_MS).toISOString(),
      max_hold_expires_at: new Date(now.getTime() + FLAG_CONFIG.MAX_HOLD_HOURS * 60 * 60 * 1000).toISOString(),
      challenge_active: false,
      challenge_challenger_id: null,
      challenge_started_at: null,
      challenge_expires_at: null,
      challenge_lock_expires_at: null,
    }).eq('id', String(flagId)).eq('is_bot', true).select('id');

    if (botClaimError || !botClaimResult || botClaimResult.length === 0) {
      return createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Flag was just claimed by someone else');
    }

    await supabase.from('players').update({
      flag_session_started_at: now.toISOString(),
      flag_session_metal: 0,
      flag_session_energy: 0,
      flag_flee_count: 0,
      flag_grace_until: null,
      flag_times_held: (rawPlayer.flag_times_held || 0) + 1,
    }).eq('username', challenger.username);

    const botUsername = f.bearer_username as string;
    if (botUsername.startsWith('Flag-Bearer-')) {
      await supabase.from('players').delete().eq('username', botUsername);
    }

    return NextResponse.json({
      success: true,
      data: { claimed: true },
      message: `Flag claimed from ${botUsername}! You are now the Flag Bearer.`,
      timestamp: new Date(),
    });
  }

  const channelExpiresAt = new Date(now.getTime() + FLAG_CONFIG.CHANNEL_DURATION);
  const lockExpiresAt = new Date(now.getTime() + FLAG_CONFIG.LOCK_DURATION);

  const { data: challengeResult, error: challengeError } = await supabase.from('flags').update({
    challenge_active: true, challenge_challenger_id: challenger.username,
    challenge_started_at: now.toISOString(), challenge_expires_at: channelExpiresAt.toISOString(),
    challenge_lock_expires_at: lockExpiresAt.toISOString(),
  } as never).eq('id', f.id as string).eq('challenge_active', false).select('id');

  if (challengeError || !challengeResult || challengeResult.length === 0) {
    return createErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Challenge already active');
  }

  return NextResponse.json({ success: true, data: { channelDuration: FLAG_CONFIG.CHANNEL_DURATION, lockDuration: FLAG_CONFIG.LOCK_DURATION, channelExpiresAt: channelExpiresAt.toISOString() }, message: `Challenge against ${bearerUsername}`, timestamp: new Date() });
}

async function handleFlee(
  supabase: ReturnType<typeof createServiceClient>, f: FlagRecord,
  user: { username: string }
): Promise<NextResponse> {
  if (f.bearer_username !== user.username) {
    return createErrorResponse(ErrorCode.AUTH_FORBIDDEN, 'Only bearer can flee');
  }
  if (!f.challenge_active) {
    return createErrorResponse(ErrorCode.VALIDATION_FAILED, 'No active challenge');
  }

  const fleeCount = (f.flee_count as number) || 0;
  if (fleeCount >= FLAG_CONFIG.MAX_FLEES) {
    return createErrorResponse(ErrorCode.VALIDATION_OUT_OF_RANGE, 'Max flees reached');
  }

  const sessionMetal = (f.session_metal_earned as number) || 0;
  const sessionEnergy = (f.session_energy_earned as number) || 0;
  const fleeCost = calculateFleeCost(sessionMetal, sessionEnergy, fleeCount);

  const { data: rawBearer } = await supabase.from('players').select('resources_metal,resources_energy,flag_flee_cooldown_until,flag_flee_paid_metal,flag_flee_paid_energy').eq('username', user.username).maybeSingle();
  const b = rawBearer as PlayerRecord | null;
  if (!b) return createErrorResponse(ErrorCode.NOT_FOUND, 'Bearer not found');

  if (b.flag_flee_cooldown_until && new Date(b.flag_flee_cooldown_until as string) > new Date()) {
    return createErrorResponse(ErrorCode.BATTLE_COOLDOWN_ACTIVE, 'Flee cooldown active');
  }
  if (!canAffordFlee((b.resources_metal as number) || 0, (b.resources_energy as number) || 0, fleeCost)) {
    return createErrorResponse(ErrorCode.INSUFFICIENT_RESOURCES, 'Insufficient resources');
  }

  const newPos = getRandomFleePosition(f.position_x as number, f.position_y as number);
  const fleeCooldownUntil = new Date(Date.now() + FLAG_CONFIG.FLEE_COOLDOWN_MS);

  await supabase.from('players').update({
    resources_metal: ((b.resources_metal as number) || 0) - fleeCost.metal,
    resources_energy: ((b.resources_energy as number) || 0) - fleeCost.energy,
    flag_flee_count: fleeCount + 1,
    flag_flee_paid_metal: ((b.flag_flee_paid_metal as number) || 0) + fleeCost.metal,
    flag_flee_paid_energy: ((b.flag_flee_paid_energy as number) || 0) + fleeCost.energy,
    flag_flee_cooldown_until: fleeCooldownUntil.toISOString(),
  } as never).eq('username', user.username);

  const challengerId = f.challenge_challenger_id as string;
  if (challengerId) {
    const { data: rawChallenger } = await supabase.from('players').select('resources_metal,resources_energy').eq('username', challengerId).maybeSingle();
    const c = rawChallenger as PlayerRecord | null;
    if (c) {
      await supabase.from('players').update({
        resources_metal: ((c.resources_metal as number) || 0) + fleeCost.metal,
        resources_energy: ((c.resources_energy as number) || 0) + fleeCost.energy,
      } as never).eq('username', challengerId);
    }
  }

  await supabase.from('flags').update({
    position_x: newPos.x, position_y: newPos.y,
    challenge_active: false, challenge_challenger_id: null,
    challenge_started_at: null, challenge_expires_at: null, challenge_lock_expires_at: null,
    flee_count: fleeCount + 1,
  } as never).eq('id', f.id as string);

  return NextResponse.json({ success: true, data: { newPosition: newPos, cost: fleeCost }, message: `Fled (${fleeCost.metal}M + ${fleeCost.energy}E)`, timestamp: new Date() });
}
