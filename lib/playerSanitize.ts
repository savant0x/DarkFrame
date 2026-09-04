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

export type PublicPlayer = Pick<Record<string, unknown>, (typeof PUBLIC_FIELDS)[number]> &
  Record<string, unknown>;

/**
 * Project a raw player row (DB row or mapped Player) onto the public allowlist.
 * Accepts both camelCase row objects and the mapped Player shape (nested
 * resources/bank/currentPosition objects are passed through when present).
 */
export function sanitizePlayer<T extends object>(raw: T | null | undefined): PublicPlayer | null {
  if (!raw || typeof raw !== 'object') return null;

  const rec = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of PUBLIC_FIELDS) {
    if (rec[field] !== undefined) out[field] = rec[field];
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

  return out as PublicPlayer;
}

/** Array helper. */
export function sanitizePlayerRows<T extends object>(rows: T[]): PublicPlayer[] {
  return (rows ?? []).map((r) => sanitizePlayer(r)).filter(Boolean) as PublicPlayer[];
}
