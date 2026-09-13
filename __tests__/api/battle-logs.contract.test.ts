/**
 * FID-20260912-080 — /api/battle-logs ⇄ battle-logs page CONTRACT tests.
 *
 * History: the page fetched /api/battle-logs for ~2 months before the route
 * existed (FID-075 built it). Nothing pinned the shape on either side, so
 * drift was undetectable until the page rendered an empty table. These tests
 * bind the route's live GET handler to the EXACT fields the page reads:
 *
 *   envelope: { logs: BattleLog[], total, page, totalPages }
 *   log:      _id, attackerUsername, defenderUsername,
 *             result ('victory'|'defeat'), type, metalGained, metalLost,
 *             energyGained, energyLost, location {x,y}, timestamp (ISO),
 *             attackerStrength?, defenderStrength?, attackerLosses?, defenderLosses?
 *
 * If the route renames/mistypes a field, or the page starts reading a field
 * the route never sends, one of these tests fails. The shared `expectLogMatchesPageContract`
 * helper IS the page contract, documented field-by-field from page.tsx's render code.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    // select() with NO args = the rows query (chains where→orderBy→limit→offset);
    // select({count}) = the count query (awaits .where() directly — no orderBy).
    __isCount: false,
    __rows: [] as unknown[],
    __count: 0,
    select: (projection?: unknown) => {
      mockDb.__isCount = projection != null;
      return mockDb;
    },
    from: () => mockDb,
    where: () =>
      // Chainable AND awaitable: the rows query keeps chaining (.orderBy…),
      // while the count query awaits right here. Grafting the chain methods
      // onto the resolved promise serves both shapes from one object.
      Object.assign(
        Promise.resolve(
          mockDb.__isCount ? [{ count: mockDb.__count }] : mockDb.__rows
        ),
        mockDb
      ),
    orderBy: () => mockDb,
    limit: () => mockDb, // the route chains .offset() AFTER .limit()
    offset: () =>
      Promise.resolve(
        mockDb.__isCount ? [{ count: mockDb.__count }] : mockDb.__rows
      ),
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/schema')>();
  return { ...actual };
});

import { GET } from '@/app/api/battle-logs/route';

/** A battle_logs row exactly as the DB stores it (snake-mapped drizzle shape). */
function dbRow(overrides: Record<string, unknown> = {}) {
  const ts = new Date('2026-09-12T10:00:00.000Z');
  return {
    battleId: 'battle-100',
    battleType: 'BASE_ATTACK',
    timestamp: ts,
    attackerUsername: 'fame',
    defenderUsername: 'Titan_Gamma',
    attackerTotalSTR: 1072500,
    defenderTotalSTR: 234200,
    attackerUnitsLost: 2,
    defenderUnitsLost: 7,
    outcome: 'ATTACKER_WIN',
    resourcesStolenResourceType: 'metal',
    resourcesStolenAmount: 5000,
    locationX: 65,
    locationY: 67,
    ...overrides,
  };
}

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/battle-logs?${query}`);
}

/** Script the handler's Promise.all select pair (rows + count). */
function scriptDb(rows: unknown[], count: number) {
  mockDb.__rows = rows;
  mockDb.__count = count;
}

/** The page contract, field-by-field from battle-logs/[type]/page.tsx. */
function expectLogMatchesPageContract(log: Record<string, unknown>, type: string) {
  // key={log._id} — missing/undefined breaks React keys
  const id: unknown = log._id;
  expect(typeof id).toBe('string');
  expect((id as string).length).toBeGreaterThan(0);
  // opponent display: `isAttacker ? log.defenderUsername : log.attackerUsername`
  expect(typeof log.attackerUsername).toBe('string');
  expect(typeof log.defenderUsername).toBe('string');
  // victory chip + nn-brief--green/magenta: `log.result === 'victory'`
  expect(['victory', 'defeat']).toContain(log.result);
  // the page's BattleLog union type
  expect(['attack', 'defense', 'infantry', 'land-mines']).toContain(log.type);
  expect(log.type).toBe(type);
  // resource math: `(log.metalGained || 0) - (log.metalLost || 0)`
  expect(typeof log.metalGained).toBe('number');
  expect(typeof log.metalLost).toBe('number');
  expect(typeof log.energyGained).toBe('number');
  expect(typeof log.energyLost).toBe('number');
  // location render: ({log.location.x}, {log.location.y})
  const loc = log.location as { x: number; y: number };
  expect(typeof loc.x).toBe('number');
  expect(typeof loc.y).toBe('number');
  // formatTimestamp(log.timestamp) — must be Date-parseable
  expect(typeof log.timestamp).toBe('string');
  expect(Number.isNaN(new Date(log.timestamp as string).getTime())).toBe(false);
  // optional forces row (rendered only when BOTH present)
  if (log.attackerStrength !== undefined || log.defenderStrength !== undefined) {
    expect(typeof log.attackerStrength).toBe('number');
    expect(typeof log.defenderStrength).toBe('number');
  }
  // optional casualties row (rendered only when BOTH present)
  if (log.attackerLosses !== undefined || log.defenderLosses !== undefined) {
    expect(typeof log.attackerLosses).toBe('number');
    expect(typeof log.defenderLosses).toBe('number');
  }
}

/** The envelope contract: the page reads data.logs / data.total / data.totalPages. */
function expectEnvelopeMatchesPageContract(body: Record<string, unknown>, expectedType: string) {
  expect(body.success).toBe(true);
  expect(Array.isArray(body.logs)).toBe(true);
  expect(typeof body.total).toBe('number');
  expect(typeof body.page).toBe('number');
  expect(typeof body.totalPages).toBe('number');
  expect(body.totalPages).toBeGreaterThanOrEqual(1);
  for (const log of body.logs as Record<string, unknown>[]) {
    expectLogMatchesPageContract(log, expectedType);
  }
}

beforeEach(() => {
  mockDb.__rows = [];
  mockDb.__count = 0;
  mockDb.__isCount = false;
});

describe('GET /api/battle-logs ⇄ battle-logs page contract (FID-080)', () => {
  it('attack view: victory row maps every rendered field correctly', async () => {
    scriptDb([dbRow()], 1);
    const res = await GET(request('username=fame&type=attack&page=1&limit=20'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expectEnvelopeMatchesPageContract(body, 'attack');

    const log = body.logs[0];
    expect(log._id).toBe('battle-100');
    expect(log.result).toBe('victory'); // viewer was attacker + ATTACKER_WIN
    expect(log.metalGained).toBe(5000);
    expect(log.metalLost).toBe(0);
    expect(log.energyGained).toBe(0);
    expect(log.location).toEqual({ x: 65, y: 67 });
    expect(log.attackerStrength).toBe(1072500);
    expect(log.defenderLosses).toBe(7);
    expect(new Date(log.timestamp as string).toISOString()).toBe('2026-09-12T10:00:00.000Z');
  });

  it('defense view: the same DB row is a DEFEAT when the viewer defended and lost', async () => {
    scriptDb([dbRow()], 1);
    const res = await GET(request('username=Titan_Gamma&type=defense&page=1'));
    const body = await res.json();
    expectEnvelopeMatchesPageContract(body, 'defense');
    // viewer was the defender; ATTACKER_WIN → their defeat
    expect(body.logs[0].result).toBe('defeat');
  });

  it('defense view: DEFENDER_WIN is the viewer-side victory (perspective correctness)', async () => {
    scriptDb([dbRow({ outcome: 'DEFENDER_WIN' })], 1);
    const res = await GET(request('username=Titan_Gamma&type=defense&page=1'));
    const body = await res.json();
    expect(body.logs[0].result).toBe('victory');
  });

  it('energy-only spoils map to energyGained, never metal', async () => {
    scriptDb([dbRow({ resourcesStolenResourceType: 'energy', resourcesStolenAmount: 2500 })], 1);
    const res = await GET(request('username=fame&type=attack&page=1'));
    const body = await res.json();
    expect(body.logs[0].energyGained).toBe(2500);
    expect(body.logs[0].metalGained).toBe(0);
  });

  it('DRAW renders as defeat (the page union has no draw state)', async () => {
    scriptDb([dbRow({ outcome: 'DRAW' })], 1);
    const res = await GET(request('username=fame&type=attack&page=1'));
    const body = await res.json();
    expect(body.logs[0].result).toBe('defeat');
  });

  it('empty history still satisfies the envelope (page renders the empty state)', async () => {
    scriptDb([], 0);
    const res = await GET(request('username=nobody&type=land-mines&page=1'));
    const body = await res.json();
    expectEnvelopeMatchesPageContract(body, 'land-mines');
    expect(body.logs).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.totalPages).toBe(1); // Math.max(1, ceil(0/20)) — page guards divide by it
  });

  it('pagination envelope: page 2 of 25 rows at limit 20 → totalPages 2', async () => {
    scriptDb([dbRow({ battleId: 'battle-200' })], 25);
    const res = await GET(request('username=fame&type=attack&page=2&limit=20'));
    const body = await res.json();
    expectEnvelopeMatchesPageContract(body, 'attack');
    expect(body.page).toBe(2);
    expect(body.total).toBe(25);
    expect(body.totalPages).toBe(2);
  });

  it('validation: missing username and bad type are 400s the page never sees', async () => {
    expect((await GET(request('type=attack'))).status).toBe(400);
    expect((await GET(request('username=fame&type=nonsense'))).status).toBe(400);
  });
});
