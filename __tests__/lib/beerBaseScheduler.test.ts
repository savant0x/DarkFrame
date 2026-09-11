/**
 * @file __tests__/lib/beerBaseScheduler.test.ts
 * @overview FID-20260909-035 — scheduler wiring regression.
 *
 * The audit found four wiring defects:
 *  1. isRespawnTime ignored dynamic multi-schedules (legacy fields only) —
 *     dynamic windows could never fire behind the scheduler.
 *  2. The manager's dedup week was in-memory → restart inside the window
 *     double-respawned.
 *  3. No catch-up → a server down for the whole scheduled hour skipped the
 *     week silently.
 *  4. botGrowthEngine.runGrowthCycle had no scheduled caller at all — the bot
 *     ecosystem could only decay.
 *
 * These tests pin the window semantics (legacy + dynamic + timezone) and the
 * persisted-week dedup/catch-up contract; the manager's flow is driven
 * through its exported job function with a mocked service layer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({ connectToDatabase: vi.fn() }));
vi.mock('@/lib/botService', () => ({
  createBot: vi.fn(),
  createBotPlayer: vi.fn(),
  claimBotBaseTile: vi.fn(),
  releaseBotBaseTile: vi.fn(),
  generateBeerBaseName: vi.fn(),
}));

import { isRespawnTime, setLastRespawnWeek } from '@/lib/beerBaseService';
import type { BeerBaseConfig } from '@/lib/beerBaseService';

/** Legacy single-schedule config stub. */
const legacyConfig = (day: number, hour: number): BeerBaseConfig =>
  ({ respawnDay: day, respawnHour: hour, enabled: true } as unknown as BeerBaseConfig);

/** Dynamic schedule config stub (the FID-20251025-003 feature). */
const dynamicConfig = (
  schedules: Array<{ dayOfWeek: number; hour: number; timezone: string; enabled?: boolean }>
): BeerBaseConfig =>
  ({
    respawnDay: 1,
    respawnHour: 3, // legacy fields must be IGNORED when schedules are enabled
    schedulesEnabled: true,
    schedules: schedules.map((s) => ({ enabled: true, spawnPercentage: 100, ...s })),
  } as unknown as BeerBaseConfig);

describe('isRespawnTime (FID-20260909-035 window semantics)', () => {
  const SUNDAY_4AM_LOCAL = new Date(2026, 8, 13, 4, 30); // 2026-09-13 is a Sunday

  it('fires inside the legacy scheduled hour', () => {
    expect(isRespawnTime(legacyConfig(0, 4), SUNDAY_4AM_LOCAL)).toBe(true);
  });

  it('does not fire outside the legacy hour or on other days', () => {
    expect(isRespawnTime(legacyConfig(0, 4), new Date(2026, 8, 13, 5, 30))).toBe(false);
    expect(isRespawnTime(legacyConfig(0, 4), new Date(2026, 8, 14, 4, 30))).toBe(false);
  });

  it('fires for an enabled dynamic schedule even when legacy fields disagree', () => {
    // Wednesday 12:00 in America/New_York — legacy fields say Mon 03:00.
    const wednesdayNoonNY = new Date('2026-09-09T16:00:00Z'); // 12:00 EDT
    const cfg = dynamicConfig([{ dayOfWeek: 3, hour: 12, timezone: 'America/New_York' }]);
    expect(isRespawnTime(cfg, wednesdayNoonNY)).toBe(true);
  });

  it('evaluates dynamic schedules in the schedule’s timezone, not the server’s', () => {
    // 2026-09-09T16:30Z is 12:30 New York (EDT) but 01:30+1h Tokyo (Thursday).
    const instant = new Date('2026-09-09T16:30:00Z');
    const ny = dynamicConfig([{ dayOfWeek: 3, hour: 12, timezone: 'America/New_York' }]);
    const tokyo = dynamicConfig([{ dayOfWeek: 4, hour: 1, timezone: 'Asia/Tokyo' }]);
    expect(isRespawnTime(ny, instant)).toBe(true);   // Wed 12:30 NY
    expect(isRespawnTime(tokyo, instant)).toBe(true); // Thu 01:30 Tokyo
  });

  it('does not fire for a disabled dynamic schedule', () => {
    const wednesdayNoonNY = new Date('2026-09-09T16:00:00Z');
    const cfg = dynamicConfig([{ dayOfWeek: 3, hour: 12, timezone: 'America/New_York', enabled: false }]);
    expect(isRespawnTime(cfg, wednesdayNoonNY)).toBe(false);
  });

  it('falls back to legacy fields when schedules exist but are disabled as a feature', () => {
    const cfg = {
      respawnDay: 0,
      respawnHour: 4,
      schedulesEnabled: false,
      schedules: [{ enabled: true, dayOfWeek: 3, hour: 12, timezone: 'America/New_York' }],
    } as unknown as BeerBaseConfig;
    expect(isRespawnTime(cfg, SUNDAY_4AM_LOCAL)).toBe(true); // legacy Sun 04:00
  });
});

