/* FID-20260906-005 Phase A2/B codemod: default-grays → glass theme tokens on the
 * secondary surface (the R2 two-theme split). Deterministic, ordered longest-first,
 * modifier-aware (e.g. bg-gray-900/80 keeps its alpha only when the target token is
 * a solid hex; rgba-based glass tokens drop the modifier).
 * Usage: node dev/scripts/ui-gray-codemod.cjs [--apply]   (dry-run is the default)
 */
const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');

const ROOTS = [
  'app/leaderboard', 'app/stats', 'app/messages', 'app/clans', 'app/clan',
  'app/help', 'app/profile', 'app/referrals', 'app/shop', 'app/tech-tree', 'app/map',
  'components/messaging', 'components/clan', 'components/leaderboard',
  // import-closure additions (FID §4 Phase A2): sub-components of the pages above
  'components/ReferralDashboard.tsx', 'components/ReferralLeaderboard.tsx',
  'components/map', 'components/TopNavBar.tsx', 'components/SafeHtmlRenderer.tsx',
  'components/BackButton.tsx',
];

// FID §4 Phase A2 mapping table. keepModifier=true only for solid-hex targets.
const MAPPINGS = [
  // Ghost classes referencing tokens that never existed (FID-005 audit): repair first
  { from: 'bg-bg-primary', to: 'bg-bg-space', keepModifier: true },
  { from: 'bg-bg-secondary', to: 'bg-bg-nebula', keepModifier: true },
  { from: 'border-border-main', to: 'border-glass-border', keepModifier: false },
  // Gradients (space-fade page backgrounds)
  { from: 'from-gray-950', to: 'from-bg-void', keepModifier: true },
  { from: 'via-gray-950', to: 'via-bg-void', keepModifier: true },
  { from: 'to-gray-950', to: 'to-bg-void', keepModifier: true },
  { from: 'from-gray-900', to: 'from-bg-space', keepModifier: true },
  { from: 'via-gray-900', to: 'via-bg-space', keepModifier: true },
  { from: 'to-gray-900', to: 'to-bg-space', keepModifier: true },
  { from: 'from-gray-800', to: 'from-bg-nebula', keepModifier: true },
  { from: 'via-gray-800', to: 'via-bg-nebula', keepModifier: true },
  { from: 'to-gray-800', to: 'to-bg-nebula', keepModifier: true },
  // Backgrounds
  { from: 'bg-gray-950', to: 'bg-bg-void', keepModifier: true },
  { from: 'bg-gray-900', to: 'bg-glass-dark', keepModifier: false },
  { from: 'bg-gray-750', to: 'bg-glass-light', keepModifier: false }, // ghost shade
  { from: 'bg-gray-800', to: 'bg-glass-light', keepModifier: false },
  { from: 'bg-gray-700', to: 'bg-glass-light', keepModifier: false },
  { from: 'bg-gray-600', to: 'bg-glass-light', keepModifier: false },
  { from: 'bg-gray-100', to: 'bg-bg-nebula', keepModifier: true },
  // Borders / dividers
  { from: 'border-gray-400', to: 'border-glass-border', keepModifier: false },
  { from: 'border-gray-600', to: 'border-glass-border', keepModifier: false },
  { from: 'border-gray-700', to: 'border-glass-border', keepModifier: false },
  { from: 'divide-gray-700', to: 'divide-glass-border', keepModifier: false },
  // Slate (the other default-gray vocabulary found on the same surface)
  { from: 'bg-slate-900', to: 'bg-glass-dark', keepModifier: false },
  { from: 'bg-slate-800', to: 'bg-glass-light', keepModifier: false },
  { from: 'bg-slate-700', to: 'bg-glass-light', keepModifier: false },
  { from: 'border-slate-500', to: 'border-glass-border', keepModifier: false },
  { from: 'border-slate-600', to: 'border-glass-border', keepModifier: false },
  { from: 'border-slate-700', to: 'border-glass-border', keepModifier: false },
  { from: 'text-slate-300', to: 'text-text-primary', keepModifier: false },
  { from: 'text-slate-400', to: 'text-text-secondary', keepModifier: false },
  { from: 'text-slate-500', to: 'text-text-tertiary', keepModifier: false },
  // Text
  { from: 'text-gray-300', to: 'text-text-primary', keepModifier: false },
  { from: 'text-gray-400', to: 'text-text-secondary', keepModifier: false },
  { from: 'text-gray-500', to: 'text-text-secondary', keepModifier: false },
  { from: 'text-gray-600', to: 'text-text-tertiary', keepModifier: false },
  { from: 'text-gray-700', to: 'text-text-tertiary', keepModifier: false },
  // Placeholders
  { from: 'placeholder-gray-400', to: 'placeholder-text-secondary', keepModifier: false },
  { from: 'placeholder-gray-500', to: 'placeholder-text-secondary', keepModifier: false },
  { from: 'placeholder-gray-600', to: 'placeholder-text-secondary', keepModifier: false },
  // Misc
  { from: 'fill-gray-600', to: 'fill-text-secondary', keepModifier: false },
].sort((a, b) => b.from.length - a.from.length);

function walk(dir, out = []) {
  // Single files are valid roots (the import-closure additions) — handle them first.
  if (fs.existsSync(dir) && fs.statSync(dir).isFile()) {
    if (dir.endsWith('.tsx')) out.push(dir);
    return out;
  }
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const files = ROOTS.flatMap((r) => walk(r));
let total = 0;
const touched = [];

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  let next = src;
  let count = 0;
  for (const { from, to, keepModifier } of MAPPINGS) {
    const re = new RegExp(esc(from) + '(\\/\\d{1,3})?(?=[\\s"\'`>\\)])', 'g');
    next = next.replace(re, (_m, mod) => {
      count++;
      return to + (keepModifier && mod ? mod : '');
    });
  }
  if (count > 0) {
    total += count;
    touched.push({ file: file.replace(/\\/g, '/'), count });
    if (APPLY) fs.writeFileSync(file, next);
  }
}

touched.sort((a, b) => b.count - a.count);
for (const t of touched) console.log(`${t.count}\t${t.file}`);
console.log(APPLY ? `\nAPPLIED: ${total} replacements across ${touched.length} files` : `\nDRY RUN: ${total} replacements would be applied across ${touched.length} files (pass --apply)`);
