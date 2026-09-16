/**
 * FID-20260909-033 §4.6 — unit catalog data migration (idempotent).
 *
 * Aligns every players.units entry to the unified catalog:
 *  1. Rows whose unitType matches a UNIT_CONFIGS enum value but whose
 *     strength/defense/name predate the unification (the old 1/10th-scale bot
 *     pools, e.g. T1_SCOUT 8→80) are re-priced from the config — identity is
 *     already canonical, stats are corrected in place.
 *  2. Rows whose unitType matches a config display NAME (e.g. 'Infantry',
 *     'T1_Rifleman'-era legacy names) are re-keyed to the enum value with
 *     blueprint stats.
 *  3. players.total_strength / total_defense are recomputed from the migrated
 *     entries so the power readout stays truthful.
 *
 * Safe to re-run: a second pass is a no-op (all rows already canonical).
 *
 * Run: npx tsx --env-file=.env.local scripts/migrate-unit-catalog.ts
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

interface UnitLike { type: string; name: string; strength: number; defense: number }
type Configs = Record<string, UnitLike>;

// Load UNIT_CONFIGS straight from the TS source (no ts-node needed): the
// object literal is self-contained — enum member references resolve against
// the enum literal in the same file.
function loadConfigs(): Configs {
  const src = fs.readFileSync(path.join(__dirname, '..', 'types', 'game.types.ts'), 'utf8');
  const sf = ts.createSourceFile('game.types.ts', src, ts.ScriptTarget.Latest, true);

  // Pull enum member raw values (e.g. T1_SCOUT -> 'T1_SCOUT', T1_Infantry -> 'INFANTRY').
  const enumValues: Record<string, string> = {};
  for (const st of sf.statements) {
    if (ts.isEnumDeclaration(st) && st.name.text === 'UnitType') {
      for (const m of st.members) {
        if (m.initializer && ts.isStringLiteral(m.initializer)) {
          enumValues[m.name.getText(sf)] = m.initializer.text;
        }
      }
    }
  }

  // Extract the UNIT_CONFIGS literal and evaluate it after rewriting
  // `UnitType.X` refs to their string values.
  let objSrc: string | undefined;
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) {
      const decl = st.declarationList.declarations[0];
      if (ts.isIdentifier(decl.name) && decl.name.text === 'UNIT_CONFIGS' && decl.initializer) {
        objSrc = decl.initializer.getText(sf);
        break;
      }
    }
  }
  if (!objSrc) throw new Error('UNIT_CONFIGS literal not found');

  const evaluated = objSrc
    .replace(/UnitType\.([A-Za-z0-9_]+)/g, (_m, key) => JSON.stringify(enumValues[key] ?? key))
    .replace(/UnitTier\.Tier([1-5])/g, (_m, n) => n);
  // eslint-disable-next-line no-eval -- contained: evaluates the type-checked literal above
  const configs = eval(`(${evaluated})`) as Record<string, UnitLike & { type: string }>;
  return configs;
}

async function main() {
  const configs = loadConfigs();
  const byValue = new Map<string, UnitLike>();
  const byName = new Map<string, UnitLike>();
  // Fallback index: (tier, category) -> candidates, for legacy bot-pool units
  // whose exact identity no longer exists (Ranger, Enforcer, Shield, …).
  // Each maps to the same-tier, same-category config with the closest total
  // power so bot army curves stay on the unified scale.
  const byTierCategory = new Map<string, UnitLike[]>();
  for (const cfg of Object.values(configs)) {
    byValue.set(cfg.type.toUpperCase(), cfg);
    byName.set(cfg.name.toLowerCase(), cfg);
    if (cfg.type.startsWith('T') && cfg.type.length > 1 && /^T[1-5]_/.test(cfg.type)) {
      const tier = cfg.type[1];
      const cat = cfg.strength > 0 ? 'STR' : 'DEF';
      const key = `${tier}:${cat}`;
      if (!byTierCategory.has(key)) byTierCategory.set(key, []);
      byTierCategory.get(key)!.push(cfg);
    }
  }
  const nearestIn = (tier: string, cat: 'STR' | 'DEF', power: number): UnitLike | undefined => {
    const pool = byTierCategory.get(`${tier}:${cat}`);
    if (!pool || pool.length === 0) return undefined;
    return pool.reduce((best, c) =>
      Math.abs(c.strength + c.defense - power) < Math.abs(best.strength + best.defense - power) ? c : best
    );
  };
  console.log(`configs loaded: ${Object.keys(configs).length}`);

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const { rows } = await c.query(
    `SELECT username, units FROM players WHERE units IS NOT NULL AND jsonb_array_length(units) > 0`
  );
  console.log(`players with units: ${rows.length}`);

  let playersTouched = 0;
  let entriesRekeyed = 0;
  let entriesRepriced = 0;

  for (const row of rows) {
    const units = row.units as Array<Record<string, unknown>>;
    let changed = false;

    for (const u of units) {
      const ut = typeof u.unitType === 'string' ? u.unitType : '';
      const name = typeof u.name === 'string' ? u.name : '';
      let target =
        (ut && byValue.get(ut.toUpperCase())) ||
        (name && byName.get(name.toLowerCase())) ||
        undefined;

      // Legacy bot-pool identities (T2_RANGER, T1_SHIELD, …): no direct match.
      // Map to the nearest same-tier, same-category canonical unit.
      if (!target && /^T[1-5]_/.test(ut)) {
        const tier = ut[1];
        const str = Number(u.strength ?? 0);
        const def = Number(u.defense ?? 0);
        target = nearestIn(tier, str >= def ? 'STR' : 'DEF', str + def);
        if (target) {
          console.log(`  ↳ ${row.username}: legacy '${ut}' (${str}/${def}) → '${target.type}'`);
        }
      }

      if (!target) {
        console.warn(`  ! ${row.username}: no config match for unitType='${ut}' name='${name}' — left as-is`);
        continue;
      }
      if (ut === target.type && u.strength === target.strength && u.defense === target.defense && name === target.name) {
        continue; // already canonical
      }
      if (ut !== target.type) { entriesRekeyed++; u.unitType = target.type; }
      if (name !== target.name) { u.name = target.name; }
      if (u.strength !== target.strength || u.defense !== target.defense) { entriesRepriced++; }
      u.strength = target.strength;
      u.defense = target.defense;
      changed = true;
    }

    if (!changed) continue;

    const totalStr = units.reduce((t, u) => t + Number(u.strength ?? 0) * Number(u.quantity ?? 1), 0);
    const totalDef = units.reduce((t, u) => t + Number(u.defense ?? 0) * Number(u.quantity ?? 1), 0);

    await c.query(
      `UPDATE players SET units = $1::jsonb, total_strength = $2, total_defense = $3 WHERE username = $4`,
      [JSON.stringify(units), totalStr, totalDef, row.username]
    );
    playersTouched++;
    console.log(`  ~ ${row.username}: entries=${units.length} str=${totalStr} def=${totalDef}`);
  }

  console.log(`\nDone. players updated: ${playersTouched}, re-keyed: ${entriesRekeyed}, re-priced: ${entriesRepriced}`);
  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
