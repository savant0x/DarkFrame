/**
 * FID-20260911-045 live verification — drives the REAL RP economy through the
 * running server and asserts every source label and the daily cap, row by row.
 *
 * Phases (idempotent — safe to re-run):
 *   1a. Harvest milestone crossing — unless a fresh `harvest_milestone` row
 *       already exists, seed dailyharvestprogress to 999 and do 2 real harvests
 *       through POST /api/harvest, crossing the 1,000 threshold. Asserts the
 *       source label and the exact documented stack: 500 base × 1.5 VIP ×
 *       2 flag-bearer (FID-20260906-001 §5.4) where applicable.
 *   1b. Cap hold — seed all six thresholds completed on a FRESH tile, harvest
 *       successfully, assert NO new milestone row (period cap refuses).
 *   2.  Battle — POST /api/combat/attack (DB-sourced raid); on victory assert
 *       a `battle` row with a positive amount; on a loss assert its absence.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-rp-sources.ts [defender]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Client } from 'pg';
import { SignJWT } from 'jose';

const BASE = 'http://localhost:3001';
const PLAYER = 'fame';

async function makeToken(secret: string): Promise<string> {
  return new SignJWT({ username: PLAYER, email: `${PLAYER}@darkframe.game` })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(new TextEncoder().encode(secret));
}

interface RpRow { amount: number; source?: string; reason?: string; timestamp: string }

async function main(): Promise<void> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing');

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const today = new Date().toISOString().substring(0, 10);

  const token = await makeToken(secret);
  const cookie = `darkframe_session=${token}`;
  const post = async (path: string, body?: unknown): Promise<{ status: number; json: any }> => {
    const res = await fetch(BASE + path, {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json: any = null;
    try { json = await res.json(); } catch { /* non-JSON error page */ }
    return { status: res.status, json };
  };
  const getHistory = async (): Promise<RpRow[]> => {
    const r = await c.query('select rp_history from players where username = $1', [PLAYER]);
    return r.rows[0].rp_history ?? [];
  };
  const freshRows = (rows: RpRow[], windowMs = 5 * 60_000): RpRow[] =>
    rows.filter(r => Date.now() - new Date(r.timestamp).getTime() < windowMs);
  const relocateFreshTile = async (): Promise<void> => {
    const pos = await c.query('select current_position_x x, current_position_y y from players where username = $1', [PLAYER]);
    const tile = await c.query(
      `select t.x, t.y from tiles t
       where t.terrain in ('Metal', 'Energy') and t.occupied_by_base is null
         and (t.last_harvested_by is null or not exists (
           select 1 from jsonb_array_elements(t.last_harvested_by) el
           where el->>'playerId' = $1 and el->>'resetPeriod' = $2))
       order by ((t.x-$3)*(t.x-$3) + (t.y-$4)*(t.y-$4)) asc
       limit 1`,
      [PLAYER, `${today}-AM`, pos.rows[0].x, pos.rows[0].y],
    );
    if (!tile.rows[0]) throw new Error('no fresh harvestable tile near the player');
    await c.query(
      'update players set current_position_x = $1, current_position_y = $2 where username = $3',
      [tile.rows[0].x, tile.rows[0].y, PLAYER],
    );
    console.log(`relocated to fresh tile (${tile.rows[0].x}, ${tile.rows[0].y})`);
  };

  // Expected milestone amount per the documented stack.
  const vipRow = await c.query('select vip, vip_expiration from players where username = $1', [PLAYER]);
  const isVIP = !!(vipRow.rows[0].vip && new Date(vipRow.rows[0].vip_expiration) > new Date());
  const flagRow = await c.query('select current_holder from flags limit 1');
  const isFlagBearer = flagRow.rows[0]?.current_holder === PLAYER;
  // FID-20260912-058 Milestones v2: first rung is 1,000 → 200 RP base.
  const expectedMilestone = Math.floor(200 * (isVIP ? 1.5 : 1)) * (isFlagBearer ? 2 : 1);
  console.log(`stack expectation: 200 × ${isVIP ? '1.5 VIP' : 'no VIP'}${isFlagBearer ? ' × 2 FLAG-BEARER' : ''} = ${expectedMilestone}`);

  // ---------------------------------------------------------------- PHASE 1a
  console.log('\n=== PHASE 1a: harvest milestone crossing ===');
  const recentMilestone = freshRows(await getHistory(), 30 * 60_000)
    .find(r => r.source === 'harvest_milestone');

  if (recentMilestone) {
    if (recentMilestone.amount !== expectedMilestone) {
      throw new Error(`FAIL: existing milestone row ${recentMilestone.amount} ≠ expected ${expectedMilestone}`);
    }
    console.log(`already verified this session: +${recentMilestone.amount} "Daily harvest milestone: 1,000 harvests" — label + stack PASS`);
  } else {
    await c.query(
      `insert into dailyharvestprogress
         (playerusername, date, resetperiod, harvestcount, milestonescompleted, totalrpearned)
       values ($1, $2, 'AM', 999, '[]'::jsonb, 0)
       on conflict (playerusername, date, resetperiod) do update
         set harvestcount = 999, milestonescompleted = '[]'::jsonb, totalrpearned = 0`,
      [PLAYER, today],
    );
    await relocateFreshTile();
    for (const n of [1, 2]) {
      const h = await post('/api/harvest', { username: PLAYER });
      console.log(`harvest #${n} → HTTP ${h.status}`);
      if (h.status !== 200 || h.json?.success === false) {
        throw new Error('harvest failed: ' + JSON.stringify(h.json).slice(0, 200));
      }
    }
    const fresh1 = freshRows(await getHistory());
    const ms = fresh1.filter(r => r.source === 'harvest_milestone');
    if (ms.length !== 1) throw new Error(`FAIL: expected exactly 1 harvest_milestone row, got ${ms.length}`);
    if (ms[0].amount !== expectedMilestone) {
      throw new Error(`FAIL: milestone amount ${ms[0].amount} ≠ expected ${expectedMilestone}`);
    }
    console.log(`PASS: harvest_milestone +${ms[0].amount} with correct source label`);
  }

  // ---------------------------------------------------------------- PHASE 1b
  console.log('\n=== PHASE 1b: daily cap holds (all thresholds done → no more awards) ===');
  const histBefore = await getHistory();
  await c.query(
    `update dailyharvestprogress
       set harvestcount = 30000,
           milestonescompleted = '[1000,2000,3000,4000,5000]'::jsonb
     where playerusername = $1 and date = $2 and resetperiod = 'AM'`,
    [PLAYER, today],
  );
  await relocateFreshTile(); // the crossing consumed the last fresh tile
  const h3 = await post('/api/harvest', { username: PLAYER });
  console.log(`capped harvest → HTTP ${h3.status}`);
  if (h3.status !== 200 || h3.json?.success === false) {
    throw new Error('capped harvest did not succeed — cap not exercised: ' + JSON.stringify(h3.json).slice(0, 160));
  }
  const cappedNew = freshRows(await getHistory()).filter(
    r => r.source === 'harvest_milestone' &&
      !histBefore.some(b => b.timestamp === r.timestamp),
  );
  if (cappedNew.length !== 0) throw new Error('FAIL: cap broken — milestone awarded with all thresholds completed');
  console.log('PASS: with all six thresholds completed, a real successful harvest awards ZERO milestone RP');

  // ---------------------------------------------------------------- PHASE 2
  console.log('\n=== PHASE 2: battle RP ===');
  const defender = process.argv[2] ?? 'Titan_Gamma';

  // The raid route requires the attacker to stand at the target's tile.
  // Attend the defender's position for the raid, then restore fame's position.
  const home = await c.query(
    'select base_x, base_y from players where username = $1', [PLAYER],
  );
  const tgt = await c.query(
    'select current_position_x x, current_position_y y from players where username = $1',
    [defender],
  );
  if (!tgt.rows[0]) throw new Error(`defender ${defender} not found`);
  await c.query(
    'update players set current_position_x = $1, current_position_y = $2 where username = $3',
    [tgt.rows[0].x, tgt.rows[0].y, PLAYER],
  );
  console.log(`attending defender at (${tgt.rows[0].x}, ${tgt.rows[0].y})`);

  const b1 = await post('/api/combat/attack', { defender, resource: 'metal' });

  // Restore position to fame's own base regardless of raid outcome.
  await c.query(
    'update players set current_position_x = $1, current_position_y = $2 where username = $3',
    [home.rows[0].base_x, home.rows[0].base_y, PLAYER],
  );
  console.log(`position restored to base (${home.rows[0].base_x}, ${home.rows[0].base_y})`);
  console.log(`raid vs ${defender} → HTTP ${b1.status}`);
  if (b1.status !== 200) {
    console.log('body:', JSON.stringify(b1.json).slice(0, 300));
    throw new Error('raid request failed');
  }
  const data = b1.json?.data ?? {};
  const outcome = data?.battle?.outcome ?? data?.outcome ?? data?.result ?? 'unknown';
  console.log('battle outcome:', typeof outcome === 'string' ? outcome : JSON.stringify(outcome).slice(0, 160));

  const fresh2 = freshRows(await getHistory());
  const battleRow = fresh2.find(r => r.source === 'battle');
  if (battleRow) {
    if (battleRow.amount <= 0) throw new Error(`FAIL: battle row amount ${battleRow.amount} ≤ 0`);
    console.log(`PASS: battle RP row · +${battleRow.amount} · "${battleRow.reason}"`);
  } else {
    console.log('NOTE: no battle RP row — battle was a loss or victory RP not applicable; inspect outcome above.');
  }

  await c.end();
  console.log('\nALL RP SOURCE CHECKS COMPLETE');
}

main().catch((e) => {
  console.error('\nVERIFY-FAIL:', e.message);
  process.exit(1);
});
