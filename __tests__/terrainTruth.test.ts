/**
 * terrainTruth — the census-style pin for the farmable-terrain contract.
 *
 * FID-20260927-001. Before this file, "which terrains are farmable" was written
 * out independently in seven places across six files. FID-20260925-003 was one
 * of those copies disagreeing with the others, silently disabling Forest for
 * every player. The interim control could not catch that class by construction:
 * it pinned the guard against its own hand-copied list, so a future edit to
 * either side survived the test.
 *
 * `FARMABLE_TERRAINS` in `types/game.types.ts` is now the single definition.
 * These assertions hold that definition honest from four directions:
 *
 *   1. inventory  — no phantom terrain; every member is a real `TerrainType`
 *   2. consumer   — census: no hand-rolled farmability list anywhere in the tree
 *   3. payout     — every farmable terrain has a dispatch branch in /api/harvest
 *   4. intent     — the constant equals the documented set (fails FIRST on a
 *                   deliberate change, forcing the intent to be updated in one
 *                   place rather than seven)
 *
 * Assertion 2 is the one that would have caught FID-20260925-003.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TerrainType, FARMABLE_TERRAINS, isFarmableTerrain } from '@/types/game.types';

const ROOT = path.resolve(__dirname, '..');

/** Directories the consumer census sweeps. `types/` is excluded by the check below. */
const SWEPT_DIRS = ['lib', 'app/api', 'components', 'utils'] as const;

/** Recursively collect source files under a directory. */
function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(rel, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      acc.push(rel);
    }
  }
  return acc;
}

/**
 * Byte spans of `Record<...> = { ... }` object literals in a source file.
 *
 * A Record keyed by TerrainType is a LOOKUP TABLE, not a membership list —
 * `HarvestModal.tsx`'s `PRE_HARVEST_MESSAGES` is keyed by exactly the four
 * farmable terrains, but it decides nothing about eligibility. Flagging it as a
 * hand-rolled farmability list would be a false positive, so its span is
 * excluded from the census. The coupling it *does* have (a new farmable terrain
 * would silently fall back to a default message) is pinned separately, by the
 * "every farmable terrain has a pre-harvest message" assertion below.
 */
function recordLiteralSpans(source: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const decl = /Record<[^;=]*?>\s*=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(source)) !== null) {
    const open = m.index + m[0].length - 1;
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) {
          spans.push([m.index, i]);
          break;
        }
      }
    }
  }
  return spans;
}

