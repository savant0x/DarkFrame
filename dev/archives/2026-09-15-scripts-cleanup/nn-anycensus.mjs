#!/usr/bin/env node
/**
 * Census of @typescript-eslint/no-explicit-any findings, grouped by file.
 * Read-only reporting tool for the burn-down campaign.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Node 20.12+/25 block .cmd/.bat spawning without shell; resolve the local
// eslint entry directly instead of going through npx. fileURLToPath handles
// Windows drive-letter URLs correctly (URL.pathname yields /C:/...).
const eslintBin = fileURLToPath(new URL('../node_modules/eslint/bin/eslint.js', import.meta.url));

let raw;
try {
  raw = execFileSync(process.execPath, [eslintBin, '.', '-f', 'json'], {
    maxBuffer: 64 * 1024 * 1024,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch (error) {
  // eslint exits 1 when findings exist — the JSON is still on stdout.
  raw = /** @type {{ stdout: string }} */ (error).stdout ?? '';
}
if (!raw) {
  console.error('eslint produced no JSON output');
  process.exit(1);
}
const data = JSON.parse(raw);
// Drop the per-file `source` payloads — with hundreds of files they exceed the
// pipe buffer and crash the process; only counts and paths are needed here.
const byFile = new Map();
for (const f of data) {
  delete f.source;
  const anys = f.messages.filter((m) => m.ruleId === '@typescript-eslint/no-explicit-any');
  if (anys.length > 0) {
    // Full repo-relative path as the grouping key: a shorter key (e.g. first two
    // segments) would merge sibling files (app/api/a.ts + app/api/b.ts) and the
    // counts must ACCUMULATE, not replace — the old set() replaced on collision
    // and silently understated totals.
    const segs = f.filePath.split(/[\\/]/);
    const rootIdx = segs.lastIndexOf('DarkFrame');
    const rel = (rootIdx >= 0 ? segs.slice(rootIdx + 1) : segs).join('/');
    byFile.set(rel, (byFile.get(rel) ?? 0) + anys.length);
  }
}
const entries = [...byFile.entries()].sort((a, b) => b[1] - a[1]);
let total = 0;
for (const [file, count] of entries) {
  total += count;
  console.log(String(count).padStart(4), file);
}
console.log('TOTAL:', total, 'files:', entries.length);
