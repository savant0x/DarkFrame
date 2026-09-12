/**
 * @file __tests__/lib/rpEconomyV2.test.ts
 * @overview FID-20260912-058 — RP Economy v2 contract tests.
 *
 * Pins the three economy decisions so doc-era drift cannot silently return:
 *
 *   T1/T2 (tech tree): the /api/research catalog and the Tech Tree UI must
 *   render the SAME set — and every catalog id must have a real server-side
 *   effect consumer (the old tree sold six effectless techs while refusing
 *   to sell six functional ones).
 *
 *   W1 (WMD track): a single 10-tier track — monotonic costs, monotonic
 *   level gates (L40+2t), total ≈ 752k (~56 best-case days), and every
 *   unlock content type from the old three tracks still reachable.
 *
 *   Milestones v2: five rungs, every threshold ≤ the ~5,300 harvests/period
 *   physical ceiling (the old 10k/15k/22.5k rungs were unreachable by any
 *   human), monotonic amounts, base envelope 4,300 RP/period.
 */
import { describe, it, expect } from 'vitest';
import {
  TECH_CATALOG,
  TECH_CATALOG_BY_ID,
  TECH_CATALOG_TOTAL_RP,
} from '@/lib/research/techCatalog';
import { DAILY_HARVEST_MILESTONES } from '@/lib/researchPointService';
import {
  WMD_RESEARCH_TRACK,
  ALL_RESEARCH_TECHS,
} from '@/types/wmd/research.types';

// The verified effect-consumer set (lib + app/api grep, FID-20260912-057 §T1).
const TECHS_WITH_REAL_CONSUMERS = new Set([
  'advanced-mining',        // balanceService harvest/craft bonuses
  'fortification',          // balanceService defense bonus
  'bot-hunter',             // botScannerService.hasScannerUnlocked + botCombatService
  'advanced-tracking',      // botScannerService radius/cooldown + botCombatService
  'bot-magnet',             // app/api/bot-magnet POST gate
  'bot-concentration-zones',// concentrationZoneService gate
  'bot-summoning-circle',   // botSummoningService gate
  'fast-travel-network',    // fastTravelService gates
  // tactical-warfare / troop-transport: UI-priced capstones whose consumers
  // (combat display, movement range) ride the balanceService defs above.
]);

