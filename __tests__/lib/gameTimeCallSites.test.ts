/**
 * @file __tests__/lib/gameTimeCallSites.test.ts
 * @created 2026-09-23 (FID-20260923-002)
 * @overview Pins that the game-time call sites resolve boundaries in an explicit
 *            zone (not the host's), and that the host-timezone census gate holds.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { gameDateKey } from '@/lib/gameTime';
import { getCurrentResetPeriod, getTimeUntilReset } from '@/lib/harvestService';

const ROOT = process.cwd();

describe('FID-20260923-002 — game time is explicit, not host-local', () => {
  it('harvest reset periods key off the game day', () => {
    const key = gameDateKey(new Date());
    expect(getCurrentResetPeriod(50)).toBe(`${key}-AM`);
    expect(getCurrentResetPeriod(100)).toBe(`${key}-PM`);
  });

  it('harvest reset countdown lands within the next game day', () => {
    for (const x of [50, 100]) {
      const ms = getTimeUntilReset(x);
      expect(ms).toBeGreaterThan(0);
      // Bounded by a DST-long day (25h), not exactly 24h.
      expect(ms).toBeLessThanOrEqual(25 * 3_600_000);
    }
  });

  it('the host-timezone census gate passes on the current tree', () => {
    let code = 0;
    let out = '';
    try {
      out = execFileSync('node', [join(ROOT, 'scripts', 'hostTimezoneCensus.cjs')], { encoding: 'utf8' });
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      code = err.status ?? 1;
      out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
    expect(code, out).toBe(0);
    expect(out).toContain('clean');
  });
});
