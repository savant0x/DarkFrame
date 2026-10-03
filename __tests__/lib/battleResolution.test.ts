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
import { describe, it, expect, vi } from 'vitest';
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

  it('INCIDENT REPLAY (BATTLE-17894 exact shape): 4 rounds under living-stats attrition — the counter collapses as the garrison dies', async () => {
    // The live incident: attacker 10,725 × STR 100 (pool 1,072,500) vs a
    // garrison of ~1.84M STR / ~788K DEF (pool 6673×393 = 2,622,489). Old code:
    // both pools zeroed in R1 → DRAW → 17,398 units wiped on both sides.
    // FID-20260915-004 army balance: BOTH sides are CRITICAL (attacker ratio 0
    // — mono-STR; defender ratio 787414/1835075 ≈ 0.43), so each strike
    // composes dealt×taken = 0.8×1.3 = 1.04. FID-20261002-013: stats are
    // RECOMPUTED from living copies every strike, so the garrison's armor
    // (and its counter) collapses as copies die — exact trace:
    //   R1: strike floor((1,072,500 − 787,414/2) × 1.04) = 705,944 → kills
    //       1,796 garrison copies (393 HP each; frontier keeps 277). Counter
    //       from LIVING DEF 4,877×118 = 575,486: floor(575,486 − 536,250) ×
    //       1.04 = 40,805 → kills 408 attackers (100 HP each).
    //   R2: strike floor((1,031,700 − 575,486/2) × 1.04) = 773,715 → 1,969
    //       dead; counter floor(343,144 − 515,850) < 0 → floor 5 → 0 deaths.
    //   R3: strike floor((1,031,700 − 343,144/2) × 1.04) = 894,533 → 2,276.
    //   R4: strike 1,034,188 ≥ pool 248,297 → garrison annihilated.
    //   → AttackerWin in 4 rounds; the raid pays 408/10,725 ≈ 3.8% (the
    //   pre-013 pool model charged 7,836 ≈ 73% because the counter ignored
    //   casualties). PvE pacing shift is quantified in the FID record.
    const attacker = army(10725, 100, 0);            // STR 1,072,500 · pool 1,072,500
    const defender = army(6673, 275, 118);           // STR 1,835,075 · DEF 787,414 · pool 2,622,489
    const expectedR1Damage = Math.floor((1072500 - Math.floor(787414 / 2)) * 1.04);
    const log = await resolveBattle(attacker, defender, 'fame', 'Hex_Lord_655', 'BASE_RAID' as never);
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds).toHaveLength(4);
    expect(log.rounds[0].attackerDamage).toBe(expectedR1Damage); // (STR − DEF/2) × balance
    expect(log.attacker.unitsLost).toBe(408);        // R1 counter from living DEF 575,486
    expect(log.defender.unitsLost).toBe(6673);       // garrison destroyed, honestly
    expect(10725 - log.attacker.unitsLost).toBe(10317); // survivors walk home
    // FID-20261002-013 §5.4 invariants: per-round sums = participant totals;
    // initial copies = survivors + casualties.
    expect(log.rounds.reduce((s, r) => s + r.attackerUnitsLost, 0)).toBe(log.attacker.unitsLost);
    expect(log.rounds.reduce((s, r) => s + r.defenderUnitsLost, 0)).toBe(log.defender.unitsLost);
    expect(log.attacker.survivorCount).toBe(10725 - 408);
    expect(log.defender.survivorCount).toBe(0);
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

describe('FID-20261002-013 attrition semantics (terminal outcomes, per-copy HP, living stats, human power)', () => {
  const balanced = { ratio: 1.0, status: 'BALANCED' as const, powerMultiplier: 1.0, damageTakenMultiplier: 1.0, damageDealtMultiplier: 1.0, gatheringMultiplier: 1.0, slotRegenMultiplier: 1.0, effectivePower: 1000, warnings: [], bonuses: [], recommendation: '' };

  it('a kill landing ON round 99 resolves AttackerWin', async () => {
    // Single-copy duel, balance pinned BALANCED so the arithmetic is exact.
    // Attacker 505 STR / 71,722 DEF (pool 72,227); defender 0/990 (pool 990).
    // Strike floor(505 − 990/2) = 10/round → the pool dies on exactly
    // ceil(990/10) = ROUND 99. Counter floor(990 − 505/2) = 737/round — the
    // attacker absorbs 98 of them (72,226) and survives with 1 HP because
    // the round-99 kill never draws return fire.
    const log = await resolveBattle(
      army(1, 505, 71722), army(1, 0, 990),
      'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 },
      { attackerLevel: 1, defenderLevel: 1, attackerBalance: balanced, defenderBalance: balanced },
    );
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.totalRounds).toBe(99);
    expect(log.defender.unitsLost).toBe(1);
    expect(log.attacker.unitsLost).toBe(0);
    expect(log.attacker.finalHP).toBe(1);
    expect(log.rounds[98].attackerDamage).toBe(10);
  });

  it('a kill landing ON round 100 resolves AttackerWin — the terminal outcome precedes the cap', async () => {
    // Old code: the round-100 break set repelled=true unconditionally, so
    // this exact fight returned DEFENDER_WIN with the attacker alive (R6).
    // Strike floor(457 − 895/2) = 9/round → pool 895 dies on ceil(895/9) =
    // ROUND 100. Counter floor(895 − 457/2) = 666/round; the attacker
    // absorbs 99 of them (65,934 of its 65,935 pool) and survives with 1 HP.
    const log = await resolveBattle(
      army(1, 457, 65478), army(1, 0, 895),
      'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 },
      { attackerLevel: 1, defenderLevel: 1, attackerBalance: balanced, defenderBalance: balanced },
    );
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.totalRounds).toBe(100);
    expect(log.defender.unitsLost).toBe(1);
    expect(log.attacker.finalHP).toBe(1);
  });

  it('a live-live standoff at the cap is still the repelled raid (defender holds)', async () => {
    // Strike 199/round into a 20,001 pool (alive at 101 after 100 rounds);
    // counter 14,901/round into a 1,490,200 pool (alive at 100). Neither
    // side reaches zero on the cap round → the REPELLED DefenderWin.
    const log = await resolveBattle(
      army(1, 10200, 1480000), army(1, 0, 20001),
      'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 },
      { attackerLevel: 1, defenderLevel: 1, attackerBalance: balanced, defenderBalance: balanced },
    );
    expect(log.outcome).toBe(BattleOutcome.DefenderWin);
    expect(log.totalRounds).toBe(100);
    expect(log.attacker.finalHP).toBe(100);
    expect(log.defender.finalHP).toBe(101);
    expect(log.attacker.survivorCount).toBe(1);
    expect(log.defender.survivorCount).toBe(1);
  });

  it('per-copy HP carries: two 600-HP copies lose ONE copy to 500+500 and carry 400 to the survivor; later strikes use living stats', async () => {
    // Defender: 2 copies × (0, 600) — pool 1,200, HP 600 each. Attacker:
    // single copy (1600, 0); the level-30 gap scales every strike by exactly
    // 0.5. Balance pinned BALANCED.
    //   R1 strike floor((1600 − 1200/2) × 0.5) = 500 → copy1 at 100/600.
    //      Counter floor((1200 − 800) × 0.5) = 200 — wounds reduce HP, not
    //      stats: the damaged copy still defends at full strength.
    //   R2 strike 500 → copy1 dies (100), copy2 absorbs 400 → 200/600. The
    //      counter recomputes from LIVING DEF 600: max(5, floor((600 − 800)
    //      × 0.5)) = 5.
    //   R3 strike floor((1600 − 600/2) × 0.5) = 650 — the RECOMPUTED strike
    //      (still 500 under frozen stats) kills copy2. Win in 3.
    const log = await resolveBattle(
      army(1, 1600, 0), army(2, 0, 600),
      'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 },
      { attackerLevel: 40, defenderLevel: 10, attackerBalance: balanced, defenderBalance: balanced },
    );
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds[0].attackerDamage).toBe(500);
    expect(log.rounds[0].defenderUnitsLost).toBe(0);
    expect(log.rounds[0].defenderDamage).toBe(200);
    expect(log.rounds[1].attackerDamage).toBe(500);
    expect(log.rounds[1].defenderUnitsLost).toBe(1); // cumulative exhaustion kills copy1
    expect(log.rounds[1].defenderDamage).toBe(5);    // only survivors counter, at living stats
    expect(log.rounds[2].attackerDamage).toBe(650);  // living stats: DEF fell 1200 → 600
    expect(log.rounds[2].defenderUnitsLost).toBe(1);
    expect(log.rounds[2].defenderDamage).toBe(0);    // dead defenders never counter
    expect(log.defender.unitsLost).toBe(2);
    expect(log.defender.survivorCount).toBe(0);
    expect(log.attacker.survivorCount).toBe(1);
  });

  it('corrupt and degenerate inputs stay finite: NaN/negative stats sanitize, zero-stat copies keep the 10 HP floor', async () => {
    const corrupt = [
      { id: 'c1', type: 'Infantry', owner: 'atk', strength: Number.NaN, defense: 0 },
      { id: 'c2', type: 'Infantry', owner: 'atk', strength: -5, defense: 3 },
    ] as unknown as Unit[];
    const log = await resolveBattle(corrupt, army(1, 0, 0), 'atk', 'def', 'BASE_RAID' as never);
    expect(Number.isFinite(log.attacker.finalHP)).toBe(true);
    expect(Number.isFinite(log.defender.finalHP)).toBe(true);
    expect(log.attacker.finalHP).toBeGreaterThanOrEqual(0);
    expect(log.defender.initialHP).toBe(10); // zero-power floor
    expect(log.attacker.initialHP).toBe(13); // NaN→0 (floor 10) + (0,3)=3
    expect(log.outcome).toBe(BattleOutcome.AttackerWin);
    expect(log.rounds.reduce((s, r) => s + r.attackerUnitsLost, 0)).toBe(log.attacker.unitsLost);
    expect(log.rounds.reduce((s, r) => s + r.defenderUnitsLost, 0)).toBe(log.defender.unitsLost);
  });

  it('equivalent stack partitions resolve identically and the seeded battle order is deterministic', async () => {
    // [X qty 10, Y qty 4] expanded vs the same copies split across two
    // inventory entries [X 6, X 4, Y 4] — identical canonical copy lists,
    // identical battles under the same seeded permutation.
    const merged = [...army(10, 200, 0), ...army(4, 0, 150)];
    const split = [...army(6, 200, 0), ...army(4, 200, 0), ...army(4, 0, 150)];
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.99); // identity order for ≤100 copies
    const a = await resolveBattle(merged, army(8, 0, 120), 'atk', 'def', 'BASE_RAID' as never);
    const b = await resolveBattle(split, army(8, 0, 120), 'atk', 'def', 'BASE_RAID' as never);
    const a2 = await resolveBattle(merged, army(8, 0, 120), 'atk', 'def', 'BASE_RAID' as never);
    spy.mockRestore();
    expect(b.outcome).toBe(a.outcome);
    expect(b.totalRounds).toBe(a.totalRounds);
    expect(b.attacker.unitsLost).toBe(a.attacker.unitsLost);
    expect(b.defender.unitsLost).toBe(a.defender.unitsLost);
    expect(a2.rounds.map(r => [r.attackerDamage, r.defenderDamage])).toEqual(a.rounds.map(r => [r.attackerDamage, r.defenderDamage]));
  });

  it('human-combat context: the frozen powerMultiplier joins effective STR/DEF once, per human side (server seam only)', async () => {
    // Attacker 10×(100,0) → raw (1000,0) CRITICAL: power 0.5, dealt 0.8.
    // Defender 3×(0,45) → raw (0,135) CRITICAL: power 0.5, taken 1.3.
    // Without context the strike is floor((1000 − 67.5)) × 0.8 × 1.3 = 969
    // (the pre-013 seam). The context (never client JSON) scales each human
    // side's axes by its OWN frozen power multiplier, exactly once:
    //   attacker-only: STR floor(1000×0.5)=500 → floor(500 − 67.5) ×1.04 = 449
    //   defender-only: DEF floor(135×0.5)=67  → floor(1000 − 33.5) ×1.04 = 1004
    //   both human:     STR 500, DEF 67      → floor(500 − 33.5) ×1.04 = 484
    const run = async (ctx?: object) => {
      const log = await resolveBattle(
        army(10, 100, 0), army(3, 0, 45),
        'atk', 'def', 'BASE_RAID' as never, { x: 0, y: 0 },
        { attackerLevel: 1, defenderLevel: 1, ...ctx },
      );
      return log.rounds[0].attackerDamage;
    };
    expect(await run()).toBe(969);
    expect(await run({ humanCombat: { attackerIsHuman: true, defenderIsHuman: false } })).toBe(449);
    expect(await run({ humanCombat: { attackerIsHuman: false, defenderIsHuman: true } })).toBe(1004);
    expect(await run({ humanCombat: { attackerIsHuman: true, defenderIsHuman: true } })).toBe(484);
  });
});
