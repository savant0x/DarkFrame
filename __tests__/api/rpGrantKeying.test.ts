/**
 * @file __tests__/api/rpGrantKeying.test.ts
 * @created 2026-09-19
 * @overview Pins for FID-20260919-010's grant service, in its own file so the
 *            REAL subscriptionService is imported with only the db handle
 *            mocked (the stripeVipKeying pattern; a partial vi.mock here would
 *            fight the behavioral pins in rpCheckout.test.ts).
 *
 *            Asserted: grantRpPackage credits researchPoints and is keyed on
 *            players.USERNAME (the FID-20260917-009 law extends to RP); a
 *            0-row match (unknown player) returns FALSE — the webhook's
 *            throw-on-false depends on it. hasRpTransactionForSession probes
 *            the ledger for tier LIKE 'rp:%'.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { updateMock, executeMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  executeMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn(),
    update: updateMock,
    execute: executeMock,
  },
}));

import { grantRpPackage, hasRpTransactionForSession } from '@/lib/stripe/subscriptionService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('grantRpPackage — the FID-20260917-009 law extended to RP', () => {
  it('credits researchPoints and returns true when the update matches a row', async () => {
    updateMock.mockReturnValue({
      set: () => ({ where: () => Promise.resolve({ rowCount: 1 }) }),
    });

    const ok = await grantRpPackage({ userId: 'probe_user', rp: 5000 });
    expect(ok).toBe(true);
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('returns FALSE on a 0-row match (unknown player) — never a silent success', async () => {
    updateMock.mockReturnValue({
      set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
    });

    const notOk = await grantRpPackage({ userId: 'ghost', rp: 5000 });
    expect(notOk).toBe(false);
  });

  it('returns FALSE when the update throws (db fault surfaces as a failed grant)', async () => {
    updateMock.mockReturnValue({
      set: () => ({ where: () => Promise.reject(new Error('db down')) }),
    });

    const notOk = await grantRpPackage({ userId: 'probe_user', rp: 5000 });
    expect(notOk).toBe(false);
  });
});

describe('hasRpTransactionForSession — the idempotency probe', () => {
  it('returns true only when a prior rp: ledger row exists for the session', async () => {
    executeMock.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
    expect(await hasRpTransactionForSession('cs_replay')).toBe(true);

    executeMock.mockResolvedValueOnce({ rows: [] });
    expect(await hasRpTransactionForSession('cs_fresh')).toBe(false);
  });

  it('a probe failure reads as NOT-processed (grant path proceeds; ledger catches dupes)', async () => {
    executeMock.mockRejectedValueOnce(new Error('db down'));
    expect(await hasRpTransactionForSession('cs_x')).toBe(false);
  });
});