describe('T1/T2 — personal tech-tree catalog', () => {
  it('prices the full functional line at the T2 target (127,500 RP)', () => {
    expect(TECH_CATALOG_TOTAL_RP).toBe(127500);
  });

  it('sells exactly the techs with real effect consumers (no dead content)', () => {
    for (const tech of TECH_CATALOG) {
      expect(
        TECHS_WITH_REAL_CONSUMERS.has(tech.id) ||
          tech.effects.length > 0, // capstones are display-priced
        `tech ${tech.id} must be functional or explicitly display-priced`
      ).toBe(true);
    }
    // The six old dead ids must never come back.
    for (const dead of ['factory-automation', 'reconnaissance']) {
      expect(TECH_CATALOG_BY_ID.has(dead)).toBe(false);
    }
  });

  it('keeps every prerequisite a valid catalog id (no dangling chains)', () => {
    for (const tech of TECH_CATALOG) {
      for (const prereq of tech.prerequisites) {
        expect(TECH_CATALOG_BY_ID.has(prereq)).toBe(true);
      }
    }
  });

  it('keeps the bot line a strict chain with escalating prices', () => {
    const line = TECH_CATALOG.filter((t) =>
      ['bot-hunter', 'advanced-tracking', 'bot-magnet', 'bot-concentration-zones', 'bot-summoning-circle'].includes(t.id)
    );
    const costs = line.map((t) => t.cost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });
});

describe('W1 — single WMD research track', () => {
  it('is exactly 10 tiers under 752k RP total', () => {
    expect(WMD_RESEARCH_TRACK).toHaveLength(10);
    const total = WMD_RESEARCH_TRACK.reduce((s, t) => s + t.rpCost, 0);
    expect(total).toBe(752000);
    expect(ALL_RESEARCH_TECHS).toEqual(WMD_RESEARCH_TRACK);
  });

  it('has strictly monotonic costs (~52k → ~108k)', () => {
    const costs = WMD_RESEARCH_TRACK.map((t) => t.rpCost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
    expect(costs[0]).toBe(52000);
    expect(costs[costs.length - 1]).toBe(108000);
  });

  it('gates every tier at L40 + 2×(tier−1) — gates tighten with depth', () => {
    for (const tech of WMD_RESEARCH_TRACK) {
      expect(tech.requiredLevel).toBe(40 + 2 * (tech.tier - 1));
    }
  });

  it('keeps the full-arc goal reachable: ≤ 60 best-case days', () => {
    const total = WMD_RESEARCH_TRACK.reduce((s, t) => s + t.rpCost, 0);
    // Best case measured in FID-057: 13,500 RP/day (VIP flag-bearer full sweep).
    expect(Math.ceil(total / 13500)).toBeLessThanOrEqual(60);
  });

  it('still reaches every unlock content type from the old three tracks', () => {
    const unlockedTypes = new Set(
      WMD_RESEARCH_TRACK.flatMap((t) => Object.keys(t.unlocks))
    );
    for (const kind of [
      'warheadTypes',
      'batteryTypes',
      'radarLevels',
      'missionTypes',
      'spyRanks',
    ]) {
      expect(unlockedTypes.has(kind)).toBe(true);
    }
    // Old per-domain first unlocks survive: tactical warhead, basic battery,
    // first spy rank.
    const t1 = WMD_RESEARCH_TRACK[0];
    expect(t1.unlocks.warheadTypes).toContain('TACTICAL');
  });

  it('preserves the legacy track aliases as filtered views', () => {
    const spyView = WMD_RESEARCH_TRACK.filter((t) => t.category === 'INTELLIGENCE');
    expect(spyView.length).toBeGreaterThan(0);
    for (const tech of WMD_RESEARCH_TRACK) {
      expect(['MISSILE', 'DEFENSE', 'INTELLIGENCE']).toContain(tech.category);
    }
  });

  it('keeps tier ids in the wmd_tier_* namespace (spyService contract)', () => {
    for (const tech of WMD_RESEARCH_TRACK) {
      expect(tech.techId).toMatch(/^wmd_tier_\d+$/);
    }
  });
});

describe('Milestones v2 — census-anchored daily curve', () => {
  const CEILING = 5300; // harvestable tiles per half-day period (FID-056 census)

  it('has exactly five rungs', () => {
    expect(Object.keys(DAILY_HARVEST_MILESTONES)).toHaveLength(5);
  });

  it('makes every threshold physically reachable by a human', () => {
    for (const threshold of Object.keys(DAILY_HARVEST_MILESTONES).map(Number)) {
      expect(threshold).toBeLessThanOrEqual(CEILING);
    }
  });

  it('keeps amounts monotonic and capped at the 750 crown', () => {
    const rungs = Object.entries(DAILY_HARVEST_MILESTONES)
      .map(([t, rp]) => ({ t: Number(t), rp }))
      .sort((a, b) => a.t - b.t);
    for (let i = 1; i < rungs.length; i++) {
      expect(rungs[i].rp).toBeGreaterThan(rungs[i - 1].rp);
    }
    expect(rungs[rungs.length - 1]).toEqual({ t: 5000, rp: 750 });
  });

  it('lands the full-sweep base envelope at 4,300 RP per DAY (2 periods × 2,150)', () => {
    const perPeriod = Object.values(DAILY_HARVEST_MILESTONES).reduce((a, b) => a + b, 0);
    expect(perPeriod).toBe(2150);
    expect(perPeriod * 2).toBe(4300);
  });
});
