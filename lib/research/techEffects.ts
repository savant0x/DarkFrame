/**
 * @file lib/research/techEffects.ts
 * @created 2026-10-02
 * @overview FID-20261002-012 §5.1/§5.2 — the personal-technology effect
 *           coefficients and the ONE combat effect composition seam.
 *
 * WHY THIS EXISTS (R9/R14): three sold core technologies (advanced-mining,
 * fortification, tactical-warfare — 22,500 RP combined) had zero gameplay
 * consumers, and the combat-power display invented a fixed 7.5% doctrine
 * average while the resolver read flag/doctrine only — display and combat
 * disagreed by construction. This module is the single typed source for:
 *   - the three techs' numeric effects (harvest yield/speed, base defense,
 *     attacking STR, critical chance/damage),
 *   - the authoritative resource-harvest action deadline (base 3000ms;
 *     advanced-mining ÷1.25 → 2400ms) shared by the harvest service, the
 *     anti-cheat detector and the auto-farm client,
 *   - the combat effect composition consumed by BOTH calculateCombatPower
 *     (display) and resolveBattle (resolution), so an effect can apply
 *     exactly once and never diverge between the two.
 *
 * COMPOSITION CONTRACT (§5.2): independent multipliers compose MULTIPLICATIVE
 * across source categories (doctrine/mastery, flag, clan research, combat
 * discoveries, personal technologies) and ADDITIVE within one category.
 * Damage-taken reductions are clamped (≤ 80%) so a stacked defense can never
 * zero incoming damage; every multiplier is validated finite ≥ 0. Raw owned
 * aggregates (players.totalStrength/totalDefense) are never modified — the
 * composition returns multipliers, callers floor their own products.
 *
 * The combat categories' inputs come from the EXISTING producers (no parallel
 * formula): clan research getClanBonuses (attack/defense %), combat
 * discoveries getDiscoveryBonuses (unitStrength/unitDefense/damageDealt/
 * damageTakenReduction %), doctrine getDoctrineBonuses (mastery-weighted
 * str/def multipliers), flag getBonusStack (bearer str/def multipliers).
 */

/** The three formerly-effectless core techs, with their numeric effects. */
export const TECH_EFFECTS = {
  'advanced-mining': {
    /** +10% resource yield on Metal/Energy harvests (estimateHarvest + payout). */
    harvestYieldPct: 10,
    /** Harvest action cadence: base 3000ms ÷ 1.25 = 2400ms. */
    harvestActionDelayMs: 2400,
  },
  fortification: {
    /** +15% effective DEF while DEFENDING in a base raid (BattleType.BaseRaid). */
    defensePct: 15,
    /** −15% incoming damage while DEFENDING in a base raid. */
    baseRaidDamageReductionPct: 15,
  },
  'tactical-warfare': {
    /** +20% effective attacking STR (the attacker side of any battle). */
    attackStrPct: 20,
    /** +5 percentage points critical chance, drawn once per actual strike. */
    critChanceBonus: 0.05,
    /** Critical strikes deal 1.5× damage. */
    critDamageMultiplier: 1.5,
  },
} as const;

/** Authoritative resource-harvest action cadence without the tech (3000ms). */
export const BASE_RESOURCE_HARVEST_DELAY_MS = 3000;

/** Hard ceiling on stacked damage-taken reductions (defense can never zero). */
export const MAX_DAMAGE_TAKEN_REDUCTION_PCT = 80;

/**
 * The authoritative per-player resource-harvest action delay.
 * 3000ms base; advanced-mining owners act at 2400ms (÷1.25). Consumed by:
 *   - lib/harvestService.ts (deadline written on successful resource payout),
 *   - lib/antiCheatDetector.ts (the SAME threshold for cooldown detection),
 *   - utils/autoFarmEngine.ts (client cadence without client authority).
 */
export function getResourceHarvestDelayMs(hasAdvancedMining: boolean): number {
  return hasAdvancedMining
    ? TECH_EFFECTS['advanced-mining'].harvestActionDelayMs
    : BASE_RESOURCE_HARVEST_DELAY_MS;
}

/** Raw per-tech combat coefficients for one player's unlocked set. */
export interface PersonalTechCombatEffects {
  /** +20% attacking STR while this player ATTACKS (tactical-warfare). */
  attackStrPct: number;
  /** +15% DEF while this player DEFENDS a base raid (fortification). */
  baseDefensePct: number;
  /** −15% incoming damage while this player DEFENDS a base raid. */
  baseRaidDamageReductionPct: number;
  /** +0.05 critical chance while ATTACKING (tactical-warfare). */
  critChanceBonus: number;
  /** 1.5× strike damage on a critical. */
  critDamageMultiplier: number;
}

const NEUTRAL_TECH_EFFECTS: PersonalTechCombatEffects = {
  attackStrPct: 0,
  baseDefensePct: 0,
  baseRaidDamageReductionPct: 0,
  critChanceBonus: 0,
  critDamageMultiplier: 1,
};

/**
 * Resolve one player's owned personal-tech combat coefficients. The caller
 * applies the ROLE (attackStr while attacking; base defense/reduction only
 * while defending a base raid) — this function is roleless and pure.
 */
