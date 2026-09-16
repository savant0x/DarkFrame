/**
 * FID-20260916-008: protection seam pins for the factory-capture void.
 *
 * Seams implemented in `attackFactory` (lib/factoryService.ts):
 *  - pvpCapture flag: the -002 owner select now also reads `isBot`; capture of
 *    a REAL player's (existing, non-bot) factory is committed outgoing PvP.
 *  - void at commit: `voidProtectionOnAggression(username)` AFTER every refusal
 *    precondition (own-factory, protected owner, max-factories, cooldown) and
 *    BEFORE the power roll — refused/blocked attempts never forfeit, and
 *    wild/bot captures are pure PvE and never forfeit.
 *
 * Battle route (`app/api/battle/attack`) seams are verified live via HTTP
 * probes (route-level auth + schema make harness mocking costlier than the
 * real server, and the route is the FID's stated seam).
 *
 * Idiom: chained-mock db with projection-aware select (mirrors the seam suite;
 * the projection path and the full-row path both take rows[0]).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const factoriesTable = Symbol('table.factories');
  const playersTable = Symbol('table.players');

  const updates: Array<{ table: unknown; set: Record<string, unknown>; where: unknown[] }> = [];
  const selectResults = new Map<unknown, Array<Record<string, unknown>>>();
  // Projection-aware: select({...cols}) takes the projected shape, select()
  // takes the full row — both resolve rows[0] via limit().
  const callPlan: Array<'projected' | 'full'> = [];

  return {
    factoriesTable,
    playersTable,
    updates,
    selectResults,
    callPlan,
    resetCalls: () => {
      callPlan.length = 0;
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation((...args: unknown[]) => {
      const mode = args.length > 0 ? 'projected' : 'full';
      h.callPlan.push(mode);
      return {
        from: vi.fn().mockImplementation((table: unknown) => ({
          where: vi.fn().mockImplementation(() => {
            // The count query awaits where() directly (no .limit()); most
            // reads chain .limit(). Make where() a thenable carrying limit.
            const rows = h.selectResults.get(table) ?? [];
            const p = Promise.resolve(rows) as Promise<Array<Record<string, unknown>>> & {
              limit: (n: number) => Promise<Array<Record<string, unknown>>>;
            };
            p.limit = () => Promise.resolve(rows);
            return p;
          }),
        })),
      };
    }),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: vi.fn().mockImplementation((set: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation((...whereArgs: unknown[]) => {
          h.updates.push({ table, set, where: whereArgs });
          return { returning: vi.fn().mockImplementation(() => Promise.resolve([])) };
        }),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => Promise.resolve()),
    })),
  },
}));

vi.mock('@/lib/db/schema', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  factories: h.factoriesTable,
  players: h.playersTable,
}));

vi.mock('./xpService', () => ({ awardXP: vi.fn(), XPAction: { FACTORY_CAPTURE: 'FACTORY_CAPTURE' } }));
vi.mock('./specializationService', () => ({ getPlayerDoctrineBonuses: vi.fn().mockResolvedValue({ strMul: 1 }) }));
vi.mock('./factoryUpgradeService', () => ({
  FACTORY_UPGRADE: { MAX_FACTORIES_PER_PLAYER: 5 },
  getMaxSlots: vi.fn(() => 5),
  getFactoryDefense: vi.fn(() => 1000),
}));

import { attackFactory } from '@/lib/factoryService';
import { PROTECTION_REFUSAL_REASON } from '@/lib/playerProtection';

const ATTACKER = 'attacker';
const OWNER = 'factoryOwner';

const factoryRow = {
  x: 5,
  y: 5,
  owner: null as string | null,
  defense: 1000,
  level: 1,
  usedSlots: 0,
  lastAttackedBy: null as string | null,
  lastAttackTime: null as Date | null,
};

/** calculatePlayerPower's full-row read of the attacker (projection path precedes it). */
const attackerRow = { username: ATTACKER, rank: 5, totalStrength: 0, inventoryItems: null };

const voidUpdates = () =>
  h.updates.filter((u) => u.table === h.playersTable && 'protectionUntil' in u.set);

beforeEach(() => {
  h.updates.length = 0;
  h.selectResults.clear();
  h.resetCalls();
});

describe('FID-20260916-008: attackFactory void at commit (pvpCapture-gated)', () => {
  it('pin 1 — player-owned target: void fires after all preconditions, before the roll', async () => {
    h.selectResults.set(h.factoriesTable, [{ ...factoryRow, owner: OWNER }]);
    h.selectResults.set(h.playersTable, [
      { protectionUntil: null, isBot: 0 }, // projected: owner row (unprotected real player)
      attackerRow, // full: attacker power read
    ]);

    await attackFactory(ATTACKER, 5, 5);

    expect(voidUpdates()).toHaveLength(1);
    expect(voidUpdates()[0].set.protectionUntil).toBeNull();
  });

  it('pin 2 — wild factory (no owner): no void (pure PvE)', async () => {
    h.selectResults.set(h.factoriesTable, [{ ...factoryRow, owner: null }]);
    h.selectResults.set(h.playersTable, [attackerRow]);

    const result = await attackFactory(ATTACKER, 5, 5);

    // Roll-dependent outcome (power 150 vs defense 1000) — the pin's claim is
    // that NO roll outcome forfeits: wild capture is pure PvE either way.
    expect(typeof result.success).toBe('boolean');
    expect(voidUpdates()).toHaveLength(0);
  });

  it('pin 3 — bot-owned factory: no void (pure PvE)', async () => {
    h.selectResults.set(h.factoriesTable, [{ ...factoryRow, owner: 'someBot' }]);
    h.selectResults.set(h.playersTable, [
      { protectionUntil: null, isBot: 1 }, // projected: owner is a bot
      attackerRow,
    ]);

    await attackFactory(ATTACKER, 5, 5);

    expect(voidUpdates()).toHaveLength(0);
  });

  it('pin 4 — protected owner: refused before any void (the -002 refusal still guards)', async () => {
    h.selectResults.set(h.factoriesTable, [{ ...factoryRow, owner: OWNER }]);
    h.selectResults.set(h.playersTable, [
      { protectionUntil: new Date(Date.now() + 3_600_000).toISOString(), isBot: 0 },
      attackerRow,
    ]);

    const result = await attackFactory(ATTACKER, 5, 5);

    expect(result.success).toBe(false);
    expect(result.message).toBe(PROTECTION_REFUSAL_REASON);
    expect(voidUpdates()).toHaveLength(0);
  });

  it('pin 5 — cooldown-blocked attempt: refused, no void', async () => {
    h.selectResults.set(h.factoriesTable, [
      {
        ...factoryRow,
        owner: OWNER,
        lastAttackedBy: ATTACKER,
        lastAttackTime: new Date(Date.now() - 60_000), // 1 min ago < 5 min cooldown
      },
    ]);
    h.selectResults.set(h.playersTable, [
      { protectionUntil: null, isBot: 0 },
      attackerRow,
    ]);

    const result = await attackFactory(ATTACKER, 5, 5);

    expect(result.success).toBe(false);
    expect(result.message).toContain('wait');
    expect(voidUpdates()).toHaveLength(0);
  });
});
