/**
 * @file __tests__/lib/chatItemLinks.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-008: item-link parsing against the real
 *            catalog (lib/chatItemLinks) and the catalog itself
 *            (lib/catalogService) — the replacement of chatService's
 *            always-false validateItem stub.
 */
import { describe, it, expect } from 'vitest';
import {
  parseItemLinkSegments,
  itemLinkHref,
  catalogTabFor,
  ITEM_LINK_REGEX,
} from '@/lib/chatItemLinks';
import { validateItem, resolveCatalogEntry, ITEM_CATALOG_NAMES } from '@/lib/catalogService';

describe('catalogService (the real item universe)', () => {
  it('validates unit types case-insensitively, trimmed', () => {
    expect(validateItem('T1_SCOUT')).toBe(true);
    expect(validateItem('t1_scout')).toBe(true);
    expect(validateItem('  T1_SCOUT  ')).toBe(true);
  });

  it('validates resource types case-insensitively', () => {
    expect(validateItem('metal')).toBe(true);
    expect(validateItem('METAL')).toBe(true);
    expect(validateItem('Energy')).toBe(true);
  });

  it('rejects unknown items — the stub used to reject everything', () => {
    expect(validateItem('notarealitem')).toBe(false);
    expect(validateItem('')).toBe(false);
    expect(validateItem('T1_SCOUT_EXTRA')).toBe(false);
  });

  it('resolves to the canonical entry with its kind', () => {
    expect(resolveCatalogEntry('t1_scout')).toEqual({ name: 'T1_SCOUT', kind: 'unit' });
    expect(resolveCatalogEntry('ENERGY')).toEqual({ name: 'energy', kind: 'resource' });
    expect(resolveCatalogEntry('junk')).toBeNull();
  });

  it('catalog is non-empty and includes both kinds', () => {
    expect(ITEM_CATALOG_NAMES.length).toBeGreaterThan(4);
    expect(ITEM_CATALOG_NAMES).toContain('T1_SCOUT');
    expect(ITEM_CATALOG_NAMES).toContain('metal');
  });
});

describe('parseItemLinkSegments', () => {
  it('turns a valid bracketed name into a canonical itemLink', () => {
    const segs = parseItemLinkSegments('selling [t1_scout] cheap');
    expect(segs).toEqual([
      { type: 'text', value: 'selling ' },
      { type: 'itemLink', name: 'T1_SCOUT', entry: { name: 'T1_SCOUT', kind: 'unit' } },
      { type: 'text', value: ' cheap' },
    ]);
  });

  it('resource links resolve with kind resource', () => {
    const segs = parseItemLinkSegments('[Metal] x1000');
    expect(segs[0]).toMatchObject({ type: 'itemLink', name: 'metal', entry: { kind: 'resource' } });
  });

  it('invalid brackets stay literal text (no fake links)', () => {
    const segs = parseItemLinkSegments('look at [notarealitem] now');
    expect(segs).toEqual([
      { type: 'text', value: 'look at ' },
      { type: 'invalidItem', value: '[notarealitem]' },
      { type: 'text', value: ' now' },
    ]);
  });

  it('handles multiple links and adjacency', () => {
    const segs = parseItemLinkSegments('[metal][energy]');
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ type: 'itemLink', name: 'metal' });
    expect(segs[1]).toMatchObject({ type: 'itemLink', name: 'energy' });
  });

  it('does not match brackets containing newlines or exceeding 64 chars', () => {
    expect(parseItemLinkSegments('[two\nlines]')).toEqual([
      { type: 'text', value: '[two\nlines]' },
    ]);
    const long = 'a'.repeat(65);
    expect(parseItemLinkSegments(`[${long}]`)).toEqual([{ type: 'text', value: `[${long}]` }]);
    // boundary: exactly 64 chars matches
    expect(parseItemLinkSegments(`[${'a'.repeat(64)}]`)[0].type).toBe('invalidItem'); // matched, but not catalog-valid
  });

  it('plain content yields one text segment; empty yields none', () => {
    expect(parseItemLinkSegments('no brackets here')).toEqual([
      { type: 'text', value: 'no brackets here' },
    ]);
    expect(parseItemLinkSegments('')).toEqual([]);
  });

  it('regex is stateless across calls (global flag safety)', () => {
    parseItemLinkSegments('[metal] [metal]');
    const segs = parseItemLinkSegments('[energy]');
    expect(segs[0]).toMatchObject({ type: 'itemLink', name: 'energy' });
    expect(ITEM_LINK_REGEX.lastIndex).toBe(0);
  });
});

describe('deep-link helpers', () => {
  it('itemLinkHref targets the game page market param, encoded', () => {
    expect(itemLinkHref('T1_SCOUT')).toBe('/game?market=T1_SCOUT');
    expect(itemLinkHref('metal')).toBe('/game?market=metal');
  });

  it('catalogTabFor maps kind to auction tab', () => {
    expect(catalogTabFor({ name: 'T1_SCOUT', kind: 'unit' })).toBe('units');
    expect(catalogTabFor({ name: 'metal', kind: 'resource' })).toBe('resources');
  });
});
