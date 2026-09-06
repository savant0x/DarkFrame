/* FID-20260906-003: admin client->endpoint contract census.
 * 1) every /api/admin/* path fetched by admin client code
 * 2) every /api/admin route that exists on disk
 * reports: client-called-but-missing (dead wires) and existing-but-uncalled (orphans)
 */
const fs = require('fs');
const path = require('path');

const roots = ['app/admin', 'components/admin', 'components'];
const clientPaths = new Set();
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(full);
    } else if (/\.tsx?$/.test(e.name)) {
      const src = fs.readFileSync(full, 'utf8');
      const re = /\/api\/admin\/[A-Za-z0-9_\-\/\[\]]*/g;
      let m;
      while ((m = re.exec(src))) {
        clientPaths.add(m[0].replace(/[.,;)\]]+$/, ''));
      }
    }
  }
};
roots.forEach((r) => walk(r));

const routesDir = 'app/api/admin';
const routePaths = new Set();
const walkRoutes = (dir, acc) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkRoutes(full, acc);
    else if (e.name === 'route.ts') acc.add('/api/admin' + full.slice('app/api/admin'.length).replace(/\\/g, '/').replace(/\/route\.ts$/, ''));
  }
};
walkRoutes(routesDir, routePaths);

// Normalize client paths: strip query strings and dynamic segments for matching
const norm = (p) => p.split('?')[0];
const clientNorm = new Set([...clientPaths].map(norm));

const deadWires = [...clientNorm].filter((p) => !routePaths.has(p)).sort();
const orphans = [...routePaths].filter((p) => !clientNorm.has(p)).sort();

console.log('=== CLIENT-CALLED ADMIN ENDPOINTS (' + clientNorm.size + ') ===');
console.log([...clientNorm].sort().join('\n'));
console.log('\n=== DEAD WIRES — called by client but NO route exists (' + deadWires.length + ') ===');
console.log(deadWires.join('\n') || '(none)');
console.log('\n=== ORPHANS — route exists but NO admin client calls it (' + orphans.length + ') ===');
console.log(orphans.join('\n') || '(none)');
