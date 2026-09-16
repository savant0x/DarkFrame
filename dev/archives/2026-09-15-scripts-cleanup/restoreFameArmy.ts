/**
 * FID-20260915-001 Phase 4 — restore fame's army from the battle-log snapshot.
 *
 * BATTLE-1789450926316-w6eb25 preserved the exact pre-battle attacker army as
 * 10,725 per-unit Unit entries. This script folds them back to the canonical
 * quantity-folded PlayerUnit column shape (the shape build-unit writes,
 * FID-20260914-004 note), verifies the recomputed totals against the snapshot,
 * and restores ONLY if the player's army is still empty (no double-restore).
 *
 * Guards:
 *   - aborts unless the snapshot folds to > 0 units and the STR total matches
 *     the battle row's attacker_total_str (1,072,500);
 *   - aborts unless players.units is currently empty (army already restored /
 *     player rebuilt → refuse to overwrite);
 *   - writes units + totalStrength/totalDefense in ONE update (RETURNING-verified).
 *
 * Run: npx tsx -r dotenv/config scripts/restoreFameArmy.ts dotenv_config_path=.env.local
 */
import { sql } from 'drizzle-orm';
import { connectToDatabase } from '@/lib/mongodb';

const BATTLE_ID = 'BATTLE-1789450926316-w6eb25';
const PLAYER = 'fame';
const EXPECTED_STR = 1072500;
const EXPECTED_UNITS = 10725;

interface SnapshotUnit {
  type?: string;
  strength?: number;
  defense?: number;
  producedDate?: string;
  rarity?: string;
}

async function main(): Promise<void> {
  const db = await connectToDatabase();

  // 1. Pull the snapshot + battle row sanity.
  const row = await db.execute(sql`
    SELECT attacker_units, attacker_total_str, attacker_total_def, attacker_username
    FROM battle_logs WHERE battle_id = ${BATTLE_ID}`);
  const battle = (row.rows as Array<{
    attacker_units: SnapshotUnit[];
    attacker_total_str: number;
    attacker_total_def: number;
    attacker_username: string;
  }>)[0];
  if (!battle) {
    console.log(`RESTORE FAIL: battle ${BATTLE_ID} not found`);
    process.exit(1);
  }
  if (battle.attacker_username !== PLAYER) {
    console.log(`RESTORE FAIL: attacker_username = ${battle.attacker_username}, expected ${PLAYER}`);
    process.exit(1);
  }
  const snap = battle.attacker_units ?? [];
  console.log(`snapshot entries: ${snap.length}`);

  // 2. Fold per-unit entries → quantity-folded PlayerUnit rows keyed by
  //    (unitType, strength, defense). Name/rarity fall back to the entry's
  //    values; id/unitId are deterministic per group (stable, unique).
  const groups = new Map<
    string,
    { unitType: string; strength: number; defense: number; quantity: number; producedDate: string | null; rarity: string }
  >();
  for (const u of snap) {
    const unitType = String(u.type ?? 'INFANTRY').toUpperCase();
    const strength = Number(u.strength ?? 0);
    const defense = Number(u.defense ?? 0);
    const key = `${unitType}|${strength}|${defense}`;
    const g = groups.get(key);
    if (g) g.quantity += 1;
    else
      groups.set(key, {
        unitType,
        strength,
        defense,
        quantity: 1,
        producedDate: u.producedDate ?? null,
        rarity: u.rarity ?? 'common',
      });
  }
  const totalUnits = [...groups.values()].reduce((s, g) => s + g.quantity, 0);
  const totalSTR = [...groups.values()].reduce((s, g) => s + g.strength * g.quantity, 0);
  const totalDEF = [...groups.values()].reduce((s, g) => s + g.defense * g.quantity, 0);
  console.log(`folded: ${groups.size} groups, ${totalUnits} units, STR ${totalSTR}, DEF ${totalDEF}`);

  if (totalUnits === 0 || totalUnits !== EXPECTED_UNITS || totalSTR !== EXPECTED_STR) {
    console.log(`RESTORE FAIL: fold mismatch — units ${totalUnits}/${EXPECTED_UNITS}, STR ${totalSTR}/${EXPECTED_STR}`);
    process.exit(1);
  }

  const playerUnits = [...groups.values()].map((g, i) => ({
    id: `${PLAYER}-restore-${BATTLE_ID.slice(-4)}-${i}`,
    unitId: `${PLAYER}-restore-${BATTLE_ID.slice(-4)}-${i}`,
    unitType: g.unitType,
    name: g.unitType,
    category: g.defense > 0 && g.strength === 0 ? 'DEF' : 'STR',
    rarity: g.rarity,
    strength: g.strength,
    defense: g.defense,
    quantity: g.quantity,
    ...(g.producedDate ? { createdAt: g.producedDate } : { createdAt: new Date().toISOString() }),
  }));

  // 3. Guard: only restore into an EMPTY army.
  const cur = await db.execute(sql`
    SELECT jsonb_array_length(COALESCE(units, '[]'::jsonb)) AS n,
           total_strength, total_defense
    FROM players WHERE username = ${PLAYER}`);
  const c = (cur.rows as Array<{ n: number; total_strength: number; total_defense: number }>)[0];
  if (!c) {
    console.log(`RESTORE FAIL: player ${PLAYER} not found`);
    process.exit(1);
  }
  if (Number(c.n) !== 0) {
    console.log(`RESTORE ABORT: ${PLAYER} already holds ${c.n} unit entries (STR ${c.total_strength}) — refusing to overwrite`);
    process.exit(1);
  }

  // 4. Restore in one update, verified.
  const upd = await db.execute(sql`
    UPDATE players
    SET units = ${JSON.stringify(playerUnits)}::jsonb,
        total_strength = ${totalSTR},
        total_defense = ${totalDEF}
    WHERE username = ${PLAYER} AND jsonb_array_length(COALESCE(units, '[]'::jsonb)) = 0
    RETURNING jsonb_array_length(units) AS entries, total_strength, total_defense`);
  const u = (upd.rows as Array<{ entries: number; total_strength: number; total_defense: number }>)[0];
  if (!u || Number(u.entries) !== groups.size || Number(u.total_strength) !== totalSTR) {
    console.log(`RESTORE FAIL: post-check mismatch → ${JSON.stringify(u ?? null)}`);
    process.exit(1);
  }
  console.log(`RESTORE ✓ ${PLAYER}: ${groups.size} folded entries / ${totalUnits} units / STR ${u.total_strength} / DEF ${u.total_defense}`);
  process.exit(0);
}

main().catch((e) => {
  console.log('RESTORE FAIL: unhandled error →', String(e).slice(0, 400));
  process.exit(1);
});
