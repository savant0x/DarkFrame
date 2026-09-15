/**
 * Repo-wide census of every db.collection() / getCollection() name against the shim's
 * live resolution (FID-20260914-009 follow-up; the session-010 census was grep-based —
 * this one machine-resolves every name through the shim's own logic).
 *
 * Methods:
 * 1. Grep all .collection('…') and getCollection('…') literals in lib/ + app/ + server.ts
 *    (production code only — scripts/ and __tests__/ excluded, they run ad-hoc).
 * 2. Dump the shim's FULL live registry from the real schema module — every key of
 *    TABLE_REGISTRY, not the two names per table my grep saw — plus the alias map.
 * 3. Machine-resolve every grepped name via the exact getTable() logic and classify.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as schema from '@/lib/db/schema';
import { is, getTableName } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';

/* ---- Step 2: dump the shim's full live registry (mirrors lib/mongodb.ts 127-139) ---- */
const TABLE_REGISTRY: Record<string, PgTable> = {};
for (const [name, exportValue] of Object.entries(schema)) {
  if (is(exportValue, PgTable)) {
    TABLE_REGISTRY[name] = exportValue;
    TABLE_REGISTRY[getTableName(exportValue)] = exportValue;
  }
}
// lib/mongodb.ts lines 141-159, verbatim
const TABLE_ALIASES: Record<string, string> = {
  users: 'players',
  playerAchievements: 'achievements',
  adminLogs: 'modLog',
  ActionLog: 'modLog',
  system_logs: 'modLog',
  wmd_clan_defense_grid: 'wmd_defense_grids',
  wmd_interception_attempts: 'wmd_interceptions',
  wmd_launch_history: 'wmd_launch_authorizations',
  wmd_missiles: 'missiles',
  wmd_player_research: 'player_research',
  wmd_sabotage_events: 'wmd_sabotage_operations',
};
// lib/mongodb.ts lines 160-164, verbatim logic
function getTable(name: string): PgTable | undefined {
  const direct = TABLE_REGISTRY[name];
  if (direct) return direct;
  const aliased = TABLE_ALIASES[name];
  return aliased ? TABLE_REGISTRY[aliased] : undefined;
}

/* ---- Step 1: scan every production file for collection-name literals ---- */
const ROOTS = ['lib', 'app', 'server.ts'];
const SKIP_DIRS = new Set(['__tests__', 'node_modules', '.next']);
const files: string[] = [];
function walk(p: string) {
  const st = statSync(p);
  if (st.isDirectory()) {
    if (SKIP_DIRS.has(p.split(/[\\/]/).pop() ?? '')) return;
    for (const e of readdirSync(p)) walk(join(p, e));
    return;
  }
  if (/\.(ts|tsx)$/.test(p) && !/\.test\./.test(p)) files.push(p);
}
for (const r of ROOTS) {
  try {
    walk(r);
  } catch {
    /* server.ts may not exist as a file; lib/app always do */
  }
}
// Generic invocations count too: db.collection<Unit>('units') — the <T> sits between
// the method and the open paren (this exact shape hid four sites from two audits).
const CALL_RE = /\.(?:collection|getCollection)(?:<[^>()]*>)?\(\s*(['"`])([^'"`]+)\1/g;
const byName = new Map<string, Set<string>>();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let m: RegExpExecArray | null;
  while ((m = CALL_RE.exec(src)) !== null) {
    const name = m[2].trim();
    if (!byName.has(name)) byName.set(name, new Set());
    byName.get(name)!.add(m[1] === "'" ? 'str' : m[1]);
  }
}
const calls = [...byName.entries()].map(([name, quoteSet]) => ({ name, sites: [...quoteSet] }));

/* ---- Step 3: resolve + classify ---- */
const rows = calls.map(({ name, sites }) => {
  const direct = TABLE_REGISTRY[name];
  if (direct) return { name, sites, how: 'registry' as const, target: getTableName(direct) };
  if (name in TABLE_ALIASES) {
    const t = TABLE_REGISTRY[TABLE_ALIASES[name]];
    return {
      name,
      sites,
      how: 'alias' as const,
      target: t ? getTableName(t) : `MISSING:${TABLE_ALIASES[name]}`,
    };
  }
  return { name, sites, how: 'UNMAPPED' as const, target: '—' };
});

const mappedRows = rows.filter((r) => r.how !== 'UNMAPPED');
const unmapped = rows.filter((r) => r.how === 'UNMAPPED').map((r) => r.name);

console.log(`Registry keys: ${Object.keys(TABLE_REGISTRY).length} (${new Set(Object.values(TABLE_REGISTRY).map(getTableName)).size} distinct tables)`);
console.log(`Alias keys: ${Object.keys(TABLE_ALIASES).length}`);
console.log(`Distinct collection names in production code: ${calls.length}`);
console.log('');
console.log('=== MAPPED (registry-direct or alias) ===');
for (const r of mappedRows) {
  console.log(`  ${r.name}  →  ${r.target}  (${r.how})`);
}
console.log('');
console.log('=== UNMAPPED (silent no-op class) ===');
for (const r of rows.filter((x) => x.how === 'UNMAPPED')) {
  console.log(`  ${r.name}  (via: ${r.sites.join(', ')})`);
}
if (unmapped.length === 0) console.log('  (none)');

export { TABLE_REGISTRY, TABLE_ALIASES, getTable, calls, unmapped };
