/**
 * @file __tests__/lib/clanWmdConsequences.test.ts
 * @created 2026-09-19 (FID-20260919-018)
 * @overview Pins for the wired clan WMD consequence system. The module was dead
 *            code with a broken core; these pins lock the four repairs:
 *              - the cooldown WRITE actually sets wmdCooldownUntil;
 *              - the cooldown READ reports the truth;
 *              - the LAUNCH gate refuses on cooldown, except for a retaliation right;
 *              - the relations pair is canonicalized and retaliation PKs fit 24.
 *            Mock rides the real drizzle builder surface; tables are identified
 *            by getTableName on the captured table object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';

const { state } = vi.hoisted(() => ({
  state: {
    selects: [] as Array<Record<string, unknown>>,
    updates: [] as Array<Record<string, unknown>>,
    inserts: [] as Array<Record<string, unknown>>,
    responder: (_spec: Record<string, unknown>) => [] as unknown,
  },
}));

vi.mock('@/lib/db', () => {
  const selectChain = (spec: Record<string, unknown>) => {
    state.selects.push(spec);
    const terminal = {
      limit: async () => state.responder(spec),
      then: (onF?: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(state.responder(spec)).then(onF, onR),
    };
    return { where: (w: unknown) => { spec.where = w; return terminal; } };
  };
  return {
    db: {
      select: (fields?: unknown) => ({
        from: (t: unknown) => selectChain({ op: 'select', table: t, fields }),
      }),
      update: (t: unknown) => ({
        set: (v: unknown) => ({
          where: async (w: unknown) => { state.updates.push({ table: t, values: v, where: w }); },
        }),
      }),
      insert: (t: unknown) => ({
        values: async (v: unknown) => { state.inserts.push({ table: t, values: v }); },
      }),
    },
  };
});

vi.mock('@/lib/wmd/targetingValidator', () => ({
  validateTargeting: vi.fn(async () => ({ isValid: true, errors: [] })),
}));
vi.mock('@/lib/playerProtection', () => ({
  voidProtectionOnAggression: vi.fn(async () => {}),
}));

import {
  applyClanWMDConsequences,
  isClanOnWMDCooldown,
} from '@/lib/wmd/clanConsequencesService';
import { launchMissile } from '@/lib/wmd/missileService';
import {
  clans,
  players,
  clanRelations,
  wmdRetaliationRights,
} from '@/lib/db/schema';
import { missiles } from '@/lib/db/schema/wmd';

const tableOf = (spec: Record<string, unknown> | undefined): string =>
  getTableName((spec?.table ?? {}) as never);

/** Flatten a drizzle SQL/chunk tree into raw text for clause assertions. */
function sqlText(node: unknown): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(sqlText).join(' ');
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (typeof o.value === 'string') return o.value;
    if (Array.isArray(o.value)) return o.value.map(sqlText).join('');
    if (Array.isArray(o.queryChunks)) return sqlText(o.queryChunks);
    if (typeof o.sql === 'string') return o.sql;
    return '';
  }
  return '';
}

const hoursFromNow = (d: Date) => (d.getTime() - Date.now()) / 3_600_000;

beforeEach(() => {
  state.selects.length = 0;
  state.updates.length = 0;
  state.inserts.length = 0;
  state.responder = () => [];
});

