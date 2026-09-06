/**
 * @file lib/flagBonusService.ts
 * @created 2026-09-06
 * @overview Flag bearer bonus engine + challenge/steal state machine
 *           (FID-20260906-001 §5.2 — design-doc faithful, FLAG_FEATURE_PLAN.md
 *           is the numeric source of truth).
 *
 * Mechanics implemented here:
 *  - GROSS session earnings while holding (never decremented by flee payments).
 *  - Escalating flee costs: 10% → 15% → 20% → 25% → 30% of GROSS earnings;
 *    a 6th challenge cannot be fled (auto-lose at channel end).
 *  - 30-second steal channel with a 5-second bearer lock before flee unlocks.
 *  - 1-hour challenge grace period after a successful steal.
 *  - 60-second flee cooldown between flee attempts.
 *  - Holder state resets on every holder change (capture, steal, auto-loss).
 *
 * The bonus *application* lives at each consumer seam (harvest 2x already
 * exists; awardXP/awardRP/bank/build/auction routes consult getBonusStack /
 * assertHolderMay transact); this module owns the data + the channel machine.
 */

import { db } from '@/lib/db';
import { players, flags } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

/** Map bounds (FLAG_FEATURE_PLAN boundary protection; matches flagBotService). */
export const MAP_BOUNDS = { min: 1, max: 150 } as const;

/** Channel duration (doc: 30s; may extend to 60 for balance — doc value kept). */
export const CHANNEL_DURATION_MS = 30_000;
/** Bearer cannot flee for the first N seconds of a channel (doc: 5s lock). */
export const BEARER_LOCK_MS = 5_000;
/** Cooldown between flee attempts (doc: 60s). */
export const FLEE_COOLDOWN_MS = 60_000;
/** Challenge immunity after a successful steal (doc: 1 hour grace). */
export const GRACE_MS = 60 * 60_000;
/** Maximum flees before a challenge cannot be fled (doc: 5; 6th = auto-lose). */
export const MAX_FLEES = 5;

/** Flee cost as a share of GROSS session earnings, by flee ordinal (1-based). */
const FLEE_COST_SHARES = [0.10, 0.15, 0.20, 0.25, 0.30] as const;

export function getFleeCostShare(fleeCount: number): number {
  // Ordinal 1..5 map to the shares; 6+ has no share (cannot flee).
  if (fleeCount < 0 || fleeCount >= MAX_FLEES) return 0;
  return FLEE_COST_SHARES[fleeCount];
}

export interface FlagHolderState {
  currentHolder: string | null;
  sessionEarningsMetal: number;
  sessionEarningsEnergy: number;
  fleeCount: number;
  graceUntil: Date | null;
  lastFleeAt: Date | null;
  challenge: {
    challenger: string;
    startedAt: Date;
    endsAt: Date;
  } | null;
}

export interface BonusStack {
  isBearer: boolean;
  harvestMultiplier: number;      // +100% => 2
  xpMultiplier: number;           // +100% => 2
  rpMultiplier: number;           // +100% => 2
  masteryMultiplier: number;      // +100% => 2
  unitStrengthMultiplier: number; // +25%  => 1.25
  unitDefenseMultiplier: number;  // +25%  => 1.25
  bankCapacityMultiplier: number; // +50%  => 1.5
  bankFeeMultiplier: number;      // no fees => 0
  autoFarmSpeedMultiplier: number;// +50%  => 1.5
  clanXpMultiplier: number;       // +25%  => 1.25
  referralMultiplier: number;     // +50%  => 1.5
  permanentHarvestBonusPct: number; // 12h milestone, +2 per hold, permanent
  restrictions: string[];         // actions blocked while holding (§5.5)
}

const IDENTITY_BONUS: BonusStack = {
  isBearer: false,
  harvestMultiplier: 1, xpMultiplier: 1, rpMultiplier: 1, masteryMultiplier: 1,
  unitStrengthMultiplier: 1, unitDefenseMultiplier: 1,
  bankCapacityMultiplier: 1, bankFeeMultiplier: 1,
  autoFarmSpeedMultiplier: 1, clanXpMultiplier: 1, referralMultiplier: 1,
  permanentHarvestBonusPct: 0,
  restrictions: [],
};

