/**
 * @file lib/research/techCatalog.ts
 * @created 2026-09-12
 * @overview FID-20260912-058 T1/T2 — the personal tech tree's single source
 * of truth. Replaces the two divergent copies (the server route's 6-entry
 * `TECHNOLOGIES` map of effectless techs, and the TechTree UI's 12-entry mock
 * that advertised six functional bot techs the route refused to sell).
 *
 * Every entry here has a real server-side effect consumer (verified by grep):
 *   - advanced-mining, fortification → balanceService combat/economy bonuses
 *   - bot-hunter / advanced-tracking → botScannerService + botCombatService
 *   - bot-magnet                     → /api/bot-magnet gating
 *   - bot-concentration-zones        → concentrationZoneService gating
 *   - bot-summoning-circle           → botSummoningService gating
 *   - fast-travel-network            → fastTravelService gating
 *
 * Pricing (T2) targets the measured economy from FID-20260912-057: the full
 * functional line costs 127,500 RP — ~9-10 best-case days for a dedicated
 * player, reachable-not-trivial, with each bot tier gating a real feature.
 */

export interface TechCatalogEntry {
  id: string;
  name: string;
  /** RP cost (the single research currency per CHANGELOG_RP_OVERHAUL). */
  cost: number;
  prerequisites: string[];
  category: 'movement' | 'economy' | 'combat' | 'special';
  description: string;
  /** Player-facing effect summary rendered on the tech tree cards. */
  effects: string[];
  /** Research time in seconds (display only — unlocks are instant RP spends). */
  researchTime: number;
}

export const TECH_CATALOG: TechCatalogEntry[] = [
  // ── Core line (repriced down from the doc-era 5k-15k flats) ──────────────
  {
    id: 'advanced-mining',
    name: 'Advanced Mining',
    cost: 3000,
    prerequisites: [],
    category: 'economy',
    description: 'Improved resource extraction techniques',
    effects: ['+25% resource harvesting speed', '+10% resource yield'],
    researchTime: 180,
  },
  {
    id: 'fortification',
    name: 'Fortification',
    cost: 4500,
    prerequisites: [],
    category: 'combat',
    description: 'Hardened base defenses against raids',
    effects: ['+15% defensive power', 'Reduced damage from raids'],
    researchTime: 240,
  },
  {
    id: 'bot-hunter',
    name: 'Bot Hunter',
    cost: 5000,
    prerequisites: [],
    category: 'special',
    description: 'Unlocks the bot scanner — locate bot bases across the map',
    effects: [
      'Unlocks Bot Scanner (basic radius)',
      'Combat bonus vs bot bases',
    ],
    researchTime: 300,
  },
  {
    id: 'advanced-tracking',
    name: 'Advanced Tracking',
    cost: 8000,
    prerequisites: ['bot-hunter'],
    category: 'special',
    description: 'Doubles scanner range and halves its cooldown',
    effects: ['Extended scanner radius (advanced)', 'Reduced scanner cooldown'],
    researchTime: 300,
  },
  // ── Bot line (the six functional techs the UI advertised but the route
  //    never sold — now real purchases) ─────────────────────────────────────
  {
    id: 'bot-magnet',
    name: 'Bot Magnet',
    cost: 12000,
    prerequisites: ['advanced-tracking'],
    category: 'special',
    description: 'Attracts bot patrols toward your position for interception',
    effects: ['Unlocks Bot Magnet deployment', 'Bot encounters trend toward you'],
    researchTime: 420,
  },
  {
    id: 'bot-concentration-zones',
    name: 'Concentration Zones',
    cost: 18000,
    prerequisites: ['bot-magnet'],
    category: 'special',
    description: 'Designate zones where bots concentrate for farming',
    effects: ['Unlocks Concentration Zone designation', 'Zone-bound bot farming'],
    researchTime: 480,
  },
  {
    id: 'bot-summoning-circle',
    name: 'Bot Summoning Circle',
    cost: 25000,
    prerequisites: ['bot-concentration-zones'],
    category: 'special',
    description: 'Summons bot encounters on demand for targeted combat',
    effects: ['Unlocks bot summoning rituals', 'On-demand bot engagements'],
    researchTime: 600,
  },
  {
    id: 'fast-travel-network',
    name: 'Fast Travel Network',
    cost: 30000,
    prerequisites: ['bot-summoning-circle'],
    category: 'movement',
    description: 'Waypoint network for instant travel across discovered ground',
    effects: [
      '5 waypoint slots',
      'Set waypoint at any discovered location',
      'Instant travel to waypoints',
      'Cooldown: 12 hours per use',
    ],
    researchTime: 600,
  },
  // ── Capstone ─────────────────────────────────────────────────────────────
  {
    id: 'tactical-warfare',
    name: 'Tactical Warfare',
    cost: 15000,
    prerequisites: ['fortification'],
    category: 'combat',
    description: 'Advanced combat doctrine for offensive operations',
    effects: ['+20% attack power', 'Critical hit chance increased'],
    researchTime: 420,
  },
  {
    id: 'troop-transport',
    name: 'Troop Transport',
    cost: 7000,
    prerequisites: [],
    category: 'movement',
    description: 'Logistics corps extending army movement range',
    effects: ['Movement range increased to 5 spaces'],
    researchTime: 300,
  },
];

export const TECH_CATALOG_BY_ID: ReadonlyMap<string, TechCatalogEntry> = new Map(
  TECH_CATALOG.map((tech) => [tech.id, tech])
);

/** Total RP for the entire functional tree (127,500 — FID-20260912-058 T2). */
export const TECH_CATALOG_TOTAL_RP = TECH_CATALOG.reduce(
  (sum, tech) => sum + tech.cost,
  0
);

export function getTechById(id: string): TechCatalogEntry | undefined {
  return TECH_CATALOG_BY_ID.get(id);
}
