/**
 * FID-20260923-001 — LIVE verification driver for the naive -> timestamptz
 * conversion. Runs against the real dev DB.
 *
 * The load-bearing claim of the migration is that it changes the STORAGE TYPE
 * while preserving the instant each reader already computes. This driver proves
 * it end-to-end: it snapshots, per class, the exact instant the app computed
 * BEFORE the migration, applies migration 0040, then re-reads and asserts.
 *
 * ALL instant math is done in SQL and compared as `YYYY-MM-DD HH24:MI:SS.US`
 * UTC-wall strings. Nothing depends on node-pg's date parsing (which returns a
 * bare string for these types through a derived column, a trap that produced a
 * false RED on this driver's first run) or on the process timezone.
 *
 *   P1  every naive column is gone (information_schema: 0 naive)
 *   P2  APP-LOCAL probe columns keep the exact instant the app computed before
 *       (their stored wall clock was the process-local one)
 *   P3  a DB-default probe column lands on the instant its UTC wall clock denotes
 *   P4  a `timestamptz` control column is untouched (migration is a no-op there)
 *   P5  getPlayerWmdStatus returns the documented shape (cooldown + rights)
 *   P6  a seeded retaliation right surfaces with its target clan name + expiry
 *   P7  cleanup leaves no residue
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { generateId } from '../lib/utils';
import { getPlayerWmdStatus } from '../lib/wmd/clanConsequencesService';

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> =>
  ((await db.execute(q)) as unknown as { rows: Row[] }).rows;

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail ?? ''); }
}

type Cls = 'app-local' | 'db-utc' | 'control';
const PROBES: Array<{ table: string; col: string; cls: Cls }> = [
  { table: 'chat_messages', col: 'timestamp', cls: 'app-local' },
  { table: 'battle_logs', col: 'timestamp', cls: 'app-local' },
  { table: 'auctions', col: 'expires_at', cls: 'app-local' },
  { table: 'flag_trail', col: 'created_at', cls: 'app-local' },
  { table: 'players', col: 'created_at', cls: 'db-utc' },
  { table: 'players', col: 'protection_until', cls: 'control' },
];

const SNAPSHOT = path.join(process.cwd(), 'dev', 'tmp', 'timestamp-pre-state.json');
const FMT = 'YYYY-MM-DD HH24:MI:SS.US';

/** A probe sample: the column's stored wall clock (`wall`) and its type. */
interface Sample { type: string; wall: string | null }

async function sample(table: string, col: string): Promise<Sample> {
  const [t] = await rows(sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table} AND column_name = ${col}`);
  const type = (t?.data_type as string) ?? 'absent';
  if (type === 'absent') return { type, wall: null };

  const isTz = type === 'timestamp with time zone';
  const inner = sql.raw(
    `SELECT "${col}" AS v FROM "${table}" WHERE "${col}" IS NOT NULL ORDER BY "${col}" LIMIT 1`,
  );
  const r = isTz
    ? await rows(sql`SELECT to_char(v AT TIME ZONE 'UTC', ${FMT}) AS wall FROM (${inner}) s`)
    : await rows(sql`SELECT to_char(v, ${FMT}) AS wall FROM (${inner}) s`);
  return { type, wall: (r[0]?.wall as string) ?? null };
}

/** The instant a stored wall clock denotes when it was written in `zone`. */
async function instantOf(rawWall: string, zone: 'UTC' | 'America/New_York'): Promise<string> {
  const r = await rows(sql`
    SELECT to_char((${rawWall}::timestamp AT TIME ZONE ${zone}) AT TIME ZONE 'UTC', ${FMT}) AS t`);
  return (r[0]?.t as string) ?? '';
}

async function naiveCount(): Promise<number> {
  const r = await rows(sql`
    SELECT count(*)::int AS n FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'`);
  return Number(r[0]?.n ?? -1);
}

/** Accepts both the current snapshot shape and the earlier `raw` field name. */
const preWall = (s: Record<string, unknown> | undefined): string | null =>
  (s?.wall as string) ?? (s?.raw as string) ?? null;

