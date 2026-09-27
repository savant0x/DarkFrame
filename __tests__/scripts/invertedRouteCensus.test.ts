/**
 * @file __tests__/scripts/invertedRouteCensus.test.ts
 * @created 2026-09-25
 * @overview Portability pin for Gate 1 (FID-20260925-004). The inverted route
 *            census must return a byte-stable verdict under both separator
 *            regimes: `path.relative()` yields backslashes on Windows and
 *            forward slashes on Linux, and the gate's waiver comparison used to
 *            match only when both sides happened to be Windows-shaped — so the
 *            gate passed locally and refused on `ubuntu-latest`, and the
 *            fail-fast chain died at Gate 1 with gates 3-10 never executing.
 *
 *            This pin runs the REAL script in a child process twice — once
 *            natively, once under a faithful POSIX separator shim — inside the
 *            suite Gate 10 already runs on both platforms. Its whole purpose is
 *            to fail on **Windows**, the platform that shipped the bug and
 *            cannot otherwise see it.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCRIPT = join(ROOT, 'scripts', 'invertedRouteCensus.cjs');

/**
 * The faithful POSIX shim: patches the RESULTS of `path.join` and
 * `path.relative` only, converting separators to '/'. `path.sep` is deliberately
 * never reassigned — on Windows `path` IS `path.win32` and mutating `sep`
 * corrupts Node's internals; a single-sided shim fabricates failures (both
 * lessons recorded in SESSION-2026-09-25-002 §3.2).
 */
const POSIX_SHIM = `
const path = require('path');
const posixResults = (fn) => (...args) => fn(...args).split(path.sep).join('/');
path.join = posixResults(path.join);
path.relative = posixResults(path.relative);
require(process.env.CENSUS_SCRIPT);
`;

function runCensus(posixSeparators: boolean): { code: number; out: string } {
  const res = posixSeparators
    ? spawnSync(process.execPath, ['-e', POSIX_SHIM], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, CENSUS_SCRIPT: SCRIPT },
      })
    : spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
  return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

function sectionCount(out: string, section: 'WAIVED' | 'MISSING' | 'UNPARSED'): number {
  const m = out.match(new RegExp(`=== ${section} \\((\\d+)\\)`));
  return m ? Number(m[1]) : -1;
}

/** The single waived call-site path as printed (file, excluding :line). */
function waivedPath(out: string): string {
  const m = out.match(/=== WAIVED \(\d+\)[^\n]*\n\s+([^\s:]+):(\d+)/);
  return m ? m[1] : '';
}

describe('inverted route census — POSIX separator portability pin (FID-20260925-004)', () => {
  it('returns the same verdict under native and POSIX separators', () => {
    const native = runCensus(false);
    const posix = runCensus(true);
    for (const [regime, run] of [
      ['native', native],
      ['posix', posix],
    ] as const) {
      expect(run.code, `${regime} run:\n${run.out}`).toBe(0);
      expect(sectionCount(run.out, 'WAIVED'), `${regime} run:\n${run.out}`).toBe(1);
      expect(sectionCount(run.out, 'MISSING'), `${regime} run:\n${run.out}`).toBe(0);
      expect(sectionCount(run.out, 'UNPARSED'), `${regime} run:\n${run.out}`).toBe(0);
    }
  });

  it('reports the waived path identically and forward-slashed in both regimes', () => {
    const nativePath = waivedPath(runCensus(false).out);
    const posixPath = waivedPath(runCensus(true).out);
    expect(nativePath).not.toBe('');
    expect(nativePath).toBe(posixPath);
    // The defect's fingerprint: a backslash here means output paths are still
    // platform-dependent and local/CI transcripts remain incomparable.
    expect(nativePath.includes('\\')).toBe(false);
  });

  it('carries no backslash-keyed waiver (pins the authoring-time self-check from the outside)', () => {
    // The exit-2 self-check refuses a waiver key containing '\' at startup;
    // this assertion pins the same invariant at the source level so the check
    // cannot be quietly deleted while keys stay POSIX.
    const src = readFileSync(SCRIPT, 'utf8');
    const waiversBlock = src.slice(src.indexOf('const WAIVERS'), src.indexOf('const waived'));
    expect(waiversBlock).toContain('WAIVERS');
    const keys = [...waiversBlock.matchAll(/file:\s*'([^']*)'/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key.includes('\\'), `waiver key authored in Windows separators: ${key}`).toBe(false);
    }
  });
});
