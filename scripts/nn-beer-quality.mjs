// NEON NOIR quality pass — Beer Base Smart Spawning section of AdminView.
// Deterministic regex transforms; logs any pattern that fails to match.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const total0 = src.length;

const edits = [];
let misses = [];
function rep(name, re, to, expect) {
  const before = src;
  src = src.replace(re, to);
  const n = before === src ? 0 : (before.match(re) || []).length;
  edits.push([name, n]);
  if (n === 0) misses.push(name);
  else if (expect && n !== expect) misses.push(`${name} (got ${n}, want ${expect})`);
}

// --- R1 shell: amber slab -> padded shell (anchored to the Beer Base comment)
rep('R1 shell',
  /\{\/\* Beer Base Smart Spawning \*\/\}\s*\n\s*<div className="nn-panel nn-panel--amber p-4">/,
  `{/* Beer Base Smart Spawning */}\n              <div className="nn-panel nn-panel--amber nn-panel--x-pad">`);

// --- R2 header -> scanline strip with meta key
rep('R2 strip',
  /<div className="flex items-center justify-between mb-3">\s*\n\s*<h3 className="nn-panel__title flex items-center gap-2">\s*\n\s*<Beer className="w-4 h-4" \/>\s*\n\s*<span>Beer Base Smart Spawning<\/span>\s*\n\s*<span className="text-xs bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] px-2 py-1 rounded-none">AUTO<\/span>\s*\n\s*<\/h3>\s*\n\s*<div className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\s*\n\s*\{\/\* payload field is `specialBases`[\s\S]*?\*\/\}\s*\n\s*Current: \{botStats\?\.specialBases \|\| 0\} active\s*\n\s*<\/div>\s*\n\s*<\/div>/,
  `<div className="nn-panel__header nn-panel__header--bleed">\n                <span className="nn-panel__title">Beer Base Smart Spawning</span>\n                <span className="nn-panel__meta">AUTO ▸ {botStats?.specialBases || 0} ACTIVE</span>\n              </div>`);

// --- R3 smart-system note slab -> amber brief
rep('R3 note',
  /<div className="bg-\[color-mix\(in_oklab,var\(--nn-amber\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-amber\)_50%,transparent\)\] rounded-none p-3 mb-4">\s*\n\s*<p className="text-xs text-\[color:var\(--nn-amber\)\]">\s*\n\s*<strong>Smart System Active:<\/strong> Beer Bases/,
  `<div className="nn-brief nn-brief--amber mb-4">\n                    <p>\n                      <strong>Smart System Active</strong> — Beer Bases`);

// --- R4 input/select class swaps (file-wide, safe: same old-skin pattern)
rep('R4a input full',
  /w-full bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_16%,transparent\)\] rounded-none px-3 py-2 text-\[color:var\(--nn-text-primary\)\]/g,
  'nn-input w-full', 10);
rep('R4b input compact',
  /w-full bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_16%,transparent\)\] rounded-none px-2 py-1 text-\[color:var\(--nn-text-primary\)\] text-sm/g,
  'nn-input w-full px-2.5 py-1.5 text-xs', 7);
rep('R4c input predictive',
  /w-full bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_25%,transparent\)\] rounded-none px-3 py-2 text-\[color:var\(--nn-text-primary\)\] text-sm/g,
  'nn-input w-full text-xs', 2);
rep('R4d select compact',
  /(?<!w-full )bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_16%,transparent\)\] rounded-none px-2 py-1 text-\[color:var\(--nn-text-primary\)\] text-xs/g,
  'nn-input px-2 py-1 text-xs', 3);
rep('R4e select predictive',
  /bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_25%,transparent\)\] rounded-none px-3 py-2 text-\[color:var\(--nn-text-primary\)\] text-sm/g,
  'nn-input text-xs', 2);

// --- R5 labels -> nn-lab
rep('R5a label flex', /<label className="text-sm text-\[color:var\(--nn-text-secondary\)\] flex items-center gap-2">/g,
  '<label className="nn-lab flex items-center gap-2">', 5);
rep('R5b label sm', /<label className="text-sm text-\[color:var\(--nn-text-secondary\)\]">/g,
  '<label className="nn-lab">', 6);
