/**
 * FID-20260914-007 — battleStatsService unit tests.
 *
 * The profile Battle Statistics panel rendered zeros forever because its data
 * source (`players.battle_stats`) had no writer. The service now computes the
 * lifetime record from battle_logs; these tests pin the viewer-side outcome
 * math, loss derivation, empty-history defaults, and corrupt-data clamping.
 * CI is DB-less: db.execute is scripted per case.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }));

vi.mock('@/lib/db', () => ({
  db: { execute: executeMock },
}));

import { computeBattleStats, toPanelBattleStats, EMPTY_BATTLE_STATS } from '@/lib/battleStatsService';

function row(overrides: Record<string, number> = {}) {
  return {
    infantry_initiated: 0,
    infantry_won: 0,
    base_attacks_initiated: 0,
    base_attacks_won: 0,
    base_defenses_total: 0,
    base_defenses_won: 0,
    ...overrides,
  };
}

beforeEach(() => {
  executeMock.mockReset();
});

describe('computeBattleStats (FID-20260914-007)', () => {
  it('derives losses as initiated − won on every panel row', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [row({ infantry_initiated: 4, infantry_won: 3, base_attacks_initiated: 10, base_attacks_won: 7, base_defenses_total: 6, base_defenses_won: 4 })],
    });
    const stats = await computeBattleStats('fame');
    expect(stats.infantryAttacks).toEqual({ initiated: 4, won: 3, lost: 1 });
    expect(stats.baseAttacks).toEqual({ initiated: 10, won: 7, lost: 3 });
    expect(stats.baseDefenses).toEqual({ total: 6, won: 4, lost: 2 });
  });

  it('returns the empty record when the query yields no row (no history)', async () => {
    executeMock.mockResolvedValueOnce({ rows: [] });
    const stats = await computeBattleStats('nobody');
    expect(stats).toEqual(EMPTY_BATTLE_STATS);
  });

  it('treats null aggregate fields as zeros (defensive)', async () => {
    executeMock.mockResolvedValueOnce({ rows: [{}] });
    const stats = await computeBattleStats('ghost');
    expect(stats.infantryAttacks).toEqual({ initiated: 0, won: 0, lost: 0 });
    expect(stats.baseDefenses).toEqual({ total: 0, won: 0, lost: 0 });
  });

  it('clamps losses at 0 when corrupt data reports more wins than fights', async () => {
    executeMock.mockResolvedValueOnce({
      rows: [row({ base_defenses_total: 2, base_defenses_won: 9 })],
    });
    const stats = await computeBattleStats('paradox');
    expect(stats.baseDefenses.lost).toBe(0);
    expect(stats.baseDefenses.won).toBe(9);
  });

  it('binds the viewer username into the aggregate query (once per FILTER clause)', async () => {
    executeMock.mockResolvedValueOnce({ rows: [row()] });
    await computeBattleStats('fame');
    expect(executeMock).toHaveBeenCalledTimes(1);
    // drizzle sql template: the username is a bound param appearing once per
    // FILTER clause (6 clauses). The SQL text itself is live-verified in FID
    // §5 (real rows returned with correct numbers).
    const call = executeMock.mock.calls[0][0];
    const flattened = JSON.stringify(call, (_k, v) => (typeof v === 'string' ? v : v));
    expect((flattened.match(/fame/g) ?? []).length).toBe(6);
  });
});

describe('toPanelBattleStats', () => {
  it('maps the computed record onto the panel contract unchanged', () => {
    const panel = toPanelBattleStats({
      infantryAttacks: { initiated: 4, won: 3, lost: 1 },
      baseAttacks: { initiated: 10, won: 7, lost: 3 },
      baseDefenses: { total: 6, won: 4, lost: 2 },
    });
    expect(panel.infantryAttacks).toEqual({ initiated: 4, won: 3, lost: 1 });
    expect(panel.baseAttacks).toEqual({ initiated: 10, won: 7, lost: 3 });
    expect(panel.baseDefenses).toEqual({ total: 6, won: 4, lost: 2 });
  });
});
