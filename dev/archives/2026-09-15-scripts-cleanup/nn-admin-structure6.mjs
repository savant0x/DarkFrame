// NEON NOIR admin pass 6 — page shell gradient, last loading emoji, stray icons.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// page shell: gray->black gradient = pre-noir skin. nn-shell owns the backdrop.
src = src.replace(
  '"min-h-screen bg-gradient-to-b from-gray-900 to-black text-[color:var(--nn-text-primary)] flex items-center justify-center"',
  '"nn-shell min-h-screen text-[color:var(--nn-text-primary)] flex items-center justify-center"'
);
src = src.replace(
  'embedded ? "p-6" : "min-h-screen bg-gradient-to-b from-gray-900 to-black text-[color:var(--nn-text-primary)] p-8"',
  'embedded ? "p-6" : "nn-shell min-h-screen text-[color:var(--nn-text-primary)] p-8"'
);

// loading spinners + stray icon spans
src = src.replace(/{beerBaseLoading \? '⏳ Calculating\.\.\.' : 'Recalculate Predictions'}/g,
  "{beerBaseLoading ? 'CALCULATING' : 'RECALCULATE PREDICTIONS'}");
src = src.replace(/{rpLoading \? '⏳ Loading\.\.\.' : 'Refresh Data'}/g,
  "{rpLoading ? 'LOADING' : 'REFRESH DATA'}");
src = src.replace(/<span>⚙️<\/span>/g, '');
src = src.replace(/<span>🏆<\/span>/g, '');

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 6 applied' : 'no changes');
