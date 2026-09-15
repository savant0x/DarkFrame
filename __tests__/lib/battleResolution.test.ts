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

  it('INCIDENT REPLAY (BATTLE-17894 exact shape): a 4-round Pyrrhic victory — the raid pays ~73%, nobody is annihilated', async () => {
    // The live incident: attacker 10,725 × STR 100 (pool 1,072,500) vs a
    // garrison of ~1.84M STR / ~788K DEF (pool 6673×393 = 2,622,489). Old code:
    // both pools zeroed in R1 → DRAW → 17,398 units wiped on both sides.
    // Converged-scale trace (deterministic; DEF-counter per the service's
    // armor-shoots-back rule) PLUS FID-20260915-004 army balance: BOTH sides are
    // CRITICAL here (attacker ratio 0 — mono-STR; defender ratio 787414/1835075
    // ≈ 0.43), so each strike composes dealt×taken = 0.8×1.3 = 1.04:
    //   R1..R3: attacker deals floor((1,072,500 − 393,707) × 1.04) = 705,944/round
    //   into the garrison pool; the garrison counters floor(251,164 × 1.04) =
    //   261,210/round (killing 2,612 infantry each round); R4 empties the
    //   garrison pool before it can counter again.
    //   → AttackerWin in 4 rounds, attacker pays 7,836/10,725 ≈ 73.1% —
    //   "if I attacked way higher than my STR, I should've got wrecked":
    //   wrecked, proportionally — never DRAW-annihilated. Mono-axis armies pay
    //   MORE under balance (both CRITICAL) — the designed anti-glass-cannon tax.
    const attacker = army(10725, 100, 0);            // STR 1,072,500 · pool 1,072,500
    const defender = army(6673, 275, 118);           // STR 1,835,075 · DEF 787,414 · pool 2,622,489
    const expectedR1Damage = Math.floor((1072500 - Math.floor(787414 / 2)) * 1.04);
    const log = await resolveBattle(attacker, defender, 'fame', 'Hex_Lord_655', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(4);
    expect(log.rounds[0].attackerDamage).toBe(expectedR1Damage); // (STR − DEF/2) × balance
    expect(log.attacker.unitsLost).toBe(7836);       // 2,612 × 3 counter rounds
    expect(log.defender.unitsLost).toBe(6673);       // garrison destroyed, honestly
    expect(10725 - log.attacker.unitsLost).toBe(2889); // survivors walk home
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

describe('FID-20260915-004 army-balance combat seam', () => {
  it('a CRITICAL out-of-balance raider strikes at ×0.8 dealt (the UI ×0.50 finally executes)', async () => {
    // fame's live shape: mono-STR attacker (ratio 0 → CRITICAL: dealt 0.8,
    // taken 1.3) vs a BALANCED defender (ratio 0.9 → inside 0.85–1.15 but
    // outside OPTIMAL: 1.0/1.0).
    // R1 strike = floor((1,000 − 135/2) × 0.8 × 1.0) = floor(932 × 0.8) = 745.
    // Pre-FID the engine used raw 932 — the balance UI was display-only.
    const attacker = army(10, 100, 0);   // STR 1,000 · DEF 0 → CRITICAL
    const defender = army(3, 50, 45);    // STR 150 · DEF 135 → BALANCED (pool 285)
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 }, { applyCasualties: false });
    expect(log.rounds[0].attackerDamage).toBe(745); // (1000 − 67) × 0.8
    expect(log.rounds[0].defenderDamage).toBe(0);   // garrison pool emptied in R1
  });

  it('OPTIMAL armies on both sides compose dealt × taken (1.05 × 0.95)', async () => {
    // ratio 1.0 = OPTIMAL band (0.95–1.05): dealt 1.05, taken 0.95 — BOTH sides.
    // Attacker strike: floor((500 − 50) × 1.05 × 0.95) = floor(450 × 0.9975) = 448.
    // Defender counter: 0 — the strike (448) exceeds the defender's 200 pool, and
    // dead defenders never strike (FID-20260915-001 rule).
    const attacker = army(10, 50, 50);   // STR 500 · DEF 500 → OPTIMAL
    const defender = army(2, 50, 50);    // STR 100 · DEF 100 → OPTIMAL (pool 200)
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 }, { applyCasualties: false });
    expect(log.rounds[0].attackerDamage).toBe(448);
    expect(log.rounds[0].defenderDamage).toBe(0);
  });

  it('balance overrides win over auto-computed effects (test seam + future callers)', async () => {
    // Same CRITICAL attacker, forced BALANCED (dealt 1.0) via the option;
    // defender ratio 0.9 → BALANCED band (OPTIMAL is exactly 0.95–1.05),
    // taken 1.0: floor((1000 − 67) × 1.0 × 1.0) = 932 (the raw pre-balance
    // number — proving the override replaced the CRITICAL ×0.8).
    const attacker = army(10, 100, 0);
    const defender = army(3, 50, 45);
    const balanced = { ratio: 1.0, status: 'BALANCED' as const, powerMultiplier: 1.0, damageTakenMultiplier: 1.0, damageDealtMultiplier: 1.0, gatheringMultiplier: 1.0, slotRegenMultiplier: 1.0, effectivePower: 1000, warnings: [], bonuses: [], recommendation: '' };
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 }, { applyCasualties: false, attackerBalance: balanced });
    expect(log.rounds[0].attackerDamage).toBe(932);
  });
});
