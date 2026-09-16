// @vitest-environment node
/**
 * FID-20260912-060 B1/B2/B4 — battle-RP pacing contracts.
 *
 * B1 envelope: first 10 victorious battle awards per player per UTC day pay
 * full; beyond that 20% with a 25-base floor; ledger outage fails open.
 * B2 saturating level term: exact pins + monotonicity + 300 asymptote.
 * B4 defense gate: RP only vs higher-or-equal attackers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const battleState: { wins: number; fail: boolean } = { wins: 0, fail: false };

vi.mock('@/lib/db', () => ({
  db: {
    execute: vi.fn(async () => {
      if (battleState.fail) throw new Error('ledger unreachable');
      return { rows: [{ battlewins: battleState.wins }] };
    }),
  },
}));

import {
  applyBattleEnvelope,
  saturatingBattleRP,
  BATTLE_FULL_PAYOUT_WINS_PER_DAY,
  BATTLE_DIMINISHED_RATE,
  BATTLE_DIMINISHED_FLOOR,
} from '@/lib/researchPointService';
import { defenseRpEligible } from '@/lib/battleService';

beforeEach(() => {
  battleState.wins = 0;
  battleState.fail = false;
});

describe('B1 — daily battle envelope', () => {
  it('pays full inside the envelope (9 wins → 500 stays 500)', async () => {
    battleState.wins = 9;
    await expect(applyBattleEnvelope('raider', 500)).resolves.toEqual({ base: 500, throttled: false });
  });

  it('throttles at and beyond 10 wins (500 → 100 @20%)', async () => {
    battleState.wins = 10;
    await expect(applyBattleEnvelope('raider', 500)).resolves.toEqual({ base: 100, throttled: true });
    battleState.wins = 87;
    await expect(applyBattleEnvelope('raider', 500)).resolves.toEqual({ base: 100, throttled: true });
  });

  it('floors small payouts at 25 base (100 → 25, not 20)', async () => {
    battleState.wins = 10;
    await expect(applyBattleEnvelope('raider', 100)).resolves.toEqual({ base: 25, throttled: true });
  });

  it('fails open on ledger outage (full amount, not throttled)', async () => {
    battleState.fail = true;
    await expect(applyBattleEnvelope('raider', 500)).resolves.toEqual({ base: 500, throttled: false });
  });

  it('constants match the FID contract (10 / 0.2 / 25)', () => {
    expect(BATTLE_FULL_PAYOUT_WINS_PER_DAY).toBe(10);
    expect(BATTLE_DIMINISHED_RATE).toBe(0.2);
    expect(BATTLE_DIMINISHED_FLOOR).toBe(25);
  });
});

describe('B2 — saturating level term', () => {
  it('exact pins (correct arithmetic — the FID text overstated L14)', () => {
    expect(saturatingBattleRP(0)).toBe(100);
    expect(saturatingBattleRP(1)).toBe(110);
    expect(saturatingBattleRP(5)).toBe(144);
    expect(saturatingBattleRP(14)).toBe(201);
    expect(saturatingBattleRP(65)).toBe(292);
  });

  it('monotonic non-decreasing and asymptotically bounded at 300', () => {
    let prev = 0;
    for (let lvl = 0; lvl <= 200; lvl += 1) {
      const v = saturatingBattleRP(lvl);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(300);
      prev = v;
    }
  });

  it('clamps hostile input (negative/NaN → 100)', () => {
    expect(saturatingBattleRP(-5)).toBe(100);
    expect(saturatingBattleRP(NaN)).toBe(100);
  });
});

describe('B4 — defense RP gate', () => {
  it('pays vs higher-or-equal attackers, never vs weaker', () => {
    expect(defenseRpEligible(20, 10)).toBe(true); // upset: reward
    expect(defenseRpEligible(10, 10)).toBe(true); // peer: reward
    expect(defenseRpEligible(5, 10)).toBe(false); // farming: cut
    expect(defenseRpEligible(1, 65)).toBe(false);
  });
});
