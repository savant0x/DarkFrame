/**
 * @file __tests__/lib/protectionDisplay.test.ts
 * @created 2026-09-16
 * @overview Unit pins for the protection UI display helper (FID-20260916-002 UI).
 *            Pure functions — no mocks, no DB.
 */
import { describe, it, expect } from 'vitest';
import { formatProtectionRemaining } from '@/lib/protectionDisplay';

const NOW = Date.UTC(2026, 8, 16, 12, 0, 0); // 2026-09-16T12:00:00Z
const H = 3_600_000;
const M = 60_000;

describe('formatProtectionRemaining', () => {
  it('formats a fresh 72h window as days + hours', () => {
    expect(formatProtectionRemaining(new Date(NOW + 72 * H), NOW)).toBe('3d 0h');
  });

  it('formats mid-window as days + hours above 48h remaining', () => {
    // 50h remaining → "2d 2h" (50h >= 48h threshold keeps day precision)
    expect(formatProtectionRemaining(new Date(NOW + 50 * H), NOW)).toBe('2d 2h');
  });

  it('switches to hours + minutes below 48h', () => {
    expect(formatProtectionRemaining(new Date(NOW + 5 * H + 30 * M), NOW)).toBe('5h 30m');
  });

  it('switches to bare minutes under an hour', () => {
    expect(formatProtectionRemaining(new Date(NOW + 42 * M), NOW)).toBe('42m');
  });

  it('formats string and number inputs identically to Date', () => {
    const iso = new Date(NOW + 30 * H).toISOString();
    expect(formatProtectionRemaining(iso, NOW)).toBe('30h 0m');
    expect(formatProtectionRemaining(NOW + 30 * H, NOW)).toBe('30h 0m');
  });

  it('returns null for absent / null / undefined windows', () => {
    expect(formatProtectionRemaining(null, NOW)).toBeNull();
    expect(formatProtectionRemaining(undefined, NOW)).toBeNull();
  });

  it('returns null for expired windows (including boundary)', () => {
    expect(formatProtectionRemaining(new Date(NOW - 1), NOW)).toBeNull();
    expect(formatProtectionRemaining(new Date(NOW), NOW)).toBeNull();
  });

  it('returns null for garbage input instead of "NaNm"', () => {
    expect(formatProtectionRemaining('not-a-date', NOW)).toBeNull();
    expect(formatProtectionRemaining(Number.NaN, NOW)).toBeNull();
  });
});
