/* Temporary audit tool: sweep all API routes on prod with GET; report 500s + error bodies. */
const fs = require('fs');
const _path = require('path');

const BASE = process.env.PROD_BASE || 'https://darkframe-savantai.vercel.app';
const routes = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__') continue;
    const full = dir + '/' + e.name;
    if (e.isDirectory()) walk(full);
    else if (e.name === 'route.ts') routes.push(full.replace(/\\/g, '/').replace(/^app\/api/, '').replace(/\/route\.ts$/, ''));
  }
}
walk('app/api');

const COOKIE_FILE = process.env.COOKIE_FILE || '/tmp/sweep.jar';
const { execSync } = require('child_process');

// Group by top segment, warm each segment once (cold lambda), then time each GET.
const bySegment = {};
for (const r of routes) {
  const seg = r.split('/')[1] || r;
  (bySegment[seg] = bySegment[seg] || []).push(r);
}

const results = [];
for (const [seg, eps] of Object.entries(bySegment)) {
  execSync(`curl -s --max-time 30 -o /dev/null "${BASE}/api/${seg === 'admin' ? 'admin/stats' : seg}" -b ${COOKIE_FILE} 2>/dev/null || true`, { shell: 'bash' });
  for (const ep of eps) {
    let code = 'ERR', body = '';
    try {
      const out = execSync(
        `curl -s --max-time 25 -w '\\n%{http_code}' "${BASE}/api${ep}" -b ${COOKIE_FILE}`,
        { encoding: 'utf8', shell: 'bash' }
      );
      const lines = out.trim().split('\n');
      code = lines.pop();
      body = lines.join('\n').slice(0, 200);
    } catch (e) {
      body = String(e.message).slice(0, 120);
    }
    results.push({ ep, code, body });
    if (code !== '200' && code !== '401' && code !== '403' && code !== '400' && code !== '404' && code !== '405') {
      console.log(`!! ${code} /api${ep}\n   ${body}`);
    }
  }
}

const ok = results.filter((r) => r.code === '200').length;
const authed = results.filter((r) => ['401', '403'].includes(r.code)).length;
const clientErr = results.filter((r) => ['400', '404', '405'].includes(r.code)).length;
console.log(`\n=== SUMMARY: ${results.length} routes | 200: ${ok} | 401/403 (auth-gated): ${authed} | 400/404/405: ${clientErr} | 5xx/ERR: ${results.length - ok - authed - clientErr} ===`);
