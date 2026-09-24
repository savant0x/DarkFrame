#!/usr/bin/env node
/**
 * Host-timezone census (FID-20260923-002) — fail-closed gate for the
 * host-local-date-math class.
 *
 * A game day/hour must come from an explicit zone, never from the host's local
 * timezone. `Date.prototype.getHours()/getDay()/getDate()`, `setHours(0,0,0,0)`
 * and `new Date(y, m, d)` all read the PROCESS timezone, so a scheduled weekly
 * respawn, a harvest reset, a daily distribution reset or a raid-period guard
 * fired at a different wall-clock time — and across DST differently again —
 * depending on where the server ran.
 *
 * Every server-side game-time computation now goes through `lib/gameTime.ts`
 * (`gameHour`, `gameDayOfWeek`, `gameDateKey`, `startOfGameDay`, `atGameTime`,
 * `addGameDays`, `nextGameOccurrence`, `daysAgo`, `hoursAgo`). This gate refuses
 * a reintroduction.
 *
 * SCOPE: server code only — `lib/`, `app/api/`, `server.ts`. Client components
 * are deliberately EXEMPT: there the user's own browser timezone is the correct
 * context for display formatting (`toLocaleDateString` etc.).
 *
 * Fail-closed: an enumeration error exits 2, never 0.
 *
 * Usage: node scripts/hostTimezoneCensus.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROOTS = ['lib', 'app/api'];
const EXTRA_FILES = ['server.ts'];
/** lib/gameTime.ts implements the helpers; it legitimately touches Intl, not these. */
const EXEMPT = new Set([path.join('lib', 'gameTime.ts')]);

const BANNED_METHOD =
  /\.(getHours|getMinutes|getDate|getMonth|getDay|setHours|setDate|setMonth|setMinutes|toDateString|toTimeString|toLocaleDateString|toLocaleTimeString)\s*\(/;
/** `new Date(y, m, d …)` — a local-zone constructor (2+ numeric-ish args). */
const LOCAL_CTOR = /new Date\(\s*[^,)]+,\s*[^,)]+/;

function refuse(msg) {
  process.stdout.write(`HOST-TZ CENSUS REFUSED: ${msg}\n`);
  process.exit(2);
}

function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    refuse(`cannot read ${dir}: ${e.message}`);
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.next', 'archives'].includes(e.name)) continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) && !/\.spec\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
}

const files = [];
for (const r of ROOTS) walk(path.join(ROOT, r), files);
for (const f of EXTRA_FILES) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) files.push(p);
}
if (files.length === 0) refuse('no server files found to scan');

const violations = [];
for (const p of files) {
  const rel = path.relative(ROOT, p);
  if (EXEMPT.has(rel)) continue;
  const src = fs.readFileSync(p, 'utf8');
  src.split('\n').forEach((raw, i) => {
    if (BANNED_METHOD.test(raw) || LOCAL_CTOR.test(raw)) {
      violations.push({ file: rel, line: i + 1, text: raw.trim() });
    }
  });
}

process.stdout.write(`host-tz census: ${files.length} server file(s) scanned\n`);

if (violations.length === 0) {
  process.stdout.write('host-tz census clean: no host-local game-time math\n');
  process.exit(0);
}

process.stdout.write(`\nHOST-LOCAL GAME-TIME MATH (${violations.length}) — use lib/gameTime.ts:\n`);
for (const v of violations) process.stdout.write(`  ${v.file}:${v.line}  ${v.text}\n`);
process.stdout.write(
  '\nA game day/hour must be resolved in an explicit zone (FID-20260923-002).\n' +
    '`getHours()`/`getDay()`/`setHours(0,0,0,0)`/`new Date(y,m,d)` read the HOST\n' +
    'timezone, so the same schedule fires at a different wall clock per host.\n',
);
process.exit(1);
