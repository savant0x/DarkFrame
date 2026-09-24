/**
 * @file __tests__/lib/gameTime.test.ts
 * @created 2026-09-23 (FID-20260923-002)
 * @overview Pins for the explicit game-timezone helpers. These are the
 *            host-independence guarantee: a scheduled game hour must resolve to
 *            the same instant no matter where the process runs, including across
 *            DST transitions.
 */
import { describe, it, expect } from 'vitest';
import {
  GAME_TIMEZONE,
  gameParts,
  gameHour,
  gameDayOfWeek,
  gameDateKey,
  startOfGameDay,
  atGameTime,
  addGameDays,
  nextGameOccurrence,
  daysAgo,
  hoursAgo,
} from '@/lib/gameTime';

const iso = (d: Date) => d.toISOString();

describe('gameTime — explicit game timezone', () => {
  it('reads game fields in the game zone, not the host zone', () => {
    const d = new Date('2026-09-23T18:00:00Z'); // 14:00 in America/New_York (EDT)
    expect(GAME_TIMEZONE).toBe('America/New_York');
    expect(gameHour(d)).toBe(14);
    expect(gameDayOfWeek(d)).toBe(3); // Wednesday
    expect(gameDateKey(d)).toBe('2026-09-23');
    expect(gameParts(d)).toMatchObject({ year: 2026, month: 8, day: 23, hour: 14 });
  });

  it('resolves game-day boundaries to the correct instant', () => {
    expect(iso(startOfGameDay(new Date('2026-09-23T18:00:00Z')))).toBe('2026-09-23T04:00:00.000Z');
    expect(iso(atGameTime(new Date('2026-09-23T18:00:00Z'), 12))).toBe('2026-09-23T16:00:00.000Z');
  });

  it('adds calendar days at the same game wall time', () => {
    const d = new Date('2026-09-23T18:00:00Z');
    expect(iso(addGameDays(d, 1))).toBe('2026-09-24T18:00:00.000Z');
    expect(iso(addGameDays(d, 7))).toBe('2026-09-30T18:00:00.000Z');
  });

  it('finds the next scheduled game occurrence (strictly after now)', () => {
    const wed = new Date('2026-09-23T18:00:00Z'); // Wed 14:00 EDT
    // Next Sunday 04:00 EDT = 08:00Z
    expect(iso(nextGameOccurrence(wed, 0, 4))).toBe('2026-09-27T08:00:00.000Z');
    // Already past today's slot -> a full week out
    const sun = new Date('2026-09-27T18:00:00Z'); // Sun 14:00, past 04:00
    expect(iso(nextGameOccurrence(sun, 0, 4))).toBe('2026-10-04T08:00:00.000Z');
    // Not yet today's slot -> today
    const sunEarly = new Date('2026-09-27T05:00:00Z'); // Sun 01:00
    expect(iso(nextGameOccurrence(sunEarly, 0, 4))).toBe('2026-09-27T08:00:00.000Z');
  });

  it('is DST-correct across both transitions', () => {
    // Fall back 2026-11-01: 04:00 EST = 09:00Z; the game day starts at 04:00Z (EDT midnight).
    expect(iso(nextGameOccurrence(new Date('2026-10-28T18:00:00Z'), 0, 4))).toBe('2026-11-01T09:00:00.000Z');
    expect(iso(startOfGameDay(new Date('2026-11-01T15:00:00Z')))).toBe('2026-11-01T04:00:00.000Z');
    // Spring forward 2026-03-08: 04:00 EDT = 08:00Z; game day starts at 05:00Z (EST midnight).
    expect(iso(nextGameOccurrence(new Date('2026-03-04T18:00:00Z'), 0, 4))).toBe('2026-03-08T08:00:00.000Z');
    expect(iso(startOfGameDay(new Date('2026-03-08T15:00:00Z')))).toBe('2026-03-08T05:00:00.000Z');
  });

  it('exact-ms relative helpers are timezone-independent', () => {
    const d = new Date('2026-09-23T18:00:00Z');
    expect(iso(daysAgo(d, 1))).toBe('2026-09-22T18:00:00.000Z');
    expect(iso(daysAgo(d, 30))).toBe('2026-08-24T18:00:00.000Z');
    expect(iso(hoursAgo(d, 5))).toBe('2026-09-23T13:00:00.000Z');
  });
});
