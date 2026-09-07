// NEON NOIR admin pass 8b — convert the two search inputs (fixed regex).
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

const inputPat = (accent) =>
  new RegExp(
    'className="bg-\\[color:var\\(--nn-void\\)\\] border border-\\[color-mix\\(in_oklab,var\\(--nn-' + accent + '\\)_16%,transparent\\)\\] rounded-none px-4 py-2 text-\\[color:var\\(--nn-text-primary\\)\\] focus:border-\\[color-mix\\(in_oklab,var\\(--nn-[a-z]+\\)_55%,transparent\\)\\] focus:outline-none w-64"',
    'g'
  );
src = src.replace(inputPat('cyan'), 'className="nn-input w-64"');
src = src.replace(inputPat('amber'), 'className="nn-input w-64"');

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 8b applied' : 'no changes');
