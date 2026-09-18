/**
 * @file __tests__/api/antiCheatDetectorPg.test.ts
 * @created 2026-09-18
 * @overview Pins for FID-20260917-017 slice 1 — the anti-cheat detector's pg
 *            rewrite. The defect class: the shim's buildWhere SILENTLY DROPPED
 *            unmapped keys, so queries filtering on `username`/`actionType`
 *            (non-existent player_activity columns) scanned ALL players on
 *            time alone. The load-bearing pins therefore assert the WHERE
 *            clauses carry the per-player and per-action predicates at the
 *            COLUMN level (real drizzle tables, getTableName-identified).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableName } from 'drizzle-orm';

// ── hoisted state + drizzle marker functions ────────────────────────────────
const { state, condFns } = vi.hoisted(() => {
  const state = {
    calls: [] as Array<Record<string, unknown>>,
    responder: null as null | ((spec: Record<string, unknown>) => unknown),
  };
  const mark = (op: string, col: unknown, val: unknown) => ({ __cond: true, op, col, val });
  const condFns = {
    and: (...parts: unknown[]) => ({ __cond: true, op: 'and', parts }),
    eq: (col: unknown, val: unknown) => mark('eq', col, val),
    gt: (col: unknown, val: unknown) => mark('gt', col, val),
    gte: (col: unknown, val: unknown) => mark('gte', col, val),
    lt: (col: unknown, val: unknown) => mark('lt', col, val),
    inArray: (col: unknown, vals: unknown) => mark('inArray', col, vals),
    desc: (x: unknown) => ({ __desc: x }),
    sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: String(strings[0]), vals }),
  };
  return { state, condFns };
});

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...condFns,
}));

vi.mock('@/lib/db', () => ({
  db: {
    // drizzle signatures: db.<verb>(table) → builder — record the table arg
    select: () => builder({ method: 'select' }),
    insert: (t: unknown) => builder({ method: 'insert', table: t }),
    update: (t: unknown) => builder({ method: 'update', table: t }),
    delete: (t: unknown) => builder({ method: 'delete', table: t }),
  },
}));

function builder(base: Record<string, unknown>): Record<string, unknown> {
  const spec: Record<string, unknown> = { ...base };
  const p: Record<string, unknown> = {
    from(table: unknown) { spec.table = table; return p; },
    where(cond: unknown) { spec.where = cond; return p; },
    orderBy(...order: unknown[]) { spec.order = order; return p; },
    limit(n: unknown) { spec.limit = n; return p; },
    groupBy(...g: unknown[]) { spec.groupBy = g; return p; },
    values(v: unknown) { spec.values = v; return p; },
    set(v: unknown) { spec.set = v; return p; },
    then(onFulfilled: (v: unknown) => unknown, onRejected: (e: unknown) => unknown) {
      state.calls.push(spec);
      const result = state.responder ? state.responder(spec) : [];
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: unknown) => unknown) {
      return Promise.resolve([]).catch(onRejected);
    },
  };
  return p;
}

/** Flatten marker conditions into (table, column, op, value) tuples. */
/** Table name for a call spec; insert/update specs carry no `.table`. */
function tableOf(spec: Record<string, unknown>): string {
  return spec.table ? getTableName(spec.table as never) : '(no-table)';
}

function conds(cond: unknown): Array<{ table: string; name: string; op: string; val: unknown }> {
  if (!cond) return [];
  if (Array.isArray(cond)) return cond.flatMap(conds);
  const c = cond as { __cond?: boolean; op?: string; parts?: unknown; col?: { name: string; table: unknown }; val?: unknown };
  if (c.__cond) {
    if (c.op === 'and') return conds(c.parts);
    return [{ table: getTableName(c.col!.table as never), name: c.col!.name, op: c.op!, val: c.val }];
  }
  return [];
}

function whereHas(spec: Record<string, unknown>, table: string, name: string, op?: string, val?: unknown): boolean {
  return conds(spec.where).some(
    (c) => c.table === table && c.name === name && (op === undefined || c.op === op) && (val === undefined || c.val === val)
  );
}

function callsOn(table: string, method: string): Array<Record<string, unknown>> {
  return state.calls.filter((c) => c.method === method && tableOf(c) === table);
}

import {
  detectSpeedHack,
  detectResourceHack,
  detectCooldownViolation,
  detectBotBehavior,
  detectSessionAbuse,
  detectTheoreticalMaxViolation,
  createFlag,
  getSuspiciousPlayers,
} from '@/lib/antiCheatDetector';

const NOW = Date.UTC(2026, 8, 18, 12, 0, 0);

