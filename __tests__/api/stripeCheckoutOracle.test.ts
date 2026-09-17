/**
 * @file __tests__/api/stripeCheckoutOracle.test.ts
 * @created 2026-09-17
 * @overview DOUBLE-RUN ORACLE for FID-20260917-009 — the regression pin for
 *            the VIP grant fix. Replays the checkout.session.completed
 *            webhook (real Stripe delivery + redelivery) against a SEEDED
 *            player store and proves the grant lands in database STATE —
 *            not just that mocks were called.
 *
 * What makes it an oracle, not a mock test:
 *  - drizzle-orm is REAL. The service's actual WHERE expressions
 *    (eq(players.username, userId) chains) are executed.
 *  - ONLY the `db` handle is swapped — for an in-memory engine that
 *    EVALUATES the expressions by walking queryChunks (Column detection:
 *    string name + table + no queryChunks, the shape proven in
 *    stripeVipKeying.test.ts). An unexpected expression shape THROWS —
 *    the oracle fails closed; it never vacuously passes a money path.
 *  - The handlers run for real (lib/stripe/webhookHandlers.ts), running
 *    the real subscription service, running real drizzle against the
 *    engine. End-to-end minus transport and Stripe.
 *
 * Proven here:
 *  1. Delivery: grant lands (vip/tier/Stripe IDs/expiration ≈ now+30d) and
 *     exactly one payment transaction is recorded.
 *  2. Redelivery: grant still landed — with the FID §7 caveat pinned as
 *     documented truth: the transaction ledger is re-recorded on
 *     redelivery (dedupe ledger is the future fix, if ever needed).
 *  3. Precision: a bystander player seeded next to the target is never
 *     touched; every captured expression is asserted username-keyed and
 *     mongoId-free (the original defect).
 *  4. Unknown player: the handler THROWS (false-success class) and the
 *     ledger records nothing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { VIPTier, getVIPDurationDays } from '@/types/stripe.types';

const { engine } = vi.hoisted(() => {
  /**
   * In-memory db engine (single source of truth — must live inside
   * vi.hoisted because the vi.mock factory can only see hoisted values).
   * Evaluates the drizzle expressions the real service builds.
   * Fail-closed: any expression shape it cannot PROVE equivalent to
   * `column === value` throws, so a service-side change to the money-path
   * query breaks this test loudly instead of passing vacuously.
   */
  function createOracleEngine() {
    const state = {
      rows: [] as Array<Record<string, unknown>>,
      selects: [] as Array<{ table: unknown; where: unknown }>,
      updates: [] as Array<{ table: unknown; where: unknown; set: Record<string, unknown> }>,
      executes: [] as unknown[],
    };

    function asColumn(node: unknown): { name: string } | null {
      const n = node as { name?: unknown; table?: unknown; queryChunks?: unknown };
      if (n && typeof n.name === 'string' && n.table !== undefined && n.queryChunks === undefined) {
        return n as { name: string };
      }
      return null;
    }

    /**
     * Evaluate expr; ONLY `column === value` is provable — anything else
     * throws. Chunk-shape notes (drizzle 0.45): eq() builds chunks like
     * [Column, StringChunk(' = '), Param(value), ...] — operator text rides
     * in StringChunk objects ({value: string[]}), values ride in Param
     * objects ({value: scalar}). So: columns collected recursively; scalars
     * from raw primitives, Dates, and Param-like objects (own 'value' prop
     * that is NOT an array); StringChunk operator text ignored; any other
     * object shape fails closed.
     */
    function walkChunks(node: unknown, columns: Array<{ name: string }>, scalars: unknown[]): void {
      if (node == null) return;
      const col = asColumn(node);
      if (col) {
        columns.push(col);
        return;
      }
      const n = node as { queryChunks?: unknown[]; value?: unknown };
      if (Array.isArray(n.queryChunks)) {
        for (const c of n.queryChunks) walkChunks(c, columns, scalars);
        return;
      }
      if (typeof node !== 'object') {
        scalars.push(node); // raw primitive in chunks
        return;
      }
      if (node instanceof Date) {
        scalars.push(node);
        return;
      }
      if (Object.prototype.hasOwnProperty.call(n, 'value')) {
        if (Array.isArray(n.value)) return; // StringChunk operator text — not a value
        scalars.push(n.value); // Param wrapper
        return;
      }
      throw new Error(
        `oracle: unrecognized chunk shape — extend the engine, do not weaken it: ${JSON.stringify(Object.keys(node as object))}`,
      );
    }

    function evalEq(expr: unknown, row: Record<string, unknown>): boolean {
      if (expr == null) return true; // no WHERE = matches all (unused by service)
      const chunks = (expr as { queryChunks?: unknown[] }).queryChunks;
      if (!Array.isArray(chunks)) {
        throw new Error('oracle: unexecutable WHERE shape — extend the engine, do not weaken it');
      }
      const columns: Array<{ name: string }> = [];
      const scalars: unknown[] = [];
      for (const c of chunks) walkChunks(c, columns, scalars);
      if (columns.length !== 1 || scalars.length !== 1) {
        throw new Error(
          `oracle: expected exactly one column + one value, got ${columns.length}+${scalars.length}`,
        );
      }
      return row[columns[0].name] === scalars[0];
    }

    const db = {
      select(_projection?: unknown) {
        const cap: { table: unknown; where: unknown } = { table: null, where: null };
        // where() returns a BUILDER (carrying limit) and limit() terminates —
        // the real service chains .where(...).limit(1) on lookups. Captured
        // on termination only (one entry per query, wherever it terminates).
        const withFrom = {
          where: (expr: unknown) => {
            cap.where = expr;
            return {
              limit: (n: number) => {
                state.selects.push({ ...cap });
                return Promise.resolve(
                  state.rows.filter((r) => evalEq(expr, r)).slice(0, n),
                );
              },
            };
          },
          limit: (n: number) => {
            state.selects.push({ ...cap });
            return Promise.resolve(state.rows.slice(0, n));
          },
        };
        return {
          from: (table: unknown) => {
            cap.table = table;
            return withFrom;
          },
        };
      },
      update(table: unknown) {
        const cap: { table: unknown; where: unknown; set: Record<string, unknown> } = {
          table,
          where: null,
          set: {},
        };
        return {
          set: (values: Record<string, unknown>) => ({
            where: (expr: unknown) => {
              cap.where = expr;
              state.updates.push({ ...cap, set: { ...values } });
              let count = 0;
              for (const r of state.rows) {
                if (evalEq(expr, r)) {
                  Object.assign(r, values);
                  count++;
                }
              }
              return Promise.resolve({ rowCount: count });
            },
          }),
        };
      },
      execute: (chunk: unknown) => {
        state.executes.push(chunk);
        return Promise.resolve({ rows: [{ id: state.executes.length }] });
      },
      insert: () => {
        throw new Error('oracle: unexpected insert through the money-path db handle');
      },
    };

    return {
      db,
      state,
      reset(seed: Array<Record<string, unknown>>) {
        state.rows = seed.map((r) => ({ ...r }));
        state.selects = [];
        state.updates = [];
        state.executes = [];
      },
    };
  }
  return { engine: createOracleEngine() };
});

