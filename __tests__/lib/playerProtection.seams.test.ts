/**
 * FID-20260916-004: Option B enforcement seams — contract pins.
 *
 * Seam 1: `launchMissile` voids the launcher's protection window after the
 *         missile's own preconditions (exists + READY) pass, before effects.
 * Seam 2: `joinClan` voids the joiner's window only when the target clan is at
 *         ACTIVE war, after every throwing precondition passes; war-lookup
 *         failure fails open (join proceeds, shield intact).
 *
 * House chained-mock db idiom (mirrors __tests__/lib/playerProtection.test.ts):
 * - select().from(table) resolves rows from a table-keyed map (module-level
 *   Symbol identities shared between mock and test).
 * - update(table).set().where() chains are recorded per-table for assertions.
 * - execute() (joinClan's raw-SQL invitation read) returns scripted rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const missilesTable = Symbol('table.missiles');
  const clansTable = Symbol('table.clans');
  const playersTable = Symbol('table.players');
  const updates: Array<{ table: unknown; set: Record<string, unknown>; where: unknown[] }> = [];
  const selectResults = new Map<unknown, Array<Record<string, unknown>>>();
  // Mutable container: the mock factory closes over `state` itself, so swaps
  // via setExecuteResult are visible to every call (a re-bound local was not).
  const state = { executeRows: [] as Record<string, unknown>[] };
  return {
    missilesTable,
    clansTable,
    playersTable,
    updates,
    selectResults,
    state,
    setExecuteResult: (rows: Record<string, unknown>[]) => {
      state.executeRows = rows;
    },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => Promise.resolve(h.selectResults.get(table) ?? [])),
        })),
      })),
    })),
    update: vi.fn().mockImplementation((table: unknown) => ({
      set: vi.fn().mockImplementation((set: Record<string, unknown>) => ({
        where: vi.fn().mockImplementation((...whereArgs: unknown[]) => {
          h.updates.push({ table, set, where: whereArgs });
          // voidProtectionOnAggression chains .returning() after .where()
          // (drizzle pg shape — live-probed in FID-20260916-002); without this
          // link the helper's swallow-and-log contract masks the mock gap.
          return {
            returning: vi.fn().mockImplementation(() => Promise.resolve([])),
          };
        }),
      })),
    })),
    execute: vi.fn().mockImplementation(() => Promise.resolve({ rows: h.state.executeRows })),
  },
}));

vi.mock('@/lib/db/schema', () => ({
  players: h.playersTable,
  clans: h.clansTable,
}));

vi.mock('@/lib/db/schema/wmd', () => ({
  missiles: h.missilesTable,
}));

// FID-20260916-005: the revived targetingValidator imports the players table
// from the module path (not the barrel), so alias it to the same Symbol the
// barrel mock uses — one shared rows map, two import surfaces.
vi.mock('@/lib/db/schema/players', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  players: h.playersTable,
}));

vi.mock('@/lib/clanWarfareService', () => ({
  getActiveWars: vi.fn(),
}));

import { launchMissile } from '@/lib/wmd/missileService';
import { joinClan } from '@/lib/clanService';
import { getActiveWars } from '@/lib/clanWarfareService';
import { MissileStatus } from '@/types/wmd';

/** A READY missile (shape launchMissile reads). */
const readyMissile = {
  id: 'm1',
  status: MissileStatus.READY,
  warheadType: 'TACTICAL',
  ownerId: 'launcher-uuid',
};

const voidedUpdates = () => h.updates.filter((u) => u.table === h.playersTable && 'protectionUntil' in u.set);

beforeEach(() => {
  h.updates.length = 0;
  h.selectResults.clear();
  h.setExecuteResult([]);
  vi.mocked(getActiveWars).mockReset();
});

describe('FID-20260916-004 seam 1: launchMissile voids on committed launch only', () => {
  it('pin 1 — voids the launcher window after the READY check passes', async () => {
    h.selectResults.set(h.missilesTable, [readyMissile]);
    // FID-20260916-005: validation now precedes the void, so the target row
    // must satisfy the revived validator (exists, unprotected, level >= 10).
    h.selectResults.set(h.playersTable, [{ username: 'targetUser', level: 12, protectionUntil: null, clanId: null }]);

    const result = await launchMissile('m1', 'targetUser', 'launcherUser');

    expect(result.success).toBe(true);
    expect(voidedUpdates()).toHaveLength(1);
    expect(voidedUpdates()[0].set.protectionUntil).toBeNull();
    // the launch effect itself commits (status flip on the missile row)
    expect(h.updates.some((u) => u.table === h.missilesTable && u.set.status === MissileStatus.LAUNCHED)).toBe(true);
  });

  it('pin 2 — does NOT void when the missile does not exist', async () => {
    h.selectResults.set(h.missilesTable, []);

    const result = await launchMissile('m1', 'targetUser', 'launcherUser');

    expect(result.success).toBe(false);
    expect(voidedUpdates()).toHaveLength(0);
  });

  it('pin 3 — does NOT void when the missile is not READY', async () => {
    h.selectResults.set(h.missilesTable, [{ ...readyMissile, status: MissileStatus.LAUNCHED }]);

    const result = await launchMissile('m1', 'targetUser', 'launcherUser');

    expect(result.success).toBe(false);
    expect(voidedUpdates()).toHaveLength(0);
  });
});