beforeEach(() => {
  state.calls = [];
  state.responder = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('slice-1 static pins: the shim surface is gone', () => {
  const src = readFileSync(join(process.cwd(), 'lib', 'antiCheatDetector.ts'), 'utf8');

  it('detector no longer imports the Mongo shim', () => {
    expect(src).not.toContain('clientPromise');
    expect(src).not.toContain('@/lib/mongodb');
    expect(src).not.toContain('getCollection(');
    expect(src).toContain("from '@/lib/db/schema'");
  });

  it('detector queries the real pg tables', () => {
    expect(src).toContain('playerActivity');
    expect(src).toContain('playerFlags');
  });

  it('logMovement persists movement geometry (the writer enrichment)', () => {
    const logger = readFileSync(join(process.cwd(), 'lib', 'activityLogger.ts'), 'utf8');
    expect(logger).toContain('from: fromLocation');
    expect(logger).toContain('to: toLocation');
  });
});

describe('detectSpeedHack', () => {
  it('per-player isolation: WHERE carries player_id + action=move + time window', async () => {
    state.responder = (spec) => {
      if (tableOf(spec) === 'player_activity') {
        return [
          { playerId: 'suspect', action: 'move', timestamp: new Date(NOW - 500), metadata: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } } },
          { playerId: 'suspect', action: 'move', timestamp: new Date(NOW - 1000), metadata: { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } } },
        ];
      }
      return [];
    };
    const result = await detectSpeedHack('suspect', { x: 0, y: 0 }, { x: 1, y: 0 }, NOW);

    const activitySelects = state.calls.filter(
      (c) => c.method === 'select' && tableOf(c) === 'player_activity'
    );
    expect(activitySelects.length).toBe(1);
    const spec = activitySelects[0];
    // THE pin: the per-player predicate exists at the column level.
    expect(whereHas(spec, 'player_activity', 'player_id', 'eq', 'suspect')).toBe(true);
    expect(whereHas(spec, 'player_activity', 'action', 'eq', 'move')).toBe(true);
    expect(whereHas(spec, 'player_activity', 'timestamp', 'gt')).toBe(true);

    // Rate 2 tiles/sec over a 1s window > 1.5 → MEDIUM flag inserted.
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('MEDIUM');
    const inserts = callsOn('player_flags', 'insert');
    expect(inserts.length).toBe(1);
    expect((inserts[0].values as Record<string, unknown>).flagType).toBe('SPEED_HACK');
  });

  it('impossible single-move distance refuses without any query', async () => {
    const result = await detectSpeedHack('suspect', { x: 0, y: 0 }, { x: 20, y: 0 }, NOW);
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    // no activity read — only createFlag's dedupe select + the insert
    expect(state.calls.length).toBe(2);
  });

  it('fewer than two own moves returns insufficient data (no flag)', async () => {
    state.responder = () => [];
    const result = await detectSpeedHack('lonely', { x: 0, y: 0 }, { x: 1, y: 0 }, NOW);
    expect(result.suspicious).toBe(false);
    expect(result.evidence).toBe('Insufficient data');
    expect(callsOn('player_flags', 'insert').length).toBe(0);
  });
});

describe('detectCooldownViolation', () => {
  it('per-player + per-action: WHERE carries player_id and the writer action value', async () => {
    state.responder = () => [{ timestamp: new Date(NOW - 1000) }];
    const result = await detectCooldownViolation('p', 'harvest', NOW);

    const selects = state.calls.filter(
      (c) => c.method === 'select' && tableOf(c) === 'player_activity'
    );
    expect(selects.length).toBe(1);
    expect(whereHas(selects[0], 'player_activity', 'player_id', 'eq', 'p')).toBe(true);
    // detector vocabulary 'harvest' is also the writer's value
    expect(whereHas(selects[0], 'player_activity', 'action', 'eq', 'harvest')).toBe(true);

    expect(result.suspicious).toBe(true); // 1000ms < 3000ms required
    expect(result.severity).toBe('HIGH'); // under half the cooldown
  });

  it("'movement' maps to the writer's 'move' action value", async () => {
    state.responder = () => [{ timestamp: new Date(NOW - 60_000) }];
    await detectCooldownViolation('p', 'movement', NOW);
    const spec = state.calls.find(
      (c) => c.method === 'select' && tableOf(c) === 'player_activity'
    );
    expect(whereHas(spec!, 'player_activity', 'action', 'eq', 'move')).toBe(true);
  });

  it('first action ever → not suspicious, no flag', async () => {
    state.responder = () => [];
    const result = await detectCooldownViolation('p', 'attack', NOW);
    expect(result.suspicious).toBe(false);
    expect(result.evidence).toBe('First action');
    expect(callsOn('player_flags', 'insert').length).toBe(0);
  });

  it('respected cooldown → not suspicious', async () => {
    state.responder = () => [{ timestamp: new Date(NOW - 60_000) }];
    const result = await detectCooldownViolation('p', 'harvest', NOW);
    expect(result.suspicious).toBe(false);
    expect(result.evidence).toBe('Cooldown respected');
  });
});

