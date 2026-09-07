// NEON NOIR admin pass 2 — buttons, badges, toggles, table polish.
// Deterministic, idempotent string replacements on app/admin/AdminView.tsx.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// --- 1. VIP badge: gradient pill -> amber token chip; Basic -> quiet chip
src = src.replace(
  'className="inline-block bg-gradient-to-r from-[color:var(--nn-amber)] to-[color:var(--nn-amber)] text-[color:var(--nn-text-primary)] px-3 py-1 rounded-full text-xs font-bold"',
  'className="nn-chip nn-chip--amber"'
);
src = src.replace(
  'className="inline-block bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-3 py-1 rounded-full text-xs font-bold"',
  'className="nn-chip"'
);

// --- 2. Schedule toggle: rounded switch -> square HUD switch
src = src.replace(
  "className={`w-12 h-6 rounded-full transition-colors ${schedule.enabled ? 'bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)]' : 'bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)]'}`}",
  "className={`nn-switch ${schedule.enabled ? 'nn-switch--on' : ''}`}"
);
src = src.replace(
  "className={`w-5 h-5 bg-[color:var(--nn-text-primary)] rounded-full transition-transform ${schedule.enabled ? 'translate-x-6' : 'translate-x-0.5'}`}",
  'className="nn-switch__knob"'
);

// --- 3. Tier bar: rounded-full track -> nn-meter
src = src.replace(
  'className="flex-1 bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] rounded-full h-6 overflow-hidden"',
  'className="nn-meter flex-1"'
);

// --- 4. Generic tinted action buttons -> nn-btn--ghost / --primary inline
// Refresh (analytics)
src = src.replace(
  "className=\"px-4 py-2 rounded-none font-semibold bg-[color-mix(in_oklab,var(--nn-void)_45%,transparent)] text-[color:var(--nn-text-secondary)] disabled:opacity-50 transition-colors\"",
  "className=\"nn-btn--ghost px-4 py-2 rounded-none disabled:opacity-40\""
);
// VIP refresh (amber tint slab)
src = src.replace(
  "className=\"px-4 py-2 bg-[color-mix(in_oklab,var(--nn-amber)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none font-semibold transition-colors\"",
  "className=\"nn-btn--amber px-4 py-2 rounded-none\""
);
// small table action buttons (cyan/magenta/green tints) -> ghost inline w/ token text
src = src.replace(
  "className=\"px-3 py-1 bg-[color-mix(in_oklab,var(--nn-cyan)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none\"",
  "className=\"nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-cyan)] text-xs\""
);
src = src.replace(
  "className=\"px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none transition-colors\"",
  "className=\"nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-magenta)] text-xs\""
);
src = src.replace(
  "className=\"px-3 py-1 bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] text-[color:var(--nn-text-primary)] text-xs rounded-none\"",
  "className=\"nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-magenta)] text-xs\""
);
src = src.replace(
  "className=\"px-3 py-1 bg-[color-mix(in_oklab,var(--nn-green)_22%,transparent)] text-[color:var(--nn-text-primary)] rounded-none text-xs font-semibold transition-colors\"",
  "className=\"nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-green)] text-xs\""
);
// duplicate stacked tints -> single ghost
src = src.replace(
  /className="px-[34] py-[12] bg-\[color-mix\(in_oklab,var\(--nn-void\)_45%,transparent\)\] bg-\[color-mix\(in_oklab,var\(--nn-text-secondary\)_35%,transparent\)\] text-\[color:var\(--nn-text-primary\)\] rounded-none ([^"]*)"/g,
  'className="nn-btn--ghost px-$1py-2 rounded-none text-xs"'
);
// violet-tinted stacked slab (RP section apply button)
src = src.replace(
  "className=\"px-4 py-2 bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] bg-[color-mix(in_oklab,var(--nn-text-secondary)_35%,transparent)] rounded-none font-semibold transition-colors text-sm\"",
  "className=\"nn-btn--violet px-4 py-2 rounded-none text-sm\""
);
// player table View button
src = src.replace(
  "className=\"bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] text-[color:var(--nn-text-primary)] px-3 py-1 rounded-none text-sm transition-colors\"",
  "className=\"nn-btn--ghost px-3 py-1 rounded-none text-[color:var(--nn-violet)] text-xs\""
);

// --- 5. Remaining emoji in status strings / labels
src = src.replace(/`✅ /g, '`').replace(/`❌ /g, '`');
src = src.replace("'✅ ", "'").replace("'❌ ", "'");
src = src.replace(/{vipLoading \? 'LOADING' : 'REFRESH'}/g, "{vipLoading ? 'LOADING' : 'REFRESH'}");
src = src.replace(/{analyticsLoading \? '⟳' : '🔄'} Refresh/g, "{analyticsLoading ? 'LOADING' : 'REFRESH'}");
src = src.replace(/>⚠ {health/g, '>ALERT · {health');
src = src.replace(/⚠️ System Reset/g, 'System Reset');
src = src.replace(/<span>🍺<\/span>/g, '<Beer className="w-4 h-4" />');
src = src.replace(/'⚔️ Battle'/g, "'Battle'");
src = src.replace(/'🏆 Achievement'/g, "'Achievement'");
src = src.replace(/'📅 Daily Login'/g, "'Daily Login'");

// --- 6. Health strip WMD alert button -> token danger chip button
src = src.replace(
  'className="ml-auto bg-[color-mix(in_oklab,var(--nn-magenta)_22%,transparent)] border border-[color-mix(in_oklab,var(--nn-magenta)_50%,transparent)] px-3 py-1 rounded-none text-[color:var(--nn-magenta)] transition-colors"',
  'className="nn-btn--danger px-3 py-1 rounded-none text-xs ml-auto"'
);

// --- 7. Admin identity chip -> nn-chip--violet
src = src.replace(
  'className="bg-[color-mix(in_oklab,var(--nn-violet)_22%,transparent)] px-4 py-2 rounded-none border border-[color-mix(in_oklab,var(--nn-violet)_50%,transparent)]"',
  'className="nn-chip nn-chip--violet px-4 py-2 text-xs"'
);

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 2 applied' : 'no changes');