rep('R5c label xs', /<label className="text-xs text-\[color:var\(--nn-text-secondary\)\]">/g,
  '<label className="nn-lab">', 5);

// --- R6 parenthetical hints folded into the label
rep('R6a master', />\s*\n\s*<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(Master switch\)<\/span>/,
  ' · Master Switch');
rep('R6b min', />\s*\n\s*<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(of bots\)<\/span>/g,
  ' · % of Bots', 2);
rep('R6c mult', />\s*\n\s*<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(1-20x\)<\/span>/,
  ' · 1–20x');
rep('R6d hour', /Respawn Hour \(0-23\)/, 'Respawn Hour · 0–23h');

// --- R7 variety block slab + heading
rep('R7a slab',
  /<div className="mt-4 bg-\[color-mix\(in_oklab,var\(--nn-amber\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-amber\)_50%,transparent\)\] rounded-none p-3">/,
  '<div className="nn-brief nn-brief--amber mt-4">');
rep('R7b heading',
  /<h4 className="text-sm font-semibold text-\[color:var\(--nn-amber\)\] flex items-center gap-2">\s*\n\s*🎨 Variety Enforcement\s*\n\s*<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(Prevents homogeneous spawns\)<\/span>\s*\n\s*<\/h4>/,
  `<h4 className="nn-lab" style={{ color: 'var(--nn-amber)' }}>\n                        Variety Enforcement · Anti-Homogeneity\n                      </h4>`);
rep('R7c totals',
  /<div className="mt-2 text-xs text-\[color:var\(--nn-text-secondary\)\]">\s*\n\s*<strong>Current totals:<\/strong> Min \{beerBaseConfig\.minWeakPercent \+ beerBaseConfig\.minMediumPercent \+ beerBaseConfig\.minStrongPercent \+ beerBaseConfig\.minElitePercent\}% guaranteed variety\s*\n\s*<\/div>/,
  `<div className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--nn-text-tertiary)' }}>\n                          Min guaranteed variety ▸ <span className="nn-num" style={{ color: 'var(--nn-amber)' }}>{beerBaseConfig.minWeakPercent + beerBaseConfig.minMediumPercent + beerBaseConfig.minStrongPercent + beerBaseConfig.minElitePercent}%</span>\n                        </div>`);

// --- R8 schedules block
rep('R8a slab',
  /<div className="mt-4 bg-\[color-mix\(in_oklab,var\(--nn-cyan\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_50%,transparent\)\] rounded-none p-3">/,
  '<div className="nn-brief nn-brief--cyan mt-4">');
rep('R8b heading',
  /<h4 className="text-sm font-semibold text-\[color:var\(--nn-cyan\)\] flex items-center gap-2">\s*\n\s*Dynamic Respawn Schedules\s*\n\s*<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(Multiple respawn times\)<\/span>\s*\n\s*<\/h4>/,
  `<h4 className="nn-lab" style={{ color: 'var(--nn-cyan)' }}>\n                        Dynamic Respawn Schedules · Multi-Slot\n                      </h4>`);
rep('R8c clock', />🕐 Legacy Single Schedule</, '>Legacy Single Schedule<');
rep('R8d empty', /className="rounded-none p-4 text-center bg-glass-light"/,
  'className="rounded-none p-4 text-center bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_10%,transparent)]"');
rep('R8e add',
  /className="mt-3 w-full bg-\[color-mix\(in_oklab,var\(--nn-cyan\)_22%,transparent\)\] text-\[color:var\(--nn-text-primary\)\] px-4 py-2 rounded-none text-sm font-semibold"/,
  'className="nn-abtn nn-abtn--cyan mt-3 w-full"');

// --- R9 action buttons (identical old strings; first=Save, second=Respawn)
const dblBtn = 'className="bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-6 py-2 rounded-none font-semibold transition-colors"';
const i1 = src.indexOf(dblBtn);
if (i1 === -1) misses.push('R9a save');
else src = src.slice(0, i1) + 'className="nn-abtn nn-abtn--amber disabled:cursor-not-allowed"' + src.slice(i1 + dblBtn.length);
const i2 = src.indexOf(dblBtn);
if (i2 === -1) misses.push('R9b respawn');
else src = src.slice(0, i2) + 'className="nn-abtn nn-abtn--cyan disabled:cursor-not-allowed"' + src.slice(i2 + dblBtn.length);
edits.push(['R9 save/respawn', (i1 !== -1 ? 1 : 0) + (i2 !== -1 ? 1 : 0)]);

