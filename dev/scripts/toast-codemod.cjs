/* FID-20260906-005 T2.1 codemod: window.alert()/window.confirm() → toast/confirmDialog.
 * - alert(msg) → showSuccess/showError/showInfo(msg) by content classification
 * - confirm(msg) → await confirmDialog(msg)  (asyncification fixed via tsc after)
 * Skips comment lines. Adds needed imports. Dry-run by default (--apply writes).
 */
const fs = require('fs');

const APPLY = process.argv.includes('--apply');

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const FILES = [...walk('app'), ...walk('components')];

// alert() content classification (success/error/neutral), refined per FID §4 T2.
function classify(msg) {
  if (/error|failed|failure|❌|not loaded|not found|invalid|must |cannot|can't|unable/i.test(msg)) return 'showError';
  if (/success|saved|complete|created|deleted|updated|granted|revoked|spawned|✅|cleared|reset|expired|regenerat|respawn/i.test(msg)) return 'showSuccess';
  return 'showInfo';
}

const stats = { alert: 0, confirm: 0, files: [] };

for (const file of FILES) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  let changed = false;
  let usedToast = false;
  let usedConfirm = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Single-line alert(...) with a template literal or string argument
    let m = lines[i].match(/^(\s*)alert\((.+)\);?\s*$/);
    if (m) {
      const [, indent, arg] = m;
      const fn = classify(arg);
      lines[i] = `${indent}${fn}(${arg});`;
      usedToast = true;
      stats.alert++;
      changed = true;
      continue;
    }

    // Multi-line alert( — attach the argument expression to a single call (rare: analyticsText)
    if (/^(\s*)alert\($/.test(trimmed) === false && /^\s*alert\(\s*$/.test(lines[i])) {
      const indent = lines[i].match(/^(\s*)/)[1];
      let j = i + 1;
      let depth = 1;
      while (j < lines.length && depth > 0) {
        depth += (lines[j].match(/\(/g) || []).length - (lines[j].match(/\)/g) || []).length;
        if (depth <= 0) break;
        j++;
      }
      if (depth === 0) {
        const argLines = lines.slice(i + 1, j + 1).map((l) => l.replace(/\)\s*;?\s*$/, ''));
        lines[i] = `${indent}${indent ? '' : ''}showInfo(${argLines.join('\n').trim()});`;
        for (let k = i + 1; k <= j; k++) lines[k] = null;
        usedToast = true;
        stats.alert++;
        changed = true;
      }
      continue;
    }

    // confirm(...) → await confirmDialog(...) — statement position only:
    // "if (!confirm(...)) return;" and "if (!confirm(...)) { ... }" and bare "const x = confirm(...)"
    let cm = lines[i].match(/^(\s*)if\s*\(!\s*confirm\((.+)\)\)\s*(return;?)\s*$/);
    if (cm) {
      const [, indent, arg, ret] = cm;
      lines[i] = `${indent}if (!(await confirmDialog(${arg}))) ${ret}`;
      usedConfirm = true;
      stats.confirm++;
      changed = true;
      continue;
    }
    cm = lines[i].match(/^(\s*)if\s*\(!\s*confirm\((.+)\)\)\s*\{\s*$/);
    if (cm) {
      const [, indent, arg] = cm;
      lines[i] = `${indent}if (!(await confirmDialog(${arg}))) {`;
      usedConfirm = true;
      stats.confirm++;
      changed = true;
      continue;
    }
    cm = lines[i].match(/^(\s*)(const|let)\s+(\w+)\s*=\s*confirm\((.+)\);?\s*$/);
    if (cm) {
      const [, indent, kw, name, arg] = cm;
      lines[i] = `${indent}${kw} ${name} = await confirmDialog(${arg});`;
      usedConfirm = true;
      stats.confirm++;
      changed = true;
      continue;
    }
    cm = lines[i].match(/^(\s*)confirm\((.+)\);?\s*$/);
    if (cm) {
      const [, indent, arg] = cm;
      lines[i] = `${indent}await confirmDialog(${arg});`;
      usedConfirm = true;
      stats.confirm++;
      changed = true;
    }
  }

  let next = lines.filter((l) => l !== null).join('\n');

  if (changed && APPLY) {
    if (usedToast && !/from '@\/lib\/toastService'/.test(next)) {
      next = next.replace(
        /('use client';\n)/,
        `$1\nimport { showSuccess, showError, showInfo } from '@/lib/toastService';\n`,
      );
    }
    if (usedConfirm && !/ConfirmDialog/.test(next)) {
      const imp = "import { confirmDialog } from '@/components/ui/ConfirmDialog';";
      if (/'use client';\n/.test(next)) {
        next = next.replace(/('use client';\n)/, `$1\n${imp}\n`);
      } else {
        next = imp + '\n\n' + next;
      }
    }
    fs.writeFileSync(file, next);
  }
  if (changed) stats.files.push(file);
}

if (APPLY) {
  console.log(`APPLIED: ${stats.alert} alerts, ${stats.confirm} confirms across ${stats.files.length} files`);
  stats.files.forEach((f) => console.log('  ' + f));
} else {
  console.log(`DRY RUN: ${stats.alert} alerts, ${stats.confirm} confirms across ${stats.files.length} files (pass --apply)`);
  stats.files.forEach((f) => console.log('  ' + f));
}
