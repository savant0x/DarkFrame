/**
 * @file lib/playerSanitize.ts
 * @created 2026-09-04
 * @overview Allowlist projection of player rows for API responses (FID-20260904-005 §5.0).
 *
 * SECURITY DESIGN (per converged FID):
 * - The projection is an ALLOWLIST: anything not explicitly listed below is dropped.
 *   A denylist (`delete row.password`) leaks by default whenever a new sensitive column
 *   is added; an allowlist cannot leak a column it has never heard of.
 * - Sensitive fields proven live in the FID (§2.2): password hash, email, signupIp,
 *   referredBy, stripeCustomerId — none of these may ever appear in a public projection.
 * - Referral data exposes COUNTS/badges only (totalReferrals, referralCount-style
 *   aggregates), never the identity of who referred whom.
 */

import type { Player, SanitizedPlayer } from '@/types/game.types';

export type { SanitizedPlayer };

/** Fields that must NEVER appear in any public projection (defense-in-depth assertion). */
const FORBIDDEN = new Set([
  'password',
  'passwordHash',
  'email',
  'signupIp',
  'signup_ip',
  'referredBy',
  'referred_by',
  'referredByUsername',
  'stripeCustomerId',
  'stripeSubscriptionId',
]);

/** The allowlist: exactly what a public API response may carry. */
const PUBLIC_FIELDS = [
  // identity / progression
  'username',
  'level',
  'xp',
  'rank',
  'specialization',
  'isBot',
  'isAdmin',
  'vip',
  'vipTier',
  'vipExpiration',
  'clanId',
  'clanName',
  'clanRole',
  'clanLevel',
  // position
  // NOTE: 'base' itself is NOT allowlisted as a passthrough — it is COMPOSED below
  // from baseX/baseY (FID-20260906-009). Consumers (StatsPanel, TileRenderer, profile
  // pages) are written against the documented Player contract's nested `base: Position`;
  // shipping only the flat columns is what made every client render Base (0,0).
  'baseX',
  'baseY',
  'currentPosition',
  'currentPositionX',
  'currentPositionY',
  'currentHp',
  'maxHp',
  // economy
  'resources',
  'bank',
  'researchPoints',
  'inventory',
  'units',
  'factoryCount',
  // presentation / social
  'baseGreeting',
  'achievements',
  'discoveries',
  'unlockedTiers',
  'lastLoginDate',
  'loginStreak',
  'createdAt',
  // referral aggregates ONLY (never identities)
  'totalReferrals',
  'referralRewardsMetal',
  'referralRewardsEnergy',
  'referralRewardsRp',
  'referralRewardsXp',
  'referralTitles',
  'referralBadges',
] as const;

// The honest client-facing shape lives in types/game.types.ts (single type home);
// re-exported here for the sanitize seam's consumers.

/**
 * Project a raw player row (DB row or mapped Player) onto the public allowlist.
 * Accepts both camelCase row objects and the mapped Player shape (nested
 * resources/bank/currentPosition objects are passed through when present).
 *
 * Return type is the honest domain shape: a `Player` with every FORBIDDEN field
 * removed — consumers get full type-checking instead of a `Record<string, unknown>`
 * that forces `as unknown as Player` casts at every call site. The single
 * structural assertion below is the deliberate dynamic→static boundary: the
 * allowlist loop constructs the object dynamically (that IS the security
 * mechanism), and `base` is composed from flat columns the domain type does not
 * declare, so the compiler cannot see the construction. Everything downstream
 * of this one assertion is statically verified.
 */
export function sanitizePlayer<T extends object>(raw: T | null | undefined): SanitizedPlayer | null {
  if (!raw || typeof raw !== 'object') return null;

  const rec = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_FIELDS) {
    if (rec[field] !== undefined) out[field] = rec[field];
  }

  // Compose the nested `base: Position` the client contract promises (FID-20260906-009).
  // Prefer the already-nested shape (mapped Player), else build it from the flat columns.
  // Guards reject NaN/non-finite so a corrupt row can never leak `base: {x: NaN, y: NaN}`.
  const isFiniteNum = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
  if (rec.base && typeof rec.base === 'object') {
    const b = rec.base as { x?: unknown; y?: unknown };
    if (isFiniteNum(b.x) && isFiniteNum(b.y)) out.base = { x: b.x, y: b.y };
  } else if (isFiniteNum(rec.baseX) && isFiniteNum(rec.baseY)) {
    out.base = { x: rec.baseX, y: rec.baseY };
  }

  if (process.env.NODE_ENV !== 'production') {
    for (const key of Object.keys(out)) {
      if (FORBIDDEN.has(key)) {
        throw new Error(
          `sanitizePlayer invariant violated: forbidden key "${key}" entered the public projection`
        );
      }
    }
  }

  // The single dynamic→static boundary (see docblock above).
  return out as SanitizedPlayer;
}

/** Array helper. */
export function sanitizePlayerRows<T extends object>(rows: T[]): SanitizedPlayer[] {
  return (rows ?? []).map((r) => sanitizePlayer(r)).filter(Boolean) as SanitizedPlayer[];
}
