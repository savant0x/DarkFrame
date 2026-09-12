/**
 * @file lib/tutorialTerminalCache.ts
 * @created 2026-09-11
 * @overview FID-20260911-051 — server-side terminal-state gate for the
 * tutorial status poll.
 *
 * The client poller stops itself once the tutorial reaches a terminal state
 * (complete/skipped/declined — FID-20260909-037), but a STALE tab running
 * pre-fix JavaScript keeps polling /api/tutorial forever, and every poll
 * costs two DB reads (tutorial_progress + action tracking). This cache makes
 * that failure mode free: once a player's progress row is observed terminal,
 * subsequent status polls are short-circuited from memory for a TTL window —
 * no database traffic at all — while remaining correct for the paths that
 * can change the answer.
 *
 * Correctness contract:
 *  - Negative (terminal) results cache for TERMINAL_TTL_MS, then expire to a
 *    real re-check (self-healing; cannot pin a wrong answer forever).
 *  - A cache entry is only WRITTEN when the progress row shows a terminal
 *    state: tutorialComplete || tutorialDeclined || (skipped && no active
 *    quest). Non-terminal polls never touch the cache.
 *  - Tutorial restart (POST /api/tutorial action:'restart') and any path
 *    that recreates progress invalidate the player's entry explicitly, so a
 *    restarted tutorial is visible to stale tabs within one 3s poll.
 */

const TERMINAL_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface TerminalEntry {
  terminal: true;
  expiresAt: number;
}

// Module-scoped: per server runtime. Bounded by the number of players with
// completed tutorials who have a stale tab open — small, and entries expire.
const terminalCache = new Map<string, TerminalEntry>();

export function isTutorialTerminalCached(playerId: string): boolean {
  const entry = terminalCache.get(playerId);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    terminalCache.delete(playerId);
    return false;
  }
  return true;
}

export function markTutorialTerminal(playerId: string): void {
  terminalCache.set(playerId, { terminal: true, expiresAt: Date.now() + TERMINAL_TTL_MS });
}

export function invalidateTutorialTerminal(playerId: string): void {
  terminalCache.delete(playerId);
}

/** Test/ops hook: number of pinned terminal entries. */
export function tutorialTerminalCacheSize(): number {
  return terminalCache.size;
}
