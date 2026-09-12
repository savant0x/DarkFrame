/**
 * @file types/wmd/research.types.ts
 * @created 2025-10-22
 * @last-modified 2026-09-12 (FID-20260912-058 W1 — single WMD research track)
 *
 * OVERVIEW:
 * WMD research system type definitions. W1 replaced the three parallel
 * 10-tier tracks (2.7M RP total, 185-370 days per track at measured best-case
 * income, 0 players ever having started) with ONE 10-tier domain-mixed track:
 *
 *   - 600,000 RP total — ~44 best-case days for the COMPLETE arc
 *     (13.5k/day VIP flag-bearer); tier 1 lands in ~4 days, giving an
 *     immediate first unlock while the full arc stays a ~2-month goal.
 *   - Domains interleave per tier (offense/defense/intel) so the old tracks'
 *     unlock content survives: every warhead, battery, radar, mission type,
 *     and spy rank is reachable on the single path.
 *   - Every tier carries a hard level gate (L40 + 2 per tier — gates tighten
 *     with depth; the old catalog gated only tier 1).
 *   - Tier 10 keeps the clan requirement (Clan Level 5) for high-end content.
 *   - Ids are `wmd_tier_*` — previously the ONLY real consumer of completed
 *     WMD techs (spyService) checked `intel_tier_*` ids the catalog never
 *     sold; the single-track ids end that class of mismatch.
 */

import { WarheadType } from './missile.types';
import { BatteryType, RadarLevel } from './defense.types';
import { MissionType, SpyRank } from './intelligence.types';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Research domains (thematic grouping on the single track)
 */
export enum ResearchCategory {
  MISSILE = 'MISSILE',             // Offensive capabilities
  DEFENSE = 'DEFENSE',             // Defensive systems
  INTELLIGENCE = 'INTELLIGENCE',   // Spy operations
}

/**
 * Research status
 */
export enum ResearchStatus {
  LOCKED = 'LOCKED',               // Prerequisites not met
  AVAILABLE = 'AVAILABLE',         // Can be researched
  RESEARCHING = 'RESEARCHING',     // Currently being researched
  COMPLETED = 'COMPLETED',         // Unlocked
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Main research tech document
 */
export interface ResearchTech {
  techId: string;                  // Unique identifier (e.g., 'wmd_tier_1')
  name: string;
  description: string;
  category: ResearchCategory;
  tier: number;                    // 1-10

  // Prerequisites
  prerequisites: string[];         // Tech IDs that must be completed first
  requiredLevel?: number;          // Player level requirement
  requiredClanLevel?: number;      // Clan level requirement

  // Cost
  rpCost: number;                  // Research Points required

  // Unlocks
  unlocks: {
    warheadTypes?: WarheadType[];
    batteryTypes?: BatteryType[];
    radarLevels?: RadarLevel[];
    missionTypes?: MissionType[];
    spyRanks?: SpyRank[];
  };

  // Metadata
  estimatedTime: string;           // Human-readable (e.g., "2 days")
}

/**
 * Player research progress
 */
export interface PlayerResearch {
  _id?: string; // 24-char hex row id (pg); ObjectId is Mongo legacy
  playerId: string;
  playerUsername: string;
  clanId?: string;

  // Research tracking
  completedTechs: string[];        // Array of techId
  availableTechs: string[];        // Techs that can be researched now
  lockedTechs: string[];           // Techs with unmet prerequisites

  // Current research
  currentResearch?: {
    techId: string;
    startedAt: Date;
    rpSpent: number;
    rpRequired: number;
    progress: number;              // Percentage (0-100)
  };

  // Stats by category
  missileTier: number;             // Highest missile-domain tier unlocked (0-10)
  defenseTier: number;             // Highest defense-domain tier unlocked (0-10)
  intelligenceTier: number;        // Highest intel-domain tier unlocked (0-10)

  // Total investment
  totalRPSpent: number;
  totalTechsUnlocked: number;

  // Bonuses
  clanResearchBonus: number;       // Percentage bonus from clan

  updatedAt: Date;
}

/**
 * Research unlock request
 */
export interface ResearchUnlockRequest {
  playerId: string;
  techId: string;
}

/**
 * Research unlock result
 */
export interface ResearchUnlockResult {
  success: boolean;
  techId: string;
  techName: string;
  rpSpent: number;
  unlocked: {
    warheadTypes?: WarheadType[];
    batteryTypes?: BatteryType[];
    radarLevels?: RadarLevel[];
    missionTypes?: MissionType[];
    spyRanks?: SpyRank[];
  };
  newAvailableTechs: string[];
  message: string;
}

/**
 * Tech tree summary
 */
export interface TechTreeSummary {
  playerId: string;