vi.mock('@/lib/db', () => ({
  db: engine.db,
}));

// Real modules below — only the db handle above is synthetic.
import { handleCheckoutCompleted } from '@/lib/stripe/webhookHandlers';
import { players } from '@/lib/db/schema';

// ---- column inspection (same proven shape-walk as stripeVipKeying.test.ts) ----
function collectColumns(node: unknown, out: PgColumn[] = []): PgColumn[] {
  if (node == null) return out;
  const anyNode = node as { queryChunks?: unknown[]; name?: unknown };
  if (Array.isArray(anyNode.queryChunks)) {
    for (const child of anyNode.queryChunks) collectColumns(child, out);
  }
  if (
    typeof anyNode.name === 'string' &&
    (node as { table?: unknown }).table !== undefined &&
    anyNode.queryChunks === undefined
  ) {
    out.push(node as PgColumn);
  }
  return out;
}

const TARGET = '__oracle_target';
const BYSTANDER = '__oracle_bystander';

function seedRow(username: string): Record<string, unknown> {
  return {
    username,
    email: `${username}@probe.invalid`,
    mongoId: null, // the audited pg-era cohort shape
    vip: 0,
    vipExpiration: null,
    vipTier: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    vipLastUpdated: null,
  };
}

function checkoutEvent(userId: string): Parameters<typeof handleCheckoutCompleted>[0] {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_oracle_1',
        payment_status: 'paid',
        customer: 'cus_oracle',
        subscription: 'sub_oracle',
        amount_total: 1499,
        metadata: { userId, username: userId, tier: VIPTier.MONTHLY },
      },
    },
  } as unknown as Parameters<typeof handleCheckoutCompleted>[0];
}

