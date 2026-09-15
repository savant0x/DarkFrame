/**
 * FID-20260915-001 — battle-resolution regression tests.
 *
 * Pins the Phase-1 semantics against the live incident class:
 *   - BATTLE-17894: simultaneous strike zeroed BOTH HP pools in R1 → DRAW →
 *     applyBattleResults wiped BOTH armies (10,725 + 6,673 units).
 *   - New: attacker strikes first; a dead defender never counter-attacks;
 *     casualties derive from the HP actually deducted; the 100-round cap is a
 *     repelled raid (DefenderWin), not a casualty-charging Draw.
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
    // STR 6 vs 6 → damage 6 per side vs 10 HP pools → multi-round; the attacker
    // deducts 6 HP in R1 (kills floor(6/10) = 0 units) and wins in R2. The
    // defender dies with its pool, not 100× overkill.
    const attacker = army(1, 6, 0);
    const defender = army(1, 6, 0);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds.length).toBeGreaterThanOrEqual(2);
    expect(log.attacker.unitsLost).toBe(0);
    expect(log.defender.unitsLost).toBe(1);
  });

  it('an army that dies with its pool records its remaining units as casualties (no phantom survivors)', async () => {
    // R1: attacker strike deducts 6 of the defender's 10 HP (0 kills), R2 kills
    // the pool — the dead side must NOT survive in the log with 0 losses.
    const attacker = army(1, 6, 0);
    const defender = army(1, 6, 0);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.defender.unitsLost).toBe(1);
    expect(log.attacker.unitsLost).toBe(0);
  });

  it('100-round cap is a REPELLED raid: DefenderWin, not a casualty-charging Draw', async () => {
    // Stalemate construction (the min-damage floor of 5 shapes both sides):
    // attacker 51×STR 10 → STR 510, pool 510, damage max(5, 510−125)=385/round;
    // defender 2570×DEF 0.1 → DEF 257, pool 38,550, counter max(5, 257−255)=5.
    // Over 100 rounds: defender soaks 38,500 of 38,550 HP (survives); attacker
    // soaks 500 of 510 → the cap fires with both armies still standing.
    const attacker = army(51, 10, 0);
    const defender = army(2570, 0, 0.1);
    const log = await resolveBattle(attacker, defender, 'atk', 'def', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.DefenderWin);
    expect(log.rounds).toHaveLength(100);
    expect(log.attacker.unitsLost).toBe(0);
    expect(log.defender.unitsLost).toBeLessThan(2570);
  });

  it('INCIDENT REPLAY (BATTLE-17894 shape): AttackerWin with attacker alive — never DRAW-mutual-wipe', async () => {
    // The live incident: attacker 10,725 × STR 100 (pool 107,250) vs a defender
    // garrison of ~1.84M STR / ~788K DEF (pool 76,110). Old code: both pools
    // zeroed in R1 → DRAW → 17,398 units wiped across both accounts. The garrison
    // is reconstructed to the incident's exact SIZE and approximate totals; the
    // damage assertion is derived from the formula, not hardcoded.
    const attacker = army(10725, 100, 0);            // STR 1,072,500 · pool 107,250
    const defender = army(6673, 275, 118);           // STR 1,835,075 · DEF 787,414
    const expectedDamage = 1072500 - Math.floor(787414 / 2);
    const log = await resolveBattle(attacker, defender, 'fame', 'Hex_Lord_655', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(1);
    expect(log.rounds[0].attackerDamage).toBe(expectedDamage); // STR − DEF/2
    expect(log.rounds[0].defenderDamage).toBe(0);    // dead defenders never strike
    expect(log.attacker.unitsLost).toBe(0);
    expect(log.defender.unitsLost).toBe(6673);       // full garrison, once
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
