// Battle logs page — fix auth-bounce guard + rebuild on the nn- language
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'app/game/battle-logs/[type]/page.tsx';
let s = readFileSync(f, 'utf8');
const misses = [];
function rep(name, re, to, expect) {
  const m = s.match(re);
  if (!m) { misses.push(name); return; }
  if (expect && m.length !== expect) misses.push(`${name} (got ${m.length}, want ${expect})`);
  s = s.replace(re, to);
}

// 1. Guard: wait for the session check before bouncing to /login
rep('destructure', /const \{ player \} = useGameContext\(\);/, 'const { player, isLoading } = useGameContext();');
rep('guard',
  /if \(!player\) \{\s*\r?\n\s*router\.push\('\/login'\);\s*\r?\n\s*return;\s*\r?\n\s*\}/,
  `// player is null until GameContext's async session check finishes — an\n    // unconditional bounce here trapped every hard visit at /login.\n    if (!isLoading && !player) {\n      router.push('/login');\n      return;\n    }`);
rep('loading gate', /if \(loading && page === 1\) \{/, 'if (isLoading || (loading && page === 1)) {');

// 2. Header -> section label
rep('header',
  /<h1 className="text-4xl font-bold mt-4">\s*\r?\n\s*\{TYPE_LABELS\[logType\] \|\| 'Battle Logs'\}\s*\r?\n\s*<\/h1>\s*\r?\n\s*<p className="text-\[color:var\(--nn-text-secondary\)\] mt-2">\s*\r?\n\s*Showing \{logs\.length\} of \{total\.toLocaleString\(\)\} logs\s*\r?\n\s*<\/p>/,
  `<div className="nn-sec mt-4">\n            <span className="nn-sec__title">{TYPE_LABELS[logType] || 'Battle Logs'}</span>\n            <span className="nn-sec__note">SHOWING {logs.length} OF {total.toLocaleString()}</span>\n          </div>`);

// 3. Pagination prev/next buttons: triple-bg slab -> ghost outline (4x)
rep('pager buttons',
  /className="px-4 py-2 bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] bg-\[color-mix\(in_oklab,var\(--nn-text-secondary\)_35%,transparent\)\] bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] text-\[color:var\(--nn-text-secondary\)\] disabled:cursor-not-allowed rounded-none font-semibold transition-colors"/g,
  'className="nn-abtn nn-abtn--ghost disabled:cursor-not-allowed"', 4);

// 4. Page-number chips -> tabchips
rep('page chips',
  /className=\{`px-3 py-2 rounded-none font-semibold transition-colors \$\{\s*\r?\n\s*page === pageNum\s*\r?\n\s*\? 'bg-\[color-mix\(in_oklab,var\(--nn-cyan\)_22%,transparent\)\] text-\[color:var\(--nn-text-primary\)\]'\s*\r?\n\s*: 'bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] bg-\[color-mix\(in_oklab,var\(--nn-text-secondary\)_35%,transparent\)\] text-\[color:var\(--nn-text-secondary\)\]'\s*\r?\n\s*\}`\}/,
  'className={`nn-tabchip ${\n                      page === pageNum ? \'nn-tabchip--on\' : \'\'\n                    }`}');

// 5. Log rows -> rail briefs (left rail carries the result signal)
rep('log row',
  /className=\{`p-4 rounded-none border-2 \$\{\s*\r?\n\s*isVictory\s*\r?\n\s*\? 'bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] border-\[color-mix\(in_oklab,var\(--nn-green\)_50%,transparent\)\]'\s*\r?\n\s*: 'bg-\[color-mix\(in_oklab,var\(--nn-magenta\)_22%,transparent\)\] border-\[color-mix\(in_oklab,var\(--nn-magenta\)_50%,transparent\)\]'\s*\r?\n\s*\}`\}/,
  'className={`nn-brief ${\n                  isVictory ? \'nn-brief--green\' : \'nn-brief--magenta\'\n                }`}');

// 6. Result chip -> token chip
rep('result chip',
  /className=\{`px-3 py-1 rounded-none font-bold text-sm \$\{\s*\r?\n\s*isVictory\s*\r?\n\s*\? 'bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] text-\[color:var\(--nn-text-primary\)\]'\s*\r?\n\s*: 'bg-\[color-mix\(in_oklab,var\(--nn-magenta\)_22%,transparent\)\] text-\[color:var\(--nn-text-primary\)\]'\s*\r?\n\s*\}`\}/,
  'className={`nn-chip ${\n                          isVictory ? \'nn-chip--green\' : \'nn-chip--magenta\'\n                        }`}');

// 7. Opponent name in display face
rep('opponent', /<span className="text-lg font-semibold">\s*\r?\n\s*vs \{opponent\}\s*\r?\n\s*<\/span>/,
  `<span className="nn-num text-lg font-bold">\n                          vs {opponent}\n                        </span>`);

// 8. Field labels -> nn-lab
rep('label location', /<span className="text-\[color:var\(--nn-text-secondary\)\]">Forces:<\/span>/, '<span className="nn-lab">Forces</span>');
rep('label casualties', /<span className="text-\[color:var\(--nn-text-secondary\)\]">Casualties:<\/span>/, '<span className="nn-lab">Casualties</span>');
rep('label metal', /<span className="text-\[color:var\(--nn-amber\)\]">Metal:<\/span>/, '<span className="nn-lab">Metal</span>');
rep('label energy', /<span className="text-\[color:var\(--nn-cyan\)\]">Energy:<\/span>/, '<span className="nn-lab">Energy</span>');
rep('label loc txt', /Location: \(\{log\.location\.x\}, \{log\.location\.y\}\)/, '<span className="nn-lab">Location</span> ({log.location.x}, {log.location.y})');

writeFileSync(f, s);
console.log(misses.length ? 'MISSES: ' + misses.join(' | ') : 'all applied');
