// NEON NOIR admin pass 9 — filter/period selector buttons -> nn-tabchip.
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'app/admin/AdminView.tsx';
let src = readFileSync(FILE, 'utf8');
const before = src;

// VIP filter: active state per filter (cyan/amber/violet), quiet otherwise
for (const [val] of [['all'], ['vip'], ['basic']]) {
  const re = new RegExp(
    "className=\\{`px-4 py-2 rounded-none font-semibold transition-colors \\$\\{\\s*vipFilter === '" + val + "'\\s*\\? '[^']*'\\s*: '[^']*'\\s*\\}`\\}",
    'g'
  );
  src = src.replace(re, "className={`nn-tabchip ${vipFilter === '" + val + "' ? 'nn-tabchip--on' : ''}`}");
}

// Analytics period selector
for (const [val] of [['24h'], ['7d'], ['30d']]) {
  const re = new RegExp(
    "className=\\{`px-4 py-2 rounded-none font-semibold transition-colors \\$\\{\\s*analyticsPeriod === '" + val + "'\\s*\\? '[^']*'\\s*: '[^']*'\\s*\\}`\\}",
    'g'
  );
  src = src.replace(re, "className={`nn-tabchip ${analyticsPeriod === '" + val + "' ? 'nn-tabchip--on' : ''}`}");
}

// Beer analytics period selector (7d/14d/30d/90d/365d)
src = src.replace(
  /className=\{`px-4 py-2 rounded-none font-semibold transition-colors \$\{\s*beerAnalyticsPeriod === '(\w+)'[\s\S]*?\}`\}/g,
  "className={`nn-tabchip ${beerAnalyticsPeriod === '$1' ? 'nn-tabchip--on' : ''}`}"
);

writeFileSync(FILE, src);
console.log(before.length !== src.length ? 'pass 9 applied' : 'no changes');