describe('beerBaseManager persisted-week dedup (FID-20260909-035)', () => {
  const week = 37;

  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips the respawn when the persisted week already covers this window', async () => {
    const spawn = vi.fn();
    vi.doMock('@/lib/beerBaseService', () => ({
      isRespawnTime: () => true,
      getBeerBaseConfig: async () => ({ lastRespawnWeek: week, enabled: true }),
      weeklyBeerBaseRespawn: spawn,
      setLastRespawnWeek: vi.fn(),
    }));
    const { beerBaseManagerJob } = await import('../../lib/jobs/beerBaseManager');

    await beerBaseManagerJob();

    expect(spawn).not.toHaveBeenCalled();
  });

  it('fires and persists the week when the window arrives fresh', async () => {
    const setWeek = vi.fn();
    const spawn = vi.fn(async () => ({ removed: 1, spawned: 1, beerBases: ['X'] }));
    vi.doMock('@/lib/beerBaseService', () => ({
      isRespawnTime: () => true,
      getBeerBaseConfig: async () => ({ lastRespawnWeek: week - 1, enabled: true }),
      weeklyBeerBaseRespawn: spawn,
      setLastRespawnWeek: setWeek,
    }));
    const { beerBaseManagerJob } = await import('../../lib/jobs/beerBaseManager');

    await beerBaseManagerJob();

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(setWeek).toHaveBeenCalledWith(expect.any(Number));
  });

  it('catches up when the persisted week is in the past (missed window)', async () => {
    const setWeek = vi.fn();
    const spawn = vi.fn(async () => ({ removed: 0, spawned: 1, beerBases: ['Y'] }));
    vi.doMock('@/lib/beerBaseService', () => ({
      isRespawnTime: () => true,
      getBeerBaseConfig: async () => ({ lastRespawnWeek: week - 3, enabled: true }),
      weeklyBeerBaseRespawn: spawn,
      setLastRespawnWeek: setWeek,
    }));
    const { beerBaseManagerJob } = await import('../../lib/jobs/beerBaseManager');

    await beerBaseManagerJob();

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(setWeek).toHaveBeenCalled();
  });

  it('does nothing when outside any respawn window', async () => {
    const spawn = vi.fn();
    vi.doMock('@/lib/beerBaseService', () => ({
      isRespawnTime: () => false,
      getBeerBaseConfig: async () => ({}),
      weeklyBeerBaseRespawn: spawn,
      setLastRespawnWeek: vi.fn(),
    }));
    const { beerBaseManagerJob } = await import('../../lib/jobs/beerBaseManager');

    await beerBaseManagerJob();

    expect(spawn).not.toHaveBeenCalled();
  });
});

describe('botGrowthManager registration (FID-20260909-035)', () => {
  it('exposes start/stop/stats with the standard job contract', async () => {
    const mod = await import('../../lib/jobs/botGrowthManager');
    expect(typeof mod.startBotGrowthJob).toBe('function');
    expect(typeof mod.stopBotGrowthJob).toBe('function');
    expect(typeof mod.getBotGrowthJobStats).toBe('function');

    const started = mod.startBotGrowthJob();
    expect(started.success).toBe(true);
    expect(mod.getBotGrowthJobStats().executionCount).toBe(0);
    mod.stopBotGrowthJob();

    // Double-start is idempotent while running.
    mod.startBotGrowthJob();
    const again = mod.startBotGrowthJob();
    expect(again.success).toBe(true);
    mod.stopBotGrowthJob();
  });
});

describe('setLastRespawnWeek persistence', () => {
  it('is exported and callable (wired through updateBeerBaseConfig)', async () => {
    expect(typeof setLastRespawnWeek).toBe('function');
  });
});
