// Document audit only: reads plans/evidence, never connects to a database.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const auditDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(auditDirectory, '../..');
const evidencePath = path.join(auditDirectory, 'PROJECT-REVIEW-2026-10-02-REMEDIATION-EVIDENCE.json');
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const errors = [];
const levenshtein = (function levenshtein(a,b){let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;a=a.slice(start);b=b.slice(start);let end=0;while(end<a.length&&end<b.length&&a[a.length-1-end]===b[b.length-1-end])end++;if(end){a=a.slice(0,-end);b=b.slice(0,-end);}if(!a.length)return b.length;if(!b.length)return a.length;if(a.length>b.length){const t=a;a=b;b=t;}let previous=new Uint32Array(a.length+1),current=new Uint32Array(a.length+1);for(let j=0;j<=a.length;j++)previous[j]=j;for(let i=1;i<=b.length;i++){current[0]=i;const code=b.charCodeAt(i-1);for(let j=1;j<=a.length;j++)current[j]=Math.min(previous[j]+1,current[j-1]+1,previous[j-1]+(a.charCodeAt(j-1)!==code));const swap=previous;previous=current;current=swap;}return previous[a.length];});
const counts = new Map();
const inventory = {existing: 0, plannedAdditions: 0};
for (const document of evidence.documents) {
  const absolute = path.resolve(root, document.path);
  const body = fs.readFileSync(absolute, 'utf8');
  const expected = document.versions.at(-1).body;
  if (body !== expected) errors.push(document.id + ': exact-character mismatch');
  if (document.sha256 && crypto.createHash('sha256').update(body).digest('hex') !== document.sha256) errors.push(document.id + ': SHA256');
  if (!body.includes('**ID:** ' + document.id)) errors.push(document.id + ': ID');
  if (!body.includes('**Filename:** ' + path.basename(document.path))) {
    if (!body.includes('**Filename:** `' + path.basename(document.path) + '`')) errors.push(document.id + ': filename');
  }
  const sections = [...body.matchAll(/^## (\d)\./gm)].map(m => m[1]).join(',');
  if (sections !== '1,2,3,4,5,6,7,8') errors.push(document.id + ': sections ' + sections);
  const status = body.match(/\*\*Status:\*\* ([^\r\n]+)/)?.[1];
  const finalStatus = body.match(/\*\*Final status:\*\* ([^\r\n]+)/)?.[1];
  if (status !== finalStatus || !['analyzed', 'loop-complete'].includes(status)) errors.push(document.id + ': status');
  const refs = body.match(/\*\*Review coverage:\*\* ([^.]+)\./)?.[1].match(/R\d+/g) ?? [];
  for (const ref of refs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
  for (const match of body.matchAll(/^\| `([^`]+)` \| (modify|add) \|/gm)) {
    const target = path.resolve(root, match[1]);
    if (!target.startsWith(root + path.sep)) errors.push(document.id + ': inventory escapes root');
    if (match[2] === 'modify') {
      inventory.existing++;
      if (!fs.existsSync(target)) errors.push(document.id + ': missing modify ' + match[1]);
    } else {
      inventory.plannedAdditions++;
      if (fs.existsSync(target)) errors.push(document.id + ': proposed add already exists ' + match[1]);
    }
  }
  for (const match of body.matchAll(/\]\(([^)]+)\)/g)) {
    if (!match[1].startsWith('http') && !fs.existsSync(path.resolve(path.dirname(absolute), match[1]))) errors.push(document.id + ': broken link ' + match[1]);
  }
  for (const command of ['npx tsc --noEmit', 'npm run lint', 'npm run test:ci']) {
    if (!body.includes(command)) errors.push(document.id + ': missing gate ' + command);
  }
  for (let i = 1; i < document.versions.length; i++) {
    const before = document.versions[i - 1].body;
    const version = document.versions[i];
    const distance = levenshtein(before, version.body);
    if (distance !== version.distance || Math.abs(version.deltaPercent - distance / before.length * 100) > 1e-9) errors.push(document.id + ': incorrect revision measurement');
    if (version.deltaPercent > 10) errors.push(document.id + ': change cap');
  }
  if (evidence.status === 'complete') {
    if (status !== 'loop-complete') errors.push(document.id + ': incomplete status');
    if (!document.versions.slice(-2).every(v => v.deltaPercent < 2)) errors.push(document.id + ': convergence');
    if (document.versions.length - 1 > 10) errors.push(document.id + ': iteration hard stop');
  }
}
for (const source of evidence.sourceHashes ?? []) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root, source.path))).digest('hex').toUpperCase();
  if (hash !== source.sha256) errors.push('Changed review source: ' + source.path);
}
for (let n = 1; n <= 19; n++) if (counts.get('R' + n) !== 1) errors.push('R' + n + ': owner count ' + counts.get('R' + n));
if (counts.size !== 19) errors.push('Unexpected finding IDs');
for (const probe of evidence.callerProbes) if (probe.exit_code !== 0 || !probe.output.trim()) errors.push('Empty/failed caller probe ' + probe.fid);
if (evidence.documents.length !== 12 || evidence.callerProbes.length !== 12) errors.push('Expected 12 FIDs and caller probes');
process.stdout.write(JSON.stringify({verdict: errors.length ? 'FAIL' : 'PASS', fullDocuments: evidence.documents.length, findingOwners: counts.size, callerProbes: evidence.callerProbes.length, inventory, errors}, null, 2) + '\n');
if (errors.length) process.exitCode = 1;
