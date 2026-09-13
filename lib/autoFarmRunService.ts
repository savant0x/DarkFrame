/**
 * @file lib/autoFarmRunService.ts
 * @created 2026-09-12
 * @overview FID-20260912-078 — server-backed AutoFarm run persistence.
 *
 * The engine's run state (status, position, row, direction, tiles count) now
 * lives on the player's row (`players.autofarm_run` jsonb) instead of the
 * browser. This is the structural fix for the FID-075 divergence class: the
 * engine's position can no longer be a stale localStorage artifact because
 * the only persisted copy IS the server's own record of the run.
 *
 * Why a jsonb blob on players rather than a dedicated table: one row per
 * player, written by the same authenticated routes that already mutate the
 * player, read by GET /api/player on session load — no joins, no extra
 * migration surface beyond one nullable column.
 *
 * Public surface:
 *   saveAutoFarmRun(username, run)  — upsert the run blob (ACTIVE/PAUSED runs)
 *   clearAutoFarmRun(username)      — run ended (or stop/complete); column → null
 *   getAutoFarmRun(username)        — read for page auto-resume (via GET /api/player)
 */

import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/** The persisted run record (subset of engine state worth restoring). */
export interface AutoFarmRunRecord {
  /** Run phase at save time — 'idle' rows are never written (cleared instead). */
  status: 'ACTIVE' | 'PAUSED';
  /** Server-authoritative position at the last completed tile. */
  position: { x: number; y: number };
  /** Row the sweep is walking (1-150). */
  currentRow: number;
  direction: 'forward' | 'backward';
  tilesCompleted: number;
  /** Session start epoch ms — preserved across refresh for elapsed-time honesty. */
  startTime: number;
  /** Epoch ms of the last write (staleness guard on resume). */
  savedAt: number;
}

/** Runs older than this are considered abandoned — the page won't auto-resume them. */
export const RUN_STALE_MS = 12 * 60 * 60 * 1000;

export function isAutoFarmRunRecord(v: unknown): v is AutoFarmRunRecord {
  if (!v || typeof v !== 'object') return false;
  const r = v as Partial<AutoFarmRunRecord>;
  return (
    (r.status === 'ACTIVE' || r.status === 'PAUSED') &&
    typeof r.position?.x === 'number' && Number.isFinite(r.position.x) &&
    typeof r.position?.y === 'number' && Number.isFinite(r.position.y) &&
    typeof r.currentRow === 'number' &&
    (r.direction === 'forward' || r.direction === 'backward') &&
    typeof r.tilesCompleted === 'number' &&
    typeof r.startTime === 'number' &&
    // savedAt is stamped server-side on save — client-submitted records omit it.
    (r.savedAt === undefined || typeof r.savedAt === 'number')
  );
}

/** Persist (or refresh) the caller's run record. Fire-and-forget safe. */
export async function saveAutoFarmRun(username: string, run: AutoFarmRunRecord): Promise<void> {
  try {
    await db
      .update(players)
      .set({ autofarmRun: { ...run, savedAt: Date.now() } })
      .where(eq(players.username, username));
  } catch (err) {
    // Persistence is best-effort: a failed write must never break the farm loop.
    console.error('[AutoFarmRun] save failed:', err);
  }
}

/** Clear the record — on stop, complete, or a restored run reaching an end state. */
export async function clearAutoFarmRun(username: string): Promise<void> {
  try {
    await db
      .update(players)
      .set({ autofarmRun: null })
      .where(eq(players.username, username));
  } catch (err) {
    console.error('[AutoFarmRun] clear failed:', err);
  }
}
