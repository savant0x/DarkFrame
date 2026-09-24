/**
 * @file lib/raidPeriod.ts
 * @created 2026-09-23 (FID-20260923-002)
 * @overview Raid reset-period math, extracted from `app/api/combat/attack/route.ts`
 *           so the route and its fidelity test share ONE implementation.
 *
 * Why this was extracted: `__tests__/lib/baseRaidFidelity.test.ts` carried a
 * hand-copied duplicate of the route's period helper and asserted against the
 * *copy*. Its comment claimed "if the route's copy drifts, these break" — they
 * could not. The route's version was later converted to explicit game-zone time
 * (FID-20260923-002) and the duplicate kept passing, because it both built and
 * read its dates in host-local terms: self-consistent in *every* timezone, so it
 * could not fail anywhere, in any zone, ever. A duplicate that cannot detect the
 * drift it exists to catch is worse than no test at all.
 *
 * There is now exactly one copy, and the test exercises it.
 */

import { atGameTime, addGameDays } from '@/lib/gameTime';

/**
 * The start instant of the raid reset period containing `now`.
 *
 * Periods mirror the harvest cadence (`lib/harvestService.getCurrentResetPeriod`):
 * tiles x <= 75 reset at midnight (AM), the rest at noon (PM) — both in GAME
 * time, not host-local time, so the guard does not flip at a different wall clock
 * on a different host.
 */
export function getRaidPeriodStart(baseX: number, now: Date = new Date()): Date {
  const startHour = baseX >= 1 && baseX <= 75 ? 0 : 12;
  let start = atGameTime(now, startHour);
  if (start > now) start = atGameTime(addGameDays(now, -1), startHour);
  return start;
}