describe('FID-20260916-004 seam 2: joinClan voids on ACTIVE-war clan only', () => {
  /** Clan row as joinClan's getClanById read returns it (select from clans). */
  const clanRow = {
    id: 'clan-1',
    name: 'TestClan',
    tag: 'TST',
    maxMembers: 50,
    members: [],
    level: 1,
  };
  const pendingInvite = {
    id: 'inv-1',
    clan_id: 'clan-1',
    invitee_id: 'joinerUser',
    status: 'pending',
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  };

  beforeEach(() => {
    h.setExecuteResult([pendingInvite as unknown as Record<string, unknown>]);
    h.selectResults.set(h.clansTable, [clanRow]);
    // joiner row: not in a clan, exists (getPlayerById via players select)
    h.selectResults.set(h.playersTable, [
      { username: 'joinerUser', clanId: null, clanName: null, clanRole: null },
    ]);
  });

  it('pin 4 — voids the joiner window when the clan is at ACTIVE war', async () => {
    vi.mocked(getActiveWars).mockResolvedValue([
      { warId: 'w1', status: 'ACTIVE' } as never,
    ]);

    await joinClan('inv-1', 'joinerUser');

    expect(voidedUpdates()).toHaveLength(1);
    expect(voidedUpdates()[0].set.protectionUntil).toBeNull();
    // the join effect itself commits (clan membership write)
    expect(h.updates.some((u) => u.table === h.clansTable && Array.isArray(u.set.members))).toBe(true);
  });

  it('pin 5 — does NOT void when the clan is neutral (no active wars)', async () => {
    vi.mocked(getActiveWars).mockResolvedValue([]);

    const result = await joinClan('inv-1', 'joinerUser');

    expect(result.success).toBe(true);
    expect(voidedUpdates()).toHaveLength(0);
  });

  it('pin 6 — fails open when the war lookup throws (join proceeds, no void)', async () => {
    vi.mocked(getActiveWars).mockRejectedValue(new Error('war table offline'));

    const result = await joinClan('inv-1', 'joinerUser');

    expect(result.success).toBe(true);
    expect(voidedUpdates()).toHaveLength(0);
  });
});

describe('FID-20260916-005 seam: launchMissile validates the target before committing', () => {
  /** Launch flipped the missile to LAUNCHED (the committed effect). */
  const missileFlipped = () =>
    h.updates.some((u) => u.table === h.missilesTable && u.set.status === MissileStatus.LAUNCHED);

  it('pin 7 — refuses a nonexistent target; missile stays READY and no void', async () => {
    h.selectResults.set(h.missilesTable, [readyMissile]);
    h.selectResults.set(h.playersTable, []); // target read comes up empty

    const result = await launchMissile('m1', 'ghostUser', 'launcherUser');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Target not found');
    expect(missileFlipped()).toBe(false);
    expect(voidedUpdates()).toHaveLength(0);
  });

  it('pin 8 — refuses a PROTECTED target (the shield-bypass fix); no flip, no void', async () => {
    h.selectResults.set(h.missilesTable, [readyMissile]);
    h.selectResults.set(h.playersTable, [
      {
        username: 'targetUser',
        level: 12,
        protectionUntil: new Date(Date.now() + 3_600_000).toISOString(),
        clanId: null,
      },
    ]);

    const result = await launchMissile('m1', 'targetUser', 'launcherUser');

    expect(result.success).toBe(false);
    expect(result.message).toContain('protection');
    expect(missileFlipped()).toBe(false);
    expect(voidedUpdates()).toHaveLength(0);
  });

  it('pin 9 — refuses a sub-floor target (level < 10); no flip, no void', async () => {
    h.selectResults.set(h.missilesTable, [readyMissile]);
    h.selectResults.set(h.playersTable, [{ username: 'targetUser', level: 5, protectionUntil: null, clanId: null }]);

    const result = await launchMissile('m1', 'targetUser', 'launcherUser');

    expect(result.success).toBe(false);
    expect(result.message).toContain('level 10');
    expect(missileFlipped()).toBe(false);
    expect(voidedUpdates()).toHaveLength(0);
  });

  it('pin 10 — refuses self-targeting; no flip, no void', async () => {
    h.selectResults.set(h.missilesTable, [readyMissile]);
    h.selectResults.set(h.playersTable, [{ username: 'launcherUser', level: 30, protectionUntil: null, clanId: null }]);

    const result = await launchMissile('m1', 'launcherUser', 'launcherUser');

    expect(result.success).toBe(false);
    expect(result.message).toContain('yourself');
    expect(missileFlipped()).toBe(false);
    expect(voidedUpdates()).toHaveLength(0);
  });

  it('pin 11 — valid target: launch commits AND the FID-004 void still fires (ordering)', async () => {
    h.selectResults.set(h.missilesTable, [readyMissile]);
    h.selectResults.set(h.playersTable, [{ username: 'targetUser', level: 12, protectionUntil: null, clanId: null }]);

    const result = await launchMissile('m1', 'targetUser', 'launcherUser');

    expect(result.success).toBe(true);
    expect(missileFlipped()).toBe(true);
    expect(voidedUpdates()).toHaveLength(1); // committed launch -> forfeit, unchanged from FID-004
  });
});