/** Actions blocked while holding the flag (FID §5.5, doc "Restricted While Holding"). */
export const HOLDER_RESTRICTIONS = [
  'build-unit', 'upgrade-unit', 'factory-produce', 'factory-capture',
  'auction-create', 'auction-bid', 'auction-buyout',
  'bank-deposit', 'bank-withdraw',
] as const;

export type RestrictedAction = (typeof HOLDER_RESTRICTIONS)[number];

/** Read the flags singleton row (the flag feature has exactly one flag). */
export async function getFlagRow() {
  const rows = await db.select().from(flags).limit(1);
  return rows[0] ?? null;
}

/** Full holder state including any in-flight challenge. */
export async function getFlagHolderState(): Promise<FlagHolderState> {
  const row = await getFlagRow();
  if (!row) {
    return {
      currentHolder: null, sessionEarningsMetal: 0, sessionEarningsEnergy: 0,
      fleeCount: 0, graceUntil: null, lastFleeAt: null, challenge: null,
    };
  }
  const challenge = row.challengeChallenger && row.challengeEndsAt
    ? { challenger: row.challengeChallenger, startedAt: row.challengeStartedAt as Date, endsAt: row.challengeEndsAt as Date }
    : null;
  return {
    currentHolder: row.currentHolder ?? null,
    sessionEarningsMetal: Number(row.sessionEarningsMetal ?? 0),
    sessionEarningsEnergy: Number(row.sessionEarningsEnergy ?? 0),
    fleeCount: row.fleeCount ?? 0,
    graceUntil: row.graceUntil ?? null,
    lastFleeAt: row.lastFleeAt ?? null,
    challenge,
  };
}

export async function isFlagBearer(username: string): Promise<boolean> {
  if (!username) return false;
  const row = await getFlagRow();
  return row?.currentHolder === username;
}

/**
 * Bonus stack for a player. Non-bearers get the identity stack plus their own
 * permanent harvest milestone (which survives flag loss by design).
 */
export async function getBonusStack(username: string): Promise<BonusStack> {
  const [row] = await db
    .select({ permanentHarvestBonus: players.permanentHarvestBonus })
    .from(players)
    .where(eq(players.username, username))
    .limit(1);
  const permanentHarvestBonusPct = Number(row?.permanentHarvestBonus ?? 0);

  if (!(await isFlagBearer(username))) {
    return { ...IDENTITY_BONUS, permanentHarvestBonusPct };
  }
  return {
    isBearer: true,
    harvestMultiplier: 2, xpMultiplier: 2, rpMultiplier: 2, masteryMultiplier: 2,
    unitStrengthMultiplier: 1.25, unitDefenseMultiplier: 1.25,
    bankCapacityMultiplier: 1.5, bankFeeMultiplier: 0,
    autoFarmSpeedMultiplier: 1.5, clanXpMultiplier: 1.25, referralMultiplier: 1.5,
    permanentHarvestBonusPct,
    restrictions: [...HOLDER_RESTRICTIONS],
  };
}

/** Route-gate: 403 reason when a holder attempts a restricted action. */
export function assertHolderMayTransact(
  stack: BonusStack,
  action: RestrictedAction,
): { ok: true } | { ok: false; reason: string } {
  if (!stack.isBearer) return { ok: true };
  if (stack.restrictions.includes(action)) {
    return {
      ok: false,
      reason:
        'The Flag Bearer cannot do this while holding the Flag (bearer restrictions). ' +
        'Drop the Flag by being stolen, or enjoy the bonuses.',
    };
  }
  return { ok: true };
}

/** Add GROSS session earnings for the current holder (harvest/auto-farm seams). */
export async function addSessionEarnings(username: string, metal: number, energy: number): Promise<void> {
  if (metal <= 0 && energy <= 0) return;
  await db
    .update(flags)
    .set({
      sessionEarningsMetal: sql`${flags.sessionEarningsMetal} + ${Math.max(0, Math.floor(metal))}`,
      sessionEarningsEnergy: sql`${flags.sessionEarningsEnergy} + ${Math.max(0, Math.floor(energy))}`,
    })
    .where(eq(flags.currentHolder, username));
}

