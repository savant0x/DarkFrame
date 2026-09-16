// NEON NOIR admin pass 8 — repair corrupted classNames, tiles, inputs.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// repair pass-2 regex mangling
src = src.split('className="nn-btn--ghost px-text-xs font-semibold transition-colorspy-2 rounded-none text-xs"')
  .join('className="nn-abtn nn-abtn--ghost text-xs"');
src = src.split('className="nn-btn--ghost px-font-semibold text-sm transition-colorspy-2 rounded-none text-xs"')
  .join('className="nn-abtn nn-abtn--ghost text-xs"');

// remaining section tool boxes -> nn-tile
src = src.split('bg-[color:var(--nn-void)] rounded-none p-4').join('nn-tile');
src = src.split('bg-[color:var(--nn-void)] rounded-none p-3').join('nn-tile p-3');
src = src.split('bg-[color:var(--nn-void)] rounded-none p-2').join('nn-tile p-2');

// search inputs -> nn-input primitive
src = src.replace(
  /className="bg-\[color:var\(--nn-void\)\] border border-\[color-mix\(in_oklab,var\(--nn-(cyan\|amber)\)_16%,transparent\)\] rounded-none px-4 py-2 text-\[color:var\(--nn-text-primary\)\] focus:border-\[color-mix\(in_oklab,var\(--nn-[a-z]+\)_55%,transparent\)\] focus:outline-none w-64"/g,
  'className="nn-input w-64"'
);

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 8 applied' : 'no changes');