// --- R10 how-it-works
rep('R10a box',
  /<div className="mt-3 text-xs text-\[color:var\(--nn-text-secondary\)\] bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] rounded-none p-2">/,
  '<div className="nn-brief nn-brief--cyan mt-4">');
rep('R10b lead', /<strong>How it works:<\/strong>/, '<strong>How It Works</strong> —');

// --- R11 analytics disclosure
rep('R11a outer',
  /<div className="mt-4 bg-\[color-mix\(in_oklab,var\(--nn-cyan\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-cyan\)_50%,transparent\)\] rounded-none">/,
  '<div className="mt-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-cyan)_18%,transparent)] rounded-none">');
rep('R11b button',
  /className="w-full p-3 text-left bg-\[color-mix\(in_oklab,var\(--nn-cyan\)_22%,transparent\)\] transition-colors flex items-center justify-between rounded-none"/,
  'className="w-full p-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--nn-cyan)_8%,transparent)] flex items-center justify-between rounded-none"');
rep('R11c meta', /<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(365-day retention\)<\/span>/,
  '<span className="nn-lab">365-Day Retention</span>');
rep('R11d chevron',
  /<span className="text-2xl text-\[color:var\(--nn-cyan\)\]">\{beerAnalyticsExpanded \? '▼' : '▶'\}<\/span>/,
  `<span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--nn-cyan)' }}>{beerAnalyticsExpanded ? '▼' : '▶'}</span>`);
rep('R11e export', /📥 Export CSV/, 'Export CSV');

// 4 quick-stat cards -> nn-stat instruments
const cards = [
  ['cyan', 'Total Spawns', 'Avg {beerSpawnStats?.averagePerDay?.toFixed(1) || \'0\'}/day'],
  ['magenta', 'Total Defeats', 'Avg {beerDefeatStats?.averagePerDay?.toFixed(1) || \'0\'}/day'],
];
for (const [accent, label] of cards) {
  rep(`R11f stat ${label}`,
    new RegExp(`<div className="bg-\\[color-mix\\(in_oklab,var\\(--nn-void\\)_65%,transparent\\)\\] rounded-none p-3 border border-\\[color-mix\\(in_oklab,var\\(--nn-${accent}\\)_50%,transparent\\)\\]">\\s*\\n\\s*<div className="text-xs text-\\[color:var\\(--nn-text-secondary\\)\\] mb-1">${label}<\\/div>\\s*\\n\\s*<div className="nn-num text-lg font-bold text-\\[color:var\\(--nn-${accent}\\)\\]">`,
    'g'),
    `<div className="nn-stat">\n                              <div className="nn-stat__lab">${label}</div>\n                              <div className="nn-stat__num nn-stat__num--glow-${accent}">`);
  rep(`R11g sub ${label}`,
    new RegExp(`<div className="text-xs text-\\[color:var\\(--nn-text-secondary\\)\\]">\\s*\\n\\s*Avg: \\{(beer(?:Spawn|Defeat)Stats\\?\\.averagePerDay\\?\\.toFixed\\(1\\) \\|\\| '0')\\}/day\\s*\\n\\s*<\\/div>`,
    'g'),
    `<div className="nn-stat__sub">\n                                Avg {` + '$1' + `}/day\n                              </div>`);
}
rep('R11h stat amber',
  /<div className="bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] rounded-none p-3 border border-\[color-mix\(in_oklab,var\(--nn-amber\)_50%,transparent\)\]">\s*\n\s*<div className="text-xs text-\[color:var\(--nn-text-secondary\)\] mb-1">Defeat Rate<\/div>\s*\n\s*<div className="nn-num text-lg font-bold text-\[color:var\(--nn-amber\)\]">/,
  `<div className="nn-stat">\n                              <div className="nn-stat__lab">Defeat Rate</div>\n                              <div className="nn-stat__num nn-stat__num--glow-amber">`);
