/* FID-20260906-006 §3.1: balance-constant census.
 * Extracts every game-economy constant with file:line AND its numeric value into
 * dev/audit/balance-2026-09-06.json — the single evidence source for proposals.
 *
 * Fix over pass-1: String.match with /g discards capture groups (value was always
 * null). Now uses matchAll per line. Pass-2: real file targets + verbatim block
 * extraction of the authoritative constant tables.
 */
const fs = require('fs');

const findings = [];
const NL = /\r?\n/;

function scan(file, patterns) {
  let src;
  try { src = fs.readFileSync(file, 'utf8'); } catch { return; }
  const lines = src.split(NL);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    for (const { re, label, area } of patterns) {
      for (const m of trimmed.matchAll(re)) {
        findings.push({
          area,
          label,
          file,
          line: i + 1,
          value: m[1] !== undefined ? Number(String(m[1]).replace(/_/g, '')) : null,
          text: trimmed.slice(0, 180),
        });
      }
    }
  });
}

const NUM = String.raw`[\d_]+(?:\.\d+)?`;

const P = {
  harvest: [
    { area: 'harvest', label: 'base-amount', re: new RegExp('(MIN_AMOUNT|MAX_AMOUNT|CAVE_DROP_RATE)\\s*[:=]\\s*(' + NUM + ')', 'g') },
  ],
  units: [
    { area: 'units', label: 'unit-cost', re: new RegExp('(UNIT_COST_\\w+)\\s*=\\s*(' + NUM + ')', 'g') },
  ],
  xp: [
    { area: 'xp', label: 'xp-constant', re: new RegExp('(XP_BASE|XP_PER_LEVEL|XP_MULTIPLIER|baseXp)\\s*[:=]\\s*(' + NUM + ')', 'g') },
  ],
  rp: [
    { area: 'rp', label: 'rp-award', re: new RegExp('(level \\* 5|max 500|vipBonus|VIP.*50)\\s*', 'g') },
  ],
  vip: [
    { area: 'vip', label: 'vip-multiplier', re: new RegExp('(multiplier|MULTIPLIER)\\s*[:=]\\s*(\\d\\.\\d+)', 'g') },
  ],
  bank: [
    { area: 'bank', label: 'bank-rate', re: new RegExp('(EXCHANGE_FEE_RATE|EXCHANGE_RATE)\\s*=\\s*(\\d*\\.?\\d+)', 'g') },
  ],
  wmd: [
    { area: 'wmd', label: 'wmd-cost', re: new RegExp('(rpCost)\\s*:\\s*(' + NUM + ')', 'g') },
  ],
  bots: [
    { area: 'bots', label: 'bot-tier', re: new RegExp('(tierMultiplier|bonusMultiplier|maxBracket|defenseMultiplier)\\s*\\(?[^\\n]{0,40}?\\s*=\\s*([^;\\n]{0,60})', 'g') },
  ],
  combat: [
    { area: 'combat', label: 'capture-theft-rate', re: new RegExp('(MIN_CAPTURE_RATE|MAX_CAPTURE_RATE|RESOURCE_THEFT_RATE)\\s*=\\s*(\\d*\\.?\\d+)', 'g') },
  ],
};

const TARGETS = [
  ['types/game.types.ts', P.harvest],
  ['lib/harvestService.ts', P.harvest],
  ['lib/xpService.ts', [...P.xp, ...P.combat]],
  ['lib/battleService.ts', [...P.combat, ...P.xp]],
  ['lib/factoryService.ts', P.units],
  ['lib/botService.ts', P.bots],
  ['lib/botCombatService.ts', P.combat],
  ['lib/beerBaseService.ts', P.bots],
  ['lib/researchPointService.ts', [...P.rp, ...P.vip]],
  ['types/wmd/research.types.ts', P.wmd],
  ['app/api/bank/exchange/route.ts', P.bank],
  ['lib/botGrowthEngine.ts', P.bots],
];

for (const [file, patterns] of TARGETS) scan(file, patterns);

// --- verbatim block extraction (authoritative constant tables) ---
function extractBlock(file, isStart, isEnd) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(NL);
  const out = [];
  let capturing = false;
  lines.forEach((l, i) => {
    if (!capturing && isStart(l)) { capturing = true; }
    else if (capturing) {
      if (isEnd(l)) { capturing = false; return; }
      out.push({ file, line: i + 1, text: l.trim().slice(0, 180) });
    }
  });
  return out;
}

const blocks = {
  gameConstants: extractBlock('types/game.types.ts', (l) => l.includes('export const GAME_CONSTANTS'), (l) => l.startsWith('} as const')),
  xpRewards: extractBlock('lib/xpService.ts', (l) => l.includes('export const XP_REWARDS'), (l) => l.trim() === '};'),
  rpMilestones: extractBlock('lib/researchPointService.ts', (l) => l.includes('DAILY_HARVEST_MILESTONES'), (l) => l.trim() === '};'),
  wmdTechCosts: fs.readFileSync('types/wmd/research.types.ts', 'utf8').split(NL)
    .map((l, i) => ({ line: i + 1, text: l.trim() })).filter((x) => /rpCost:/.test(x.text)),
  battleRates: extractBlock('lib/battleService.ts', (l) => l.includes('MAX_CAPTURE_RATE ='), (l) => l.includes('RESOURCE_THEFT_RATE =')),
};

const byArea = {};
for (const f of findings) byArea[f.area] = (byArea[f.area] || 0) + 1;

const out = {
  generatedAt: new Date().toISOString(),
  totals: { findings: findings.length, withValues: findings.filter((f) => f.value !== null).length },
  byArea, findings, blocks,
};
fs.mkdirSync('dev/audit', { recursive: true });
fs.writeFileSync('dev/audit/balance-2026-09-06.json', JSON.stringify(out, null, 2));
console.log('findings:', findings.length, '| with values:', findings.filter((f) => f.value !== null).length);
console.log('by area:', JSON.stringify(byArea));
console.log('blocks:', Object.entries(blocks).map(([k, v]) => k + '=' + v.length).join(' '));
console.log('written: dev/audit/balance-2026-09-06.json');
