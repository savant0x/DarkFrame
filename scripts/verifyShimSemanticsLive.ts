/**
 * FID-20260914-004 live seam verification against the real postgres engine via
 * the REAL compat seam (`getCollection`), exercised through the running dev
 * server's shared database:
 *
 *  1. Honest counts: $set on a matching row → 1; on a non-matching filter → 0
 *     (previously a fictional 1); $inc fragment → 1; deleteMany → real count.
 *  2. $pull jsonb_agg rewrite: unit-listing-shaped object operand removed from
 *     `players.units` (the exact live scenario FID-003 routed around).
 *  3. $addToSet containment guard: absent tier appends, present tier does not
 *     duplicate (tierUnlockService's live shape on `unlocked_tiers`).
 *
 * All writes are scoped to one scratch player created via the real register
 * route and deleted at the end (cleanup guarded by row-count assertion).
 * Run: npx tsx -r dotenv/config scripts/verifyShimSemanticsLive.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase, getCollection } from '@/lib/mongodb';

interface PlayerRow {
  username: string;
  units?: Array<{ unitId?: string; type?: string; strength?: number }>;
  unlockedTiers?: number[];
}

async function main(): Promise<void> {
  const db = await connectToDatabase();
  const suffix = Date.now().toString().slice(-7);
  const username = `e2eShim${suffix}`;
  const password = 'E2eShim4!Probe99';
  const BASE = 'http://localhost:3002';

  // ── Mint the scratch player through the real register route ─────────────
  const reg = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email: `e2e-shim-${suffix}@test.local`, password }),
  });
  const regJson = (await reg.json()) as { success?: boolean };
  if (!reg.ok || regJson.success !== true) {
    console.log(`LIVE FAIL: register → ${reg.status} ${JSON.stringify(regJson).slice(0, 200)}`);
    process.exit(1);
  }
  console.log(`LIVE: scratch player ${username} registered`);

  const players = getCollection<PlayerRow>('players');
  let failures = 0;
  const check = (label: string, ok: boolean, detail: unknown): void => {
    console.log(`LIVE ${ok ? 'PASS' : 'FAIL'}: ${label}${ok ? '' : ` → ${JSON.stringify(detail)}`}`);
    if (!ok) failures += 1;
  };

  try {
    // ── 1a. Honest count: $set matching row → 1 ───────────────────────────
    const setHit = await players.updateOne(
      { username },
      { $set: { resourcesMetal: 123 } }
    );
    check('$set on matching row → modifiedCount 1', setHit.modifiedCount === 1, setHit);

    // ── 1b. Honest count: non-matching filter → 0 (was fictional 1) ───────
    const setMiss = await players.updateOne(
      { username: `${username}-ghost` },
      { $set: { resourcesMetal: 1 } }
    );
    check(
      '$set on non-matching filter → modifiedCount 0 (honest failure)',
      setMiss.modifiedCount === 0,
      setMiss
    );

    // ── 1c. SQL-fragment payload ($inc) counts honestly ───────────────────
    const inc = await players.updateOne({ username }, { $inc: { resourcesMetal: 5 } });
    check('$inc fragment → modifiedCount 1', inc.modifiedCount === 1, inc);

    // ── 2. $pull jsonb_agg rewrite over players.units (live scenario) ─────
    const unit = { unitId: 'U-E2E-1', type: 'infantry', strength: 10 };
    await players.updateOne({ username }, { $push: { units: unit } });
    const pushed = await players.findOne({ username });
    check('unit pushed into units[]', (pushed?.units ?? []).length === 1, pushed?.units);
    const pulled = await players.updateOne({ username }, { $pull: { units: unit } });
    check('$pull (object operand) → modifiedCount 1', pulled.modifiedCount === 1, pulled);
    const afterPull = await players.findOne({ username });
    check(
      '$pull removed exactly the matching unit (jsonb_agg deep equality)',
      (afterPull?.units ?? []).length === 0,
      afterPull?.units
    );

    // ── 3. $addToSet containment guard on unlockedTiers ───────────────────
    await players.updateOne({ username }, { $set: { unlockedTiers: [1, 2] } });
    const addAbsent = await players.updateOne(
      { username },
      { $addToSet: { unlockedTiers: 3 } }
    );
    check('$addToSet absent tier → modifiedCount 1', addAbsent.modifiedCount === 1, addAbsent);
    const afterAdd = await players.findOne({ username });
    check('tier 3 appended', JSON.stringify(afterAdd?.unlockedTiers) === '[1,2,3]', afterAdd?.unlockedTiers);
    const addPresent = await players.updateOne(
      { username },
      { $addToSet: { unlockedTiers: 3 } }
    );
    const afterDup = await players.findOne({ username });
    check(
      '$addToSet present tier → array unchanged (no duplicate)',
      JSON.stringify(afterDup?.unlockedTiers) === '[1,2,3]',
      { result: addPresent, tiers: afterDup?.unlockedTiers }
    );

    // ── 4. deleteMany honest count ────────────────────────────────────────
    // (Second scratch player so the delete is non-trivial but still scoped.)
    const second = `${username}b`;
    await fetch(`${BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: second, email: `e2e-shim-${suffix}b@test.local`, password }),
    });
    const del = await players.deleteMany({ username: { $in: [username, second] } });
    check('deleteMany → real deletedCount 2', del.deletedCount === 2, del);
  } finally {
    // ── Cleanup (guarded) ──────────────────────────────────────────────────
    const residual = await db.execute(
      sql`SELECT count(*)::int AS n FROM players WHERE username LIKE 'e2eShim%'`
    );
    const n = Number((residual.rows as Array<{ n: number }>)[0]?.n ?? 0);
    if (n > 0 && n <= 5) {
      await db.execute(sql`DELETE FROM player_notifications WHERE player_id LIKE 'e2eShim%'`);
      const del = await db.execute(sql`DELETE FROM players WHERE username LIKE 'e2eShim%'`);
      console.log(`LIVE cleanup: ${del.rowCount ?? 0} scratch player(s) removed`);
    } else {
      console.log(`LIVE cleanup SKIPPED (matched ${n} rows — outside expected 1-5)`);
    }
  }

  console.log(failures === 0 ? 'LIVE VERDICT: ALL SEAM SEMANTICS VERIFIED' : `LIVE VERDICT: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main().catch((err) => {
  console.log('LIVE crashed:', err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
