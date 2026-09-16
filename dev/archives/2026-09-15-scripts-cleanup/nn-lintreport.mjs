// Dump all no-explicit-any lint errors with source lines to /tmp/any-errors.txt
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const raw = execSync('npx eslint app components lib --ext .ts,.tsx -f json || true', {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const r = JSON.parse(raw);
const out = [];
for (const f of r) {
  if (!f.errorCount) continue;
  const lines = readFileSync(f.filePath, 'utf8').split(/\r?\n/);
  const rel = f.filePath.replace(/^.*?[\\/]dev[\\/]/, '').replace(/\\/g, '/');
  for (const m of f.messages) {
    if (m.ruleId !== '@typescript-eslint/no-explicit-any') continue;
    const line = (lines[m.line - 1] || '').trim().slice(0, 160);
    out.push(`${rel}:${m.line}: ${line}`);
  }
}
writeFileSync('/tmp/any-errors.txt', out.join('\n') + '\n');
console.log('wrote', out.length, 'entries');