describe('detectResourceHack', () => {
  it('player read uses flat pg columns; missing player refuses without flag', async () => {
    state.responder = (spec) => (tableOf(spec) === 'players' ? [] : []);
    const result = await detectResourceHack('ghost', 'metal', 5000, 1);
    expect(result.suspicious).toBe(false);
    expect(result.evidence).toBe('Player not found');
    expect(callsOn('player_flags', 'insert').length).toBe(0);
  });

  it('absolute-max breach → CRITICAL flag', async () => {
    state.responder = (spec) => {
      if (tableOf(spec) === 'players') {
        return [
          {
            gatheringBonusMetalBonus: '0',
            gatheringBonusEnergyBonus: '0',
            activeBoostsGatheringBoost: null,
            shrineBoosts: [],
          },
        ];
      }
      return [];
    };
    const result = await detectResourceHack('p', 'metal', 20_000, 1);
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    const inserts = callsOn('player_flags', 'insert');
    expect(inserts.length).toBe(1);
    expect((inserts[0].values as Record<string, unknown>).severity).toBe('CRITICAL');
  });

  it('normal harvest (with bonuses below tolerance) → clean, no flag', async () => {
    state.responder = (spec) => {
      if (tableOf(spec) === 'players') {
        return [
          {
            gatheringBonusMetalBonus: '10.00',
            gatheringBonusEnergyBonus: '0',
            activeBoostsGatheringBoost: null,
            shrineBoosts: [{ tier: 'T1', expiresAt: new Date(NOW + 3_600_000), yieldBonus: 0.25 }],
          },
        ];
      }
      return [];
    };
    const result = await detectResourceHack('p', 'metal', 1200, 1);
    expect(result.suspicious).toBe(false);
    expect(callsOn('player_flags', 'insert').length).toBe(0);
  });
});

describe('detectBotBehavior', () => {
  it('per-player predicate; >=10 rows with perfect intervals → HIGH flag', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ timestamp: new Date(NOW - i * 1000) }));
    // activity reads get rows; player_flags reads (createFlag dedupe) get none
    state.responder = (spec) => (tableOf(spec) === 'player_activity' ? rows : []);
    const result = await detectBotBehavior('robot');

    const spec = state.calls.find(
      (c) => c.method === 'select' && tableOf(c) === 'player_activity'
    );
    expect(whereHas(spec!, 'player_activity', 'player_id', 'eq', 'robot')).toBe(true);

    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('HIGH');
    const inserts = callsOn('player_flags', 'insert');
    expect((inserts[0].values as Record<string, unknown>).flagType).toBe('BOT_BEHAVIOR');
  });

  it('fewer than MIN_ACTIONS_FOR_PATTERN rows → insufficient data', async () => {
    state.responder = () => Array.from({ length: 5 }, (_, i) => ({ timestamp: new Date(NOW - i * 1000) }));
    const result = await detectBotBehavior('human');
    expect(result.suspicious).toBe(false);
    expect(result.evidence).toBe('Insufficient data');
  });
});

describe('detectSessionAbuse (pure threshold logic)', () => {
  it('15h session → CRITICAL flag', async () => {
    const result = await detectSessionAbuse('p', 15 * 3_600_000);
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('CRITICAL');
    expect(callsOn('player_flags', 'insert').length).toBe(1);
  });

  it('11h session → MEDIUM flag', async () => {
    const result = await detectSessionAbuse('p', 11 * 3_600_000);
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('MEDIUM');
  });

  it('2h session → clean, no flag write', async () => {
    const result = await detectSessionAbuse('p', 2 * 3_600_000);
    expect(result.suspicious).toBe(false);
    expect(state.calls.length).toBe(0);
  });
});

