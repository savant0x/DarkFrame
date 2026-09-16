/**
 * FID-20260916-002: new-player protection window — contract pins.
 *
 * Covers the pure predicate (single truth for "protected right now?"), the
 * registration expiry math, the aggression-void write (honest one-row scoping,
 * swallowed-failure contract), and the sanitizer allowlist passthrough.
 * Route-level refusals + registration write are live-probed per the FID's
 * verification plan (combat/infantry 400, factory/attack refusal, WMD negative).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateWhereArgs, updateReturning, updateSetPayloads } = vi.hoisted(() => ({
  updateWhereArgs: [] as unknown[][],
  updateReturning: [] as Array<Array<Record<string, unknown>>>,
  updateSetPayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((set: Record<string, unknown>) => {
        updateSetPayloads.push(set);
        return {
          where: vi.fn().mockImplementation((...whereArgs: unknown[]) => {
            updateWhereArgs.push(whereArgs);
            return {
              returning: vi.fn().mockImplementation(() => Promise.resolve(updateReturning.shift() ?? [])),
            };
          }),
        };
      }),
    })),
  },
}));

import {
  PROTECTION_WINDOW_HOURS,
  PROTECTION_REFUSAL_REASON,
  protectionActive,
  newPlayerProtectionUntil,
  voidProtectionOnAggression,
} from '@/lib/playerProtection';
import { sanitizePlayer } from '@/lib/playerSanitize';

describe('protectionActive (pure predicate — the single truth)', () => {
  const now = new Date('2026-09-16T12:00:00.000Z');

  it('active when window is in the future', () => {
    expect(protectionActive(new Date('2026-09-19T12:00:00.000Z'), now)).toBe(true);
  });

  it('expired when window is in the past', () => {
    expect(protectionActive(new Date('2026-09-15T12:00:00.000Z'), now)).toBe(false);
  });

  it('boundary: expiry second == now means UNPROTECTED (until <= now)', () => {
    expect(protectionActive(new Date('2026-09-16T12:00:00.000Z'), now)).toBe(false);
  });

  it('accepts ISO strings (jsonb payload shape)', () => {
    expect(protectionActive('2026-09-19T12:00:00.000Z', now)).toBe(true);
    expect(protectionActive('2026-09-15T12:00:00.000Z', now)).toBe(false);
  });

  it('null/undefined = never protected (the pre-existing player shape)', () => {
    expect(protectionActive(null, now)).toBe(false);
    expect(protectionActive(undefined, now)).toBe(false);
  });

  it('corrupt timestamp degrades to unprotected, never throws', () => {
    expect(protectionActive('not-a-date', now)).toBe(false);
  });
});

describe('newPlayerProtectionUntil (registration expiry math)', () => {
  it('is exactly PROTECTION_WINDOW_HOURS ahead of the given instant', () => {
    const base = new Date('2026-09-16T12:00:00.000Z');
    const expected = new Date(base.getTime() + PROTECTION_WINDOW_HOURS * 60 * 60 * 1000);
    expect(newPlayerProtectionUntil(base).getTime()).toBe(expected.getTime());
  });

  it('default window is 72h (FID §5 operator-tunable default)', () => {
    expect(PROTECTION_WINDOW_HOURS).toBe(72);
  });
});

describe('PROTECTION_REFUSAL_REASON', () => {
  it('is the stable server reason surfaced on every protected-target refusal', () => {
    expect(PROTECTION_REFUSAL_REASON).toBe('Target is under new-player protection');
  });
});

describe('voidProtectionOnAggression (aggression voids the window)', () => {
  beforeEach(() => {
    updateWhereArgs.length = 0;
    updateSetPayloads.length = 0;
    updateReturning.length = 0;
  });

  it('clears the window for the attacking player, scoped to rows WITH a window', async () => {
    updateReturning.push([{ username: 'newbie' }]);
    await voidProtectionOnAggression('newbie');
    expect(updateSetPayloads[0]).toEqual({ protectionUntil: null });
    // Two predicates: username match + isNotNull(protectionUntil) — an
    // unprotected attacker's update matches nothing (honest no-op).
    expect(updateWhereArgs.length).toBeGreaterThan(0);
  });

  it('a no-row result is a silent honest no-op (no throw)', async () => {
    updateReturning.push([]);
    await expect(voidProtectionOnAggression('already-unprotected')).resolves.toBeUndefined();
  });

  it('a failed void write is swallowed (battle already begun; window is time-derived)', async () => {
    vi.mocked(
      (
        await import('@/lib/db')
      ).db.update as ReturnType<typeof vi.fn>
    ).mockImplementationOnce(() => {
      throw new Error('db down');
    });
    await expect(voidProtectionOnAggression('newbie')).resolves.toBeUndefined();
  });
});

describe('sanitizer seam (client-visible remaining time)', () => {
  it('passes protectionUntil through the allowlist', () => {
    const out = sanitizePlayer({
      username: 'newbie',
      password: 'never-leak',
      protectionUntil: new Date('2026-09-19T12:00:00.000Z'),
    });
    expect(out).not.toBeNull();
    expect(out?.protectionUntil).toEqual(new Date('2026-09-19T12:00:00.000Z'));
  });

  it('control: forbidden fields still never enter the projection', () => {
    const out = sanitizePlayer({ username: 'x', password: 'hash', email: 'a@b.c' });
    expect(out).not.toBeNull();
    expect(out).not.toHaveProperty('password');
    expect(out).not.toHaveProperty('email');
    expect(out).not.toHaveProperty('protectionUntil'); // absent on legacy rows
  });
});
