/**
 * @file __tests__/lib/timestampIntegrity.test.ts
 * @created 2026-09-23 (FID-20260923-001)
 * @overview Pins for the naive-timestamp class elimination: the migration's
 *            per-column zone decisions, the schema convention, the signed
 *            retaliation window, the new read-side surface, and the gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const MIGRATION = join(ROOT, 'lib', 'db', 'migrations', '0040_timestamptz_conversion.sql');
const VALUE_ROW = /^\s*\('[a-z_]+', '[a-z_]+', '(UTC|America\/New_York)'\),?$/;

describe('FID-20260923-001 — timestamp convention integrity', () => {
  it('migration 0040 converts every naive column with a valid zone, guarded', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    // Normalize CRLF before splitting: with `core.autocrlf=true` (every Windows
    // checkout) the `$`-anchored row regex matches nothing and this pin reports
    // 0 of 135 — a green-on-this-host, red-on-a-clone failure (probed 2026-09-24).
    const valueRows = sql.replace(/\r\n/g, '\n').split('\n').filter((l) => VALUE_ROW.test(l));
    // The class is 135 columns (FID §2d) — the migration must cover all of them.
    expect(valueRows.length).toBe(135);
    for (const l of valueRows) expect(l).toMatch(/'(UTC|America\/New_York)'/);
    // Idempotency guard: a column already timestamptz is skipped, else the USING
    // expression would silently re-shift it.
    expect(sql).toMatch(/data_type = 'timestamp without time zone'/);
    expect(sql).toMatch(/ALTER COLUMN %I TYPE timestamptz USING \(%I AT TIME ZONE %L\)/);
  });

  it('the six MIXED columns carry their explicit per-column zone decision', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    const decided: Record<string, string> = {
      'auctions.expires_at': 'America/New_York',
      'clan_wars.declared_at': 'UTC',
      'clan_wars.updated_at': 'UTC',
      'flag_trail.created_at': 'America/New_York',
      'player_level_history.captured_at': 'UTC',
      'players.created_at': 'UTC',
    };
    for (const [key, zone] of Object.entries(decided)) {
      const [t, c] = key.split('.');
      expect(sql, `${key} should be ${zone}`).toContain(`('${t}', '${c}', '${zone}')`);
    }
  });

  it('every drizzle schema timestamp declaration is timestamptz', () => {
    const dir = join(ROOT, 'lib', 'db', 'schema');
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
    expect(files.length).toBeGreaterThan(0);
    let declarations = 0;
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const d of src.match(/timestamp\(\s*'[a-z_]+'[^)]*\)/g) ?? []) {
        declarations += 1;
        expect(d, `${f}: ${d}`).toMatch(/withTimezone:\s*true/);
      }
    }
    expect(declarations).toBeGreaterThan(100);
  });

  it('retaliation window is the signed 7 days, not the old unreviewed 30', () => {
    const src = readFileSync(join(ROOT, 'lib', 'wmd', 'clanConsequencesService.ts'), 'utf8');
    expect(src).toMatch(/RETALIATION_WINDOW = 7 \* 24 \* HOUR/);
    expect(src).not.toMatch(/RETALIATION_WINDOW = 30 \* 24 \* HOUR/);
  });

  it('the cooldown + retaliation surface is reachable: route -> panel', () => {
    const route = readFileSync(join(ROOT, 'app', 'api', 'wmd', 'missiles', 'route.ts'), 'utf8');
    expect(route).toContain('getPlayerWmdStatus');
    expect(route).toContain('clanWmdStatus');
    const panel = readFileSync(join(ROOT, 'components', 'WMDMissilePanel.tsx'), 'utf8');
    expect(panel).toContain('clanWmdStatus');
    expect(panel).toContain('Clan WMD Status');
    const svc = readFileSync(join(ROOT, 'lib', 'wmd', 'clanConsequencesService.ts'), 'utf8');
    expect(svc).toMatch(/export async function getPlayerWmdStatus/);
  });

  it('the convention census gate passes on the current tree', () => {
    let code = 0;
    let out = '';
    try {
      out = execFileSync('node', [join(ROOT, 'scripts', 'timestampConventionCensus.cjs')], { encoding: 'utf8' });
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      code = err.status ?? 1;
      out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
    }
    expect(code, out).toBe(0);
    expect(out).toContain('clean');
  });
});