rep('R11i stat violet',
  /<div className="bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] rounded-none p-3 border border-\[color-mix\(in_oklab,var\(--nn-violet\)_50%,transparent\)\]">\s*\n\s*<div className="text-xs text-\[color:var\(--nn-text-secondary\)\] mb-1">Avg Lifespan<\/div>\s*\n\s*<div className="nn-num text-lg font-bold text-\[color:var\(--nn-violet\)\]">/,
  `<div className="nn-stat">\n                              <div className="nn-stat__lab">Avg Lifespan</div>\n                              <div className="nn-stat__num nn-stat__num--glow-violet">`);
rep('R11j subs',
  /<div className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\s*\n\s*(Engagement Score: \{[^}]*\}|All tiers combined)\s*\n\s*<\/div>/g,
  `<div className="nn-stat__sub">\n                                $1\n                              </div>`);

// tier distribution + defeats rows
rep('R11k tier lab',
  /<div className="w-24 text-xs text-\[color:var\(--nn-text-secondary\)\]">\{tierNames\[tier\.tier\]\}<\/div>/g,
  '<div className="nn-lab w-24">{tierNames[tier.tier]}</div>', 2);
rep('R11l tier num',
  /<div className="w-16 text-right text-sm font-bold text-\[color:var\(--nn-text-primary\)\]">\{tier\.count\}<\/div>/,
  '<div className="nn-num w-16 text-right text-sm text-[color:var(--nn-text-primary)]">{tier.count}</div>');

// hunters: medals -> rank numerals with tier accents
rep('R11m rank',
  /<span className="text-lg">\s*\n\s*\{index === 0 \? '🥇' : index === 1 \? '🥈' : index === 2 \? '🥉' : `#\$\{index \+ 1\}`\}\s*\n\s*<\/span>/,
  `<span className="nn-num w-8 text-center text-xs" style={{ color: index === 0 ? 'var(--nn-amber)' : index === 1 ? 'var(--nn-cyan)' : index === 2 ? 'var(--nn-violet)' : 'var(--nn-text-tertiary)' }}>
                                      {` + '`#${index + 1}`' + `}
                                    </span>`);
