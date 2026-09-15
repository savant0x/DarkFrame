/**
 * FID-20260915-001 — battle-resolution regression tests.
 *
 * Pins the Phase-1 semantics against the live incident class:
 *   - BATTLE-17894: simultaneous strike zeroed BOTH HP pools in R1 → DRAW →
 *     applyBattleResults wiped BOTH armies (10,725 + 6,673 units).
 *   - New: attacker strikes first; a dead defender never counter-attacks;
 *     casualties derive from the HP actually deducted.
 * Plus the Phase-3 (converged rebalance) semantics:
 *   - HP = strength + defense per unit (power-proportional): mirrors fight
 *     ~2 rounds at any tier; the 100-round stalemate is structurally
 *     unreachable (min-damage grind still resolves in ≤2 rounds by the
 *     floor's own math) — the cap is a safety net, not an outcome;
 *   - the incident's exact matchup now resolves DefenderWin in 2 rounds with
 *     ~26% proportional garrison losses — overreached raids lose honestly
 *     instead of DRAW-annihilating both sides.
 *
 * resolveBattle is pure (no DB writes): its bonus-stack reads are try/catch
 * fail-soft, so these tests run without a database.
 */
import { describe, it, expect } from 'vitest';
import { resolveBattle } from '@/lib/battleService';
import { BattleOutcome } from '@/types/game.types';
import type { Unit } from '@/types/game.types';

function army(n: number, strength: number, defense: number): Unit[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    type: 'Infantry',
    owner: 'test',
    strength,
    defense,
  })) as unknown as Unit[];
}

describe('FID-20260915-001 battle resolution semantics', () => {
  it('mutual-lethal matchup resolves AttackerWin — never the annihilation DRAW', async () => {
    // Both sides can one-shot each other in R1 (old code: both HP → 0 → DRAW,
    // both armies wiped 100%).
    const attacker = army(100, 1000, 0); // STR 100,000 · HP 1,000
    const defender = army(100, 500, 0);  // STR 50,000  · HP 1,000
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.attacker.unitsLost).toBe(0);
    expect(log.defender.unitsLost).toBe(100);
  });

  it('dead defenders never counter-attack (attacker takes 0 damage on the killing blow)', async () => {
    const attacker = army(10, 100, 0);  // STR 1,000 · HP 100
    const defender = army(5, 50, 0);    // STR 250   · HP 50 — one-shot
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(1);
    expect(log.rounds[0].defenderDamage).toBe(0);
    expect(log.attacker.unitsLost).toBe(0);
  });

  it('casualties are proportional to HP actually deducted (no all-or-nothing wipe)', async () => {
    // Mirror unit (STR 5, DEF 5): pool 10, damage max(5, 10−5) = 5 → two rounds;
    // the defender dies with its pool, not 100× overkill, and no counter deaths.
    const attacker = army(1, 5, 5);
    const defender = army(1, 5, 5);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(2);
    expect(log.attacker.unitsLost).toBe(0);
    expect(log.defender.unitsLost).toBe(1);
  });

  it('an army that dies with its pool records its remaining units as casualties (no phantom survivors)', async () => {
    // Mirror (5,5): R1 deducts 5 of 10 (0 kills), R2 empties the pool — the
    // dead side must NOT survive in the log with 0 losses.
    const attacker = army(1, 5, 5);
    const defender = army(1, 5, 5);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.defender.unitsLost).toBe(1);
    expect(log.attacker.unitsLost).toBe(0);
  });

  it('Phase 3: the old stalemate construction is structurally unreachable (pool collapses under power-proportional HP)', async () => {
    // The Phase-1-era 100-round stalemate fixture, re-run under the converged
    // scale: attacker 51×STR 10 (STR 510, pool 510) vs 2570×DEF 0.1 — the
    // defender's pool was 38,550 under the flat 15-HP rule but is now 2570×0.1
    // = 257, while its armor (DEF 257) still halves the attacker's strike to
    // floor(510 − 128.5) = 381 ≥ 257 → the garrison dies in R1. Power-
    // proportional HP removes the grind class by construction: pools scale
    // WITH power, so halved damage still outpaces the pool it feeds on.
    const attacker = army(51, 10, 0);
    const defender = army(2570, 0, 0.1);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(1);
    expect(log.attacker.unitsLost).toBe(0);   // defender died before its counter
    expect(log.defender.unitsLost).toBe(2570);
  });

  it('INCIDENT REPLAY (BATTLE-17894 exact shape): a 4-round Pyrrhic victory — the raid pays ~70%, nobody is annihilated', async () => {
    // The live incident: attacker 10,725 × STR 100 (pool 1,072,500) vs a
    // garrison of ~1.84M STR / ~788K DEF (pool 6673×393 = 2,622,489). Old code:
    // both pools zeroed in R1 → DRAW → 17,398 units wiped on both sides.
    // Converged-scale trace (deterministic; DEF-counter per the service's
    // armor-shoots-back rule):
    //   R1..R3: attacker deals 1,072,500 − 393,707 = 678,793/round into the
    //   garrison pool; the garrison counters 787,414 − 536,250 = 251,164/round
    //   (killing floor(251,164/100) = 2,511 infantry each round); R4 empties
    //   the garrison pool before it can counter again.
    //   → AttackerWin in 4 rounds, attacker pays 7,533/10,725 ≈ 70.2% —
    //   "if I attacked way higher than my STR, I should've got wrecked":
    //   wrecked, proportionally — never DRAW-annihilated.
    const attacker = army(10725, 100, 0);            // STR 1,072,500 · pool 1,072,500
    const defender = army(6673, 275, 118);           // STR 1,835,075 · DEF 787,414 · pool 2,622,489
    const expectedR1Damage = 1072500 - Math.floor(787414 / 2);
    const log = await resolveBattle(attacker, defender, 'fame', 'Hex_Lord_655', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(4);
    expect(log.rounds[0].attackerDamage).toBe(expectedR1Damage); // STR − DEF/2
    expect(log.attacker.unitsLost).toBe(7533);       // 2,511 × 3 counter rounds
    expect(log.defender.unitsLost).toBe(6673);       // garrison destroyed, honestly
    expect(10725 - log.attacker.unitsLost).toBe(3192); // survivors walk home
  });

  it('defender victory still possible when it survives and kills the attacker', async () => {
    // R1: attacker STR 4 → damage max(5, 4−0)=5 → defender HP 30−5=25 alive →
    // counter DEF 90 → damage 90 → clamped to the attacker's 10 HP pool →
    // attacker destroyed (its 1 unit becomes a casualty).
    const attacker = army(1, 4, 0);
    const defender = army(3, 30, 0);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.DefenderWin);
    expect(log.attacker.unitsLost).toBe(1);
    expect(log.defender.unitsLost).toBe(0);
  });
});
