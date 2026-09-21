#!/usr/bin/env node
/**
 * Schema consumer census (FID-20260919-014) — enforcement for protocol Law 17:
 * every drizzle table in lib/db/schema must be live (has BOTH a writer and a
 * reader outside its defining file) or carry a removal ticket.
 *
 * Classification per exported pgTable:
 *   LIVE        — writes (insert/update/delete) AND reads (select-from) exist
 *   WRITE-ONLY  — writes exist, no reader  (notifications nobody reads — the
 *                 wmd_notifications failure)
 *   READ-ONLY   — reads exist, no writer   (tables that can never fill — the
 *                 wmd_alerts failure)
 *   NO-CONSUMER — neither                (pure accretion)
 *
 * A failing table escapes only with a REMOVAL TICKET: a file under dev/fids/
 * naming the table. Fail-closed: unparsable/unknown failures exit 1.
 *
 * Usage: node scripts/schemaConsumerCensus.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'lib', 'db', 'schema');
const FIDS_DIR = path.join(ROOT, 'dev', 'fids');

function fail(msg) {
  process.stderr.write(`❌ schema-consumer census: ${msg}\n`);
  process.exit(1);
}

// ---- Collect schema files ----
let schemaFiles;
try {
  schemaFiles = fs
    .readdirSync(SCHEMA_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts');
} catch (e) {
  fail(`cannot read ${SCHEMA_DIR}: ${e.message}`);
}
if (schemaFiles.length === 0) fail('no schema files found');

// ---- Extract exported pgTable names per file ----
const PGTABLE_RE = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(/g;

function tableNames(src) {
  const names = [];
  let m;
  PGTABLE_RE.lastIndex = 0;
  while ((m = PGTABLE_RE.exec(src)) !== null) names.push(m[1]);
  return names;
}

// ---- Build the runtime-code corpus (lib/app/components/scripts, excluding
// schema definitions, archives, tests, and census scripts themselves) ----
function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'archives' || e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.|\.spec\./.test(e.name)) {
      out.push(p);
    }
  }
}

const codeFiles = [];
for (const d of ['lib', 'app', 'components', 'scripts']) {
  walk(path.join(ROOT, d), codeFiles);
}
const corpus = codeFiles
  .filter((p) => !p.includes(`${path.sep}db${path.sep}schema${path.sep}`))
  .map((p) => ({ path: p, src: fs.readFileSync(p, 'utf-8') }));

// ---- Removal tickets: any FID file (open or archived) naming the table ----
let ticketSources = [];
try {
  ticketSources = fs.readdirSync(FIDS_DIR);
  const archiveDir = path.join(FIDS_DIR, 'archive');
  if (fs.existsSync(archiveDir)) {
    for (const f of fs.readdirSync(archiveDir)) ticketSources.push(`archive/${f}`);
  }
} catch {
  // no fids dir — no tickets possible
}
const ticketText = ticketSources
  .map((f) => {
    try {
      return fs.readFileSync(path.join(FIDS_DIR, f), 'utf-8');
    } catch {
      return '';
    }
  })
  .join('\n');

function hasTicket(table) {
  return new RegExp(`\\b${table}\\b`).test(ticketText);
}

// ---- Consumer probes per table ----
function consumes(src, table) {
  const word = `\\b${table}\\b`;
  return {
    write:
      new RegExp(`\\.insert\\(\\s*${word}`).test(src) ||
      new RegExp(`\\.update\\(\\s*${word}`).test(src) ||
      new RegExp(`\\.delete\\(\\s*${word}`).test(src),
    read:
      new RegExp(`\\.select\\(\\s*\\)\\s*\\.from\\(\\s*${word}`).test(src) ||
      new RegExp(`\\.select\\(\\s*\\{[^}]*\\}\\s*\\)\\s*\\.from\\(\\s*${word}`, 's').test(src) ||
      new RegExp(`\\.from\\(\\s*${word}\\s*\\)`).test(src),
  };
}

// ---- Classify ----
const report = [];
for (const file of schemaFiles) {
  const filePath = path.join(SCHEMA_DIR, file);
  const src = fs.readFileSync(filePath, 'utf-8');
  const tables = tableNames(src);
  if (tables.length === 0) continue; // type-only module
  for (const table of tables) {
    let writes = 0;
    let reads = 0;
    for (const { path: p, src: code } of corpus) {
      // Skip the defining file — internal usage is not a live consumer.
      if (p.endsWith(`${path.sep}${file}`)) continue;
      const c = consumes(code, table);
      if (c.write) writes++;
      if (c.read) reads++;
    }
    const live = writes > 0 && reads > 0;
    const ticket = hasTicket(table);
    report.push({ table, file, writes, reads, live, ticket });
  }
}

// ---- Emit ----
const dead = report.filter((r) => !r.live);
const offenders = dead.filter((r) => !r.ticket);

for (const r of report.filter((r) => r.live)) {
  console.log(`  ✓ ${r.table} (${r.file}) — live (w:${r.writes} r:${r.reads})`);
}
for (const r of dead) {
  const tag = r.ticket ? 'ticketed' : 'UNCONSUMERED';
  console.log(
    `  ${r.ticket ? '~' : '✗'} ${r.table} (${r.file}) — ${r.writes && r.reads ? '?' : r.writes ? 'write-only' : r.reads ? 'read-only' : 'no-consumer'} [${tag}]`
  );
}

if (offenders.length > 0) {
  process.stderr.write(
    [
      '',
      `❌ Law 17 violation — ${offenders.length} schema table(s) have no live consumer pair and no removal ticket:`,
      ...offenders.map(
        (r) =>
          `   • ${r.table} (lib/db/schema/${r.file}) — ${
            r.writes ? 'write-only (no reader)' : r.reads ? 'read-only (no writer)' : 'no consumers'
          }`
      ),
      '',
      '   Fix one way:',
      '   1. Wire a producer and/or consumer, then comment the live-consumer pointer on the table block.',
      '   2. File a removal-ticket FID under dev/fids/ naming this table, and record it in SCOPE.md.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(
  `🔍 schema-consumer census: ${report.length} tables — ${report.filter((r) => r.live).length} live, ${dead.length - offenders.length} ticketed, ${offenders.length} violations`
);
