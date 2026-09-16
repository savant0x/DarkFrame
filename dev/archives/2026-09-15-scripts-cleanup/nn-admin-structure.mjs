// NEON NOIR admin structural pass — converts AdminView.tsx from generic
// Tailwind slab structure to the nn- primitive language. Deterministic,
// idempotent string replacements.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// --- 1. Section shells: border-2 tinted slabs -> nn-panel with matching accent
const shellMap = [
  ['border-2 border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]', 'nn-panel nn-panel--violet'],
  ['border-2 border-[color-mix(in_oklab,var(--nn-amber)_50%,transparent)]', 'nn-panel nn-panel--amber'],
  ['border-2 border-[color-mix(in_oklab,var(--nn-cyan)_50%,transparent)]', 'nn-panel'],
  ['border-2 border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)]', 'nn-panel nn-panel--magenta'],
];
for (const [oldC, newC] of shellMap) {
  // shell pattern: bg-[...void_65%...] rounded-none p-6 border-2 border-[...]  OR p-6 without
  const re = new RegExp(
    'bg-\\[color-mix\\(in_oklab,var\\(--nn-void\\)_65%,transparent\\)\\] (rounded-none )?(p-6 )?(max-w-md w-full )?' + oldC.replace(/[[\]()\\]/g, (m) => '\\' + m),
    'g'
  );
  src = src.replace(re, (m, r1, r2, r3) => `${newC}${r3 ? ' ' + r3.trim() : ''}`);
}
// also the p-4 inner shell (beer base)
src = src.replace(
  /bg-\[color:var\(--nn-void\)\] rounded-none p-4 border-2 border-\[color-mix\(in_oklab,var\(--nn-amber\)_50%,transparent\)\]/g,
  'nn-panel nn-panel--amber p-4'
);

// --- 2. Emoji headings -> nn-panel__title Orbitron labels
const h2Map = [
  ['📊 Game Statistics', 'Game Statistics', 'violet'],
  ['👥 Player Management', 'Player Management', 'violet'],
  ['⚡ VIP Management', 'VIP Management', 'amber'],
  ['📊 Analytics Dashboard', 'Analytics Dashboard', 'cyan'],
  ['🛠️ Database Tools', 'Database Tools', 'violet'],
  ['🤖 Bot Ecosystem Controls', 'Bot Ecosystem Controls', 'cyan'],
  ['☢️ WMD System Oversight', 'WMD System Oversight', 'magenta'],
  ['💰 RP Economy Management', 'RP Economy Management', 'amber'],
];
for (const [emoji, title] of h2Map) {
  // match the h2 with any leading emoji + title, any color var
  const re = new RegExp(
    '<h2 className="text-2xl font-bold text-\\[color:var\\(--nn-[a-z]+\\)\\] mb-4">' + emoji + '</h2>',
    'g'
  );
  src = src.replace(re, `<h2 className="nn-panel__title mb-4">${title}</h2>`);
  const re2 = new RegExp(
    '<h2 className="text-2xl font-bold text-\\[color:var\\(--nn-[a-z]+\\)\\]">' + emoji + '</h2>',
    'g'
  );
  src = src.replace(re2, `<h2 className="nn-panel__title">${title}</h2>`);
}
// h1 admin panel title
src = src.replace(
  /<h1 className="text-4xl font-bold text-\[color:var\(--nn-violet\)\]">⚙️ Admin Panel<\/h1>/g,
  '<h1 className="nn-panel__title" style={{ fontSize: \'1.5rem\', letterSpacing: \'0.25em\' }}>ADMIN PANEL</h1>'
);

// --- 3. h3 subsection headings -> consistent Orbitron micro-titles
src = src.replace(
  /<h3 className="text-lg font-semibold text-\[color:var\(--nn-[a-z]+\)\] mb-3">/g,
  '<h3 className="nn-panel__title mb-3">'
);
src = src.replace(
  /<h3 className="text-lg font-semibold text-\[color:var\(--nn-[a-z]+\)\] flex items-center gap-2">/g,
  '<h3 className="nn-panel__title flex items-center gap-2">'
);

// --- 4. Stat number tiles: text-3xl/text-2xl -> nn-num Orbitron numerals
src = src.replace(/text-3xl font-bold /g, 'nn-num text-xl font-bold ');
src = src.replace(/text-2xl font-bold /g, 'nn-num text-lg font-bold ');

// --- 5. Emoji button labels -> plain Orbitron-cased text (nn-btn handles case)
src = src.replace(/\{vipLoading \? '⟳' : '🔄'\} Refresh/g, "{vipLoading ? 'LOADING' : 'REFRESH'}");
src = src.replace(/>🔄 Refresh</g, '>REFRESH<');
src = src.replace(/>⚠ /g, '>ALERT · ');
src = src.replace(/'⚠ /g, "'ALERT · ");
src = src.replace(/📊 /g, '').replace(/👥 /g, '').replace(/⚡ /g, '')
  .replace(/🛠️ /g, '').replace(/🤖 /g, '').replace(/☢️ /g, '').replace(/💰 /g, '')
  .replace(/⚙️ /g, '').replace(/🔍 /g, '').replace(/➕ /g, '').replace(/🗑️ /g, '')
  .replace(/✏️ /g, '').replace(/💾 /g, '').replace(/🔄 /g, '').replace(/⟳ /g, '');

// --- 6. Inputs: focus rings -> token cyan
src = src.replace(/focus:border-purple-500 /g, 'focus:border-[color-mix(in_oklab,var(--nn-cyan)_55%,transparent)] ');
src = src.replace(/focus:border-yellow-500 /g, 'focus:border-[color-mix(in_oklab,var(--nn-amber)_55%,transparent)] ');
src = src.replace(/focus:border-blue-500 /g, 'focus:border-[color-mix(in_oklab,var(--nn-cyan)_55%,transparent)] ');

// --- 7. Broken/dead utility classes -> token text helpers
src = src.replace(/text-text-secondary/g, 'nn-text-dim');
src = src.replace(/text-text-tertiary/g, 'nn-text-dim');
src = src.replace(/text-text-primary/g, 'text-[color:var(--nn-text-primary)]');

// --- 8. Duplicate stacked bg tints -> single token treatment
src = src.replace(
  /bg-\[color-mix\(in_oklab,var\(--nn-[a-z]+\)_22%,transparent\)\] bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\]/g,
  (m) => m.replace(' bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)]', '')
);
src = src.replace(
  /bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] text-\[color:var\(--nn-text-secondary\)\] bg-\[color-mix\(in_oklab,var\(--nn-text-secondary\)_35%,transparent\)\]/g,
  'bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)]'
);

writeFileSync(FILE, src);
const n = before.length !== src.length;
console.log(n ? 'admin structural pass applied' : 'no changes');
