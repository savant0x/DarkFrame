/* Audit tool: dead client wiring - fetch() call sites with no matching route on disk. Permanent regression gate: re-run after any route or panel change. */
const fs = require('fs');
const path = require('path');

const ROOTS = ['components', 'context', 'hooks', 'app', 'lib'];
const EXT = ['.ts', '.tsx'];
const callsByFile = new Map(); // endpoint -> Set(files)

function walkSources(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      walkSources(full, cb);
    } else if (EXT.includes(path.extname(e.name)) && !e.name.includes('.test.')) {
      cb(full);
    }
  }
}

// Match fetch('...'), fetch("..."), fetch(`...`) with /api/ inside — same line only.
const FETCH_RE = /fetch\(\s*[`'"](\/api\/[^`'"?\\]+)/g;

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  walkSources(root, (file) => {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(FETCH_RE)) {
      const p = m[1].replace(/^\/api/, '').replace(/\$\{[^}]*\}/g, ':param');
      const parts = p.split('/').filter(Boolean).map((s) => (s.startsWith(':') ? ':param' : s));
      if (parts.length > 1) {
        const key = parts.join('/');
        if (!callsByFile.has(key)) callsByFile.set(key, new Set());
        callsByFile.get(key).add(file.split(path.sep).join('/'));
      }
    }
  });
}

function walkRoutes(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkRoutes(full, acc);
    else if (e.name === 'route.ts') acc.push(full);
  }
  return acc;
}

const routes = walkRoutes('app/api', []).map((f) =>
  f.replace(/\\/g, '/').replace(/^app\/api\//, '').replace(/\/route\.ts$/, '')
    .split('/')
    .map((s) => (s.startsWith('[') ? ':param' : s))
    .join('/')
);

const dead = [];
for (const [endpoint, files] of callsByFile) {
  const cParts = endpoint.split('/');
  const hit = routes.some((r) => {
    const rParts = r.split('/');
    if (rParts.length !== cParts.length) return false;
    return rParts.every((seg, i) => seg === cParts[i] || seg === ':param' || cParts[i] === ':param');
  });
  if (!hit) dead.push({ endpoint, files: [...files] });
}

console.log('client fetch endpoints:', callsByFile.size, '| routes on disk:', routes.length);
console.log('\n=== DEAD WIRING (fetch() with no route on disk) ===');
dead.sort((a, b) => a.endpoint.localeCompare(b.endpoint)).forEach((d) =>
  console.log(`  ${d.endpoint}\n    <- ${d.files.join(', ')}`)
);