rep('R11n bolt', /toLocaleString\(\) 🔩/, 'toLocaleString()} ME');
rep('R11o peak', /\{index === 0 \? '🥇' : index === 1 \? '🥈' : '🥉'\} \{peak\.hour/,
  '#{index + 1} · {peak.hour');
rep('R11p dice', /🎲 Spawn Sources/, 'Spawn Sources');
rep('R11q source wrap',
  /<div key=\{source\.source\} className="flex-1 bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] rounded-none p-3 text-center">\s*\n\s*<div className="text-xs text-\[color:var\(--nn-text-secondary\)\] mb-1">/,
  `<div key={source.source} className="nn-stat flex-1 text-center">\n                                    <div className="nn-stat__lab">`);
rep('R11r source num',
  /<div className="text-xl font-bold text-\[color:var\(--nn-green\)\]">\{source\.count\}<\/div>/,
  '<div className="nn-stat__num nn-stat__num--glow-green">{source.count}</div>');
rep('R11s eff lab',
  /<div className="text-xs text-\[color:var\(--nn-text-secondary\)\] mb-2">(Average Lifespan by Tier|Peak Activity Hours \(UTC\))<\/div>/g,
  '<div className="nn-lab mb-2">$1</div>');
rep('R11t eff row',
  /<span className="text-\[color:var\(--nn-text-secondary\)\]">\{tierNames\[tier\.tier\]\}:<\/span>/g,
  '<span className="nn-lab">{tierNames[tier.tier]}</span>');

// --- R12 predictive disclosure
rep('R12a outer',
  /<div className="mt-4 bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-green\)_50%,transparent\)\] rounded-none">/,
  '<div className="mt-4 bg-[color-mix(in_oklab,var(--nn-void)_65%,transparent)] border border-[color-mix(in_oklab,var(--nn-green)_18%,transparent)] rounded-none">');
rep('R12b button',
  /className="w-full p-3 text-left bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] transition-colors flex items-center justify-between rounded-none"/,
  'className="w-full p-3 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--nn-green)_8%,transparent)] flex items-center justify-between rounded-none"');
rep('R12c meta', /<span className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\(Historical data forecasting\)<\/span>/,
  '<span className="nn-lab">Historical Forecasting</span>');
rep('R12d chevron',
  /<span className="text-2xl text-\[color:var\(--nn-green\)\]">\{beerBaseConfig\.predictiveExpanded \? '▼' : '▶'\}<\/span>/,
  `<span className="font-mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--nn-green)' }}>{beerBaseConfig.predictiveExpanded ? '▼' : '▶'}</span>`);
rep('R12e brain',
  /<p className="text-xs text-\[color:var\(--nn-text-secondary\)\]">\s*\n\s*🧠 <strong>AI-Powered Forecasting:<\/strong> Uses/,
  `<p className="nn-brief nn-brief--green text-xs"><strong>AI-Powered Forecasting</strong> — Uses`);
rep('R12f mode lab',
  /<label className="text-sm font-semibold text-\[color:var\(--nn-green\)\]">Predictive Mode<\/label>/,
  `<label className="nn-lab" style={{ color: 'var(--nn-green)' }}>Predictive Mode</label>`);
rep('R12g indicator',
  /<div className=\{`rounded-none p-3 border-2 \$\{[\s\S]*?\`\}>/,
  `<div
                      className="nn-brief"
                      style={{
                        borderColor: 'color-mix(in oklab, var(--nn-rail) 20%, transparent)',
                        borderLeft: ` + '`${' + `beerBaseConfig.usePredictiveSpawning ? 'var(--nn-green)' : 'var(--nn-cyan)'}` + '}`' + `,
                      }}
                    >`);
rep('R12h chip',
  /<span className='nn-panel__title'>\{beerBaseConfig\.usePredictiveSpawning \? 'PREDICTIVE' : 'DISTRIBUTED'\}<\/span>/,
  "<span className={`nn-chip ${beerBaseConfig.usePredictiveSpawning ? 'nn-chip--green' : 'nn-chip--cyan'}`}>{beerBaseConfig.usePredictiveSpawning ? 'PREDICTIVE' : 'DISTRIBUTED'}</span>");
rep('R12i dist head',
  /<div className="text-center text-\[color:var\(--nn-text-secondary\)\] font-semibold">/g,
  '<div className="nn-lab text-center">', 6);
rep('R12j recalc',
  /className="flex-1 bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] bg-\[color-mix\(in_oklab,var\(--nn-text-secondary\)_35%,transparent\)\] disabled:cursor-not-allowed text-\[color:var\(--nn-text-primary\)\] px-4 py-2 rounded-none font-semibold text-sm transition-colors"/,
  'className="nn-abtn nn-abtn--green flex-1 disabled:cursor-not-allowed"');
rep('R12k info', /ℹ️ How It Works/, 'How It Works');
rep('R12l alert box',
  /\{\/\* Implementation Status \*\/\}\s*\n\s*<div className="bg-\[color-mix\(in_oklab,var\(--nn-amber\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-amber\)_50%,transparent\)\] rounded-none p-3">/,
  `{/* Implementation Status */}\n                      <div className="nn-brief nn-brief--amber">`);
rep('R12m alert lab', /<span className="nn-panel__title">ALERT<\/span>/,
  `<span className="nn-lab" style={{ color: 'var(--nn-amber)' }}>Implementation Status</span>`);
rep('R12n alert lead', /<strong>Implementation Status:<\/strong> Backend integration complete\./,
  '<strong>Backend Integration</strong> — complete.');

// normalize inserted \n to the file's CRLF
src = src.replace(/(?<!\r)\n/g, '\r\n');
writeFileSync(FILE, src);

console.log('applied:', edits.filter(e => e[1] > 0).length, '/', edits.length, 'transforms');
console.log('delta chars:', src.length - total0);
if (misses.length) { console.log('MISSES:'); for (const m of misses) console.log(' -', m); }
else console.log('no misses');
