/**
 * @file __tests__/config/devTmpExcluded.test.ts
 * @created 2026-09-28
 * @overview FID-20260928-002 — the `dev/tmp/` scratch contract, pinned.
 *
 * SCOPE row 128's incident class: `dev/tmp/` is gitignored (scratch by
 * intent) while tsconfig, eslint and vitest all scanned it — so a scratch
 * artifact could break a gate with a clean `git status`. The fix adds the
 * directory to all three tool configs; this pin makes the contract
 * mechanical so the exclusion cannot silently regress. Textual by design
 * (the census-pin precedent); the behavioral proof is the FID's GREEN
 * re-drill, recorded in its implementation record.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

/**
 * tsconfig.json is JSONC, and this repo's file carries `/*` inside string
 * values (`"paths": { "@/*": ["./*"] }`), so naive comment-stripping corrupts
 * the document. Extract the arrays by targeted match instead — consistent
 * with the eslint/vitest assertions below.
 */
function extractArray(src: string, key: string): string {
  const m = src.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`));
  expect(m, `tsconfig.json "${key}" array must exist`).toBeTruthy();
  return m![1];
}

describe('FID-20260928-002 — dev/tmp is invisible to every gate', () => {
  it('tsconfig excludes dev/tmp from compilation', () => {
    const src = readFileSync(join(ROOT, 'tsconfig.json'), 'utf8');
    expect(extractArray(src, 'exclude')).toContain('dev/tmp');
  });

  it('eslint ignores dev/tmp (the flat-config global-ignores block)', () => {
    const src = readFileSync(join(ROOT, 'eslint.config.mjs'), 'utf8');
    const m = src.match(/ignores:\s*\[([^\]]*node_modules[^\]]*)\]/);
    expect(m, 'the global-ignores array (carrying node_modules) must exist').toBeTruthy();
    expect(m![1]).toContain('dev/tmp/**');
  });

  it('vitest excludes dev/tmp from test discovery', () => {
    const src = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8');
    const m = src.match(/exclude:\s*\[([^\]]*node_modules[^\]]*)\]/);
    expect(m, 'the test.exclude array (carrying node_modules) must exist').toBeTruthy();
    expect(m![1]).toContain('dev/tmp/**');
  });

  it('.gitignore still designates dev/tmp as the scratch area', () => {
    const src = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(src).toMatch(/^dev\/tmp\/\s*$/m);
  });
});
