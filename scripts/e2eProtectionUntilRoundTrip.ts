/**
 * FID-20260916-009 D2 — UTC round-trip probe for protection_until.
 * Writes a known instant, reads it back through node-pg, and reports the
 * delta. Run BEFORE migration (naive column) and AFTER (timestamptz); the
 * delta must be 0 in both states, proving the conversion shifted nothing.
 * One-shot; exits explicitly (ESM + open pg pool keeps the process alive).
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });

import { eq, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { players } from '../lib/db/schema';

const KNOWN = new Date('2026-09-19T12:34:56.789Z');
const USER = `svc9_rt_${Date.now().toString(36)}`;

async function columnType(): Promise<string> {
  const res = (await db.execute(
    sql`SELECT data_type FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'protection_until'`
  )) as unknown as { rows: Array<{ data_type: string }> };
  return res.rows[0]?.data_type ?? '(unknown)';
}

async function main(): Promise<void> {
  const typeBefore = await columnType();
  console.log(`column type: ${typeBefore}`);

  await db.insert(players).values({
    username: USER,
    email: `${USER}@probe.invalid`,
    password: 'x',
    protectionUntil: KNOWN,
    level: 1,
    baseX: 1,
    baseY: 1,
    currentPositionX: 1,
    currentPositionY: 1,
  });

  const [row] = await db
    .select({ protectionUntil: players.protectionUntil })
    .from(players)
    .where(eq(players.username, USER))
    .limit(1);

  const readBack = row?.protectionUntil ?? null;
  const delta = readBack ? readBack.getTime() - KNOWN.getTime() : Number.NaN;
  const ok = delta === 0;
  console.log(`wrote : ${KNOWN.toISOString()}`);
  console.log(`read  : ${readBack instanceof Date ? readBack.toISOString() : String(readBack)}`);
  console.log(`delta : ${delta} ms`);
  console.log(ok ? '✅ round-trip lossless' : '❌ ROUND-TRIP SHIFTED');

  await db.delete(players).where(eq(players.username, USER));
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error('probe failed:', err);
  process.exit(1);
});
