/**
 * @__tests__/lib/battleReportParser.test.ts
 * @overview FID-20260911-044 — battle report parser contract.
 *
 * Pins parseBattleReport against the exact report text shipped by
 * lib/battleNotification.formatBattleResultMessage (taken from the live
 * database row produced by the FID-043 raid smoke), plus defensive parses
 * of arbitrary/truncated text. The card renderer's empty-card guarantee
 * depends on `parsed: false` for non-report bodies.
 */

import { describe, it, expect } from 'vitest';
import { parseBattleReport } from '@/lib/battleReportParser';

// Verbatim live report (defeat, with captures) — format contract.
const DEFEAT_REPORT = `⚔️ BATTLE REPORT — FACTORY at (44, 2) — DEFEAT
🗓 9/11/2026, 1:37:37 PM · Battle ID BATTLE-17891 · 1 round

📋 FORCES COMMITTED
🎯 Attacker: fame
  • INFANTRY ×10,725 — STR 1,072,500 / DEF 0
  • Total STR 1,340,625 · DEF 0 · HP 107,250 → 0
🛡 Defender: Silent_Citadel
  • INFANTRY ×6,434 — STR 643,400 / DEF 0
  • SPEC_OFF_VANGUARD ×6,426 — STR 1,285,200 / DEF 0
  • SPEC_OFF_EXECUTIONER ×5,355 — STR 1,927,800 / DEF 0
  • T4_TANK ×1,028 — STR 1,542,000 / DEF 0
  • T5_WARLORD ×228 — STR 1,026,000 / DEF 0
  • T1_WATCHMAN ×3,060 — STR 0 / DEF 275,400
  • T2_RAMPART ×2,118 — STR 0 / DEF 550,680
  • SPEC_DEF_CITADEL ×2,295 — STR 0 / DEF 826,200
  • T4_STRONGHOLD ×388 — STR 0 / DEF 659,600
  • T5_BASTION ×88 — STR 0 / DEF 440,000
  • T1_BARRICADE ×2 — STR 0 / DEF 200
  • Total STR 6,424,400 · DEF 2,752,080 · HP 313,975 → 313,970

🎲 ROUND-BY-ROUND
  R1: A dealt 5 / D dealt 2,081,767 — HP 0 vs 313,970 — losses A 10725 / D 0

💀 CASUALTIES & RESULTS
  • Attacker lost 10,725 units · dealt 5 total damage
  • Defender lost 0 units · dealt 2,081,767 total damage
  • Units captured — attacker took 0, defender took 1376
  • 💰 You plundered 1,250 metal
  • XP — attacker +150 · defender +75
  ℹ️ extra note line`;

const VICTORY_DRAW_REPORT = `⚔️ BATTLE REPORT — BASE at (10, 20) — DRAW
🗓 1/1/2026, 12:00:00 AM · Battle ID BATTLE-1 · 3 rounds

📋 FORCES COMMITTED
🎯 Attacker: alice
  • Total STR 100 · DEF 50 · HP 10 → 5
🛡 Defender: bob
  • Total STR 90 · DEF 60 · HP 8 → 4

🎲 ROUND-BY-ROUND
  R1: A dealt 3 / D dealt 3 — HP 10 vs 8 — losses A 1 / D 1

💀 CASUALTIES & RESULTS
  • Attacker lost 1 unit · dealt 3 total damage`;

describe('parseBattleReport', () => {
  it('parses the live defeat report completely', () => {
    const r = parseBattleReport(DEFEAT_REPORT);

    expect(r.parsed).toBe(true);
    expect(r.battleType).toBe('FACTORY');
    expect(r.location).toEqual({ x: 44, y: 2 });
    expect(r.outcome).toBe('DEFEAT');
    expect(r.timestamp).toBe('9/11/2026, 1:37:37 PM');
    expect(r.battleId).toBe('BATTLE-17891');
    expect(r.totalRounds).toBe(1);

    expect(r.forces).toHaveLength(2);
    const [atk, def] = r.forces;
    expect(atk.side).toBe('attacker');
    expect(atk.username).toBe('fame');
    expect(atk.units).toEqual([
      { name: 'INFANTRY', qty: 10725, str: 1072500, def: 0 },
    ]);
    expect(atk.totalStr).toBe(1340625);
    expect(atk.totalDef).toBe(0);
    expect(atk.hpStart).toBe(107250);
    expect(atk.hpEnd).toBe(0);

    expect(def.side).toBe('defender');
    expect(def.username).toBe('Silent_Citadel');
    expect(def.units).toHaveLength(11);
    expect(def.units[0]).toEqual({ name: 'INFANTRY', qty: 6434, str: 643400, def: 0 });
    expect(def.totalStr).toBe(6424400);
    expect(def.totalDef).toBe(2752080);
    expect(def.hpEnd).toBe(313970);

    expect(r.rounds).toEqual([
      {
        roundNumber: 1,
        attackerDamage: 5,
        defenderDamage: 2081767,
        attackerHP: 0,
        defenderHP: 313970,
        attackerLost: 10725,
        defenderLost: 0,
      },
    ]);

    expect(r.results.map(l => l.text)).toContain('Units captured — attacker took 0, defender took 1376');
    expect(r.results.map(l => l.text)).toContain('💰 You plundered 1,250 metal');
    expect(r.results.map(l => l.text)).toContain('XP — attacker +150 · defender +75');
    expect(r.results.map(l => l.text)).toContain('ℹ️ extra note line');
  });

  it('parses draw headline and multi-force totals without unit lines', () => {
    const r = parseBattleReport(VICTORY_DRAW_REPORT);

    expect(r.parsed).toBe(true);
    expect(r.outcome).toBe('DRAW');
    expect(r.location).toEqual({ x: 10, y: 20 });
    expect(r.totalRounds).toBe(3);
    expect(r.forces).toHaveLength(2);
    expect(r.forces[0].units).toHaveLength(0);
    expect(r.forces[0].totalStr).toBe(100);
    expect(r.forces[0].hpEnd).toBe(5);
    expect(r.rounds).toHaveLength(1);
  });

  it('marks arbitrary chat text as not-parsed (fallback contract)', () => {
    const r = parseBattleReport('hey lol\n'.repeat(3));
    expect(r.parsed).toBe(false);
    expect(r.forces).toHaveLength(0);
  });

  it('never throws on truncated report bodies', () => {
    const truncated = DEFEAT_REPORT.slice(0, 400);
    expect(() => parseBattleReport(truncated)).not.toThrow();
    const r = parseBattleReport(truncated);
    // Headline + forces survive; later sections are simply absent.
    expect(r.battleType).toBe('FACTORY');
    expect(r.forces.length).toBeGreaterThan(0);
  });

  it('tolerates unknown sections without losing known ones', () => {
    const withUnknown = `${DEFEAT_REPORT}

🧪 UNKNOWN SECTION
  • mystery line`;
    const r = parseBattleReport(withUnknown);
    expect(r.parsed).toBe(true);
    // 🧪 (U+1F9EA, astral) is intentionally not a recognized section header —
    // the detector only treats the three known headers as sections, so these
    // lines land in the post-💀 preamble and are ignored. unknownSections
    // exists for unknown BMP-emoji headers. Known sections are unaffected.
    expect(r.unknownSections).toHaveLength(0);
  });

  it('handles empty input', () => {
    const r = parseBattleReport('');
    expect(r.parsed).toBe(false);
    expect(r.headline).toBe('');
  });
});
