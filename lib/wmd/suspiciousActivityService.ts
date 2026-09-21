/**
 * FID-20260919-015 W4: suspicious-activity trigger wiring.
 *
 * flagSuspiciousActivity (wmdAdminService) existed since FID-20260903-002 but
 * had zero callers — the writer was unreachable. This service provides the
 * first reachable trigger: EXCESSIVE_LAUNCHES when a player's 24h launch count
 * crosses the threshold EXACTLY (=== semantics, not >=, so one flag per
 * crossing — sustained volume re-flags only after the count resets below and
 * crosses again, which the probe asserts).
 *
 * Called non-fatally from the missile-launch success path; a flag failure
 * must never fail the launch.
 */
import { and, count, eq, gte } from 'drizzle-orm';

import { db } from '@/lib/db';
import { missiles, wmdSuspiciousActivity } from '@/lib/db/schema';
import { flagSuspiciousActivity } from '@/lib/wmd/admin/wmdAdminService';

export const EXCESSIVE_LAUNCH_THRESHOLD = 10;
export const LAUNCH_WINDOW_HOURS = 24;

/** Count the player's launches inside the rolling window. */
export async function countRecentLaunches(username: string): Promise<number> {
  const since = new Date(Date.now() - LAUNCH_WINDOW_HOURS * 60 * 60 * 1000);
  const rows = await db
    .select({ value: count() })
    .from(missiles)
    .where(
      and(eq(missiles.launchedBy, username), gte(missiles.launchedAt, since))
    );
  return rows[0]?.value ?? 0;
}

/**
 * Flag EXCESSIVE_LAUNCHES exactly when the 24h count crosses the threshold.
 * Returns the number of flags written (0 or 1).
 *
 * Two guards make this one-per-crossing: count === threshold (not >=) stops
 * re-flagging on later launches inside the window, and a dedupe read (any
 * EXCESSIVE_LAUNCHES flag for this player inside the current window) stops
 * double-fires when the trigger is re-evaluated at the same count — retries,
 * races, or manual replays of the launch path.
 */
export async function flagExcessiveLaunches(
  username: string,
  clanId: string | null
): Promise<number> {
  const launches = await countRecentLaunches(username);
  if (launches !== EXCESSIVE_LAUNCH_THRESHOLD) return 0;

  const since = new Date(Date.now() - LAUNCH_WINDOW_HOURS * 60 * 60 * 1000);
  const existing = await db
    .select({ id: wmdSuspiciousActivity.id })
    .from(wmdSuspiciousActivity)
    .where(
      and(
        eq(wmdSuspiciousActivity.playerId, username),
        eq(wmdSuspiciousActivity.activityType, 'EXCESSIVE_LAUNCHES'),
        gte(wmdSuspiciousActivity.createdAt, since)
      )
    )
    .limit(1);
  if (existing.length > 0) return 0;

  await flagSuspiciousActivity({
    playerId: username,
    clanId: clanId || 'NONE',
    activityType: 'EXCESSIVE_LAUNCHES',
    severity: 'MEDIUM',
    details: `${launches} launches in the last ${LAUNCH_WINDOW_HOURS}h`,
    evidence: { launches, threshold: EXCESSIVE_LAUNCH_THRESHOLD, windowHours: LAUNCH_WINDOW_HOURS },
  });
  return 1;
}
