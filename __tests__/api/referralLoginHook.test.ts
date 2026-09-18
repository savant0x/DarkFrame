/**
 * @file __tests__/api/referralLoginHook.test.ts
 * @created 2026-09-17
 * @overview Pins for FID-20260917-014 (SCOPE row 92): the on-login referral
 *            trigger - loginCount/lastLogin maintenance, criteria-gated
 *            auto-validation through the REAL reward path, exclusion set,
 *            and the claim-guard that makes validateReferral race-safe.
 *
 * db mocked at the handle; service logic runs for real. flagBonusService is
 * mocked (its isFlagBearer would otherwise consume queued db selects).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const { selectMock, insertMock, deleteMock, updateMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  insertMock: vi.fn(),
  deleteMock: vi.fn(),
  updateMock: vi.fn(),
}));

function chain(result: unknown, methods: string[]) {
  const thenable = vi.fn(() => thenable) as unknown as Promise<unknown> & Record<string, ReturnType<typeof vi.fn>>;
  (thenable as unknown as { then: (res: (v: unknown) => unknown) => void }).then = (res) => res(result);
  for (const m of methods) thenable[m] = vi.fn(() => thenable);
  return thenable;
}

vi.mock('@/lib/db', () => ({
  db: {
    select: selectMock,
    insert: insertMock,
    delete: deleteMock,
    update: updateMock,
    execute: vi.fn(),
  },
}));

vi.mock('@/lib/flagBonusService', () => ({
  isFlagBearer: vi.fn(async () => false),
}));

import { processLoginReferralEvents, checkReferralValidation, validateReferral } from '@/lib/referralService';

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/** Walk a drizzle expression and collect Column db-names (name + table + no chunks). */
function collectColumns(node: unknown, acc: Set<string> = new Set()): Set<string> {
  if (!node || typeof node !== 'object') return acc;
  const n = node as { name?: unknown; table?: unknown; queryChunks?: unknown; [k: string]: unknown };
  const chunks = 'queryChunks' in n ? n.queryChunks : undefined;
  if (typeof n.name === 'string' && n.table && chunks === undefined) {
    acc.add(n.name);
    return acc;
  }
  if (Array.isArray(chunks)) { for (const c of chunks) collectColumns(c, acc); return acc; }
  if (chunks && typeof chunks === 'object') { collectColumns(chunks, acc); return acc; }
  for (const v of Object.values(n)) {
    if (v && typeof v === 'object' && !('toISOString' in (v as object))) collectColumns(v, acc);
  }
  return acc;
}

interface UpdateEntry { set?: Record<string, unknown> }

/**
 * Capture every db.update() call. Each builder is awaitable (then -> {rowCount:1},
 * matching drizzle's QueryResult) and `.returning()` resolves to the sequence
 * entry for that call index (default: claim succeeds with one returned row).
 */
function captureUpdate(returningSequence: unknown[] = [[{ id: 'r1' }]]) {
  const captured: UpdateEntry[] = [];
  let call = 0;
  updateMock.mockImplementation(() => {
    const rows = returningSequence[Math.min(call, returningSequence.length - 1)];
    call += 1;
    const entry: UpdateEntry = {};
    captured.push(entry);
    const builder = {
      set: vi.fn((arg: Record<string, unknown>) => { entry.set = arg; return builder; }),
      where: vi.fn(() => builder),
      returning: vi.fn(() => Promise.resolve(rows)),
      then: (res: (v: unknown) => unknown) => res({ rowCount: 1 }),
    };
    return builder;
  });
  return captured;
}

beforeEach(() => {
  vi.resetAllMocks(); // clears once-queues too - clearAllMocks would leak them across tests
});

