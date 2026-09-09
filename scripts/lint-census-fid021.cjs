/* Read-only census helper for FID-20260908-021 (analysis tooling only — all remediation is by hand).
 * Expects a lint log path as argv[2]; parses per-file error counts grouped by directory. */
const fs = require('fs');

const logPath = process.argv[2] || 'lint-full2.log';
if (!fs.existsSync(logPath)) {
  console.error(`Log not found: ${logPath} — pass the eslint output log as argv[2]`);
  process.exit(1);
}
const raw = fs.readFileSync(logPath, 'utf8');
const lines = raw.split(/\r?\n/);
const counts = {};
let cur = null;
const header = 'C:\\Users\\spenc\\dev\\DarkFrame\\';
for (const line of lines) {
  if (line.startsWith(header)) {
    cur = line.slice(header.length).replace(/\\$/, '');
    continue;
  }
  if (/error|warning/.test(line) && cur) {
    const rule = (line.match(/@typescript-eslint\/[a-z-]+/) || ['other'])[0];
    const key = cur;
    counts[key] = counts[key] || {};
    counts[key][rule] = (counts[key][rule] || 0) + 1;
  }
}
const rows = [];
for (const [file, rules] of Object.entries(counts)) {
  const total = Object.values(rules).reduce((a, b) => a + b, 0);
  rows.push(`${total}\t${file}\t${JSON.stringify(rules)}`);
}
rows.sort((a, b) => parseInt(b) - parseInt(a));
fs.writeFileSync('lint-remaining.txt', rows.join('\n') + '\n');
console.log(rows.slice(0, 45).join('\n'));
console.log('TOTAL FILES:', rows.length);
