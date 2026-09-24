/**
 * @file __tests__/api/stripeVipKeying.test.ts
 * @created 2026-09-17
 * @overview Pins for FID-20260917-009 (Stripe VIP remediation), service layer:
 *            every money-function lookup is keyed on players.USERNAME — the
 *            WHERE key itself is asserted by walking the drizzle expression's
 *            queryChunks for Column nodes, because the whole defect was "the
 *            key is the wrong column" (mongoId, NULL for every player).
 *            Webhook behavioral pins live in stripeWebhookFalseSuccess.test.ts.
 *
 * db handle mocked; drizzle-orm stays REAL so captured expressions are live.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

const { selectMock, updateMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
    update: updateMock,
    // updateMock must cover BOTH: grant/update set(...).where(...) AND
    // everything else the service touches. add missing methods on failure.
    execute: vi.fn(),
    insert: vi.fn(),
  },
}));

import {
  grantVIP,
  revokeVIP,
  extendVIP,
  checkVIPStatus,
  getUserByStripeCustomerId,
} from '@/lib/stripe/subscriptionService';
import { players } from '@/lib/db/schema';
import { VIPTier } from '@/types/stripe.types';

// ---- drizzle expression inspection (real drizzle, version-proof) ----

/** Collect every Column node reachable in a drizzle expression via queryChunks. */
function collectColumns(node: unknown, out: PgColumn[] = []): PgColumn[] {
  if (node == null) return out;
  const anyNode = node as { queryChunks?: unknown[]; name?: unknown };
  if (Array.isArray(anyNode.queryChunks)) {
    for (const child of anyNode.queryChunks) collectColumns(child, out);
  }
  // Column detection: drizzle Column instances carry `name` and `table` and
  // are leaf nodes (their queryChunks is undefined in this version).
  if (
    typeof anyNode.name === 'string' &&
    (node as { table?: unknown }).table !== undefined &&
    anyNode.queryChunks === undefined
  ) {
    out.push(node as PgColumn);
  }
  return out;
}

/** Assert the WHERE expression references username and NOT mongoId. */
function expectKeyedOnUsername(expr: unknown) {
  const cols = collectColumns(expr);
  expect(cols.length).toBeGreaterThan(0);
  const names = cols.map((c) => c.name);
  expect(names).toContain('username');
  expect(names).not.toContain('_id'); // mongoId's physical column name
}

// ---- chain builders ----
// ONE thenable object carries every method; each method returns the thenable,
// so drizzle's varying call orders (.from().where().limit() vs .where() alone)
// all work, and awaiting anywhere yields the final result. Per-method vi.fns
// keep call capture separate for the WHERE-key assertions.
function makeChain<T>(result: T, methods: string[]) {
  const thenable = vi.fn(() => thenable) as unknown as Promise<T> & Record<string, ReturnType<typeof vi.fn>>;
  (thenable as unknown as { then: (res: (v: T) => unknown) => void }).then = (res) => res(result);
  for (const m of methods) {
    thenable[m] = vi.fn(() => thenable);
  }
  return thenable;
}

function selectReturning(rows: unknown[]) {
  const chain = makeChain(rows, ['from', 'where', 'limit']);
  selectMock.mockReturnValue(chain);
  return chain;
}

