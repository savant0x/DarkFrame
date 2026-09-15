/**
 * Scripted drizzle layer for shim-semantics unit tests (FID-20260914-004).
 * CI runs without a database, so the shim's `db` import is replaced by this
 * stub: every update/delete/insert call is recorded with its chain arguments
 * and method names, and `.returning()` resolves the scripted row set.
 * `makeDbModule()` is consumed inside the vi.mock('@/lib/db') factory; the test
 * body imports this module directly — the module-registry singleton is the
 * shared harness handle.
 */
import { vi } from 'vitest';

export type Row = Record<string, unknown>;

export interface RecordedCall {
  op: 'update' | 'delete' | 'insert';
  /** Arguments captured per chain method, in call order (parallel to chainCalls). */
  args: unknown[];
  /** Chain method names in call order ('set' | 'where' | 'values' | 'onConflictDoUpdate' | …). */
  chainCalls: string[];
  /** Arguments passed to .returning() (length 0 = bare returning()). */
  returningArgs?: unknown[];
}

export interface FakeDrizzleState {
  calls: RecordedCall[];
  rows: Row[];
}

export function makeDbModule(): { db: Record<string, ReturnType<typeof vi.fn>> } {
  const state: FakeDrizzleState = { calls: [], rows: [] };
  // Stash the state on the module function so the test can reach it through the
  // same import used by the factory (one singleton, no ambient globals).
  (makeDbModule as unknown as { __state?: FakeDrizzleState }).__state = state;

  function opStub(op: RecordedCall['op']) {
    return vi.fn(() => {
      const call: RecordedCall = { op, args: [], chainCalls: [] };
      state.calls.push(call);
      const chain: Record<string, (...a: unknown[]) => unknown> = {
        set: (...a: unknown[]) => {
          call.chainCalls.push('set');
          call.args.push(a);
          return chain;
        },
        where: (...a: unknown[]) => {
          call.chainCalls.push('where');
          call.args.push(a);
          return chain;
        },
        values: (...a: unknown[]) => {
          call.chainCalls.push('values');
          call.args.push(a);
          return chain;
        },
        onConflictDoUpdate: (...a: unknown[]) => {
          call.chainCalls.push('onConflictDoUpdate');
          call.args.push(a);
          return chain;
        },
        onConflictDoNothing: (...a: unknown[]) => {
          call.chainCalls.push('onConflictDoNothing');
          call.args.push(a);
          return chain;
        },
        from: () => chain,
        limit: () => chain,
        returning: (...a: unknown[]) => {
          call.chainCalls.push('returning');
          call.returningArgs = a;
          return state.rows;
        },
      };
      return chain;
    });
  }

  const db = {
    update: opStub('update'),
    delete: opStub('delete'),
    insert: opStub('insert'),
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve(state.rows) }),
      }),
    })),
  };
  return { db };
}

export function harnessState(): FakeDrizzleState {
  const s = (makeDbModule as unknown as { __state?: FakeDrizzleState }).__state;
  if (!s) throw new Error('fakeDrizzle harness not initialized (mock factory did not run)');
  return s;
}

export function resetState(rows: Row[] = []): void {
  const s = harnessState();
  s.calls = [];
  s.rows = rows;
}

/**
 * Flatten a drizzle SQL fragment's literal text. drizzle 0.45 wraps template
 * literals in StringChunk objects (string `.value`) and parameters in typed
 * wrappers — params are excluded so assertions target the SQL SHAPE, with the
 * live behavior of that shape pinned separately by the read-only probe script.
 */
export function fragmentText(v: unknown): string {
  const chunks = (v as { queryChunks?: unknown[] } | null)?.queryChunks;
  if (!Array.isArray(chunks)) return String(v ?? '');
  return chunks
    .map((c) => {
      if (typeof c === 'string') return c;
      const val = (c as { value?: unknown }).value;
      // drizzle 0.45: StringChunk.value is a string[]; params carry non-string values.
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.filter((s) => typeof s === 'string').join('');
      return '';
    })
    .join('');
}

export function lastCall(op?: RecordedCall['op']): RecordedCall {
  const calls = harnessState().calls;
  const found = op
    ? [...calls].reverse().find((c) => c.op === op)
    : calls[calls.length - 1];
  if (!found) throw new Error(`no recorded ${op ?? 'any'} call`);
  return found;
}

/** The `.set(...)` payload (first argument) of an update/delete call. */
export function setPayloadOf(call: RecordedCall): Record<string, unknown> {
  const idx = call.chainCalls.indexOf('set');
  if (idx === -1) throw new Error('call has no set() payload');
  const [payload] = call.args[idx] as [Record<string, unknown>];
  return payload;
}
