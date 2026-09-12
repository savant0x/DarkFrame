/**
 * FID-20260911-051 — live rate probe.
 *
 * Phase A: snapshot pg_stat_statements call counts for the residual furnace
 *          fingerprints (tutorial x2, flags, flag_trail, user_presence, tiles).
 * Phase B: 60s of pg_stat_activity sampling — which of them execute LIVE.
 * Phase C: (invoked again later with --final) re-read counts; the script
 *          persists the snapshot in /tmp/fid51-snapshot.json and prints the
 *          delta → true calls/hour, which settles "stale tab vs live leak".
 */
import { Client } from 'pg';
import { config } from 'dotenv';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

config({ path: '.env.local' });

const FINAL = process.argv.includes('--final');
const SNAPSHOT = '/tmp/fid51-snapshot.json';

const FINGERPRINTS: Array<[string, string]> = [
  ['tutorial_action_tracking', `query LIKE '%from "tutorial_action_tracking"%'`],
  ['tutorial_progress', `query LIKE '%from "tutorial_progress"%'`],
  ['flags_limit1', `query LIKE '%from "flags" limit%'`],
  ['flag_trail', `query LIKE '%from "flag_trail"%'`],
  ['user_presence', `query LIKE '%from "user_presence"%'`],
  ['tiles_xy', `query LIKE '%from "tiles" where ("tiles"."x"%'`],
];

async function counts(c: Client): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const [name, cond] of FINGERPRINTS) {
    const r = await c.query(
      `SELECT COALESCE(SUM(calls),0)::bigint AS n FROM pg_stat_statements WHERE ${cond}`,
    );
    out[name] = Number(r.rows[0].n);
  }
  return out;
}

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  if (!FINAL) {
    // ---- Phase A: snapshot ----
    const snap = { at: Date.now(), counts: await counts(c) };
    writeFileSync(SNAPSHOT, JSON.stringify(snap));
    console.log('SNAPSHOT @', new Date(snap.at).toLocaleTimeString());
    for (const [k, v] of Object.entries(snap.counts)) console.log(`  ${k}: ${v}`);

    // ---- Phase B: 60s live-activity sampler ----
    console.log('\nLIVE ACTIVITY (60s sampling, 2s interval) — only matching queries shown:');
    const seen = new Map<string, number>();
    const end = Date.now() + 60_000;
    while (Date.now() < end) {
      const r = await c.query(
        `SELECT query FROM pg_stat_activity
          WHERE state = 'active' AND query NOT LIKE '%pg_stat_activity%'`,
      );
      for (const row of r.rows) {
        for (const [name] of FINGERPRINTS) {
          // emulate the LIKE on the client for counting by fingerprint name
          const q = row.query as string;
          const matches =
            (name === 'tutorial_action_tracking' && q.includes('from "tutorial_action_tracking"')) ||
            (name === 'tutorial_progress' && q.includes('from "tutorial_progress"')) ||
            (name === 'flags_limit1' && q.includes('from "flags" limit')) ||
            (name === 'flag_trail' && q.includes('from "flag_trail"')) ||
            (name === 'user_presence' && q.includes('from "user_presence"')) ||
            (name === 'tiles_xy' && q.includes('from "tiles" where ("tiles"."x"'));
          if (matches) seen.set(name, (seen.get(name) ?? 0) + 1);
        }
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    if (seen.size === 0) console.log('  (none — zero live executions of any fingerprint in 60s)');
    else for (const [k, v] of seen) console.log(`  ${k}: ${v} executions observed`);
  } else {
    // ---- Phase C: final delta ----
    if (!existsSync(SNAPSHOT)) {
      console.error('no snapshot found — run without --final first');
      process.exit(1);
    }
    const prev = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
    const now = { at: Date.now(), counts: await counts(c) };
    const hours = (now.at - prev.at) / 3_600_000;
    console.log(`delta over ${((now.at - prev.at) / 60_000).toFixed(1)} min:`);
    for (const k of Object.keys(now.counts)) {
      const d = now.counts[k] - prev.counts[k];
      const perH = d / hours;
      console.log(`  ${k}: +${d}  (~${perH.toFixed(0)}/hour)`);
    }
  }
  await c.end();
}

main().catch(e => { console.error('probe failed:', e.message); process.exit(1); });
