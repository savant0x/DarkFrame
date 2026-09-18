/**
 * FID-20260917-017 slice 1 — LIVE verification driver for the anti-cheat
 * detector pg rewrite. Runs against the real dev DB (DATABASE_URL from
 * .env.local) and invokes the real detector functions directly.
 *
 * The load-bearing probe is ISOLATION: the pre-rewrite shim dropped the
 * per-player predicate, so a suspect's "last action" could be another
 * player's row. Probes 4/5 prove that can no longer happen.
 *
 * Probes:
 *   1. PREFLIGHT       — clean slate for the acz-* probe namespace
 *   2. SEED            — suspect A (harvest 1s/2s ago), bystander B (nothing),
 *                        bystander C (one move row only), speeder D (5 move
 *                        rows with {from,to} geometry, 10 tiles/sec)
 *   3. COOLDOWN HIT    — A: harvest 1s after last → suspicious HIGH
 *   4. ISOLATION       — B (no rows): "First action", NOT suspicious
 *   5. ACTION SCOPING  — C (move only): "First action" for harvest
 *   6. SPEED DETECTION — D: rate 10 t/s > 1.5 → suspicious HIGH flag
 *   7. FLAG PERSISTED  — player_flags row: username, type, severity, metadata
 *   8. DEDUPE          — re-fire folds into same row, occurrenceCount 2
 *   9. SUMMARY         — getSuspiciousPlayers groups D with correct counts
 *  10. CLEANUP         — probe artifacts removed, residue zero
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../lib/db';
import { playerActivity, playerFlags } from '../lib/db/schema';
import {
  detectSpeedHack,
  detectCooldownViolation,
  getSuspiciousPlayers,
} from '../lib/antiCheatDetector';

let failures = 0;
function ok(name: string, cond: boolean, detail = ''): void {
  const mark = cond ? '✓' : '✗';
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) failures++;
}
function fail(step: string, err: unknown): never {
  console.error(`✗ ${step} threw:`, err);
  let cause: unknown = err;
  while (cause instanceof Error && 'cause' in cause && cause.cause) cause = cause.cause;
  if (cause !== err) console.error('  root cause:', cause);
  process.exit(1);
}

const NOW = Date.now();
const A = 'aczsuspect';
const B = 'aczbystnd';
const C = 'aczbystnd2';
const D = 'aczspeedr';
const NAMES = [A, B, C, D];

async function cleanup(): Promise<void> {
  await db.delete(playerActivity).where(inArray(playerActivity.playerId, NAMES));
  await db.delete(playerFlags).where(inArray(playerFlags.username, NAMES));
}

async function countFlags(username: string): Promise<number> {
  const rows = await db
    .select({ id: playerFlags.id })
    .from(playerFlags)
    .where(eq(playerFlags.username, username));
  return rows.length;
}

async function main(): Promise<void> {
  console.log(`probe suspect=${A} bystanders=${B}/${C} speeder=${D}\n`);

  // 1. PREFLIGHT
  try {
    await cleanup();
    ok('1 preflight (namespace clean)', true);
  } catch (err) {
    fail('preflight', err);
  }

  // 2. SEED
  try {
    const row = (playerId: string, action: string, msAgo: number, metadata: Record<string, unknown> | null) => ({
      id: `acz${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`.slice(0, 24),
      playerId,
      action,
      timestamp: new Date(NOW - msAgo),
      details: null,
      sessionId: null,
      metadata,
    });
    await db.insert(playerActivity).values([
      row(A, 'harvest', 1000, { resourcesGained: { metal: 900 } }),
      row(A, 'harvest', 2000, { resourcesGained: { metal: 900 } }),
      row(C, 'move', 500, { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, result: 'success' }),
      // speeder D: 5 moves, 2 tiles per 200ms => 10 tiles/sec
      row(D, 'move', 1000, { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, result: 'success' }),
      row(D, 'move', 1200, { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, result: 'success' }),
      row(D, 'move', 1400, { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, result: 'success' }),
      row(D, 'move', 1600, { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, result: 'success' }),
      row(D, 'move', 1800, { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, result: 'success' }),
    ]);
    ok('2 seeded 8 activity rows (A×2, C×1, D×5; B none)', true);
  } catch (err) {
    fail('seed', err);
  }

  // 3. COOLDOWN HIT — re-seed A's rows relative to the check instant so no
  // driver-latency drift shifts the severity band, then check.
  try {
    await db.delete(playerActivity).where(eq(playerActivity.playerId, A));
    const t = Date.now();
    await db.insert(playerActivity).values([
      { id: `acz${(t - 500).toString(36)}a1`.slice(0, 24), playerId: A, action: 'harvest', timestamp: new Date(t - 500), details: null, sessionId: null, metadata: { resourcesGained: { metal: 900 } } },
      { id: `acz${(t - 600).toString(36)}a2`.slice(0, 24), playerId: A, action: 'harvest', timestamp: new Date(t - 600), details: null, sessionId: null, metadata: { resourcesGained: { metal: 900 } } },
    ]);
    const r = await detectCooldownViolation(A, 'harvest', Date.now());
    ok('3 cooldown hit for A (<1.5s → HIGH)', r.suspicious === true && r.severity === 'HIGH',
      `${r.suspicious ? '' : 'NOT '}suspicious, ${r.severity}, "${r.evidence}"`);
  } catch (err) {
    fail('cooldown A', err);
  }

  // 4. ISOLATION — B has NO rows; the old shim would have read A's rows here
  try {
    const r = await detectCooldownViolation(B, 'harvest', Date.now());
    ok('4 ISOLATION: B is clean (own-rows-only)', r.suspicious === false && r.evidence === 'First action',
      `"${r.evidence}"`);
  } catch (err) {
    fail('isolation B', err);
  }

  // 5. ACTION SCOPING — C has only a move row; a harvest query must not see it
  try {
    const r = await detectCooldownViolation(C, 'harvest', Date.now());
    ok('5 action scoping: C clean for harvest', r.suspicious === false && r.evidence === 'First action',
      `"${r.evidence}"`);
  } catch (err) {
    fail('scoping C', err);
  }

  // 6. SPEED DETECTION — re-seed D's geometry rows at the check instant,
  // then verify the rate flag (10 tiles/sec → HIGH band > 3.0).
  try {
    await db.delete(playerActivity).where(eq(playerActivity.playerId, D));
    const t = Date.now();
    const mover = (msAgo: number, seq: string) => ({
      id: `acz${(t - msAgo).toString(36)}${seq}`.slice(0, 24),
      playerId: D, action: 'move', timestamp: new Date(t - msAgo),
      details: null, sessionId: null,
      metadata: { from: { x: 0, y: 0 }, to: { x: 2, y: 0 }, result: 'success' },
    });
    await db.insert(playerActivity).values([
      mover(200, 'd1'), mover(400, 'd2'), mover(600, 'd3'), mover(800, 'd4'), mover(1000, 'd5'),
    ]);
    const r = await detectSpeedHack(D, { x: 0, y: 0 }, { x: 2, y: 0 }, Date.now());
    ok('6 speed detection for D (> 3.0 t/s → HIGH)', r.suspicious === true && r.severity === 'HIGH',
      `"${r.evidence}"`);
  } catch (err) {
    fail('speed D', err);
  }

  // 7. FLAG PERSISTED
  try {
    const [flag] = await db
      .select()
      .from(playerFlags)
      .where(and(eq(playerFlags.username, D), eq(playerFlags.flagType, 'SPEED_HACK')));
    const meta = (flag?.metadata ?? {}) as { movementRate?: number };
    ok('7 flag persisted with evidence',
      !!flag && flag.severity === 'HIGH' && (meta.movementRate ?? 0) > 1.5 && flag.occurrenceCount === 1,
      flag ? `severity=${flag.severity} rate=${meta.movementRate?.toFixed(2)} occ=${flag.occurrenceCount}` : 'MISSING');
  } catch (err) {
    fail('flag read', err);
  }

  // 8. DEDUPE — same detection again folds into the same row
  try {
    await detectSpeedHack(D, { x: 0, y: 0 }, { x: 2, y: 0 }, Date.now());
    const flags = await db.select().from(playerFlags).where(eq(playerFlags.username, D));
    ok('8 dedupe: 1 row, occurrenceCount=2', flags.length === 1 && flags[0].occurrenceCount === 2,
      `rows=${flags.length} occ=${flags[0]?.occurrenceCount}`);
  } catch (err) {
    fail('dedupe', err);
  }

  // 9. SUMMARY — getSuspiciousPlayers groups D
  try {
    const summary = await getSuspiciousPlayers();
    const d = summary.find((s) => s._id === D);
    ok('9 summary groups D (1 flag, high=1)',
      !!d && d.flagCount === 1 && d.highFlags === 1 && d.flags.length === 1 && d.flags[0].occurrenceCount === 2,
      d ? `flagCount=${d.flagCount} high=${d.highFlags}` : 'D missing from summary');
  } catch (err) {
    fail('summary', err);
  }

  // 10. CLEANUP — remove exactly the probe's artifacts
  try {
    await cleanup();
    const residualActivity = await db
      .select({ id: playerActivity.id })
      .from(playerActivity)
      .where(inArray(playerActivity.playerId, NAMES));
    const residualFlags = await db
      .select({ id: playerFlags.id })
      .from(playerFlags)
      .where(inArray(playerFlags.username, NAMES));
    ok('10 cleanup: residue zero',
      residualActivity.length === 0 && residualFlags.length === 0,
      `activity=${residualActivity.length} flags=${residualFlags.length}`);
  } catch (err) {
    fail('cleanup', err);
  }

  console.log(`\nprobe result: ${failures === 0 ? 'ALL GREEN' : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => fail('driver', err));
