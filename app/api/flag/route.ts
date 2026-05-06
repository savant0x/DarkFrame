/**
 * @file app/api/flag/route.ts
 * @updated 2026-05-04 — Full spec rebuild: challenge + flee system
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateDistance, calculateFleeCost, canAffordFlee, getRandomFleePosition } from '@/lib/flagService';
import { type FlagBearer, type FlagAPIResponse, FLAG_CONFIG } from '@/types/flag.types';

type FlagRecord = Record<string, unknown>;
type PlayerRecord = Record<string, unknown>;

export async function GET(_request: NextRequest): Promise<NextResponse<FlagAPIResponse<FlagBearer | null>>> {
  const supabase = createServiceClient();
  const { data: rawFlag } = await supabase.from('flags').select('*').single();
  const f = rawFlag as FlagRecord | null;
  if (!f?.bearer_username) return NextResponse.json({ success: true, data: null, timestamp: new Date() });

  // Auto-clear expired challenge
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

  // Auto-drop flag if max hold time expired
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
  const { data: rawHolder } = await supabase.from('players').select('*').eq('username', bearerId).single();
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
}

export async function POST(request: NextRequest): Promise<NextResponse<FlagAPIResponse>> {
  const supabase = createServiceClient();
  const { data: rawFlag } = await supabase.from('flags').select('*').single();
  const f = rawFlag as FlagRecord | null;
  if (!f?.bearer_username) return NextResponse.json({ success: false, error: 'No flag bearer', timestamp: new Date() }, { status: 404 });

  const body = await request.json();
  const username = body.username;
  if (!username) return NextResponse.json({ success: false, error: 'Username required', timestamp: new Date() }, { status: 400 });

  const action: string = body.action || '';

  if (action === 'flee') return handleFlee(supabase, f, { username });
  if (action === 'challenge') return handleChallenge(supabase, f, { username }, body);
  return NextResponse.json({ success: false, error: 'Invalid action', timestamp: new Date() }, { status: 400 });
}

async function handleChallenge(
  supabase: ReturnType<typeof createServiceClient>, f: FlagRecord,
  challenger: { username: string }, body: Record<string, unknown>
): Promise<NextResponse<FlagAPIResponse>> {
  const bearerUsername = f.bearer_username as string;
  if (!bearerUsername || bearerUsername === challenger.username) {
    return NextResponse.json({ success: false, error: 'Cannot challenge yourself', timestamp: new Date() }, { status: 400 });
  }
  if (f.challenge_active) {
    return NextResponse.json({ success: false, error: 'Already being challenged', timestamp: new Date() }, { status: 429 });
  }
  if (f.grace_until && new Date(f.grace_until as string) > new Date()) {
    return NextResponse.json({ success: false, error: 'Bearer has grace period', timestamp: new Date() }, { status: 403 });
  }

  const { data: rawPlayer } = await supabase.from('players').select('current_x,current_y,flag_challenge_cooldown_until').eq('username', challenger.username).single();
  const p = rawPlayer as PlayerRecord | null;
  if (!p) return NextResponse.json({ success: false, error: 'Player not found', timestamp: new Date() }, { status: 404 });

  if (p.flag_challenge_cooldown_until && new Date(p.flag_challenge_cooldown_until as string) > new Date()) {
    return NextResponse.json({ success: false, error: 'Challenge cooldown active', timestamp: new Date() }, { status: 429 });
  }

  const attackerPos = body.attackerPosition as { x: number; y: number } | undefined;
  if (!attackerPos) return NextResponse.json({ success: false, error: 'attackerPosition required', timestamp: new Date() }, { status: 400 });

  const distance = calculateDistance(attackerPos.x, attackerPos.y, f.position_x as number, f.position_y as number);
  if (distance > FLAG_CONFIG.CHALLENGE_RANGE) {
    return NextResponse.json({ success: false, error: `Out of range: ${Math.round(distance)} tiles`, timestamp: new Date() }, { status: 400 });
  }

  const now = new Date();

  // Bot bearer: auto-transfer flag immediately — no combat, no channel, instant
  if (f.is_bot) {
    const flagId = f.id as string;
    await supabase.from('flags').update({
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
    } as never).eq('id', flagId);

    // Update challenger player row with flag bearer tracking
    await supabase.from('players').update({
      flag_session_started_at: now.toISOString(),
      flag_session_metal: 0,
      flag_session_energy: 0,
      flag_flee_count: 0,
      flag_grace_until: null,
      flag_times_held: ((p as Record<string, unknown>).flag_times_held as number || 0) + 1,
    } as never).eq('username', challenger.username);

    // Clean up the old flag bot
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

  // Human bearer: create challenge channel for player interaction
  const channelExpiresAt = new Date(now.getTime() + FLAG_CONFIG.CHANNEL_DURATION);
  const lockExpiresAt = new Date(now.getTime() + FLAG_CONFIG.LOCK_DURATION);

  await supabase.from('flags').update({
    challenge_active: true, challenge_challenger_id: challenger.username,
    challenge_started_at: now.toISOString(), challenge_expires_at: channelExpiresAt.toISOString(),
    challenge_lock_expires_at: lockExpiresAt.toISOString(),
  } as never).eq('id', f.id as string);

  return NextResponse.json({ success: true, data: { channelDuration: FLAG_CONFIG.CHANNEL_DURATION, lockDuration: FLAG_CONFIG.LOCK_DURATION, channelExpiresAt: channelExpiresAt.toISOString() }, message: `Challenge against ${bearerUsername}`, timestamp: new Date() });
}

async function handleFlee(
  supabase: ReturnType<typeof createServiceClient>, f: FlagRecord,
  user: { username: string }
): Promise<NextResponse<FlagAPIResponse>> {
  if (f.bearer_username !== user.username) {
    return NextResponse.json({ success: false, error: 'Only bearer can flee', timestamp: new Date() }, { status: 403 });
  }
  if (!f.challenge_active) {
    return NextResponse.json({ success: false, error: 'No active challenge', timestamp: new Date() }, { status: 400 });
  }

  const fleeCount = (f.flee_count as number) || 0;
  if (fleeCount >= FLAG_CONFIG.MAX_FLEES) {
    return NextResponse.json({ success: false, error: 'Max flees reached', timestamp: new Date() }, { status: 400 });
  }

  const sessionMetal = (f.session_metal_earned as number) || 0;
  const sessionEnergy = (f.session_energy_earned as number) || 0;
  const fleeCost = calculateFleeCost(sessionMetal, sessionEnergy, fleeCount);

  const { data: rawBearer } = await supabase.from('players').select('resources_metal,resources_energy,flag_flee_cooldown_until,flag_flee_paid_metal,flag_flee_paid_energy').eq('username', user.username).single();
  const b = rawBearer as PlayerRecord | null;
  if (!b) return NextResponse.json({ success: false, error: 'Bearer not found', timestamp: new Date() }, { status: 404 });

  if (b.flag_flee_cooldown_until && new Date(b.flag_flee_cooldown_until as string) > new Date()) {
    return NextResponse.json({ success: false, error: 'Flee cooldown active', timestamp: new Date() }, { status: 429 });
  }
  if (!canAffordFlee((b.resources_metal as number) || 0, (b.resources_energy as number) || 0, fleeCost)) {
    return NextResponse.json({ success: false, error: 'Insufficient resources', timestamp: new Date() }, { status: 400 });
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
    const { data: rawChallenger } = await supabase.from('players').select('resources_metal,resources_energy').eq('username', challengerId).single();
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