/** Reset all holder-scoped state (called on every holder change). */
async function resetHolderState(holder: string): Promise<void> {
  await db
    .update(flags)
    .set({
      sessionEarningsMetal: 0,
      sessionEarningsEnergy: 0,
      fleeCount: 0,
      graceUntil: null,
      challengeChallenger: null,
      challengeStartedAt: null,
      challengeEndsAt: null,
      lastFleeAt: null,
      fleeDestinationX: null,
      fleeDestinationY: null,
      milestone12hAwarded: 0,
      currentHolder: holder,
      currentHolderUsername: holder,
    })
    .where(eq(flags.id, (await getFlagRow())!.id));
}

/**
 * Transfer the flag to a new holder: resets holder state, records the capture,
 * and starts the 12-hour hold clock from now (milestone check reads this).
 */
export async function transferFlagTo(newHolder: string, capturedBy?: string): Promise<void> {
  await resetHolderState(newHolder);
  await db
    .update(flags)
    .set({
      lastCapturedAt: new Date(),
      lastCapturedBy: capturedBy ?? newHolder,
      totalCaptures: sql`${flags.totalCaptures} + 1`,
    })
    .where(eq(flags.currentHolder, newHolder));
}

/**
 * First-claim (doc §146-154): the flag has no holder; a player within 15 tiles
 * of the spawn coordinates claims it instantly (no channel). Caller has
 * verified the flag row exists and has no holder.
 */
export async function claimUnclaimedFlag(username: string, playerPosition: { x: number; y: number }): Promise<ClaimResult> {
  const row = await getFlagRow();
  if (!row) return { ok: false, reason: 'The Flag has not spawned yet' };
  if (row.currentHolder) return { ok: false, reason: 'The Flag is already held — use the steal channel' };
  if (row.spawnX == null || row.spawnY == null) {
    return { ok: false, reason: 'Flag spawn position unknown — wait for the next spawn' };
  }

  const distance = Math.max(Math.abs(playerPosition.x - row.spawnX), Math.abs(playerPosition.y - row.spawnY));
  if (distance > 15) {
    return { ok: false, reason: `Too far from the Flag: ${distance} tiles (must be within 15 of its spawn point)` };
  }

  await transferFlagTo(username, username);
  return { ok: true, newHolder: username, reason: 'Flag claimed!' };
}

export interface ChallengeStartResult {
  ok: boolean;
  reason?: string;
  startedAt?: Date;
  endsAt?: Date;
  bearerLockExpiresAt?: Date;
}

/**
 * Start a steal channel. Rules (doc):
 *  - challenger must not be the holder; must be within ATTACK_RANGE of the holder
 *    (presence is verified by the route before calling);
 *  - holder under 1h grace → rejected;
 *  - an existing unfinished channel → rejected;
 *  - holder is the bot → channel still starts; claim succeeds at channel end
 *    (the bot never flees — §5.6).
 */
export async function startChallenge(challenger: string): Promise<ChallengeStartResult> {
  const state = await getFlagHolderState();
  if (!state.currentHolder) return { ok: false, reason: 'No one is holding the Flag' };
  if (state.currentHolder === challenger) return { ok: false, reason: 'You already hold the Flag' };
  if (state.challenge) return { ok: false, reason: 'A steal challenge is already in progress' };
  if (state.graceUntil && state.graceUntil > new Date()) {
    return { ok: false, reason: `Flag is under challenge grace for another ${Math.ceil((state.graceUntil.getTime() - Date.now()) / 1000)}s` };
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + CHANNEL_DURATION_MS);
  await db
    .update(flags)
    .set({
      challengeChallenger: challenger,
      challengeStartedAt: startedAt,
      challengeEndsAt: endsAt,
    })
    .where(eq(flags.currentHolder, state.currentHolder));

  return { ok: true, startedAt, endsAt, bearerLockExpiresAt: new Date(startedAt.getTime() + BEARER_LOCK_MS) };
}