describe('terrainTruth: the farmable-terrain contract', () => {
  describe('1. inventory direction', () => {
    it('every farmable terrain is a real TerrainType member (no phantoms)', () => {
      const known = new Set<string>(Object.values(TerrainType));
      for (const terrain of FARMABLE_TERRAINS) {
        expect(known.has(terrain)).toBe(true);
      }
    });

    it('the constant has no duplicate members', () => {
      expect(new Set(FARMABLE_TERRAINS).size).toBe(FARMABLE_TERRAINS.length);
    });

    it('the predicate agrees with the constant it is derived from', () => {
      for (const terrain of Object.values(TerrainType)) {
        expect(isFarmableTerrain(terrain)).toBe(FARMABLE_TERRAINS.includes(terrain));
      }
    });
  });

  describe('2. consumer direction (census)', () => {
    it('no file hand-rolls its own farmability list', () => {
      // The fingerprint of a hand-rolled farmability list is a *closed* set of
      // farmable terrains: a statement naming Metal AND (Cave or Forest) while
      // naming NONE of the non-farmable terrains.
      //
      // Both halves of that discriminator are load-bearing, and each was added
      // because a real file tripped it:
      //   - Requiring Cave/Forest (not just "two farmable members") keeps the
      //     route's `Metal || Energy` path-selection branch legal: it names two
      //     farmable terrains but selects a payout PATH, not eligibility.
      //   - Excluding statements that also name a non-farmable terrain keeps
      //     legitimate broader enumerations legal: `mapService.ts`'s weight
      //     table (Metal..Wasteland) and `terrainCodec.ts`'s 9-member wire
      //     codec. Farmable is a SUBSET of those, not the same thing.
      //
      // Matching is per-statement, not per-line: the original copy in
      // `TileRenderer.tsx` is a 4-line OR-chain and a same-line check missed it.
      const NON_FARMABLE = [
        'TerrainType.Factory',
        'TerrainType.Wasteland',
        'TerrainType.Bank',
        'TerrainType.Shrine',
        'TerrainType.AuctionHouse',
      ];

      const offenders: string[] = [];

      for (const dir of SWEPT_DIRS) {
        for (const rel of collectSourceFiles(dir)) {
          const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
          const lookupTables = recordLiteralSpans(source);
          const inLookupTable = (offset: number) => lookupTables.some(([a, b]) => offset >= a && offset <= b);

          // Split into statements. `{`/`}`/`;` bound a statement for every
          // multi-line construct in this codebase (array literals, OR-chains,
          // object maps, if-conditions).
          const statements = source.split(/[;{}]/);
          let consumed = 0;
          for (const statement of statements) {
            const startOffset = consumed;
            const startLine = source.slice(0, startOffset).split(/\r?\n/).length;
            consumed += statement.length + 1;

            const isSetShaped =
              statement.includes('TerrainType.Metal') &&
              (statement.includes('TerrainType.Cave') || statement.includes('TerrainType.Forest'));
            const namesNonFarmable = NON_FARMABLE.some((t) => statement.includes(t));

            if (isSetShaped && !namesNonFarmable && !inLookupTable(startOffset)) {
              offenders.push(`${rel}:${startLine} (hand-rolled farmability set)`);
            }
          }

          // The string-typed copy: a locally declared farmable-terrain string
          // array is invisible to tsc, so a typo in it compiles clean. Every
          // occurrence is reported, not just the first in the file.
          const stringArray = /harvestableTerrains\s*=\s*\[/g;
          let m: RegExpExecArray | null;
          while ((m = stringArray.exec(source)) !== null) {
            const lineNo = source.slice(0, m.index).split(/\r?\n/).length;
            offenders.push(`${rel}:${lineNo} (string-typed farmable-terrain array)`);
          }
        }
      }

      expect(
        offenders,
        `Hand-rolled farmability lists found. Re-point these at FARMABLE_TERRAINS / isFarmableTerrain:\n  ${offenders.join('\n  ')}`
      ).toEqual([]);
    });
  });

  describe('3. payout direction', () => {
    it('every farmable terrain has a dispatch branch the route can pay', () => {
      const route = fs.readFileSync(path.join(ROOT, 'app/api/harvest/route.ts'), 'utf8');

      // Each farmable terrain must be named in the route's dispatch chain.
      for (const terrain of FARMABLE_TERRAINS) {
        expect(route, `route.ts never dispatches on ${terrain}`).toContain(`TerrainType.${terrain}`);
      }
    });

    it('the route reaches a real payout function for each terrain path', () => {
      const route = fs.readFileSync(path.join(ROOT, 'app/api/harvest/route.ts'), 'utf8');
      for (const fn of ['harvestResourceTile', 'harvestCaveTile', 'harvestForestTile']) {
        expect(route).toContain(fn);
      }
    });
  });

  describe('4. intent records', () => {
    it('the constant equals the documented farmable set', () => {
      // This is the assertion that fails FIRST when a human deliberately
      // changes the set — forcing the intent to be updated here, in one place,
      // rather than hand-synced into seven call sites.
      expect([...FARMABLE_TERRAINS]).toEqual([
        TerrainType.Metal,
        TerrainType.Energy,
        TerrainType.Cave,
        TerrainType.Forest,
      ]);
    });

    it('non-farmable terrains stay non-farmable', () => {
      for (const terrain of [TerrainType.Factory, TerrainType.Wasteland, TerrainType.Bank, TerrainType.Shrine, TerrainType.AuctionHouse]) {
        expect(isFarmableTerrain(terrain)).toBe(false);
      }
    });
  });

  describe('5. adjacent couplings the single source now makes visible', () => {
    it('every farmable terrain has a pre-harvest message', () => {
      // `HarvestModal.tsx`'s PRE_HARVEST_MESSAGES is a Record keyed by exactly
      // the farmable terrains. It is a lookup table, not a membership list, so
      // the census above correctly ignores it — but it is coupled to the farmable
      // set, and it degrades SILENTLY: an unmapped terrain falls through
      // `|| []` to the generic 'Ready to harvest?'. Before this assertion, adding
      // a fifth farmable terrain would quietly ship a wrong message.
      const source = fs.readFileSync(path.join(ROOT, 'components/HarvestModal.tsx'), 'utf8');
      const missing = FARMABLE_TERRAINS.filter((t) => !source.includes(`[TerrainType.${t}]:`));

      expect(
        missing,
        `These farmable terrains have no PRE_HARVEST_MESSAGES entry and would silently fall back:\n  ${missing.join('\n  ')}`
      ).toEqual([]);
    });
  });
});
