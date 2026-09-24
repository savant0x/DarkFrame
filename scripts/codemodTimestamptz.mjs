/**
 * One-shot codemod (FID-20260923-001) — flip every naive drizzle timestamp
 * declaration to `{ withTimezone: true }`. Idempotent: a declaration that
 * already carries the option does not match the bare pattern and is left
 * untouched. Run with `node scripts/codemodTimestamptz.mjs`; review with
 * `git diff lib/db/schema`.
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join(process.cwd(), 'lib', 'db', 'schema');
const BARE = /timestamp\('([a-z_]+)'\)/g;

let files = 0;
let edits = 0;
for (const f of fs.readdirSync(DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts')) {
  const p = path.join(DIR, f);
  const src = fs.readFileSync(p, 'utf8');
  const next = src.replace(BARE, (_m, col) => `timestamp('${col}', { withTimezone: true })`);
  if (next !== src) {
    const n = (src.match(BARE) ?? []).length;
    fs.writeFileSync(p, next);
    files += 1;
    edits += n;
    console.log(`  ${f}: ${n} declaration(s)`);
  }
}
console.log(`\ncodemod: ${edits} declaration(s) across ${files} file(s) -> withTimezone: true`);
