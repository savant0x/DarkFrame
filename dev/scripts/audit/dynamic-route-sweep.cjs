/* Temporary audit tool: GET every dynamic [param] route with a dummy id; report 5xx. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PROD_BASE || 'https://darkframe-savantai.vercel.app';
const COOKIE_FILE = process.env.COOKIE_FILE || '/tmp/sweep.jar';

const dynamic = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__') continue;
    const full = dir + '/' + e.name;
    if (e.isDirectory()) walk(full);
    else if (e.name === 'route.ts' && /\[[^\]]+\]/.test(dir)) dynamic.push(full.replace(/\\/g, '/').replace(/^app\/api/, '').replace(/\/route\.ts$/, ''));
  }
}
walk('app/api');

for (const ep of dynamic) {
  const url = `${BASE}/api${ep.replace(/\[[^\]]+\]/, 'testplayer123')}`;
  let code = 'ERR', body = '';
  try {
    const out = execSync(`curl -s --max-time 25 -w '\\n%{http_code}' "${url}" -b ${COOKIE_FILE}`, { encoding: 'utf8', shell: 'bash' });
    const lines = out.trim().split('\n');
    code = lines.pop();
    body = lines.join('\n').slice(0, 160);
  } catch (e) { body = String(e.message).slice(0, 100); }
  const bad = code.startsWith('5') || code === 'ERR';
  console.log(`${bad ? '!!' : '  '} ${code} /api${ep}  ${bad ? body : ''}`);
}
