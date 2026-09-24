#!/usr/bin/env node
/**
 * Timestamp convention census (FID-20260923-001) — fail-closed gate for the
 * naive-timestamp class.
 *
 * A stored instant must be `timestamp with time zone`. A naive
 * (`timestamp without time zone`) column has no single meaning: the application
 * writes the process-local wall clock while the database (`DEFAULT now()`) writes
 * the UTC wall clock, so the two disagree by the process offset — in opposite
 * directions depending on who wrote the row. Migration 0040 converted the 135
 * existing naive columns; this gate keeps the class from coming back.
 *
 * Checks:
 *   A. lib/db/schema/*.ts — every `timestamp('<col>' …)` declaration must carry
 *      `{ withTimezone: true }`. A `defaultNow()` on a naive declaration is
 *      reported separately: over a `timestamptz` column it is correct, over a
 *      naive one it stamps the wrong wall clock.
 *   B. lib/db/migrations/*.sql numbered ABOVE the convention boundary (0040, the
 *      conversion migration) and beyond must not declare a bare `timestamp` type.
 *      Earlier migrations are history and are waived by number — 0040 is what
 *      converts the columns they created; a *new* migration that adds a naive
 *      column is exactly the regression this gate exists to refuse.
 *
 * Fail-closed: a scan/enumeration error exits 2, not 0 — a tool failure must
 * never impersonate a pass (the defect class hardened out of the pre-commit and
 * pre-push gates in 2026-09-16).
 *
 * Usage: node scripts/timestampConventionCensus.cjs
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'lib', 'db', 'schema');
const MIGRATIONS_DIR = path.join(ROOT, 'lib', 'db', 'migrations');

/** The migration that converted the class; SQL at or below it predates the rule. */
const CONVENTION_MIGRATION = 40;

function refuse(msg) {
  process.stdout.write(`TIMESTAMP CENSUS REFUSED: ${msg}\n`);
  process.exit(2);
}

// ---- A. drizzle schema declarations -----------------------------------------
let schemaFiles;
try {
  schemaFiles = fs.readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
} catch (e) {
  refuse(`cannot read ${SCHEMA_DIR}: ${e.message}`);
}
if (schemaFiles.length === 0) refuse('no schema files found');

const DECL = /timestamp\(\s*'([a-z_]+)'\s*(?:,\s*\{([^}]*)\})?\s*\)([^,;]*)/g;
const violations = [];
let declarations = 0;

for (const file of schemaFiles) {
  const src = fs.readFileSync(path.join(SCHEMA_DIR, file), 'utf8');
  const lines = src.split('\n');
  DECL.lastIndex = 0;
  let m;
  while ((m = DECL.exec(src)) !== null) {
    declarations += 1;
    const col = m[1];
    const opts = m[2] || '';
    const tail = m[3] || '';
    const line = src.slice(0, m.index).split('\n').length;
    if (!/withTimezone:\s*true/.test(opts)) {
      const dflt = /defaultNow\(\)/.test(tail);
      violations.push({
        file,
        line,
        col,
        why: dflt ? 'naive column with defaultNow()' : 'naive column (no withTimezone)',
      });
    }
  }
  if (lines.length === 0) refuse(`empty scan of ${file}`);
}

// ---- B. future migrations ---------------------------------------------------
let migrationFiles;
try {
  migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
} catch (e) {
  refuse(`cannot read ${MIGRATIONS_DIR}: ${e.message}`);
}

const MIG_NUM = /^(\d+)/;
const BARE_TS = /"([a-z_]+)"\s+timestamp\b(?!\s+with\s+time\s+zone)/i;
const futureMigrationViolations = [];
let scannedMigrations = 0;

for (const file of migrationFiles) {
  const numMatch = MIG_NUM.exec(file);
  if (!numMatch) continue;
  if (Number(numMatch[1]) <= CONVENTION_MIGRATION) continue; // history, waived by number
  scannedMigrations += 1;
  const src = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  src.split('\n').forEach((raw, i) => {
    const line = raw.replace(/--.*$/, ''); // strip SQL comments
    if (BARE_TS.test(line)) futureMigrationViolations.push({ file, line: i + 1, text: raw.trim() });
  });
}

// ---- Report -----------------------------------------------------------------
process.stdout.write(
  `timestamp census: ${declarations} declaration(s) across ${schemaFiles.length} schema file(s); ` +
    `${scannedMigrations} migration(s) above 00${CONVENTION_MIGRATION} scanned\n`,
);

if (violations.length === 0 && futureMigrationViolations.length === 0) {
  process.stdout.write('timestamp census clean: no naive instants\n');
  process.exit(0);
}

process.stdout.write('\n');
if (violations.length > 0) {
  process.stdout.write(`NAIVE SCHEMA DECLARATIONS (${violations.length}) — add \`{ withTimezone: true }\`:\n`);
  for (const v of violations) {
    process.stdout.write(`  lib/db/schema/${v.file}:${v.line}  ${v.col}  [${v.why}]\n`);
  }
}
if (futureMigrationViolations.length > 0) {
  process.stdout.write(`NAIVE TYPES IN NEW MIGRATIONS (${futureMigrationViolations.length}) — use \`timestamptz\`:\n`);
  for (const v of futureMigrationViolations) {
    process.stdout.write(`  ${v.file}:${v.line}  ${v.text}\n`);
  }
}
process.stdout.write(
  '\nA stored instant is always `timestamptz` (FID-20260923-001). A naive column\n' +
    'silently disagrees with the database by the process offset, in both directions.\n',
);
process.exit(1);
