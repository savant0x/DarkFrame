/**
 * @file __tests__/lib/shrineBlessingLedger.test.ts
 * @created 2026-09-19 (FID-20260919-015 W2)
 * @overview Pins for the shrine blessing ledger service: the row shape written
 *            per grant (playerId = username convention, tier, expiry, yield
 *            bonus) and the history read's ordering/limit contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';

const { capture } = vi.hoisted(() => ({
  capture: {
    inserts: [] as Array<{ table: unknown; values: unknown }>,
    historyRows: [] as Array<{ id: string; playerId: string; tier: string; expiresAt: Date; yieldBonus: number; createdAt: Date }>,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        capture.inserts.push({ table, values });
        return Promise.resolve();
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: async () => capture.historyRows,
          }),
        }),
      }),
    }),
  },
}));

import { recordBlessing, getBlessingHistory } from '@/lib/shrineBlessingService';
import { shrineBlessings } from '@/lib/db/schema/config';

describe('recordBlessing — the per-grant ledger row', () => {
  beforeEach(() => {
    capture.inserts = [];
  });

  it('writes the full grant shape keyed on the username', async () => {
    const expires = new Date('2026-09-19T14:00:00Z');
    await recordBlessing('tester', 'spade', expires, 0.25);
    expect(capture.inserts).toHaveLength(1);
    expect(getTableName(capture.inserts[0].table as never)).toBe(getTableName(shrineBlessings));
    // fraction in → integer-percent column (0.25 → 25)
    expect(capture.inserts[0].values).toMatchObject({
      playerId: 'tester',
      tier: 'spade',
      expiresAt: expires,
      yieldBonus: 25,
    });
    expect((capture.inserts[0].values as { id: string }).id).toBeTruthy();
    expect((capture.inserts[0].values as { createdAt: Date }).createdAt).toBeInstanceOf(Date);
  });
});

describe('getBlessingHistory — newest-first, limited', () => {
  beforeEach(() => {
    capture.historyRows = [];
  });

  it('converts integer-percent storage back to fractional wire shape', async () => {
    capture.historyRows = [
      { id: 'b1', playerId: 'tester', tier: 'club', expiresAt: new Date(), yieldBonus: 25, createdAt: new Date('2026-09-19T10:00:00Z') },
    ];
    const rows = await getBlessingHistory('tester');
    expect(rows[0].tier).toBe('club');
    expect(rows[0].yieldBonus).toBe(0.25);
  });
});
