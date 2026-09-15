// @vitest-environment node
/**
 * FID-20260912-093b — label backfill + full-width report contract tests.
 *
 * Pins:
 *  • the backfill SQL's classification: FACTORY rows with bot defenders are
 *    raids; FACTORY rows with human defenders (should none exist) untouched
 *  • the feed maps both BASE_RAID spellings ('BASE_RAID' enum, 'BASE RAID'
 *    parsed headline) to the BASE RAID label
 *  • the report card CSS no longer caps at 420px
 *  • the messages page container is full-width (no max-w-7xl centering)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

describe('FID-093b backfill migration', () => {
  const src = readFileSync(join(ROOT, 'lib/migrations/baseRaidLabelBackfill.ts'), 'utf8');

  it('relabels FACTORY → BASE_RAID only where the defender is a bot', () => {
    expect(src).toContain("b.battle_type = 'FACTORY'");
    expect(src).toContain('p.is_bot = 1');
    expect(src).toContain("SET battle_type = 'BASE_RAID'");
  });

  it('rewrites report message headlines to match the relabeled rows', () => {
    expect(src).toContain("regexp_replace(m.content, '— FACTORY at', '— BASE RAID at')");
    expect(src).toContain("metadata_system_type = 'battle_result'");
  });

  it('is drift-guarded and registered in server boot', () => {
    expect(src).toContain('markerExists');
    const server = readFileSync(join(ROOT, 'server.ts'), 'utf8');
    expect(server).toContain('runBaseRaidLabelBackfillMigration');
  });
});

describe('FID-093b feed label mapping', () => {
  it('maps both BASE_RAID spellings and leaves real FACTORY rows alone', () => {
    const src = readFileSync(join(ROOT, 'components/BattleHistoryFeed.tsx'), 'utf8');
    expect(src).toContain("b.battleType === 'BASE_RAID' || b.battleType === 'BASE RAID'");
  });
});

describe('FID-093b full-width battle reports', () => {
  it('the report card no longer caps at 420px', () => {
    const css = readFileSync(join(ROOT, 'app/neon-noir.css'), 'utf8');
    const reportBlock = css.slice(css.indexOf('.nn-battle-report {'), css.indexOf('.nn-battle-report--victory'));
    expect(reportBlock).toContain('max-width: 100%');
    // The old cap may survive in the comment; assert the declaration list
    // itself carries no pixel cap.
    expect(reportBlock).not.toMatch(/max-width:\s*\d+px/);
  });

  it('the messages page container is full window width', () => {
    const page = readFileSync(join(ROOT, 'app/messages/page.tsx'), 'utf8');
    // Strip comments before scanning — the ban is on the class in markup.
    const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toContain('max-w-7xl');
  });
});
