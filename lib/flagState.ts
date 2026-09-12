/**
 * @file lib/flagState.ts
 * @created 2026-09-05
 * @overview Single mapping seam for flag-bearer state (FID-20260905-001 §7.2).
 *
 * The flag holder is always a `players` row — bot or human — so position, level
 * and HP are derived from `players` at read time (single source of truth; no
 * mirrored state to drift). The flags row contributes only holder identity and
 * capture metadata. The trail lives in its own `flag_trail` table (migration
 * 0015); every flag consumer (GET /api/flag, GET /api/tile, POST /api/move,
 * POST /api/flag/attack, /map) reads through this module.
 */

import { db } from '@/lib/db';
import { players, flags, flagTrail } from '@/lib/db/schema';
import { eq, gt, lt, and, desc } from 'drizzle-orm';
import { generateId } from '@/lib/utils';

export interface TrailEntry {
  x: number;
  y: number;
  timestamp: Date;
  expiresAt: Date;
}

export interface FlagState {
  holderUsername: string;
  claimedAt: Date;
  position: { x: number; y: number };
  level: number;
  currentHP: number;
  maxHP: number;
  trail: TrailEntry[];
}

/** Trail TTL in minutes (matches the 8-minute design in FLAG docs). */
const TRAIL_TTL_MINUTES = 8;

/** Max retained trail entries per bearer (older entries pruned on write). */
const TRAIL_MAX_ENTRIES = 200;

/**
 * Read the full flag state, or null when nothing holds the flag / the holder
 * row is gone. Expired trail entries are filtered and never returned.
 *
 * FID-20260909-037 egress fix: the holder select previously fetched the FULL
 * player row (units/discoveries/rp_history jsonb included) on every tile view,
 * feeding the #1 pg_stat_statements entry (187K full-row reads/week). Only
 * position/level/HP are consumed — select exactly those four columns.
 */
export async function getFlagState(): Promise<FlagState | null> {
  const [flagRow] = await db.select().from(flags).limit(1);
  if (!flagRow?.currentHolder) return null;

  const [holderRow] = await db
    .select({
      username: players.username,
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
      baseX: players.baseX,
      baseY: players.baseY,
      level: players.level,
      currentHP: players.currentHP,
      maxHP: players.maxHP,
    })
    .from(players)
    .where(eq(players.username, flagRow.currentHolder))
    .limit(1);
  if (!holderRow) return null;

  const now = new Date();

  const trailRows = await db
    .select()
    .from(flagTrail)
    .where(and(eq(flagTrail.holderUsername, flagRow.currentHolder), gt(flagTrail.expiresAt, now)))
    .orderBy(desc(flagTrail.createdAt))
    .limit(TRAIL_MAX_ENTRIES);

  return {
    holderUsername: flagRow.currentHolder,
    claimedAt: flagRow.lastCapturedAt ?? now,
    position: {
      x: holderRow.currentPositionX ?? holderRow.baseX ?? 1,
      y: holderRow.currentPositionY ?? holderRow.baseY ?? 1,
    },
    level: holderRow.level ?? 1,
    currentHP: holderRow.currentHP ?? 1000,
    maxHP: holderRow.maxHP ?? 1000,
    trail: trailRows
      .reverse() // oldest first for display
      .map((t) => ({
        x: t.x,
        y: t.y,
        timestamp: t.createdAt,
        expiresAt: t.expiresAt,
      })),
  };
}

/**
 * Record a trail step for the CURRENT bearer after a movement. Writes only when
 * `username` actually holds the flag — callers may invoke unconditionally after
 * any player move. Prunes the bearer's expired entries and enforces the cap.
 */
export async function recordTrailStep(username: string, position: { x: number; y: number }): Promise<void> {
  const [flagRow] = await db.select().from(flags).limit(1);
  if (!flagRow?.currentHolder || flagRow.currentHolder !== username) return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TRAIL_TTL_MINUTES * 60 * 1000);

  await db.insert(flagTrail).values({
    id: generateId(),
    holderUsername: username,
    x: position.x,
    y: position.y,
    createdAt: now,
    expiresAt,
  });

  // Drop this bearer's expired entries, then enforce the cap (keep newest 200).
  await db.delete(flagTrail).where(
    and(eq(flagTrail.holderUsername, username), lt(flagTrail.expiresAt, now))
  );
  const recent = await db
    .select({ id: flagTrail.id })
    .from(flagTrail)
    .where(eq(flagTrail.holderUsername, username))
    .orderBy(desc(flagTrail.createdAt));
  if (recent.length > TRAIL_MAX_ENTRIES) {
    const stale = recent.slice(TRAIL_MAX_ENTRIES).map((r) => r.id);
    for (const id of stale) {
      await db.delete(flagTrail).where(eq(flagTrail.id, id));
    }
  }
}

/**
 * FID-20260911-051 — position-only flag lookup for the hottest read path.
 *
 * The tile route needs exactly one fact: is the bearer standing on THIS tile?
 * getFlagState() answers that but also selects the bearer's live trail list
 * (up to TRAIL_MAX_ENTRIES rows) — pure waste once per AutoFarm cycle and
 * once per manual tile view. This reads the flags row + 5 holder columns.
 */
export async function getFlagBearerPosition(): Promise<{ x: number; y: number } | null> {
  const [flagRow] = await db.select({ currentHolder: flags.currentHolder }).from(flags).limit(1);
  if (!flagRow?.currentHolder) return null;

  const [holderRow] = await db
    .select({
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
      baseX: players.baseX,
      baseY: players.baseY,
    })
    .from(players)
    .where(eq(players.username, flagRow.currentHolder))
    .limit(1);
  if (!holderRow) return null;

  return {
    x: holderRow.currentPositionX ?? holderRow.baseX ?? 1,
    y: holderRow.currentPositionY ?? holderRow.baseY ?? 1,
  };
}

/**
 * Whether the tile at (x, y) is on the current bearer's live trail. Used by the
 * tile route to set hasTrail/trailExpiresAt. Returns null when no flag state.
 *
 * FID-20260909-037 egress fix: previously re-ran getFlagState() (3 more
 * queries) for a point lookup. A tile is ON the trail iff a live trail row
 * exists at (x, y) — one indexed query, no holder/trail-list fetch.
 */
export async function getTrailInfoAt(x: number, y: number): Promise<{ hasTrail: boolean; trailExpiresAt?: Date }> {
  const [hit] = await db
    .select({ expiresAt: flagTrail.expiresAt })
    .from(flagTrail)
    // innerJoin on the (single-row) flags table restricts hits to the CURRENT
    // bearer's rows — a previous bearer's not-yet-expired entries must not
    // render as live trail on the new holder's map.
    .innerJoin(flags, eq(flags.currentHolder, flagTrail.holderUsername))
    .where(and(eq(flagTrail.x, x), eq(flagTrail.y, y), gt(flagTrail.expiresAt, new Date())))
    .limit(1);
  return hit ? { hasTrail: true, trailExpiresAt: hit.expiresAt } : { hasTrail: false };
}
