/**
 * FID-20260916-011: sabotage success/detection math — single source of truth.
 *
 * Extracted verbatim from lib/wmd/spyService.ts (getSabotageTargetDifficulty /
 * getSabotageDetectionRisk) into a DB-free module so the enumeration route and
 * the client preview can import the SAME tables the fire path uses. The service
 * now delegates to these functions; the FID-009 D1 rule: imports, never copies.
 *
 * PURE module — no server imports, no node APIs: safe for the browser bundle.
 */

export const SABOTAGE_TARGET_TYPES = ['MISSILE', 'DEFENSE_BATTERY', 'RESEARCH'] as const;

export type SabotageTargetType = (typeof SABOTAGE_TARGET_TYPES)[number];

/** How much the attacker's sabotage skill is discounted by per target. */
export const SABOTAGE_DIFFICULTY: Record<SabotageTargetType, number> = {
  MISSILE: 0.2,
  DEFENSE_BATTERY: 0.3,
  RESEARCH: 0.4,
};

/** Base detection probability before the spy's stealth discount. */
export const SABOTAGE_BASE_DETECTION_RISK: Record<SabotageTargetType, number> = {
  MISSILE: 0.4,
  DEFENSE_BATTERY: 0.5,
  RESEARCH: 0.6,
};

/** Minimum service skill floor for executeSabotage (presentational gate only). */
export const SABOTAGE_SKILL_FLOOR = 30;

export function isSabotageTargetType(value: unknown): value is SabotageTargetType {
  return typeof value === 'string' && (SABOTAGE_TARGET_TYPES as readonly string[]).includes(value);
}

export function getSabotageDifficulty(targetType: SabotageTargetType): number {
  return SABOTAGE_DIFFICULTY[targetType];
}

export function getBaseDetectionRisk(targetType: SabotageTargetType): number {
  return SABOTAGE_BASE_DETECTION_RISK[targetType];
}

/** Clamp window shared with the service's fire path. */
export function clampDetectionRisk(risk: number): number {
  return Math.max(0.1, Math.min(0.9, risk));
}

/**
 * Success chance exactly as executeSabotage rolls it:
 * `Math.max(0.05, skills.sabotage / 100 - difficulty)`.
 */
export function sabotageSuccessChance(sabotageSkill: number, targetType: SabotageTargetType): number {
  return Math.max(0.05, sabotageSkill / 100 - getSabotageDifficulty(targetType));
}

/**
 * Detection risk exactly as executeSabotage rolls it:
 * `clamp(base - stealth / 200)`.
 */
export function sabotageDetectionRisk(stealthSkill: number, targetType: SabotageTargetType): number {
  return clampDetectionRisk(getBaseDetectionRisk(targetType) - stealthSkill / 200);
}