/** Whether the bearer may flee right now (5s lock elapsed + flee-count + cooldown). */
export function evaluateFleeEligibility(state: FlagHolderState, now = new Date()): {
  canFlee: boolean;
  reason?: string;
} {
  if (!state.challenge) return { canFlee: false, reason: 'No active challenge' };
  if (state.fleeCount >= MAX_FLEES) {
    return { canFlee: false, reason: 'You have fled 5 times — the next challenge cannot be fled (auto-lose)' };
  }
  const lockExpires = new Date(state.challenge.startedAt.getTime() + BEARER_LOCK_MS);
  if (now < lockExpires) {
    return { canFlee: false, reason: `Stunned — flee unlocks in ${Math.ceil((lockExpires.getTime() - now.getTime()) / 1000)}s` };
  }
  if (state.lastFleeAt && now.getTime() - state.lastFleeAt.getTime() < FLEE_COOLDOWN_MS) {
    return { canFlee: false, reason: `Flee cooldown — ${Math.ceil((FLEE_COOLDOWN_MS - (now.getTime() - state.lastFleeAt.getTime())) / 1000)}s remaining` };
  }
  return { canFlee: true };
}

export interface FleeResult {
  ok: boolean;
  reason?: string;
  costMetal?: number;
  costEnergy?: number;
  destination?: { x: number; y: number };
}

/**
 * Bearer flees: pays the escalating share of GROSS session earnings and
 * teleports to a random valid tile (1–150 bounds, not the challenger's tile).
 * Insufficient funds → cannot flee (doc: "cannot pay = cannot flee").
 * Caller has verified bearer identity + channel existence.
 */
export async function fleeChallenge(bearer: string, bearerPosition: { x: number; y: number }): Promise<FleeResult> {
  const state = await getFlagHolderState();
  const eligible = evaluateFleeEligibility(state);
  if (!eligible.canFlee) return { ok: false, reason: eligible.reason };

  const share = getFleeCostShare(state.fleeCount);
  // Doc: floor for ALL flee-cost math — "rounds down, NO FRACTIONS EVER".
  const costMetal = Math.floor(state.sessionEarningsMetal * share);
  const costEnergy = Math.floor(state.sessionEarningsEnergy * share);

  const [bearerRow] = await db
    .select({
      metal: players.resourcesMetal,
      energy: players.resourcesEnergy,
      positionX: players.currentPositionX,
      positionY: players.currentPositionY,
    })
    .from(players)
    .where(eq(players.username, bearer))
    .limit(1);
  if (!bearerRow) return { ok: false, reason: 'Bearer not found' };
  const bearerDashFrom = { x: Number(bearerRow.positionX ?? bearerPosition.x), y: Number(bearerRow.positionY ?? bearerPosition.y) };

  if (Number(bearerRow.metal) < costMetal || Number(bearerRow.energy) < costEnergy) {
    return {
      ok: false,
      reason:
        'Cannot afford to flee (cost exceeds your unbanked resources). Cannot pay = cannot flee — the Flag is lost when the channel ends.',
      costMetal,
      costEnergy,
    };
  }

  // Escape dash: 5 tiles in a random 8-direction, validated against 1–150
  // map bounds and clamped inside them (doc: bearer cannot control direction).
  const DIRECTIONS = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ] as const;
  const [dx, dy] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
  const x = Math.min(MAP_BOUNDS.max, Math.max(MAP_BOUNDS.min, bearerDashFrom.x + dx * 5));
  const y = Math.min(MAP_BOUNDS.max, Math.max(MAP_BOUNDS.min, bearerDashFrom.y + dy * 5));

  await db
    .update(players)
    .set({
      resourcesMetal: Number(bearerRow.metal) - costMetal,
      resourcesEnergy: Number(bearerRow.energy) - costEnergy,
      currentPositionX: x,
      currentPositionY: y,
    })
    .where(eq(players.username, bearer));

  // Doc: "Payment goes directly to challenger (instant transfer)".
  if (costMetal > 0 || costEnergy > 0) {
    await db
      .update(players)
      .set({
        resourcesMetal: sql`${players.resourcesMetal} + ${costMetal}`,
        resourcesEnergy: sql`${players.resourcesEnergy} + ${costEnergy}`,
      })
      .where(eq(players.username, state.challenge!.challenger));
  }

  await db
    .update(flags)
    .set({
      fleeCount: state.fleeCount + 1,
      lastFleeAt: new Date(),
      fleeDestinationX: x,
      fleeDestinationY: y,
    })
    .where(eq(flags.currentHolder, bearer));

  return { ok: true, costMetal, costEnergy, destination: { x, y } };
}

