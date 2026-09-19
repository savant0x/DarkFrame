/**
 * FID-20260914-009 — collection-mapping regression gate.
 *
 * The shim silently no-ops any `collection('name')` whose name does not
 * resolve against its registry (schema exports ∪ SQL table names ∪
 * TABLE_ALIASES): reads return empty, writes vanish, no error. Four such
 * names shipped and lived undetected until the FID-009 machine census
 * (`scripts/censusCollectionMapping.ts`, which this test imports — the scan
 * executes at module load and covers lib/ + app/ + server.ts, including
 * generic invocations like db.collection<Unit>('units')).
 *
 * Self-validation guards make a broken census false-pass loudly:
 *   - the scan must have found a plausible number of call sites;
 *   - spot-mapped names (players, factories, battleLogs) must resolve.
 * A regression = any NEW unmapped name appearing in production code.
 */
import { describe, it, expect } from 'vitest';
import { calls, unmapped, TABLE_REGISTRY, TABLE_ALIASES } from '@/scripts/censusCollectionMapping';

describe('FID-20260914-009: every production collection name resolves on the shim', () => {
  it('census scan is alive (found production call sites)', () => {
    // FID-20260917-017 retired every app/api call site and converted the
    // batch-4 lib services in place; the remaining literals live in the
    // lib-adjacent pin suites that keep the shim quarantined. The floor
    // tracks that shrinkage — if this ever reaches 0 the census is vacuous
    // and should be deleted together with its last consumer.
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('registry is populated and canonical names resolve directly', () => {
    expect(Object.keys(TABLE_REGISTRY).length).toBeGreaterThan(50);
    expect(TABLE_REGISTRY['players']).toBeDefined();
    expect(TABLE_REGISTRY['factories']).toBeDefined();
    expect(TABLE_REGISTRY['battleLogs']).toBeDefined();
  });

  it('aliases remain intact (legacy names keep resolving)', () => {
    expect(TABLE_ALIASES['users']).toBe('players');
    expect(TABLE_ALIASES['BattleLog']).toBeUndefined(); // retired with Phase B — must NOT come back
    expect(TABLE_ALIASES['playerLevelHistory']).toBeUndefined(); // now a real table, not an alias
  });

  it('zero unmapped collection names in production code', () => {
    expect(
      unmapped,
      `unmapped collection names found: ${unmapped.join(', ')} — add the schema export ` +
        `(or a TABLE_ALIASES entry with a dated FID note) in lib/mongodb.ts, or fix the name`
    ).toEqual([]);
  });
});
