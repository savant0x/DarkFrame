#!/usr/bin/env node
/**
 * Cross-zone test audit (FID-20260923-002).
 *
 * Why two zones: the suite's timezone pin (vitest.setup.ts) makes failures
 * reproducible, but no single zone can detect every host-timezone class — the
 * two failure modes need opposite conditions and each one is invisible in the
 * other zone. Probed, not assumed:
 *
 *   UTC              no DST, no offset. Catches code or tests that read the
 *                    HOST zone where the GAME zone was meant — e.g. a respawn
 *                    assertion reading `getHours()` (detected 2026-09-23:
 *                    3 failures, each off by the NY offset).
 *
 *   America/New_York DST-observing. Catches methods that differ only across a
 *                    transition — e.g. production doing a wall-clock calendar
 *                    walk (`setDate(getDate()+n)`) where an exact duration was
 *                    meant. Under UTC those two agree, so UTC cannot see it.
 *
 * So the proof of host-independence is the UNION of both runs, and this script
 * is that union in one command: `npm run test:zones`.
 *
 * Exits non-zero if either zone fails, printing which class that zone covers.
 */

const { spawnSync } = require('node:child_process');

const ZONES = [
  { tz: 'UTC', covers: 'host-zone assumptions (no DST, no offset)' },
  { tz: 'America/New_York', covers: 'DST-sensitive method drift' },
];

const results = [];

for (const zone of ZONES) {
  console.log(`\n${'='.repeat(72)}\nZONE AUDIT: ${zone.tz} — covers ${zone.covers}\n${'='.repeat(72)}\n`);
  const run = spawnSync('npx', ['vitest', 'run'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TEST_TZ: zone.tz },
  });
  results.push({ tz: zone.tz, ok: run.status === 0 });
}

console.log(`\n${'='.repeat(72)}\nCROSS-ZONE AUDIT SUMMARY\n${'='.repeat(72)}`);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.tz}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(
    `\nCross-zone audit FAILED in: ${failed.map((f) => f.tz).join(', ')}.\n` +
      `A suite that passes in one zone and fails in another is host-dependent —\n` +
      `fix the host dependency, not the zone.`,
  );
  process.exit(1);
}

console.log('\nHost independence proven: the suite passes in every audited zone.');