describe('applyClanWMDConsequences — the cooldown write is real', () => {
  beforeEach(() => {
    const member = [{ username: 'u1' }, { username: 'u2' }];
    state.responder = (spec) => {
      const t = tableOf(spec);
      if (t === getTableName(clans)) return [{ id: 'clanB', name: 'Bravo' }];
      if (t === getTableName(players)) return member;
      if (t === getTableName(clanRelations)) return [];
      return [];
    };
  });

  it('TACTICAL sets wmdCooldownUntil ~24h out (never the old self-assignment)', async () => {
    await applyClanWMDConsequences('clanB', 'Bravo', 'clanA', 'Alpha', 'TACTICAL');
    const cooldownUpdate = state.updates.find(
      (u) => tableOf(u) === getTableName(clans) && 'wmdCooldownUntil' in (u.values as object)
    );
    expect(cooldownUpdate).toBeDefined();
    const until = (cooldownUpdate!.values as { wmdCooldownUntil: Date }).wmdCooldownUntil;
    expect(hoursFromNow(until)).toBeGreaterThan(23.5);
    expect(hoursFromNow(until)).toBeLessThan(24.5);
    // and it must NOT be the old bankTreasuryMetal self-assignment
    expect('bankTreasuryMetal' in (cooldownUpdate!.values as object)).toBe(false);
  });

  it('CLAN_BUSTER sets the 72h cooldown', async () => {
    await applyClanWMDConsequences('clanB', 'Bravo', 'clanA', 'Alpha', 'CLAN_BUSTER');
    const cooldownUpdate = state.updates.find(
      (u) => tableOf(u) === getTableName(clans) && 'wmdCooldownUntil' in (u.values as object)
    );
    const until = (cooldownUpdate!.values as { wmdCooldownUntil: Date }).wmdCooldownUntil;
    expect(hoursFromNow(until)).toBeGreaterThan(71.5);
    expect(hoursFromNow(until)).toBeLessThan(72.5);
  });

  it('the reputation penalty targets the clan research pool, floored at 0', async () => {
    await applyClanWMDConsequences('clanB', 'Bravo', 'clanA', 'Alpha', 'TACTICAL');
    const repUpdate = state.updates.find(
      (u) => tableOf(u) === getTableName(clans) && 'researchResearchPoints' in (u.values as object)
    );
    expect(repUpdate).toBeDefined();
    const expr = (repUpdate!.values as { researchResearchPoints: unknown }).researchResearchPoints;
    expect(sqlText(expr).toLowerCase()).toContain('greatest');
  });

  it('canonicalizes the relations pair (sorted) regardless of argument order', async () => {
    await applyClanWMDConsequences('clanB', 'Bravo', 'clanA', 'Alpha', 'TACTICAL');
    const relInsert = state.inserts.find((i) => tableOf(i) === getTableName(clanRelations));
    expect(relInsert).toBeDefined();
    const values = relInsert!.values as { clanId1: string; clanId2: string; relation: string };
    expect([values.clanId1, values.clanId2]).toEqual(['clanA', 'clanB']);
    expect(values.relation).toBe('ENEMY');
  });

  it('grants one retaliation right per victim member, with PKs that fit 24 chars', async () => {
    await applyClanWMDConsequences('clanB', 'Bravo', 'clanA', 'Alpha', 'TACTICAL');
    const rrInsert = state.inserts.find((i) => tableOf(i) === getTableName(wmdRetaliationRights));
    expect(rrInsert).toBeDefined();
    const rows = rrInsert!.values as Array<{ id: string }>;
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.id.length).toBeLessThanOrEqual(24);
  });

  it('a clanless attacker applies no clan-scoped consequences', async () => {
    const res = await applyClanWMDConsequences(null, 'nobody', null, 'target', 'TACTICAL');
    expect(res.success).toBe(true);
    expect(state.updates.filter((u) => 'wmdCooldownUntil' in (u.values as object))).toHaveLength(0);
  });
});

describe('isClanOnWMDCooldown — reads the truth', () => {
  it('reports an active cooldown with remaining time', async () => {
    const until = new Date(Date.now() + 5 * 3_600_000);
    state.responder = () => [{ wmdCooldownUntil: until }];
    const res = await isClanOnWMDCooldown('clanA');
    expect(res.onCooldown).toBe(true);
    expect(res.remainingTime).toBeGreaterThan(0);
  });

  it('reports no cooldown for a past expiry', async () => {
    state.responder = () => [{ wmdCooldownUntil: new Date(Date.now() - 1000) }];
    expect((await isClanOnWMDCooldown('clanA')).onCooldown).toBe(false);
  });

  it('reports no cooldown for a null column', async () => {
    state.responder = () => [{ wmdCooldownUntil: null }];
    expect((await isClanOnWMDCooldown('clanA')).onCooldown).toBe(false);
  });
});

describe('launchMissile — the consequence gate', () => {
  const readyMissile = {
    id: 'm1',
    missileId: 'mis1',
    status: 'READY',
    ownerClanId: 'clanA',
    ownerId: 'attacker',
    warheadType: 'TACTICAL',
  };

  it('refuses a launch while the clan is on cooldown with no retaliation right', async () => {
    state.responder = (spec) => {
      const t = tableOf(spec);
      if (t === getTableName(missiles)) return [readyMissile];
      if (t === getTableName(clans)) return [{ wmdCooldownUntil: new Date(Date.now() + 3_600_000) }];
      if (t === getTableName(players)) return [{ clanId: 'clanB' }];
      if (t === getTableName(wmdRetaliationRights)) return [];
      return [];
    };
    const res = await launchMissile('m1', 'victim', 'attacker');
    expect(res.success).toBe(false);
    expect(res.message).toContain('cooldown');
    // the missile must not have been launched
    expect(state.updates.filter((u) => tableOf(u) === getTableName(missiles))).toHaveLength(0);
  });

  it('allows the launch and consumes a retaliation right', async () => {
    state.responder = (spec) => {
      const t = tableOf(spec);
      if (t === getTableName(missiles)) return [readyMissile];
      if (t === getTableName(clans)) return [{ wmdCooldownUntil: new Date(Date.now() + 3_600_000) }];
      if (t === getTableName(players)) return [{ clanId: 'clanB' }];
      if (t === getTableName(wmdRetaliationRights)) return [{ id: 'r1', expiresAt: new Date(Date.now() + 3_600_000) }];
      return [];
    };
    const res = await launchMissile('m1', 'victim', 'attacker');
    expect(res.success).toBe(true);
    // the right was consumed
    expect(state.updates.filter((u) => tableOf(u) === getTableName(wmdRetaliationRights))).toHaveLength(1);
    // and the missile was actually launched
    expect(state.updates.filter((u) => tableOf(u) === getTableName(missiles))).toHaveLength(1);
  });
});