function updateReturning(result: { rowCount: number | null }) {
  const chain = makeChain(result, ['set', 'where']);
  updateMock.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FID-20260917-009: money functions are username-keyed', () => {
  it('grantVIP: lookup + update filter on players.username', async () => {
    const row = { username: 'fame', vip: 0, vipExpiration: null };
    const sel = selectReturning([row]);
    const upd = updateReturning({ rowCount: 1 });

    const ok = await grantVIP({
      userId: 'fame',
      tier: VIPTier.MONTHLY,
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
    });

    expect(ok).toBe(true);
    expectKeyedOnUsername(sel.where.mock.calls[0][0] as SQL);
    expectKeyedOnUsername(upd.where.mock.calls[0][0] as SQL);
  });

  it('grantVIP: missing player → false (no update issued)', async () => {
    selectReturning([]);

    const ok = await grantVIP({
      userId: 'ghost',
      tier: VIPTier.MONTHLY,
      stripeCustomerId: 'cus_test',
      stripeSubscriptionId: 'sub_test',
    });

    expect(ok).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('revokeVIP: filters on players.username; zero rows matched → false', async () => {
    const miss = updateReturning({ rowCount: 0 });
    expect(await revokeVIP('ghost')).toBe(false);
    expectKeyedOnUsername(miss.where.mock.calls[0][0] as SQL);

    const hit = updateReturning({ rowCount: 1 });
    expect(await revokeVIP('fame')).toBe(true);
    expectKeyedOnUsername(hit.where.mock.calls[0][0] as SQL);
  });

  it('extendVIP: extends FROM the existing future expiration and filters on username', async () => {
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const row = { username: 'fame', vipExpiration: future };
    const sel = selectReturning([row]);
    const upd = updateReturning({ rowCount: 1 });

    const ok = await extendVIP({ userId: 'fame', tier: VIPTier.WEEKLY });
    expect(ok).toBe(true);
    expectKeyedOnUsername(sel.where.mock.calls[0][0] as SQL);
    expectKeyedOnUsername(upd.where.mock.calls[0][0] as SQL);

    const newExp = (upd.set.mock.calls[0][0] as { vipExpiration: Date }).vipExpiration;
    // FID-20260923-002: mirror production's METHOD, not just its intent.
    // extendVIP adds an exact duration (`base.getTime() + days * 86_400_000`);
    // this expectation used to walk the calendar (`setDate(getDate() + 7)`),
    // which differs by the DST offset whenever the window crosses a transition.
    const expected = new Date(future.getTime() + 7 * 86_400_000);
    expect(newExp.getTime()).toBe(expected.getTime());
  });

  it('extendVIP adds an exact duration across a DST change', async () => {
    // FID-20260923-002 — a METHOD pin, deliberately hard-coded.
    //
    // The test above derives its expectation with the same arithmetic as
    // production, so it can only ever confirm self-consistency. This case fixes
    // the absolute instant instead: extending from 2027-03-10T17:00:00Z
    // (12:00 America/New_York, EST) by 7 days must land on 17:00:00Z. A
    // host-local wall-clock walk would land on 16:00:00Z, because the window
    // crosses the 2027-03-14 transition (noon EDT = 16:00Z). The suite is
    // UTC-pinned, where those two agree — so the distinction has to be written
    // down here or it is unpinnable.
    const base = new Date('2027-03-10T17:00:00.000Z');
    selectReturning([{ username: 'fame', vipExpiration: base }]);
    const upd = updateReturning({ rowCount: 1 });

    expect(await extendVIP({ userId: 'fame', tier: VIPTier.WEEKLY })).toBe(true);
    const newExp = (upd.set.mock.calls[0][0] as { vipExpiration: Date }).vipExpiration;
    expect(newExp.toISOString()).toBe('2027-03-17T17:00:00.000Z');
  });

  it('checkVIPStatus: filters on players.username; active VIP echoed', async () => {
    const row = { vip: 1, vipExpiration: new Date(Date.now() + 86400_000), vipTier: 'MONTHLY' };
    const sel = selectReturning([row]);

    const status = await checkVIPStatus('fame');
    expect(status.isVIP).toBe(true);
    expectKeyedOnUsername(sel.where.mock.calls[0][0] as SQL);
  });

  it('getUserByStripeCustomerId projects username as id (no NULL mongoId alias)', async () => {
    const row = { id: 'fame', username: 'fame', email: 'f@x.dev' };
    selectReturning([row]);

    const user = await getUserByStripeCustomerId('cus_test');
    expect(user).toEqual({ id: 'fame', username: 'fame', email: 'f@x.dev' });

    const projection = selectMock.mock.calls[0][0] as Record<string, unknown>;
    expect(projection.id).toBe(players.username);
    expect(projection.id).not.toBe(players.mongoId);
  });
});