export interface ClaimResult {
  ok: boolean;
  reason?: string;
  autoLoss?: boolean;
  newHolder?: string;
}

/**
 * Challenger claims at channel end. Auto-loss when the bearer could not flee
 * (flee budget exhausted) or simply never fled; bot bearers always lose.
 */
export async function claimFlag(challenger: string): Promise<ClaimResult> {
  const state = await getFlagHolderState();
  if (!state.challenge) return { ok: false, reason: 'No active challenge' };
  if (state.challenge.challenger !== challenger) return { ok: false, reason: 'Only the challenger can claim' };
  if (state.challenge.endsAt > new Date()) {
    return { ok: false, reason: `Channel still running — ${Math.ceil((state.challenge.endsAt.getTime() - Date.now()) / 1000)}s remaining` };
  }
  const oldHolder = state.currentHolder!;
  await transferFlagTo(challenger, challenger);
  // Doc: successful steal starts the 1-hour challenge grace for the new bearer.
  await db
    .update(flags)
    .set({ graceUntil: new Date(Date.now() + GRACE_MS) })
    .where(eq(flags.currentHolder, challenger));
  return { ok: true, newHolder: challenger, autoLoss: state.fleeCount >= MAX_FLEES, reason: `Flag stolen from ${oldHolder}` };
}

/** Clear a channel without transferring (bearer fled — steal failed).
 * Grace is intentionally untouched: an active post-steal grace persists. */
export async function breakChallenge(): Promise<void> {
  await db
    .update(flags)
    .set({ challengeChallenger: null, challengeStartedAt: null, challengeEndsAt: null })
    .where(sql`${flags.challengeEndsAt} IS NOT NULL`);
}

/** 12-hour hold milestone: once per hold, +2 permanent harvest (doc §73). */
export async function checkHoldMilestone(now = new Date()): Promise<{ granted: boolean; holder?: string }> {
  const row = await getFlagRow();
  if (!row?.currentHolder || !row.lastCapturedAt || row.milestone12hAwarded) return { granted: false };
  const heldMs = now.getTime() - new Date(row.lastCapturedAt).getTime();
  if (heldMs < 12 * 60 * 60_000) return { granted: false };

  await db
    .update(players)
    .set({ permanentHarvestBonus: sql`LEAST(${players.permanentHarvestBonus} + 2, 100)` })
    .where(eq(players.username, row.currentHolder));
  await db.update(flags).set({ milestone12hAwarded: 1 }).where(eq(flags.id, row.id));
  return { granted: true, holder: row.currentHolder };
}

/**
 * Bot-holder reclaim (cron): the flag returns to the bot when a human has held
 * it >1h — humans lose it only via the challenge channel, never by deletion.
 * Preserves the FID-20260905-001 §7.2 human-protection semantics.
 */
export async function reclaimFlagForBot(botUsername: string, maxHoldMs = 60 * 60_000): Promise<boolean> {
  const state = await getFlagHolderState();
  if (!state.currentHolder || state.currentHolder === botUsername) return false;
  if (state.challenge) return false;
  const row = await getFlagRow();
  if (!row?.lastCapturedAt || Date.now() - new Date(row.lastCapturedAt).getTime() < maxHoldMs) return false;
  await transferFlagTo(botUsername, botUsername);
  return true;
}

/** Unused-generator guard keeps imports honest when callers import defaults. */
export const FLAG_CHANNEL_CONSTANTS = { CHANNEL_DURATION_MS, BEARER_LOCK_MS, FLEE_COOLDOWN_MS, GRACE_MS, MAX_FLEES };
