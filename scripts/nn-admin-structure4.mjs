// NEON NOIR admin pass 4 — gradient stat tiles, bulk tool headings, RP result.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// RP economy gradient stat tiles -> nn-well--accent ledger wells
src = src.replace(
  /<div className="bg-gradient-to-br from-\[color:var\(--nn-violet\)\] to-\[color:var\(--nn-magenta\)\] rounded-none p-4 text-\[color:var\(--nn-text-primary\)\]">/g,
  '<div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: \'color-mix(in oklab, var(--nn-violet) 35%, transparent)\' }}>'
);
src = src.replace(
  /<div className="bg-gradient-to-br from-\[color:var\(--nn-cyan\)\] to-\[color:var\(--nn-green\)\] rounded-none p-4 text-\[color:var\(--nn-text-primary\)\]">/g,
  '<div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: \'color-mix(in oklab, var(--nn-cyan) 35%, transparent)\' }}>'
);
src = src.replace(
  /<div className="bg-gradient-to-br from-\[color:var\(--nn-amber\)\] to-\[color:var\(--nn-magenta\)\] rounded-none p-4 text-\[color:var\(--nn-text-primary\)\]">/g,
  '<div className="nn-well nn-well--accent !mx-0 p-4" style={{ borderColor: \'color-mix(in oklab, var(--nn-amber) 35%, transparent)\' }}>'
);
// glyph label rows inside those tiles
src = src.replace(/<div className="text-2xl">📊<\/div>/g, '<div className="nn-lab">STAT</div>');
src = src.replace(/<div className="text-2xl">📈<\/div>/g, '<div className="nn-lab">TREND</div>');
src = src.replace(/<div className="text-2xl">🪙<\/div>/g, '<div className="nn-lab">POOL</div>');
// tile numerals
src = src.replace(/<div className="text-2xl font-bold">/g, '<div className="nn-num text-lg font-bold">');

// bulk tool / top earners headings: emoji span + bold h3 -> nn-panel__title
src = src.replace(
  /<h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-\[color:var\(--nn-violet\)\]">\n(\s*)<span>⚙️<\/span>\n\s*<span>/g,
  '<h3 className="nn-panel__title mb-3 flex items-center gap-2">\n$1<span>'
);
src = src.replace(
  /<h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-\[color:var\(--nn-violet\)\]">\n(\s*)<span>🏆<\/span>\n\s*<span>/g,
  '<h3 className="nn-panel__title mb-3 flex items-center gap-2">\n$1<span>'
);

// predictive spawning header
src = src.replace(
  /<h4 className="text-sm font-semibold text-\[color:var\(--nn-green\)\]">\n\s*🔮 Predictive Spawning\n(\s*)<\/h4>/g,
  '<h4 className="nn-panel__title text-[color:var(--nn-green)]">\nPredictive Spawning\n$1</h4>'
);
src = src.replace(/>🔮 Predictive \(Forecast\)</g, '>Predictive (Forecast)<');
src = src.replace(/'🔮 Predictive Spawning Details:/g, "'Predictive Spawning Details:");
src = src.replace(/showInfo\('🔮 /g, "showInfo('");

// RP bulk result chips: startsWith('✅') checks -> token variants (emoji already stripped from set strings)
src = src.replace(
  /\$\{rpBulkResult\.startsWith\('✅'\) \? 'bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] text-\[color:var\(--nn-green\)\]' : 'bg-\[color-mix\(in_oklab,var\(--nn-magenta\)_22%,transparent\)\] text-\[color:var\(--nn-magenta\)\]'\}/g,
  "${rpBulkResult.startsWith('Success') ? 'bg-[color-mix(in_oklab,var(--nn-green)_12%,transparent)] text-[color:var(--nn-green)]' : 'bg-[color-mix(in_oklab,var(--nn-magenta)_12%,transparent)] text-[color:var(--nn-magenta)]'}"
);
src = src.replace(/{rpBulkLoading \? '⏳ Processing\.\.\.' : 'Adjust RP Balance'}/g, "{rpBulkLoading ? 'PROCESSING' : 'ADJUST RP BALANCE'}");

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 4 applied' : 'no changes');