describe('detectTheoreticalMaxViolation (pure threshold logic)', () => {
  it('rank above max → HIGH violation flag', async () => {
    const result = await detectTheoreticalMaxViolation('p', {
      tier: 1,
      rank: 12,
      createdAt: new Date(NOW - 1_000),
      resources: { metal: 10, energy: 10 },
    });
    expect(result.suspicious).toBe(true);
    expect(result.severity).toBe('HIGH');
    const inserts = callsOn('player_flags', 'insert');
    expect((inserts[0].values as Record<string, unknown>).flagType).toBe('THEORETICAL_MAX_VIOLATION');
  });

  it('within limits → clean, no flag write', async () => {
    const result = await detectTheoreticalMaxViolation('p', {
      tier: 1,
      rank: 1,
      createdAt: new Date(NOW - 1_000),
      resources: { metal: 10, energy: 10 },
    });
    expect(result.suspicious).toBe(false);
    expect(state.calls.length).toBe(0);
  });
});

describe('createFlag (pg shape + dedupe)', () => {
  const flag = {
    username: 'p',
    flagType: 'SPEED_HACK',
    severity: 'HIGH' as const,
    description: 'd',
    evidence: 'e',
    metadata: { k: 1 },
  };

  it('fresh flag: insert with generated 24-char id, resolved 0, occurrenceCount 1', async () => {
    state.responder = () => [];
    const id = await createFlag(flag);
    const inserts = callsOn('player_flags', 'insert');
    expect(inserts.length).toBe(1);
    const values = inserts[0].values as Record<string, unknown>;
    expect(typeof values.id).toBe('string');
    expect((values.id as string).length).toBeLessThanOrEqual(24);
    expect(values.resolved).toBe(0);
    expect(values.occurrenceCount).toBe(1);
    expect(values.username).toBe('p');
    expect(id).toBe(values.id);
  });

  it('dedupe: recent unresolved same-type flag is updated (occurrenceCount+1), not duplicated', async () => {
    state.responder = (spec) => {
      if (spec.method === 'select' && tableOf(spec) === 'player_flags') {
        expect(whereHas(spec, 'player_flags', 'username', 'eq', 'p')).toBe(true);
        expect(whereHas(spec, 'player_flags', 'flag_type', 'eq', 'SPEED_HACK')).toBe(true);
        expect(whereHas(spec, 'player_flags', 'resolved', 'eq', 0)).toBe(true);
        return [{ id: 'flag1' }];
      }
      return [];
    };
    const id = await createFlag(flag);
    expect(id).toBe('flag1');
    const updates = callsOn('player_flags', 'update');
    expect(updates.length).toBe(1);
    expect((updates[0].set as Record<string, unknown>).severity).toBe('HIGH');
    expect((updates[0].set as Record<string, unknown>).occurrenceCount).toBeTruthy(); // sql`+1` marker
    expect(whereHas(updates[0], 'player_flags', 'id', 'eq', 'flag1')).toBe(true);
    expect(callsOn('player_flags', 'insert').length).toBe(0);
  });
});

describe('getSuspiciousPlayers (SQL group-by replaces the pipeline-ignoring aggregate)', () => {
  it('groups unresolved flags by player and attaches flag rows', async () => {
    const latest = new Date(NOW - 1000);
    state.responder = (spec) => {
      if (spec.method !== 'select' || tableOf(spec) !== 'player_flags') return [];
      if (spec.groupBy) {
        expect(whereHas(spec, 'player_flags', 'resolved', 'eq', 0)).toBe(true);
        return [
          { username: 'a', flagCount: 2, criticalFlags: 1, highFlags: 1, mediumFlags: 0, lowFlags: 0, latestFlag: latest },
        ];
      }
      return [
        { id: 'f1', username: 'a', flagType: 'SPEED_HACK', severity: 'CRITICAL', evidence: 'e1', metadata: { k: 1 }, resolved: 0, occurrenceCount: 1, createdAt: latest },
        { id: 'f2', username: 'a', flagType: 'COOLDOWN_VIOLATION', severity: 'HIGH', evidence: 'e2', metadata: null, resolved: 0, occurrenceCount: 3, createdAt: new Date(NOW - 2000) },
      ];
    };

    const result = await getSuspiciousPlayers();
    expect(result.length).toBe(1);
    const summary = result[0];
    expect(summary._id).toBe('a');
    expect(summary.flagCount).toBe(2);
    expect(summary.criticalFlags).toBe(1);
    expect(summary.highFlags).toBe(1);
    expect(summary.latestFlag).toBe(latest);
    expect(summary.flags.length).toBe(2);
    expect(summary.flags[0]).toMatchObject({ _id: 'f1', username: 'a', flagType: 'SPEED_HACK', resolved: false });
    expect(summary.flags[1].occurrenceCount).toBe(3);
    expect(summary.flags[1].metadata).toBeUndefined(); // null jsonb → undefined
  });

  it('empty table → empty array', async () => {
    state.responder = () => [];
    const result = await getSuspiciousPlayers();
    expect(result).toEqual([]);
  });
});
