/* FID-006 P5: blueprint efficiency audit + cost rewrite for strictly increasing
 * rarity efficiency. Costs only — STR/DEF untouched (zero combat-math blast radius).
 * Run: node dev/scripts/audit/unit-efficiency.cjs [--apply]
 */
const fs = require('fs');

const APPLY = process.argv.includes('--apply');
const lines = fs.readFileSync('types/units.types.ts', 'utf8').split(/\r?\n/);

const sectionStart = lines.findIndex((l) => l.includes('export const UNIT_BLUEPRINTS'));
if (sectionStart < 0) { console.error('UNIT_BLUEPRINTS not found'); process.exit(1); }
const sectionEnd = (() => { for (let i = sectionStart; i < lines.length; i++) { if (/^\};/.test(lines[i])) return i; } return lines.length; })();

// parse blueprint blocks within the section
const units = [];
let cur = null;
for (let i = sectionStart; i < sectionEnd; i++) {
  const line = lines[i];
  const idMatch = line.match(/^\s{2}'([a-z_]+)': \{/);
  if (idMatch) { cur = { id: idMatch[1], startLine: i, costLines: {}, fields: {} }; continue; }
  if (cur) {
    for (const k of ['strength', 'defense', 'metalCost', 'energyCost']) {
      const m = line.match(new RegExp('^\\s{4}' + k + ': ([0-9]+),'));
      if (m) { cur.fields[k] = Number(m[1]); if (k.endsWith('Cost')) cur.costLines[k] = i; }
    }
    const r = line.match(/^\s{4}rarity: UnitRarity\.(\w+),/);
    if (r) cur.fields.rarity = r[1];
    if (/^\s{2}\},/.test(line)) { units.push(cur); cur = null; }
  }
}

const CLASS = { Common: 1.0, Uncommon: 1.10, Rare: 1.22, Epic: 1.36, Legendary: 1.50 };
const COMMON_EFF = 0.25; // anchor: commons stay untouched (FID-006 §4.3 cited 0.5 STR/metal ≈ 0.25 per metal+energy)
const stat = (u) => u.fields.strength || u.fields.defense || 0;
const cost = (u) => (u.fields.metalCost || 0) + (u.fields.energyCost || 0);
const eff = (u) => stat(u) / cost(u);

console.log('id'.padEnd(14), 'rarity'.padEnd(10), 'stat'.padStart(6), 'cost'.padStart(7), 'eff'.padStart(7), '→ eff'.padStart(8), '→ cost'.padStart(8));
let bad = 0;
const results = [];
for (const u of units) {
  const mult = CLASS[u.fields.rarity] ?? 1.0;
  const total = cost(u);
  if (u.fields.rarity === 'Common' || mult === 1.0) {
    results.push({ ...u, newMetal: u.fields.metalCost, newEnergy: u.fields.energyCost, oldEff: eff(u), newEff: eff(u) });
    console.log(u.id.padEnd(14), (u.fields.rarity || '').padEnd(10), String(stat(u)).padStart(6), String(total).padStart(7), eff(u).toFixed(3).padStart(7), eff(u).toFixed(3).padStart(8), String(total).padStart(8));
    continue;
  }
  const targetEff = COMMON_EFF * mult;      // relative to common baseline (0.275/0.305/0.34/0.375)
  const newTotal = Math.round(stat(u) / targetEff / 10) * 10; // round to 10
  // split proportional to current metal:energy ratio, keep metal = energy where they already match
  let newMetal, newEnergy;
  if (u.fields.metalCost === u.fields.energyCost) { newMetal = newTotal / 2; newEnergy = newTotal / 2; }
  else { newMetal = Math.round((u.fields.metalCost / total) * newTotal / 10) * 10; newEnergy = newTotal - newMetal; }
  const newEff = stat(u) / (newMetal + newEnergy);
  results.push({ ...u, newMetal, newEnergy, oldEff: eff(u), newEff });
  console.log(u.id.padEnd(14), (u.fields.rarity || '').padEnd(10), String(stat(u)).padStart(6), String(total).padStart(7), eff(u).toFixed(3).padStart(7), newEff.toFixed(3).padStart(8), String(newMetal + newEnergy).padStart(8));
}

// verify: within each rarity, every unit's new eff >= class floor and classes strictly increase
const classMin = {};
for (const r of results) { const k = r.fields.rarity; classMin[k] = Math.min(classMin[k] ?? Infinity, r.newEff); }
const order = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].filter((k) => classMin[k] !== undefined);
for (let i = 1; i < order.length; i++) {
  if (classMin[order[i]] <= classMin[order[i - 1]]) { console.error('CLASS ORDER FAIL: ' + order[i] + ' min ' + classMin[order[i]].toFixed(3) + ' <= ' + order[i - 1] + ' min ' + classMin[order[i - 1]].toFixed(3)); bad++; }
}

if (!APPLY) { console.log(bad === 0 ? '\nDRY RUN OK — rerun with --apply to write' : '\nDRY RUN FAILURES: ' + bad); process.exit(bad ? 1 : 0); }

// apply: rewrite the recorded cost-line indexes directly
let changed = 0;
for (const r of results) {
  if (r.newMetal === r.fields.metalCost && r.newEnergy === r.fields.energyCost) continue;
  for (const [k, v] of [['metalCost', r.newMetal], ['energyCost', r.newEnergy]]) {
    const li = r.costLines[k];
    if (li === undefined) continue;
    lines[li] = lines[li].replace(new RegExp(k + ': [0-9]+,'), k + ': ' + v + ',');
    changed++;
  }
}
fs.writeFileSync('types/units.types.ts', lines.join('\n'));
console.log('applied: ' + changed + ' cost lines rewritten');
