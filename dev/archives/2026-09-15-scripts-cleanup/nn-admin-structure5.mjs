// NEON NOIR admin pass 5 — solid-color gradient tiles, last emoji, h5 titles.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// solid-color gradient tiles (from==to degenerates) -> nn-well--accent wells
for (const c of ['amber', 'green', 'cyan', 'violet', 'magenta']) {
  src = src.replace(
    new RegExp(
      '<div className="bg-gradient-to-br from-\\[color:var\\(--nn-' + c + '\\)\\] to-\\[color:var\\(--nn-' + c + '\\)\\] rounded-none p-4 text-\\[color:var\\(--nn-text-primary\\)\\]">',
      'g'
    ),
    `<div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: 'color-mix(in oklab, var(--nn-${c}) 35%, transparent)' }}>`
  );
}

// last emoji
src = src.replace(/\.toLocaleString\(\)\} ⚡/g, '.toLocaleString()}');
src = src.replace(/>📈 Effectiveness Metrics</g, '>Effectiveness Metrics<');
src = src.replace(/🔮 Predictive Spawning\n/g, 'Predictive Spawning\n');
src = src.replace(/<span>⚙️<\/span>\n/g, '');
src = src.replace(/<span>🏆<\/span>\n/g, '');

// h5 mini-titles -> consistent Orbitron micro-titles
src = src.replace(
  /<h5 className="text-sm font-semibold text-\[color:var\(--nn-[a-z]+\)\] mb-3">/g,
  '<h5 className="nn-panel__title mb-3">'
);
src = src.replace(
  /<h4 className="text-sm font-semibold text-\[color:var\(--nn-[a-z]+\)\] mb-2">/g,
  '<h4 className="nn-panel__title mb-2">'
);
src = src.replace(
  /<h4 className="text-sm font-semibold text-\[color:var\(--nn-[a-z]+\)\]">/g,
  '<h4 className="nn-panel__title">'
);

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 5 applied' : 'no changes');