export function getPersonalTechCombatEffects(unlockedTechs: string[] | null | undefined): PersonalTechCombatEffects {
  const owned = unlockedTechs ?? [];
  const effects: PersonalTechCombatEffects = { ...NEUTRAL_TECH_EFFECTS };

  if (owned.includes('tactical-warfare')) {
    effects.attackStrPct += TECH_EFFECTS['tactical-warfare'].attackStrPct;
    effects.critChanceBonus += TECH_EFFECTS['tactical-warfare'].critChanceBonus;
    effects.critDamageMultiplier = TECH_EFFECTS['tactical-warfare'].critDamageMultiplier;
  }
  if (owned.includes('fortification')) {
    effects.baseDefensePct += TECH_EFFECTS.fortification.defensePct;
    effects.baseRaidDamageReductionPct += TECH_EFFECTS.fortification.baseRaidDamageReductionPct;
  }

  return effects;
}

/** One combat-effect source category (all percentages; multipliers ≥ 0). */
export interface CombatEffectSource {
  /** Doctrine/mastery multipliers (e.g. offensive 1.15 STR). Default 1/1. */
  doctrine?: { strMul: number; defMul: number };
  /** Flag-bearer multipliers (bearer 1.25/1.25). Default 1/1. */
  flag?: { strMul: number; defMul: number };
  /** Clan military research percentages (attack boosts the STR axis,
   *  defense the DEF axis — never averaged). Default 0/0. */
  clan?: { attackPct: number; defensePct: number };
  /** Combat discovery percentages. Default all 0. */
  discovery?: {
    unitStrengthPct: number;
    unitDefensePct: number;
    damageDealtPct: number;
    damageTakenReductionPct: number;
  };
  /** Role-filtered personal-tech percentages (see
   *  getPersonalTechCombatEffects — the caller picks the attacking or
   *  defending coefficients). Default all 0 / multiplier 1. */
  tech?: {
    attackStrPct: number;
    defensePct: number;
    damageTakenReductionPct: number;
    critChanceBonus: number;
    critDamageMultiplier: number;
  };
}

/** The composed, ready-to-apply effect snapshot for one battle side. */
export interface CombatEffectSnapshot {
  /** Multiply the side's raw STR by this (floors are the caller's job). */
  strMul: number;
  /** Multiply the side's raw DEF by this. */
  defMul: number;
  /** Multiply the side's dealt damage by this (balance dealt applies
   *  separately in the resolver — never folded in here). */
  damageDealtMul: number;
  /** Multiply damage this side TAKES by this (≤ 1; clamped ≥ 0.2). */
  damageTakenMul: number;
  /** Critical chance for this side's strikes [0..0.5]. */
  critChance: number;
  /** Damage multiplier on a critical strike (1 = none). */
  critDamageMultiplier: number;
}

function finiteNonNegative(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function finitePositive(value: number | undefined, fallback = 1): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Compose one battle side's effect snapshot. MULTIPLICATIVE across categories
 * (doctrine × flag × clan × discovery × tech per axis), ADDITIVE within a
 * category. Damage-taken reductions clamp at MAX_DAMAGE_TAKEN_REDUCTION_PCT;
 * crit chance clamps at 0.5. Neutral inputs (all absent) return the identity
 * snapshot — unresearched/unclanned/unflagged players keep the baseline.
 */
export function composeCombatEffects(sources: CombatEffectSource): CombatEffectSnapshot {
  const doctrine = sources.doctrine;
  const flag = sources.flag;
  const clan = sources.clan;
  const discovery = sources.discovery;
  const tech = sources.tech;

  // STR axis: doctrine × flag × (1 + clan.attack) × (1 + discovery.unitStrength)
  //           × (1 + tech.attackStr) — additive WITHIN no category here (each
  //           category contributes one STR term), multiplicative ACROSS.
  const strMul =
    finitePositive(doctrine?.strMul) *
    finitePositive(flag?.strMul) *
    (1 + finiteNonNegative(clan?.attackPct) / 100) *
    (1 + finiteNonNegative(discovery?.unitStrengthPct) / 100) *
    (1 + finiteNonNegative(tech?.attackStrPct) / 100);

  // DEF axis: same shape with the defensive coefficients.
  const defMul =
    finitePositive(doctrine?.defMul) *
    finitePositive(flag?.defMul) *
    (1 + finiteNonNegative(clan?.defensePct) / 100) *
    (1 + finiteNonNegative(discovery?.unitDefensePct) / 100) *
    (1 + finiteNonNegative(tech?.defensePct) / 100);

  // Damage dealt: discovery's damageDealt only (balance dealt is the
  // resolver's separate stage — §5.6 one defined place per modifier).
  const damageDealtMul = 1 + finiteNonNegative(discovery?.damageDealtPct) / 100;

  // Damage taken: additive reductions WITHIN the reduction bucket (discovery +
  // tech), then one multiplicative clamp — stacked defense can never zero
  // incoming damage.
  const totalReductionPct = Math.min(
    MAX_DAMAGE_TAKEN_REDUCTION_PCT,
    finiteNonNegative(discovery?.damageTakenReductionPct) + finiteNonNegative(tech?.damageTakenReductionPct),
  );
  const damageTakenMul = Math.max(0.2, 1 - totalReductionPct / 100);

  const critChance = Math.min(
    0.5,
    Math.max(0, finiteNonNegative(tech?.critChanceBonus)),
  );
  const critDamageMultiplier = Math.max(1, finitePositive(tech?.critDamageMultiplier));

  return {
    strMul,
    defMul,
    damageDealtMul,
    damageTakenMul,
    critChance,
    critDamageMultiplier,
  };
}
