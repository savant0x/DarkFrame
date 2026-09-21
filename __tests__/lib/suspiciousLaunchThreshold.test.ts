/**
 * @file __tests__/lib/suspiciousLaunchThreshold.test.ts
 * @created 2026-09-19 (FID-20260919-015 W4)
 * @overview Pins for the EXCESSIVE_LAUNCHES trigger: the flag fires exactly
 *            when the 24h launch count crosses the threshold (=== semantics —
 *            one flag per crossing), never before or after.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { flagMock, launchCount, existingFlags } = vi.hoisted(() => ({
  flagMock: vi.fn(),
  launchCount: { value: 0 },
  existingFlags: { rows: [] as unknown[] },
}));

vi.mock('@/lib/db', async () => {
  const { getTableName } = await import('drizzle-orm');
  const { missiles } = await import('@/lib/db/schema');
  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (getTableName(table as never) === getTableName(missiles)) {
              // launch-count query: awaited directly as [{ value }]
              return [{ value: launchCount.value }];
            }
            // dedupe read: chains .limit(1)
            return { limit: async () => existingFlags.rows };
          },
          limit: async () => existingFlags.rows,
        }),
      }),
    },
  };
});

vi.mock('@/lib/wmd/admin/wmdAdminService', () => ({
  flagSuspiciousActivity: flagMock,
}));

import { flagExcessiveLaunches, EXCESSIVE_LAUNCH_THRESHOLD } from '@/lib/wmd/suspiciousActivityService';

describe('flagExcessiveLaunches — threshold-exactly semantics', () => {
  beforeEach(() => {
    launchCount.value = 0;
    existingFlags.rows = [];
    flagMock.mockClear().mockResolvedValue({ success: true, alertId: 'susp_x' });
  });

  it('no flag below the threshold', async () => {
    launchCount.value = EXCESSIVE_LAUNCH_THRESHOLD - 1;
    expect(await flagExcessiveLaunches('tester', 'clan-1')).toBe(0);
    expect(flagMock).not.toHaveBeenCalled();
  });

  it('flags EXACTLY at the threshold (one flag per crossing)', async () => {
    launchCount.value = EXCESSIVE_LAUNCH_THRESHOLD;
    expect(await flagExcessiveLaunches('tester', 'clan-1')).toBe(1);
    expect(flagMock).toHaveBeenCalledTimes(1);
    expect(flagMock.mock.calls[0][0]).toMatchObject({
      playerId: 'tester',
      clanId: 'clan-1',
      activityType: 'EXCESSIVE_LAUNCHES',
      severity: 'MEDIUM',
    });
  });

  it('dedupe: a same-window flag suppresses a re-fire at the same count', async () => {
    launchCount.value = EXCESSIVE_LAUNCH_THRESHOLD;
    existingFlags.rows = [{ id: 'existing' }];
    expect(await flagExcessiveLaunches('tester', 'clan-1')).toBe(0);
    expect(flagMock).not.toHaveBeenCalled();
  });

  it('no flag above the threshold (>= would re-flag every launch)', async () => {
    launchCount.value = EXCESSIVE_LAUNCH_THRESHOLD + 5;
    expect(await flagExcessiveLaunches('tester', 'clan-1')).toBe(0);
    expect(flagMock).not.toHaveBeenCalled();
  });

  it('null clan degrades to the NONE sentinel, not an FK-less empty write', async () => {
    launchCount.value = EXCESSIVE_LAUNCH_THRESHOLD;
    await flagExcessiveLaunches('tester', null);
    expect(flagMock.mock.calls[0][0].clanId).toBe('NONE');
  });
});
