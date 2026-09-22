/**
 * @file __tests__/lib/law17TicketTriage.test.ts
 * @created 2026-09-19 (FID-20260919-017)
 * @overview Pins for the Law-17 ticket triage. Hermetic — reads the migration +
 *            source files and inspects the schema barrel; no DB.
 *            Regression classes pinned:
 *              (a) a "removed" table silently staying in the schema;
 *              (b) the varchar(24) id-overflow class returning to the three
 *                  writers it silently broke.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { generateId } from '@/lib/utils';
import * as schema from '@/lib/db/schema';

const MIGRATION = '0038_law17_ticket_removals.sql';
const REMOVED = [
  'achievements',
  'wmdVotes',
  'wmdConsequenceEvents',
  'wmdResourcePools',
  'wmdDefenseGrids',
];

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('migration 0038 — the five consumerless tables are dropped', () => {
  const sql = read(join('lib', 'db', 'migrations', MIGRATION));

  it('exists as a tracked migration file', () => {
    // (Not "is newest" — later FIDs legitimately add newer migrations.)
    const dir = join(process.cwd(), 'lib', 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f));
    expect(files).toContain(MIGRATION);
  });

  it('drops all five, idempotently', () => {
    for (const table of [
      'achievements',
      'wmd_votes',
      'wmd_consequence_events',
      'wmd_resource_pools',
      'wmd_defense_grids',
    ]) {
      expect(sql).toContain(`DROP TABLE IF EXISTS ${table};`);
    }
  });
});

describe('schema barrel — the removed tables are gone', () => {
  it.each(REMOVED)('%s is no longer exported', (name) => {
    expect(name in schema).toBe(false);
  });
});

describe('the three repaired writers emit ids that fit varchar(24)', () => {
  it('generateId() is within the 24-char PK budget', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateId().length).toBeLessThanOrEqual(24);
    }
  });

  it('spyService uses generateId for the report + counter-intel PKs', () => {
    const src = read('lib/wmd/spyService.ts');
    expect(src).not.toMatch(/wir_\$\{Date\.now\(\)\}/);
    expect(src).not.toMatch(/wcio_\$\{Date\.now\(\)\}/);
    expect(src.match(/id: generateId\(\),/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('defenseService uses generateId for the interception PK', () => {
    const src = read('lib/wmd/defenseService.ts');
    expect(src).not.toMatch(/wi_\$\{Date\.now\(\)\}/);
    expect(src).toContain('id: generateId(),');
  });
});

describe('readers added for the three wired tables', () => {
  it('spyService exposes the intel-report and counter-intel readers', () => {
    const src = read('lib/wmd/spyService.ts');
    expect(src).toContain('export async function getPlayerIntelligenceReports');
    expect(src).toContain('export async function getPlayerCounterIntelHistory');
  });

  it('defenseService exposes the interception-history reader', () => {
    expect(read('lib/wmd/defenseService.ts')).toContain(
      'export async function getDefenderInterceptions'
    );
  });
});