async function main(): Promise<void> {
  console.log('=== FID-20260923-001: live timestamp-integrity probe ===\n');

  // ---- snapshot pre-state -------------------------------------------------
  let pre: Record<string, Sample>;
  const alreadyConverted = (await naiveCount()) === 0;
  if (alreadyConverted && fs.existsSync(SNAPSHOT)) {
    pre = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, Sample>;
    console.log('pre-state: loaded from snapshot (columns already converted)');
  } else {
    pre = {};
    for (const p of PROBES) pre[`${p.table}.${p.col}`] = await sample(p.table, p.col);
    fs.mkdirSync(path.dirname(SNAPSHOT), { recursive: true });
    fs.writeFileSync(SNAPSHOT, JSON.stringify(pre, null, 2));
    console.log(`pre-state: captured ${Object.keys(pre).length} probe column(s) -> ${path.relative(process.cwd(), SNAPSHOT)}`);
  }

  // ---- apply (only if still naive) ---------------------------------------
  if (!alreadyConverted) {
    const ddl = readFileSync(path.join(process.cwd(), 'lib/db/migrations/0040_timestamptz_conversion.sql'), 'utf8');
    await db.execute(sql.raw(ddl));
    console.log('migration 0040 applied\n');
  } else {
    console.log('migration 0040 already applied\n');
  }

  // ---- P1: no naive columns remain ---------------------------------------
  const naive = await naiveCount();
  check('P1 every naive column converted (information_schema)', naive === 0, `naive=${naive}`);

  // ---- P2/P3/P4: instant preservation per class --------------------------
  for (const p of PROBES) {
    const key = `${p.table}.${p.col}`;
    const raw = preWall(pre[key] as unknown as Record<string, unknown>);
    if (raw === null) { console.log(`  · ${key}: no pre-sample, skipped`); continue; }
    const post = await sample(p.table, p.col);
    if (post.type !== 'timestamp with time zone') { check(`${key} is timestamptz`, false, post.type); continue; }

    if (p.cls === 'control') {
      check(`P4 ${key} (timestamptz control) unchanged`, post.wall === raw, `${raw} -> ${post.wall}`);
    } else {
      const zone = p.cls === 'app-local' ? 'America/New_York' : 'UTC';
      const expected = await instantOf(raw, zone);
      const label = p.cls === 'app-local' ? 'P2 keeps the app-computed instant' : 'P3 lands on its UTC-wall instant';
      check(`${key} ${label}`, post.wall === expected, `expected ${expected}, got ${post.wall}`);
    }
  }

  // ---- P5/P6: the new read-side surface ----------------------------------
  const [player] = await rows(sql`SELECT username FROM players ORDER BY created_at LIMIT 1`);
  const username = player?.username as string | undefined;
  if (!username) check('P5 getPlayerWmdStatus', false, 'no player to probe');
  else {
    const status = await getPlayerWmdStatus(username);
    const okShape =
      typeof status.onCooldown === 'boolean' &&
      Array.isArray(status.retaliationRights) &&
      typeof status.remainingTime === 'number';
    check(`P5 getPlayerWmdStatus('${username}') returns the documented shape`, okShape, status);

    // P6: seed a right against a real clan and prove it surfaces with its name.
    const [clan] = await rows(sql`SELECT id, name FROM clans ORDER BY id LIMIT 1`);
    if (!clan) console.log('  · P6 skipped: no clan to target');
    else {
      const rightId = generateId();
      await db.execute(sql`
        INSERT INTO wmd_retaliation_rights
          (id, player_id, player_clan_id, can_retaliate_against_clan, granted_at, expires_at, used)
        VALUES (${rightId}, ${username}, ${generateId()}, ${clan.id as string},
                now(), now() + interval '7 days', 0)`);
      const after = await getPlayerWmdStatus(username);
      const hit = after.retaliationRights.find((r) => r.targetClanId === (clan.id as string));
      check('P6 seeded retaliation right surfaces with target clan name',
        !!hit && hit.targetClanName === (clan.name as string) && !!hit.expiresAt,
        hit ?? after.retaliationRights);
      await db.execute(sql`DELETE FROM wmd_retaliation_rights WHERE id = ${rightId}`);
      const residue = await rows(sql`SELECT count(*)::int AS n FROM wmd_retaliation_rights WHERE id = ${rightId}`);
      check('P7 cleanup leaves no residue', Number(residue[0]?.n) === 0);
    }
  }

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
