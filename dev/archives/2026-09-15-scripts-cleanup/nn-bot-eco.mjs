// Bot Ecosystem + ops-row button/emoji/stat-card pass
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'app/admin/AdminView.tsx';
let s = readFileSync(f, 'utf8');

const swaps = [
  ['amber ops',   'bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors', 'nn-abtn nn-abtn--amber'],
  ['cyan ops',    'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors', 'nn-abtn nn-abtn--cyan'],
  ['green ops',   'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors', 'nn-abtn nn-abtn--green'],
  ['violet ops',  'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors', 'nn-abtn nn-abtn--violet'],
  ['magenta ops', 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] px-6 py-4 rounded-none font-semibold transition-colors', 'nn-abtn nn-abtn--magenta'],
  ['qa green',    'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--green disabled:cursor-not-allowed'],
  ['qa cyan',     'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--cyan disabled:cursor-not-allowed'],
  ['qa violet',   'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--violet disabled:cursor-not-allowed'],
  ['row violet',  'bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--violet'],
  ['row ghost',   'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--ghost'],
  ['row cyan',    'bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--cyan'],
  ['row magenta', 'bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] px-4 py-3 rounded-none font-semibold transition-colors text-sm', 'nn-abtn nn-abtn--magenta'],
  ['save config', 'mt-4 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] disabled:cursor-not-allowed text-[color:var(--nn-text-primary)] px-6 py-2 rounded-none font-semibold transition-colors w-full', 'nn-abtn nn-abtn--cyan mt-4 w-full disabled:cursor-not-allowed'],
  ['fix emoji', '\u{1F3E0} Fix Base Tiles', 'Fix Base Tiles'],
  ['ws emoji',  '\u{1F50C} WebSocket Console', 'WebSocket Console'],
  ['map emoji', '\u{1F5FA}\uFE0F Tile Inspector', 'Tile Inspector'],
  ['kbd emoji', '\u2328\uFE0F Hotkey Manager', 'Hotkey Manager'],
];
for (const [name, from, to] of swaps) {
  const parts = s.split(from);
  if (parts.length === 1) { console.log('MISS:', name); continue; }
  s = parts.join(to);
  console.log(name, '->', parts.length - 1);
}

// bot population cards -> nn-stat instruments
const re = /<div className="bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] p-3 rounded-none text-center">\s*\r?\n\s*<p className="text-xs text-\[color:var\(--nn-text-secondary\)\]">(Total Bots|Hoarders|Fortresses|Raiders|Ghosts)<\/p>\s*\r?\n\s*<p className="nn-num text-lg font-bold text-\[color:var\(--nn-(cyan|amber|magenta|violet)\)\]">/g;
let n = 0;
s = s.replace(re, (_, lab, color) => {
  n++;
  return '<div className="nn-stat text-center">\r\n                      <p className="nn-stat__lab">' + lab + '</p>\r\n                      <p className="nn-stat__num nn-stat__num--glow-' + color + '">';
});
console.log('stat cards ->', n);
writeFileSync(f, s);
