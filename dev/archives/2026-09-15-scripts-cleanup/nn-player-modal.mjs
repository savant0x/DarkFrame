// PlayerDetailModal — rebuild onto the nn- modal language
import { readFileSync, writeFileSync } from 'node:fs';

const f = 'components/admin/PlayerDetailModal.tsx';
let s = readFileSync(f, 'utf8');
let misses = [];

function rep(name, re, to, expect) {
  const m = s.match(re);
  if (!m) { misses.push(name); return; }
  if (expect && m.length !== expect) misses.push(`${name} (got ${m.length}, want ${expect})`);
  s = s.replace(re, to);
}

// shell -> padded panel
rep('shell',
  /<div className="bg-\[color:var\(--nn-void\)\] rounded-none border-2 border-\[color-mix\(in_oklab,var\(--nn-violet\)_50%,transparent\)\] max-w-4xl w-full max-h-\[90vh\] overflow-hidden flex flex-col">/,
  '<div className="nn-panel nn-panel--violet nn-panel--x-pad max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">');

// header -> strip with meta chip + mono close
rep('header',
  /<div className="bg-\[color-mix\(in_oklab,var\(--nn-violet\)_22%,transparent\)\] p-4 flex justify-between items-center border-b border-\[color-mix\(in_oklab,var\(--nn-violet\)_50%,transparent\)\]">\s*\r?\n\s*<h2 className="text-2xl font-bold text-\[color:var\(--nn-text-primary\)\]">\s*\r?\n\s*👤 \{username\}\s*\r?\n\s*\{playerData\?\.isBot && <span className="ml-2 text-sm text-\[color:var\(--nn-cyan\)\]">\(BOT\)<\/span>\}\s*\r?\n\s*<\/h2>\s*\r?\n\s*<button\s*\r?\n\s*onClick=\{onClose\}\s*\r?\n\s*className="text-\[color:var\(--nn-text-secondary\)\] hover:text-\[color:var\(--nn-text-primary\)\] text-2xl font-bold"\s*\r?\n\s*>\s*\r?\n\s*×\s*\r?\n\s*<\/button>\s*\r?\n\s*<\/div>/,
  `<div className="nn-panel__header nn-panel__header--bleed">
          <span className="nn-panel__title">Player ▸ {username}</span>
          <span className="flex items-center gap-3">
            {playerData?.isBot && <span className="nn-chip nn-chip--cyan">BOT</span>}
            <button
              onClick={onClose}
              aria-label="Close"
              className="font-mono text-sm text-[color:var(--nn-text-tertiary)] transition-colors hover:text-[color:var(--nn-magenta)]"
            >
              ×
            </button>
          </span>
        </div>`);

// tabs
rep('tabs container',
  /<div className="flex gap-2 p-4 bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] border-b border-\[color-mix\(in_oklab,var\(--nn-cyan\)_16%,transparent\)\]">/,
  '<div className="flex flex-wrap gap-2 border-b border-[color-mix(in_oklab,var(--nn-cyan)_12%,transparent)] pb-3">');
rep('tab buttons',
  /className=\{`px-4 py-2 rounded-none font-semibold transition-colors \$\{\s*\r?\n\s*activeTab === tab\s*\r?\n\s*\? 'bg-\[color-mix\(in_oklab,var\(--nn-violet\)_22%,transparent\)\] text-\[color:var\(--nn-text-primary\)\]'\s*\r?\n\s*: 'bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] text-\[color:var\(--nn-text-secondary\)\] bg-\[color-mix\(in_oklab,var\(--nn-text-secondary\)_35%,transparent\)\]'\s*\r?\n\s*\}`\}/,
  'className={`nn-tabchip ${\n                activeTab === tab ? \'nn-tabchip--on\' : \'\'\n              }`}');