describe('processLoginReferralEvents (the login hook)', () => {
  it('zero-cost early return: one select, no writes, when the player has no pending referral', async () => {
    selectMock.mockReturnValue(chain([], ['from', 'where']));
    await processLoginReferralEvents('plain_player');
    expect(selectMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('pending-select WHERE excludes invalidated and flagged rows (structural column pin)', async () => {
    let whereArg: unknown;
    const sel = chain([], ['from', 'where']);
    (sel.where as ReturnType<typeof vi.fn>).mockImplementation((arg: unknown) => {
      whereArg = arg;
      return sel;
    });
    selectMock.mockReturnValueOnce(sel);

    await processLoginReferralEvents('someone');
    const cols = collectColumns(whereArg);
    expect(cols.has('new_player_username')).toBe(true);
    expect(cols.has('validated')).toBe(true);
    expect(cols.has('invalidated')).toBe(true);
    expect(cols.has('flagged_for_abuse')).toBe(true);
  });

  it('increments loginCount + stamps lastLogin; criteria unmet -> no validation chain', async () => {
    selectMock
      .mockReturnValueOnce(chain([{ id: 'r1' }], ['from', 'where']))            // pending lookup
      .mockReturnValueOnce(chain([{ validated: 0, signupDate: new Date(NOW - 1 * DAY), loginCount: 5 }], ['from', 'where', 'limit'])); // record read: 1 day old
    const captured = captureUpdate();

    await processLoginReferralEvents('referred_kid');

    // only the loginCount/lastLogin increment ran; the claim UPDATE did not
    expect(captured.length).toBe(1);
    expect(captured[0].set?.loginCount).toBeDefined();
    expect(captured[0].set?.lastLogin).toBeInstanceOf(Date);
    expect(captured[0].set?.validated).toBeUndefined();
  });

  it('end-to-end: 9 days + 4 logins -> validates through the REAL reward path exactly once', async () => {
    selectMock
      .mockReturnValueOnce(chain([{ id: 'r1' }], ['from', 'where']))  // pending
      .mockReturnValueOnce(chain([{ validated: 0, signupDate: new Date(NOW - 9 * DAY), loginCount: 4, newPlayerUsername: 'kid', referrerPlayerId: 'papa', rewardsDataMetal: 100, rewardsDataEnergy: 50, rewardsDataRp: 10, rewardsDataXp: 20, rewardsDataVipDays: 0 }], ['from', 'where', 'limit'])) // check
      .mockReturnValueOnce(chain([{ referralValidated: 0 }], ['from', 'where', 'limit']))                       // new player status
      .mockReturnValueOnce(chain([{ username: 'papa', totalReferrals: 2, pendingReferrals: 1, vipExpiration: null }], ['from', 'where', 'limit'])); // referrer
    const captured = captureUpdate();

    await processLoginReferralEvents('kid');

    // The key writes, regardless of optional milestone bonuses:
    const claim = captured.find((c) => c.set?.validated === 1);
    expect(claim).toBeDefined();
    const referrerSet = captured.find((c) => c.set?.totalReferrals !== undefined)?.set ?? {};
    expect(referrerSet.totalReferrals).toBe(3);
    expect(referrerSet.pendingReferrals).toBe(0);
    expect(referrerSet.referralRewardsMetal).toBeDefined(); // sql increment template
    expect(captured.some((c) => c.set?.rewardsClaimed === 1)).toBe(true);
    expect(captured.some((c) => c.set?.loginCount !== undefined)).toBe(true);
  });

  it('claim race lost (another device validated first) -> no reward writes', async () => {
    const record = { validated: 0, signupDate: new Date(NOW - 9 * DAY), loginCount: 4, referrerPlayerId: 'papa', newPlayerUsername: 'kid', rewardsDataMetal: 100, rewardsDataEnergy: 50, rewardsDataRp: 10, rewardsDataXp: 20, rewardsDataVipDays: 0 };
    selectMock
      .mockReturnValueOnce(chain([{ id: 'r1' }], ['from', 'where']))          // pending
      .mockReturnValueOnce(chain([{ ...record }], ['from', 'where', 'limit'])) // check (ARRAY: service reads recordRows[0])
      .mockReturnValueOnce(chain([{ ...record }], ['from', 'where', 'limit'])); // validateReferral's own read
    // update #1 = increment (returning unused), update #2 = the claim, which LOSES
    const captured = captureUpdate([[{ id: 'r1' }], []]);

    await processLoginReferralEvents('kid');

    // the full chain ran: pending + check + validate reads; increment + claim writes
    expect(selectMock.mock.calls.length).toBe(3);
    expect(updateMock.mock.calls.length).toBe(2);
    // increment + losing claim only: no new-player status, no referrer rewards,
    // no rewardsClaimed flip
    expect(captured.length).toBe(2);
    expect(captured[1].set?.validated).toBe(1);
  });

  it('validateReferral with a LOST claim (row already validated elsewhere) -> false, no reward writes', async () => {
    // Pre-read sees a stale unvalidated row (the race window); the conditional
    // claim then finds validated=1 in the real DB and returns no rows.
    selectMock.mockReturnValueOnce(chain([{ validated: 0, referrerPlayerId: 'papa', newPlayerUsername: 'kid', signupDate: new Date(NOW - 9 * DAY), loginCount: 4 }], ['from', 'where', 'limit']));
    const captured = captureUpdate([[]]);

    const result = await validateReferral('r1');
    expect(result).toBe(false);
    expect(captured.length).toBe(1); // the losing claim attempt only
  });

  it('checkReferralValidation still enforces 7d + 4logins on the record', async () => {
    selectMock.mockReturnValue(chain([{ validated: 0, signupDate: new Date(NOW - 8 * DAY), loginCount: 2 }], ['from', 'where', 'limit']));
    expect(await checkReferralValidation('r1')).toBe(false);

    selectMock.mockReturnValue(chain([{ validated: 0, signupDate: new Date(NOW - 8 * DAY), loginCount: 4 }], ['from', 'where', 'limit']));
    expect(await checkReferralValidation('r1')).toBe(true);
  });
});

describe('login route wiring (source pin)', () => {
  it('POST /api/auth/login wires the hook and imports nothing from lib/mongodb', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/auth/login/route.ts'), 'utf8');
    expect(src).toContain('processLoginReferralEvents');
    expect(src).not.toContain("from '@/lib/mongodb'");
    expect(src).not.toContain('getCollection');
  });
});
