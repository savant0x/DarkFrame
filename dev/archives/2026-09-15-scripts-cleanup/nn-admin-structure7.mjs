// NEON NOIR admin pass 7 — inline buttons -> nn-abtn primitive, tiles -> nn-tile.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// small table/tool buttons
const btnMap = [
  ['nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-cyan)] text-xs', 'nn-abtn nn-abtn--cyan'],
  ['nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-magenta)] text-xs', 'nn-abtn nn-abtn--magenta'],
  ['nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-green)] text-xs', 'nn-abtn nn-abtn--green'],
  ['nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-violet)] text-xs', 'nn-abtn nn-abtn--violet'],
  // larger toolbar buttons
  ['nn-btn--ghost px-4 py-2 rounded-none disabled:opacity-40', 'nn-abtn nn-abtn--cyan px-6 py-2.5 disabled:opacity-40'],
  ['nn-btn--amber px-4 py-2 rounded-none', 'nn-abtn nn-abtn--amber px-6 py-2.5'],
  ['nn-btn--violet px-4 py-2 rounded-none text-sm', 'nn-abtn nn-abtn--violet px-6 py-2.5'],
  // health-strip WMD alert
  ['nn-btn--danger px-3 py-1 rounded-none text-xs ml-auto', 'nn-abtn nn-abtn--danger px-3 py-1 text-xs ml-auto'],
];
for (const [a, b] of btnMap) src = src.split(a).join(b);

// stat/tile wells
src = src.split('bg-[color:var(--nn-void)] p-4 rounded-none').join('nn-tile');
src = src.split('bg-[color:var(--nn-void)] p-3 rounded-none text-center').join('nn-tile p-3 text-center');

// admin identity chip: token size instead of Tailwind overrides
src = src.replace(
  'className="nn-chip nn-chip--violet px-4 py-2 text-xs"',
  "className=\"nn-chip nn-chip--violet\" style={{ padding: '0.375rem 1rem', fontSize: '0.75rem' }}"
);

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 7 applied' : 'no changes');
