/**
 * FID-20260909-032 §5-G live-data repair — flatten the `{$each: [...]}` junk
 * blob(s) in players.units (written verbatim by the pre-fix seam path) into
 * proper PlayerUnit entries, deduplicated, preserving all real entries.
 *
 * Read-modify-write per affected row, only rows whose units text contains
 * the blob key. Run: npx tsx --env-file=.env.local scripts/repair-units-each-blob.ts
 */
import { Client } from 'pg';

interface RawUnit {
  id?: string;
  unitId?: string;
  unitType?: string;
  name?: string;
  type?: string;
  category?: string;
  rarity?: string;
  strength?: number;
  defense?: number;
  quantity?: number;
  createdAt?: string;
  producedDate?: string;
  owner?: string;
  [k: string]: unknown;
}

/** Normalize any unit entry (real or blob-embedded) into the PlayerUnit shape
 *  the domain type declares (id, unitId, unitType, name, category, rarity,
 *  strength, defense, quantity, createdAt). */
function normalize(u: RawUnit, idx: number): Record<string, unknown> {
  const name = u.name ?? (u.type as string) ?? 'Unknown';
  const unitType = u.unitType ?? u.type ?? name;
  const isDef = String(u.category ?? '').toUpperCase().startsWith('DEF') ||
    (typeof u.defense === 'number' && u.defense > 0 && !u.strength);
  const createdAt = u.createdAt ?? u.producedDate ?? new Date().toISOString();
  return {
    id: u.id ?? `${u.unitId ?? unitType}-${idx}-${Date.now()}`,
    unitId: u.unitId ?? unitType,
    unitType,
    name,
    category: isDef ? 'DEF' : 'STR',
    rarity: u.rarity ?? 'common',
    strength: u.strength ?? 0,
    defense: u.defense ?? 0,
    quantity: u.quantity ?? 1,
    createdAt,
  };
}

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const broken = await c.query(
    `SELECT username, units FROM players WHERE units::text LIKE '%"\\$each"%'`
  );
  console.log(`rows to repair: ${broken.rows.length}`);

  for (const row of broken.rows) {
    const units: RawUnit[] = row.units ?? [];
    const flattened: RawUnit[] = [];
    for (const u of units) {
      if (u && typeof u === 'object' && Array.isArray((u as { $each?: unknown }).$each)) {
        flattened.push(...((u as { $each: RawUnit[] }).$each));
      } else {
        flattened.push(u);
      }
    }

    // Dedupe: group by (unitType, createdAt-second, strength, defense) and
    // fold quantity — the builds were per-unit entries sharing one timestamp.
    const groups = new Map<string, Record<string, unknown>>();
    let idx = 0;
    for (const raw of flattened) {
      const n = normalize(raw, idx++);
      const second = String(n.createdAt).slice(0, 19);
      const key = `${n.unitType}|${second}|${n.strength}|${n.defense}`;
      const existing = groups.get(key);
      if (existing) {
        existing.quantity = (existing.quantity as number) + (n.quantity as number);
      } else {
        groups.set(key, n);
      }
    }

    const repaired = [...groups.values()];
    await c.query(`UPDATE players SET units = $1::jsonb WHERE username = $2`, [
      JSON.stringify(repaired),
      row.username,
    ]);
    console.log(
      `${row.username}: ${units.length} entries (1 blob of ${flattened.length}) -> ${repaired.length} clean entries`
    );
  }

  await c.end();
  console.log('UNITS-REPAIR-OK');
})().catch((e: Error) => {
  console.error('REPAIR FAILED:', e.message);
  process.exit(1);
});
