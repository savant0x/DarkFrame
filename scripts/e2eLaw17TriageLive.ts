/**
 * FID-20260919-017 — LIVE verification driver for the Law-17 ticket triage.
 * Runs against the real dev DB (DATABASE_URL from .env.local).
 *
 * Probes:
 *   P1  the five removed tables are gone
 *   P2  the three repaired writers accept a generateId() PK (width fits) — the
 *       exact inserts that used to overflow varchar(24) and silently fail
 *   P3  every reader returns the planted row, owner-scoped
 *   P4  cleanup leaves no residue
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { generateId } from '../lib/utils';
import {
  getPlayerIntelligenceReports,
  getPlayerCounterIntelHistory,
} from '../lib/wmd/spyService';
import { getDefenderInterceptions } from '../lib/wmd/defenseService';

const PROBE = 'zprobe17';
const REMOVED = ['achievements', 'wmd_votes', 'wmd_consequence_events', 'wmd_resource_pools', 'wmd_defense_grids'];

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>): Promise<Row[]> =>
  ((await db.execute(q)) as unknown as { rows: Row[] }).rows;

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`, detail ?? ''); }
}

const spyId = `spy_${Date.now()}`;
const codename = `Probe17_${Date.now()}`;
const missionId = generateId();
const reportId = generateId();
const ciId = generateId();
const intId = generateId();

async function main(): Promise<void> {
  console.log('FID-20260919-017 triage live probe\n');

  // P1 — removals.
  for (const t of REMOVED) {
    const r = await rows(sql`SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema='public' AND table_name=${t}`);
    check(`P1 ${t} retired`, Number(r[0]?.n ?? 0) === 0, r);
  }

  // P2 — the three repaired writers accept a generateId PK.
  let ok = true, detail: unknown = null;
  try {
    await db.execute(sql`INSERT INTO wmd_spies
      (id, spy_id, owner_id, owner_username, codename, rank, experience, specialization, status, recruited_at, created_at, updated_at)
      VALUES (${generateId()}, ${spyId}, ${PROBE}, ${PROBE}, ${codename}, 'ROOKIE', 0, 'SURVEILLANCE', 'AVAILABLE', now(), now(), now())`);
    await db.execute(sql`INSERT INTO wmd_spy_missions
      (id, sender_clan_id, target_clan_id, spy_id, spy_name, target_name, mission_type, status, created_at, updated_at)
      VALUES (${missionId}, ${PROBE}, ${PROBE}, ${spyId}, ${codename}, 'target', 'SURVEILLANCE', 'COMPLETED', now(), now())`);
    await db.execute(sql`INSERT INTO wmd_intelligence_reports
      (id, report_id, classification, gathered_by, gathered_from, gathered_at, mission_id, target_id, target_username, expires_at, created_at)
      VALUES (${reportId}, ${'rep_' + Date.now()}, 'SECRET', ${codename}, 'target', now(), ${missionId}, 'target', 'target', now() + interval '1 day', now())`);
    await db.execute(sql`INSERT INTO wmd_counter_intel_operations
      (id, operation_id, operator_id, target_area, spies_detected, executed_at, created_at)
      VALUES (${ciId}, ${'op_' + Date.now()}, ${PROBE}, 'ALL', 0, now(), now())`);
    await db.execute(sql`INSERT INTO wmd_interceptions
      (id, interception_id, missile_id, defender_id, battery_id, result, timestamp)
      VALUES (${intId}, ${'int_' + Date.now()}, 'probe-missile', ${PROBE}, 'probe-battery', 'SUCCESS', now())`);
  } catch (e) { ok = false; detail = e instanceof Error ? e.message : e; }
  check('P2 all three repaired writers accept a generateId() PK', ok, detail);

  // P3 — readers return the planted rows, owner-scoped.
  const reports = await getPlayerIntelligenceReports(PROBE);
  check('P3a getPlayerIntelligenceReports returns the planted report', reports.some((r) => r.id === reportId), reports.length);
  const ci = await getPlayerCounterIntelHistory(PROBE);
  check('P3b getPlayerCounterIntelHistory returns the planted sweep', ci.some((r) => r.id === ciId), ci.length);
  const ints = await getDefenderInterceptions(PROBE);
  check('P3c getDefenderInterceptions returns the planted interception', ints.some((r) => r.id === intId), ints.length);
  const other = await getDefenderInterceptions('nobody-should-match');
  check('P3d the readers are owner-scoped (no cross-player leak)', other.length === 0, other.length);

  // P4 — cleanup.
  await db.execute(sql`DELETE FROM wmd_intelligence_reports WHERE id=${reportId}`);
  await db.execute(sql`DELETE FROM wmd_counter_intel_operations WHERE id=${ciId}`);
  await db.execute(sql`DELETE FROM wmd_interceptions WHERE id=${intId}`);
  await db.execute(sql`DELETE FROM wmd_spy_missions WHERE id=${missionId}`);
  await db.execute(sql`DELETE FROM wmd_spies WHERE spy_id=${spyId}`);
  const residue = await rows(sql`SELECT count(*)::int AS n FROM wmd_spies WHERE owner_id=${PROBE}`);
  check('P4 probe cleanup left no residue', Number(residue[0]?.n ?? 0) === 0, residue);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => { console.error('probe crashed:', err); process.exit(1); });