  // Missile domain progress
  missileProgress: {
    tier: number;
    nextTier?: ResearchTech;
    unlocked: WarheadType[];
    locked: WarheadType[];
  };

  // Defense domain progress
  defenseProgress: {
    tier: number;
    nextTier?: ResearchTech;
    unlocked: BatteryType[];
    locked: BatteryType[];
  };

  // Intelligence domain progress
  intelligenceProgress: {
    tier: number;
    nextTier?: ResearchTech;
    unlocked: MissionType[];
    locked: MissionType[];
  };

  // Overall
  totalTechs: number;
  completedTechs: number;
  availableTechs: number;
  totalRPSpent: number;
  totalRPNeeded: number;           // To unlock everything
}

/**
 * Research validation result
 */
export interface ResearchValidation {
  canResearch: boolean;
  techId: string;
  techName: string;

  // Validation checks
  hasPrerequisites: boolean;
  meetsLevelRequirement: boolean;
  hasEnoughRP: boolean;

  // Details
  missingPrerequisites: string[];
  currentLevel: number;
  requiredLevel: number;
  currentRP: number;
  requiredRP: number;

  message: string;
}

// ============================================================================
// CONSTANTS - THE WMD RESEARCH TRACK (SINGLE, 10 TIERS — FID-20260912-058 W1)
// ============================================================================

/**
 * Cost ladder (FID-20260912-059 revision): 44k → 80k in flat +4k steps.
 * Total 600,000 RP exactly (~46 best-case days for the full arc; tier 1 =
 * ~3.4 days). Level gates: L40 + 2×tier (tier 1 = L42, tier 10 = L60).
 * Tier 10 additionally requires Clan Level 5 (high-end content stays
 * clan-gated).
 *
 * Domain rotation preserves every unlock from the three old tracks:
 * warheads t1/t4/t6/t8/t10, batteries+radar t2/t5/t7/t10, missions and
 * spy ranks t3/t5/t9/t10. (BASIC+ADVANCED batteries ride t2; the full
 * mission ladder folds into t3/t5/t9/t10.)
 */
export const WMD_RESEARCH_TRACK: ResearchTech[] = [
  {
    techId: 'wmd_tier_1',
    name: 'Tactical Missile Technology',
    description: 'Unlock Tactical Warheads (25% damage, single target)',
    category: ResearchCategory.MISSILE,
    tier: 1,
    prerequisites: [],
    requiredLevel: 42,
    rpCost: 42000,
    unlocks: {
      warheadTypes: [WarheadType.TACTICAL],
    },
    estimatedTime: '3 days',
  },
  {
    techId: 'wmd_tier_2',
    name: 'Basic Defense Systems',
    description: 'Unlock Basic Batteries (10% intercept chance) and Local Radar (30s warning, 50 tile range)',
    category: ResearchCategory.DEFENSE,
    tier: 2,
    prerequisites: ['wmd_tier_1'],
    requiredLevel: 44,
    rpCost: 46000,
    unlocks: {
      batteryTypes: [BatteryType.BASIC, BatteryType.ADVANCED],
      radarLevels: [RadarLevel.LOCAL],
    },
    estimatedTime: '4 days',
  },
  {
    techId: 'wmd_tier_3',
    name: 'Basic Espionage',
    description: 'Unlock Reconnaissance, Surveillance, and Infiltration missions; deploy your first spy (Operative rank)',
    category: ResearchCategory.INTELLIGENCE,
    tier: 3,
    prerequisites: ['wmd_tier_2'],
    requiredLevel: 46,
    rpCost: 50000,
    unlocks: {
      missionTypes: [
        MissionType.RECONNAISSANCE,
        MissionType.SURVEILLANCE,
        MissionType.INFILTRATION,
      ],
      spyRanks: [SpyRank.OPERATIVE],
    },
    estimatedTime: '4 days',
  },
  {
    techId: 'wmd_tier_4',
    name: 'Strategic Missile Technology',
    description: 'Unlock Strategic Warheads (50% damage, single target)',
    category: ResearchCategory.MISSILE,
    tier: 4,
    prerequisites: ['wmd_tier_3'],
    requiredLevel: 48,
    rpCost: 54000,
    unlocks: {
      warheadTypes: [WarheadType.STRATEGIC],
    },
    estimatedTime: '4 days',
  },
  {
    techId: 'wmd_tier_5',
    name: 'Elite Defense & Counter-Intelligence',
    description: 'Unlock Elite Batteries (40% intercept), Regional Radar, Counter-Intelligence, Light Sabotage, and Intelligence Leak missions (Agent rank)',
    category: ResearchCategory.DEFENSE,
    tier: 5,
    prerequisites: ['wmd_tier_4'],
    requiredLevel: 50,
    rpCost: 58000,
    unlocks: {
      batteryTypes: [BatteryType.ELITE],
      radarLevels: [RadarLevel.REGIONAL],
      missionTypes: [
        MissionType.COUNTER_INTELLIGENCE,
        MissionType.SABOTAGE_LIGHT,
        MissionType.INTELLIGENCE_LEAK,
      ],
      spyRanks: [SpyRank.AGENT],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'wmd_tier_6',
    name: 'Neutron Bomb Technology',
    description: 'Unlock Neutron Warheads (60% damage, preserves resources)',
    category: ResearchCategory.MISSILE,
    tier: 6,
    prerequisites: ['wmd_tier_5'],
    requiredLevel: 52,
    rpCost: 62000,
    unlocks: {
      warheadTypes: [WarheadType.NEUTRON],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'wmd_tier_7',
    name: 'Fortress Defense Systems',
    description: 'Unlock Fortress Batteries (60% intercept chance)',
    category: ResearchCategory.DEFENSE,
    tier: 7,
    prerequisites: ['wmd_tier_6'],
    requiredLevel: 54,
    rpCost: 66000,
    unlocks: {
      batteryTypes: [BatteryType.FORTRESS],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'wmd_tier_8',
    name: 'MIRV Technology',
    description: 'Unlock Cluster Warheads (40%+20% damage, 5 targets)',
    category: ResearchCategory.MISSILE,
    tier: 8,
    prerequisites: ['wmd_tier_7'],
    requiredLevel: 56,
    rpCost: 70000,
    unlocks: {
      warheadTypes: [WarheadType.CLUSTER],
    },
    estimatedTime: '5 days',
  },
  {
    techId: 'wmd_tier_9',
    name: 'Wetwork Operations',
    description: 'Unlock Heavy Sabotage, Research Theft, and Assassination missions (Veteran rank)',
    category: ResearchCategory.INTELLIGENCE,
    tier: 9,
    prerequisites: ['wmd_tier_8'],
    requiredLevel: 58,
    rpCost: 74000,
    unlocks: {
      missionTypes: [
        MissionType.SABOTAGE_HEAVY,
        MissionType.THEFT,
        MissionType.ASSASSINATION,
      ],
      spyRanks: [SpyRank.VETERAN],
    },
    estimatedTime: '6 days',
  },
  {
    techId: 'wmd_tier_10',
    name: 'Total Warfare',
    description: 'Unlock Clan Buster Warheads (entire-clan damage), AEGIS Defense (80% intercept), Nuclear Sabotage, and the Elite spy rank',
    category: ResearchCategory.MISSILE,
    tier: 10,
    prerequisites: ['wmd_tier_9'],
    requiredLevel: 60,
    requiredClanLevel: 5,
    rpCost: 78000,
    unlocks: {
      warheadTypes: [WarheadType.CLAN_BUSTER],
      batteryTypes: [BatteryType.AEGIS],
      radarLevels: [RadarLevel.GLOBAL],
      missionTypes: [MissionType.SABOTAGE_NUCLEAR],
      spyRanks: [SpyRank.ELITE],
    },
    estimatedTime: '6 days',
  },
];

// ============================================================================
// BACK-COMPAT ALIASES (the old three-track exports; W1 folds them into one)
// ============================================================================

/** W1: the missile/defense/intelligence "tracks" are views of the single track. */
export const MISSILE_RESEARCH_TRACK: ResearchTech[] = WMD_RESEARCH_TRACK.filter(
  (t) => t.category === ResearchCategory.MISSILE
);
export const DEFENSE_RESEARCH_TRACK: ResearchTech[] = WMD_RESEARCH_TRACK.filter(
  (t) => t.category === ResearchCategory.DEFENSE
);
export const INTELLIGENCE_RESEARCH_TRACK: ResearchTech[] = WMD_RESEARCH_TRACK.filter(
  (t) => t.category === ResearchCategory.INTELLIGENCE
);

// ============================================================================
// AGGREGATED CONSTANTS
// ============================================================================

/**
 * All research techs (the single track)
 */
export const ALL_RESEARCH_TECHS: ResearchTech[] = [...WMD_RESEARCH_TRACK];

/**
 * Research techs by domain
 */
export const RESEARCH_BY_CATEGORY: Record<ResearchCategory, ResearchTech[]> = {
  [ResearchCategory.MISSILE]: MISSILE_RESEARCH_TRACK,
  [ResearchCategory.DEFENSE]: DEFENSE_RESEARCH_TRACK,
  [ResearchCategory.INTELLIGENCE]: INTELLIGENCE_RESEARCH_TRACK,
};

/**
 * Total RP required to unlock everything
 * (W1: 600,000 RP across 10 tiers — the full endgame arc, ~44 best-case
 * days at ~13.5k/day. The old three-track tree was 2.7M demanding the
 * same 900k grind three times over for parallel content.)
 */
export const TOTAL_RP_REQUIRED = ALL_RESEARCH_TECHS.reduce(
  (sum, tech) => sum + tech.rpCost,
  0
);

/**
 * RP required per domain (sums exceed TOTAL_RP_REQUIRED — W1 tiers can
 * unlock multiple domains at once and are counted once in the total)
 */
export const RP_BY_CATEGORY = {
  [ResearchCategory.MISSILE]: MISSILE_RESEARCH_TRACK.reduce((s, t) => s + t.rpCost, 0),
  [ResearchCategory.DEFENSE]: DEFENSE_RESEARCH_TRACK.reduce((s, t) => s + t.rpCost, 0),
  [ResearchCategory.INTELLIGENCE]: INTELLIGENCE_RESEARCH_TRACK.reduce((s, t) => s + t.rpCost, 0),
} as const;

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Check if tech ID is valid
 */
export function isValidTechId(techId: string): boolean {
  return ALL_RESEARCH_TECHS.some(tech => tech.techId === techId);
}

/**
 * Get tech by ID
 */
export function getTechById(techId: string): ResearchTech | undefined {
  return ALL_RESEARCH_TECHS.find(tech => tech.techId === techId);
}

/**
 * Get techs by domain
 */
export function getTechsByCategory(category: ResearchCategory): ResearchTech[] {
  return RESEARCH_BY_CATEGORY[category];
}

/**
 * Get prerequisite chain for a tech
 */
export function getPrerequisiteChain(techId: string): string[] {
  const tech = getTechById(techId);
  if (!tech || tech.prerequisites.length === 0) return [];

  const chain: string[] = [];
  for (const prereq of tech.prerequisites) {
    chain.push(prereq);
    chain.push(...getPrerequisiteChain(prereq));
  }

  return Array.from(new Set(chain)); // Remove duplicates
}

/**
 * Check if player has prerequisites for a tech
 */
export function hasPrerequisites(
  techId: string,
  completedTechs: string[]
): boolean {
  const tech = getTechById(techId);
  if (!tech) return false;

  return tech.prerequisites.every(prereq => completedTechs.includes(prereq));
}

/**
 * Get next available techs for a player
 */
export function getAvailableTechs(completedTechs: string[]): ResearchTech[] {
  return ALL_RESEARCH_TECHS.filter(tech => {
    // Skip already completed
    if (completedTechs.includes(tech.techId)) return false;

    // Check prerequisites
    return hasPrerequisites(tech.techId, completedTechs);
  });
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Research Track (W1):
 *    - ONE 10-tier track, 600k RP total — the full WMD endgame arc
 *    - Domains interleave: offense/defense/intel content is spread across
 *      the path instead of demanding three parallel 900k grinds
 *
 * 2. Tier Gates:
 *    - Level gate on EVERY tier: L40 + 2(tier-1) — depth is earned
 *    - Tier 10 requires Clan Level 5 (high-end content is clan-gated)
 *
 * 3. RP Cost Progression (at measured best-case ~13.5k RP/day):
 *    - Tier 1: 52k RP (~4 days)
 *    - Tier 5: 70k RP (cumulative 303k, ~3 weeks)
 *    - Tier 10: 78k RP (cumulative 600k, ~6 weeks of top play)
 *
 * 4. Integration with Existing System:
 *    - Reuses /lib/xpService.ts spendResearchPoints()
 *    - Pattern: await spendResearchPoints(userId, tech.rpCost, 'WMD Research: ${tech.name}')
 *
 * 5. Consumer Compatibility:
 *    - spyService gates on wmd_tier_* ids (the old intel_tier_* ids were
 *      unsellable — FID-20260912-058)
 *    - applyTechEffects (researchService) increments the per-domain tier
 *      columns on completion and persists unlock effects
 */
