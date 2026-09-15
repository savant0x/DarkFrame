// @vitest-environment node
/**
 * FID-20260914-004 — shim update/delete semantics:
 *  - honest modifiedCount/deletedCount via `.returning()` (including upsert branches)
 *  - $pull rewritten to the probe-verified jsonb_agg deep-equality form (the old
 *    `jsonb - jsonb` operator SQL cannot execute on this engine)
 *  - $addToSet gains real set semantics (containment guard, no duplicate appends)
 *
 * The tests drive the REAL Collection API over a scripted drizzle layer because CI
 * runs without a database; SQL-shape assertions read the literal string chunks
 * drizzle composes, and the live engine behavior of those shapes is separately
 * pinned by scripts/probePullObjectOperand.ts (read-only, exit 0).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fragmentText,
  harnessState,
  lastCall,
  makeDbModule,
  resetState,
  setPayloadOf,
} from './fakeDrizzle';

vi.mock('@/lib/db', () => makeDbModule());

const { getCollection } = await import('@/lib/mongodb');

describe('shim honest update/delete counts (FID-20260914-004)', () => {
  beforeEach(() => resetState([{ id: 'row-1', username: 'matched' }]));

  it('updateOne reports the real affected-row count (1 on match)', async () => {
    const col = getCollection('players');
    const r = await col.updateOne({ username: 'matched' }, { $set: { username: 'matched' } });
    expect(r.modifiedCount).toBe(1);
    expect(lastCall('update').returningArgs).toEqual([]); // bare .returning()
  });

  it('updateOne on a non-matching filter reports 0 (previously a fictional 1)', async () => {
    resetState([]);
    const col = getCollection('players');
    const r = await col.updateOne({ username: 'ghost' }, { $set: { username: 'ghost' } });
    expect(r.modifiedCount).toBe(0);
  });

  it('updateMany reports the real count (3 affected rows)', async () => {
    resetState([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const col = getCollection('players');
    const r = await col.updateMany({ username: 'matched' }, { $set: { username: 'matched' } });
    expect(r.modifiedCount).toBe(3);
  });

  it('an SQL-fragment payload ($inc) still counts through .returning()', async () => {
    const col = getCollection('players');
    const r = await col.updateOne({ username: 'matched' }, { $inc: { resourcesMetal: 5 } });
    expect(r.modifiedCount).toBe(1);
    // Key resolves through resolveKeyToProp — recorded under the COLUMN prop.
    // Params (the delta 5) are excluded from fragment text; the arithmetic shape proves it is a live SQL fragment.
    const text = fragmentText(setPayloadOf(lastCall('update')).resourcesMetal);
    expect(text).toContain('coalesce(');
    expect(text).toContain(', 0) + ');
  });

  it('an empty set payload skips the update entirely and reports 0', async () => {
    const col = getCollection('players');
    const r = await col.updateOne({ username: 'matched' }, {});
    expect(r.modifiedCount).toBe(0);
    expect(harnessState().calls).toHaveLength(0); // no update issued at all
  });

  it('updateOne still refuses an empty filter (mass-update guard intact)', async () => {
    const col = getCollection('players');
    await expect(col.updateOne({}, { $set: { username: 'x' } })).rejects.toThrow(
      'INVALID_EMPTY_FILTER'
    );
  });

  it('deleteOne/deleteMany report the real deleted count', async () => {
    resetState([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const col = getCollection('players');
    expect((await col.deleteMany({ username: 'matched' })).deletedCount).toBe(3);
    resetState([]);
    expect((await col.deleteOne({ username: 'ghost' })).deletedCount).toBe(0);
  });

  it('upsert onConflictDoUpdate counts its inserted row honestly', async () => {
    const col = getCollection('user_presence');
    const r = await col.updateOne(
      { userId: 'u1' },
      { $set: { lastSeen: new Date('2026-09-14T00:00:00Z') } },
      { upsert: true }
    );
    expect(r.modifiedCount).toBe(1);
    expect(lastCall('insert').chainCalls).toContain('onConflictDoUpdate');
  });

  it('upsert onConflictDoNothing that conflicts reports 0 (FID-004 honest counts on the reachable insert branches)', async () => {
    resetState([]);
    const col = getCollection('user_presence');
    // IMPLEMENTATION DISCOVERY (FID-004, Law 1): the shim's onConflictDoNothing
    // branch is dead code — the whole upsert path is gated on `upsert && setPayload`
    // while that branch requires `!setPayload`, so empty-update upserts fall through
    // to the final `modifiedCount: 0` return. Documented in FID §7; NOT widened here
    // (no live caller sends an empty upsert). Assert the real, honest semantics:
    const r = await col.updateOne({ userId: 'u1' }, {}, { upsert: true });
    expect(r.modifiedCount).toBe(0);
    expect(noInsertCalls()).toBe(true);
  });

  it('bulkWrite sums the real per-op counts', async () => {
    // The scripted rows are shared across ops (one fake table), so the update
    // matches 2 and each delete deletes 2 — honest counting must reflect each.
    resetState([{ id: 'a' }, { id: 'b' }]);
    const col = getCollection('players');
    const r = await col.bulkWrite([
      { updateOne: { filter: { username: 'matched' }, update: { $set: { username: 'matched' } } } },
      { deleteOne: { filter: { username: 'matched' } } },
    ]);
    expect(r.modifiedCount).toBe(4); // 2 (update) + 2 (delete), honestly counted
  });
});

describe('shim $pull rewrite (FID-20260914-004)', () => {
  beforeEach(() => resetState([{ id: 'row-1' }]));

  it('emits the jsonb_agg deep-equality rewrite for an object operand', async () => {
    const col = getCollection('players');
    const unit = { unitId: 'U1', name: 'Grunt' };
    await col.updateOne({ username: 'matched' }, { $pull: { units: unit } });
    const text = fragmentText(setPayloadOf(lastCall('update')).units);
    expect(text).toContain('jsonb_agg(e)');
    expect(text).toContain('jsonb_array_elements(');
    expect(text).toContain('WHERE e <> ');
    expect(text).not.toContain(') - '); // the dead jsonb-minus shape is gone
  });

  it('handles a scalar operand through the same shape', async () => {
    const col = getCollection('players');
    await col.updateOne({ username: 'matched' }, { $pull: { unlockedTiers: 3 } });
    expect(fragmentText(setPayloadOf(lastCall('update')).unlockedTiers)).toContain('jsonb_agg(e)');
  });
});

describe('shim $addToSet semantics (FID-20260914-004)', () => {
  beforeEach(() => resetState([{ id: 'row-1' }]));

  it('guards the append with a containment probe (real set semantics)', async () => {
    const col = getCollection('players');
    await col.updateOne({ username: 'matched' }, { $addToSet: { unlockedTiers: 3 } });
    const text = fragmentText(setPayloadOf(lastCall('update')).unlockedTiers);
    expect(text).toContain('CASE WHEN');
    expect(text).toContain('@>');
    expect(text).toContain('ELSE'); // the append happens only in the else branch
  });
});

/** True when the harness recorded no insert calls (dead-branch proof for upsert tests). */
function noInsertCalls(): boolean {
  return !harnessState().calls.some((c) => c.op === 'insert');
}
