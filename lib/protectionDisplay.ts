/**
 * @file lib/protectionDisplay.ts
 * @created 2026-09-16
 * @overview Pure display helpers for the new-player protection window
 *            (FID-20260916-002 UI surfacing). Client-safe: no DB, no server
 *            imports — the enforcement truth lives server-side (lib/
 *            playerProtection.ts); this module only formats what the client
 *            already receives (`protectionUntil` on the player payload,
 *            `baseProtected`/`baseProtectionUntil` on tile payloads).
 */

/**
 * Human countdown for a protection window. Returns null when there is no
 * active window (absent, NULL, expired, or unparseable) so callers can simply
 * not render.
 *
 * Precision: days+hours above 48h, hours+minutes below, minutes under an hour.
 */
export function formatProtectionRemaining(
  protectionUntil: Date | string | number | null | undefined,
  now: number = Date.now()
): string | null {
  if (protectionUntil === null || protectionUntil === undefined) return null;
  const until = protectionUntil instanceof Date ? protectionUntil.getTime() : new Date(protectionUntil).getTime();
  if (!Number.isFinite(until)) return null;
  const ms = until - now;
  if (ms <= 0) return null;

  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (hours >= 48) return `${days}d ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

/** Server-refusal reason (mirrors lib/playerProtection.ts — display copy only). */
export const PROTECTION_BLOCKED_COPY = 'Target is under new-player protection';