/** Every captured expression must filter on username and never on mongoId (_id). */
function assertAllUsernameKeyed() {
  const exprs = [
    ...engine.state.selects.map((s) => s.where),
    ...engine.state.updates.map((u) => u.where),
  ].filter((e) => e != null);
  expect(exprs.length).toBeGreaterThan(0);
  for (const e of exprs) {
    const names = collectColumns(e).map((c) => c.name);
    expect(names).toContain('username');
    expect(names).not.toContain('_id'); // mongoId's physical column
  }
}

function row(username: string): Record<string, unknown> {
  const found = engine.state.rows.find((r) => r.username === username);
  expect(found, `seeded row missing: ${username}`).toBeDefined();
  return found as Record<string, unknown>;
}

beforeEach(() => {
  engine.reset([seedRow(TARGET), seedRow(BYSTANDER)]);
});

describe('FID-20260917-009 double-run oracle: checkout webhook replay', () => {
  it('delivery + redelivery: the grant lands and stays landed; bystander untouched; ledger matches the documented caveat', async () => {
    const durationDays = getVIPDurationDays(VIPTier.MONTHLY);

    // ---- RUN 1: the real Stripe delivery ----
    await expect(handleCheckoutCompleted(checkoutEvent(TARGET))).resolves.toBeUndefined();

    assertAllUsernameKeyed();

    // Every query ran against the REAL players table object — no parallel
    // mock-table universe.
    const tables = [
      ...engine.state.selects.map((s) => s.table),
      ...engine.state.updates.map((u) => u.table),
    ];
    expect(tables.length).toBeGreaterThan(0);
    for (const t of tables) expect(t).toBe(players);

    const afterRun1 = row(TARGET);
    expect(afterRun1.vip).toBe(1);
    expect(afterRun1.vipTier).toBe(VIPTier.MONTHLY);
    expect(afterRun1.stripeCustomerId).toBe('cus_oracle');
    expect(afterRun1.stripeSubscriptionId).toBe('sub_oracle');
    expect(afterRun1.vipLastUpdated).toBeInstanceOf(Date);
    const exp1 = afterRun1.vipExpiration as Date;
    expect(Math.abs(exp1.getTime() - (Date.now() + durationDays * 86_400_000))).toBeLessThan(120_000);
    expect(afterRun1.mongoId).toBeNull(); // the fix premise: granted WITHOUT mongoId

    // Exactly one payment transaction recorded for the granted VIP.
    expect(engine.state.executes).toHaveLength(1);

    // Precision: the bystander never moved.
    const bystander1 = row(BYSTANDER);
    expect(bystander1.vip).toBe(0);
    expect(bystander1.vipExpiration).toBeNull();

    // ---- RUN 2: Stripe redelivery of the same event ----
    await expect(handleCheckoutCompleted(checkoutEvent(TARGET))).resolves.toBeUndefined();

    const afterRun2 = row(TARGET);
    expect(afterRun2.vip).toBe(1);
    expect(afterRun2.vipTier).toBe(VIPTier.MONTHLY);
    expect(afterRun2.stripeCustomerId).toBe('cus_oracle');
    const exp2 = afterRun2.vipExpiration as Date;
    expect(exp2.getTime()).toBeGreaterThanOrEqual(exp1.getTime());

    // FID §7 caveat, pinned as documented truth: redelivery re-records the
    // transaction (the grant is idempotent per-row, the ledger is not). If
    // a dedupe ledger ever lands, this assertion flips — consciously.
    expect(engine.state.executes).toHaveLength(2);

    const bystander2 = row(BYSTANDER);
    expect(bystander2.vip).toBe(0);
  });

  it('unknown player: handler THROWS (false-success class) and records no transaction', async () => {
    await expect(handleCheckoutCompleted(checkoutEvent('__oracle_ghost'))).rejects.toThrow(
      /VIP grant failed/,
    );
    expect(engine.state.executes).toHaveLength(0);
    // Nothing in the store changed.
    expect(row(BYSTANDER).vip).toBe(0);
  });
});
