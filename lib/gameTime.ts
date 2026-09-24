/**
 * Game-time helpers (FID-20260923-002).
 *
 * The game's day boundary is a PRODUCT decision, not a host detail. Before this
 * module, server-side date math read the host's local timezone — `getHours()`,
 * `getDay()`, `setHours(0,0,0,0)`, `new Date(y, m, d)` — so the weekly beer
 * respawn, the harvest reset, the daily territory income, the clan-distribution
 * reset and the AM/PM attack period all fired at a different wall-clock time
 * depending on where the server ran — and differently again across a DST shift.
 *
 * This module pins every game-day computation to one explicit zone so behaviour
 * is host-independent. `GAME_TIMEZONE` preserves the behaviour of the original
 * (America/New_York) environment exactly; changing it moves the game day in one
 * place rather than dozens.
 *
 * RULE: server-side code that needs "what game hour is it", "today in game
 * terms", or "the next game-day occurrence" must use these helpers, never a raw
 * `Date.prototype.getHours()/getDay()/getDate()`. Client-side *display*
 * formatting (`toLocaleDateString`) is deliberately NOT covered — there the
 * user's own browser timezone is the correct context.
 *
 * All arithmetic here is wall-clock arithmetic in the game zone: a "day" is a
 * calendar day, and a DST transition does not shift a scheduled hour.
 */

export const GAME_TIMEZONE = 'America/New_York';

export interface GameParts {
  year: number;
  /** 0-based (0 = January). */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday. */
  dayOfWeek: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The calendar/time fields of `date` as seen in the game zone. */
export function gameParts(date: Date, timeZone: string = GAME_TIMEZONE): GameParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const year = get('year');
  const month = get('month') - 1;
  const day = get('day');
  // Some ICU builds render midnight as hour 24; normalise to 0.
  const hour = get('hour') % 24;
  return {
    year,
    month,
    day,
    hour,
    minute: get('minute'),
    second: get('second'),
    dayOfWeek: new Date(Date.UTC(year, month, day)).getUTCDay(),
  };
}

/** The zone's UTC offset, in ms, at `date` (positive east of UTC). */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = gameParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second, date.getUTCMilliseconds());
  return asUtc - date.getTime();
}

/**
 * The instant for a given wall-clock time in the game zone. Two correction
 * passes resolve DST: the offset is re-read at the candidate instant, which is
 * wrong at most by the transition hour and correct after the second pass.
 */
function fromGameFields(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month, day, hour, minute, 0, 0);
  let instant = guess - zoneOffsetMs(new Date(guess), timeZone);
  instant = guess - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** The game-zone hour (0-23) of `date`. */
export function gameHour(date: Date, timeZone: string = GAME_TIMEZONE): number {
  return gameParts(date, timeZone).hour;
}

/** The game-zone day of week (0 = Sunday) of `date`. */
export function gameDayOfWeek(date: Date, timeZone: string = GAME_TIMEZONE): number {
  return gameParts(date, timeZone).dayOfWeek;
}

/** `YYYY-MM-DD` in the game zone — a stable key for a game day. */
export function gameDateKey(date: Date, timeZone: string = GAME_TIMEZONE): string {
  const p = gameParts(date, timeZone);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** The instant of 00:00 in the game zone on `date`'s game day. */
export function startOfGameDay(date: Date, timeZone: string = GAME_TIMEZONE): Date {
  const p = gameParts(date, timeZone);
  return fromGameFields(p.year, p.month, p.day, 0, 0, timeZone);
}

/** `date`'s game day at `hour`:`minute` in the game zone. */
export function atGameTime(
  date: Date,
  hour: number,
  minute = 0,
  timeZone: string = GAME_TIMEZONE,
): Date {
  const p = gameParts(date, timeZone);
  return fromGameFields(p.year, p.month, p.day, hour, minute, timeZone);
}

/** `date` plus `days` calendar days (same game wall-clock time). */
export function addGameDays(date: Date, days: number, timeZone: string = GAME_TIMEZONE): Date {
  const p = gameParts(date, timeZone);
  return fromGameFields(p.year, p.month, p.day + days, p.hour, p.minute, timeZone);
}

/**
 * The next instant whose game day-of-week is `dayOfWeek` (0 = Sunday) and whose
 * game hour is `hour` — strictly after `now`.
 */
export function nextGameOccurrence(
  now: Date,
  dayOfWeek: number,
  hour: number,
  timeZone: string = GAME_TIMEZONE,
): Date {
  const p = gameParts(now, timeZone);
  let daysUntil = (dayOfWeek - p.dayOfWeek + 7) % 7;
  if (daysUntil === 0 && p.hour >= hour) daysUntil = 7;
  const target = new Date(Date.UTC(p.year, p.month, p.day + daysUntil));
  return fromGameFields(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate(),
    hour,
    0,
    timeZone,
  );
}

/** Exact `n` days before `date` (86 400 000 ms each — timezone-independent). */
export function daysAgo(date: Date, n: number): Date {
  return new Date(date.getTime() - n * 86_400_000);
}

/** Exact `n` hours before `date`. */
export function hoursAgo(date: Date, n: number): Date {
  return new Date(date.getTime() - n * 3_600_000);
}