// stat cards -> nn-stat
rep('stat cards',
  /<div className="bg-\[color-mix\(in_oklab,var\(--nn-void\)_65%,transparent\)\] p-4 rounded-none">\s*\r?\n\s*<p className="text-\[color:var\(--nn-text-secondary\)\] text-sm">(Level|Rank|Metal|Energy)<\/p>\s*\r?\n\s*<p className="text-2xl font-bold text-\[color:var\(--nn-(amber|violet|cyan)\)\]">/g,
  '<div className="nn-stat">\n                      <p className="nn-stat__lab">$1</p>\n                      <p className="nn-stat__num nn-stat__num--glow-$2">', 4);

// section headings -> nn-lab
rep('h3 mb-3', /<h3 className="text-lg font-semibold text-\[color:var\(--nn-text-secondary\)\] mb-3">/g, '<h3 className="nn-lab mb-3">', 2);
rep('h3 mb-2', /<h3 className="text-lg font-semibold text-\[color:var\(--nn-text-secondary\)\] mb-2">/g, '<h3 className="nn-lab mb-2">', 3);

// banned banner -> magenta brief
rep('banned',
  /<div className="bg-\[color-mix\(in_oklab,var\(--nn-magenta\)_22%,transparent\)\] border border-\[color-mix\(in_oklab,var\(--nn-magenta\)_50%,transparent\)\] p-4 rounded-none">\s*\r?\n\s*<p className="text-\[color:var\(--nn-magenta\)\] font-bold">⚠️ PLAYER IS BANNED<\/p>/,
  `<div className="nn-brief nn-brief--magenta">
                      <p className="font-bold"><strong>Banned</strong> — this player is currently banned</p>`);

// loader -> square
rep('loader',
  /<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-\[color-mix\(in_oklab,var\(--nn-violet\)_50%,transparent\)\] mx-auto mb-3"><\/div>/,
  '<div className="mx-auto mb-3 h-10 w-10 animate-spin border border-[color-mix(in_oklab,var(--nn-violet)_40%,transparent)] border-t-[color:var(--nn-violet)]"></div>');

// action buttons -> nn-abtn
rep('btn green',   /bg-\[color-mix\(in_oklab,var\(--nn-green\)_22%,transparent\)\] disabled:opacity-50 text-\[color:var\(--nn-text-primary\)\] px-6 py-4 rounded-none font-semibold transition-colors/g, 'nn-abtn nn-abtn--green disabled:opacity-50', 1);
rep('btn magenta', /bg-\[color-mix\(in_oklab,var\(--nn-magenta\)_22%,transparent\)\] disabled:opacity-50 text-\[color:var\(--nn-text-primary\)\] px-6 py-4 rounded-none font-semibold transition-colors/g, 'nn-abtn nn-abtn--danger disabled:opacity-50', 1);
rep('btn cyan',    /bg-\[color-mix\(in_oklab,var\(--nn-cyan\)_22%,transparent\)\] disabled:opacity-50 text-\[color:var\(--nn-text-primary\)\] px-6 py-4 rounded-none font-semibold transition-colors/g, 'nn-abtn nn-abtn--cyan disabled:opacity-50', 1);
rep('btn amber',   /bg-\[color-mix\(in_oklab,var\(--nn-amber\)_22%,transparent\)\] disabled:opacity-50 text-\[color:var\(--nn-text-primary\)\] px-6 py-4 rounded-none font-semibold transition-colors/g, 'nn-abtn nn-abtn--amber disabled:opacity-50', 1);
rep('btn violet',  /bg-\[color-mix\(in_oklab,var\(--nn-violet\)_22%,transparent\)\] disabled:opacity-50 text-\[color:var\(--nn-text-primary\)\] px-6 py-4 rounded-none font-semibold transition-colors/g, 'nn-abtn nn-abtn--violet disabled:opacity-50', 1);

// emoji strip
rep('e unban', /✅ Unban Player/, 'Unban Player');
rep('e ban', /🚫 Ban Player/, 'Ban Player');
rep('e gems', /💎 Give Resources/, 'Give Resources');
rep('e broom', /🧹 Clear Flags/, 'Clear Flags');
rep('e reset', /🔄 Reset Progress/, 'Reset Progress');

writeFileSync(f, s);
console.log(misses.length ? 'MISSES: ' + misses.join(' | ') : 'all transforms applied');
