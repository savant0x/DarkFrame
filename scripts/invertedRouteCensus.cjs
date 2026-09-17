#!/usr/bin/env node
/**
 * Inverted route census (FID-20260917-007): every client fetch URL must resolve
 * to an existing app/api route. The inverse of the session-037 dead-route sweep
 * (existing-but-uncalled) — this finds called-but-never-built endpoints, the
 * class behind "Failed to load clan data" (GET /api/clan/[id], fixed 22f5889).
 *
 * Estate: components/ app/(minus app/api) lib/ hooks/ utils/ context/
 * Sources: fetch(`...`), fetch('...'), apiFetch(`...`), apiFetch('...')
 *
 * Method:
 *   1. Build the route set from app/api/**\/route.ts → path patterns
 *      ([id] segments become placeholders for matching).
 *   2. Harvest every fetch/apiFetch call site with a string-literal or
 *      template-literal first argument (tagged templates and concatenations
 *      are recorded as "unparsed" for manual review, not silently dropped).
 *   3. Normalize: strip query strings, drop leading-trailing slashes, compare
 *      segment counts, match literals exactly and [param] segments positionally.
 *   4. Report: MISSING (no route matches) vs OK (matched) vs UNPARSED (needs eyes).
 *   5. Second pass: scan every reported-OK URL's family for near-misses of the
 *      MISSING list (the template-literal lesson from session 037's sweep).
 *
 * Output: console table + exit code 1 if any MISSING (census failure = signal).
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const API_DIR = path.join(ROOT, 'app', 'api');
const SKIP_DIRS = new Set(['node_modules', '.next', 'api', 'archives']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// ---- 1. Route set ----
function routeFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, out);
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}
const routePatterns = new Set();
for (const f of routeFiles(API_DIR)) {
  let rel = path.relative(API_DIR, f).replace(/\\/g, '/');
  rel = rel.replace(/\/route\.ts$/, '');
  if (rel === 'route.ts' || rel === '') continue; // root /api handler edge
  routePatterns.add('/' + rel);
}
const routeSeg = [...routePatterns].map((p) => p.split('/').filter(Boolean));

// ---- 2. Harvest fetch/apiFetch URLs ----
const CALL_RE = /(?:\bfetch|\bapiFetch)\(\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
const calls = [];
const unparsed = [];
for (const file of walk(path.join(ROOT, 'components'))
  .concat(walk(path.join(ROOT, 'lib')))
  .concat(walk(path.join(ROOT, 'hooks')))
  .concat(walk(path.join(ROOT, 'utils')))
  .concat(walk(path.join(ROOT, 'context')))
  .concat(walk(path.join(ROOT, 'app')).filter((f) => !f.startsWith(API_DIR + path.sep)))) {
  const src = fs.readFileSync(file, 'utf8')
    // Strip comments BEFORE harvesting — example fetches in doc blocks
    // (lib/toast.ts /api/battle) are not call sites. Block comments go whole;
    // then full-line // comments drop by trim-prefix (safe: cannot eat
    // 'https://' inside string literals, which never START a line).
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  let m;
  while ((m = CALL_RE.exec(src)) !== null) {
    const raw = m[1];
    const line = src.slice(0, m.index).split('\n').length;
    if (raw.startsWith('`')) {
      const inner = raw.slice(1, -1);
      // Sentinel pass: ${...} → \x01 (one path segment each), THEN cut the query
      // on the joined string (a '?' cut per-chunk leaks '&k=' fragments as bogus
      // segments), THEN split on '/'. A trailing interpolation therefore yields
      // a real dynamic segment (the /api/clan/${id} class).
      const pathTpl = inner.replace(/\$\{[^}]*\}/g, '\x01').split('?')[0];
      const segs = pathTpl
        .split('/')
        .filter((s) => s !== '')
        .map((s) => (s === '\x01' ? '*' : s));
      calls.push({ file: path.relative(ROOT, file), line, raw: inner.trim(), parts: segs });
    } else {
      const u = raw.slice(1, -1).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
      calls.push({ file: path.relative(ROOT, file), line, raw: u, parts: u.split('/').filter(Boolean) });
    }
  }
}

// ---- 3. Matching ----
function matches(parts) {
  if (parts.length === 0 || parts[0] !== 'api') return null;
  const tail = parts.slice(1); // drop leading 'api' — route segs are relative to app/api
  for (const segs of routeSeg) {
    if (segs.length !== tail.length) continue;
    let ok = true;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (s.startsWith('[') && s.endsWith(']')) continue; // dynamic accepts anything
      if (tail[i] !== s) { ok = false; break; }
    }
    if (ok) return '/' + segs.join('/');
  }
  return null;
}

const missing = [];
const ok = [];
// Waivers: documented false positives (do not remove — re-verify on upgrade).
const WAIVERS = [
  {
    file: 'components\\admin\\PlayerDetailModal.tsx',
    rawPrefix: '/api/admin/vip/${action}',
    reason: 'action domain is {grant, revoke}; literal child routes app/api/admin/vip/grant and /revoke exist and Next resolves them at runtime',
  },
];
const waived = [];
for (const c of calls) {
  if (!c.parts.includes('api')) continue; // only API calls are census-relevant
  const route = matches(c.parts);
  if (route) ok.push({ ...c, route });
  else {
    const w = WAIVERS.find((x) => c.file.endsWith(x.file.replace(/\\/g, '\\')) && c.raw.startsWith(x.rawPrefix));
    if (w) waived.push({ ...c, reason: w.reason });
    else missing.push(c);
  }
}

// ---- 4. Report ----
console.log(`routes: ${routePatterns.size} · call sites: ${calls.length} (unparsed: ${unparsed.length})`);
console.log(`\n=== WAIVED (${waived.length}) — documented false positives ===`);
for (const w of waived) console.log(`  ${w.file}:${w.line}  ${w.raw}\n    reason: ${w.reason}`);
console.log(`\n=== MISSING (${missing.length}) — called but no route matches ===`);
for (const c of missing) console.log(`  ${c.file}:${c.line}  ${c.raw}`);
console.log(`\n=== UNPARSED (${unparsed.length}) — needs manual eyes ===`);
for (const u of unparsed) console.log(`  ${u.file}:${u.line}  ${u.raw.slice(0, 90)}`);
process.exit(missing.length > 0 ? 1 : 0);
