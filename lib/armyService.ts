/**
 * @file lib/armyService.ts
 * @created 2026-10-02
 * @overview FID-20261002-004 §5.5 — the shared canonical army contract.
 *
 * OVERVIEW:
 * ONE server-side module owning the canonical army identities and weighted
 * totals, consumed by procurement (both build routes, produceUnit), battle
 * (extracted from battleService), and — per the remediation plan's ownership
 * map — the FID-005 auction and FID-006 missile seams. No parallel reducer may
 * exist elsewhere (FID-004 §3: "no duplicate reducer elsewhere").
 *
 * - `calculatePlayerUnitStats`: the quantity-weighted totals reducer
 *   (strength × quantity, defense × quantity; NO temporary bonuses), extracted
 *   verbatim from battleService's private helper.
 * - `newUnitInstanceId`: distinct instance ids for PlayerUnit entries, safe
 *   across repeated builds inside one millisecond (the factory route's
 *   quantity-folded stack previously used a timestamp-only id).
 * - `canonicalPlayerUnitFromConfig`: the one place a procured PlayerUnit entry
 *   is minted — blueprint id and canonical UnitType stored SEPARATELY (§5.5),
 *   stack quantity preserved.
 */

import { randomUUID } from 'node:crypto';
import { UNIT_TYPE_TO_BLUEPRINT, type PlayerUnit, type UnitConfig } from '@/types';

/** Quantity-weighted army totals (the common army reducer). */
export interface ArmyStats {
  totalSTR: number;
  totalDEF: number;
}

/**
 * Sum strength×quantity and defense×quantity across a PlayerUnit army.
 * Pure; NO temporary bonuses (doctrine/battle multipliers apply at their own
 * seams). Extracted verbatim from battleService (FID-20261002-004 §5.5) and
 * shared with procurement, auction and missile consumers.
 */
export function calculatePlayerUnitStats(playerUnits: PlayerUnit[]): ArmyStats {
  let totalSTR = 0;
  let totalDEF = 0;

  for (const playerUnit of playerUnits) {
    totalSTR += playerUnit.strength * playerUnit.quantity;
    totalDEF += playerUnit.defense * playerUnit.quantity;
  }

  return { totalSTR, totalDEF };
}

/**
 * Distinct instance id for one PlayerUnit entry: username + timestamp +
 * random component, so two builds in the SAME millisecond (and quantity-folded
 * stacks from different builds) can never collide (§5.5).
 */
export function newUnitInstanceId(username: string, unitType: string): string {
  return `${username}-${Date.now()}-${randomUUID().slice(0, 8)}-${unitType}`;
}

/**
 * Mint the canonical procured PlayerUnit from a trusted UnitConfig:
 * blueprint id (`unitId`) and canonical UnitType (`unitType`) stored
 * separately; a distinct instance id; stack quantity preserved; provenance
 * stamped for per-factory investment reconstruction.
 */
export function canonicalPlayerUnitFromConfig(
  config: UnitConfig,
  quantity: number,
  username: string,
  producedAt?: { x: number; y: number },
): PlayerUnit {
  // The blueprint id lives in the canonical mapping; SPEC/PRESTIGE units (no
  // blueprint) use the canonical UnitType value as their catalog id.
  const unitId = UNIT_TYPE_TO_BLUEPRINT[config.type] ?? (config.type as string);

  return {
    id: newUnitInstanceId(username, config.type),
    unitId,
    unitType: config.type,
    name: config.name,
    category: (config.defense > 0 && !config.strength ? 'DEF' : 'STR') as 'STR' | 'DEF',
    rarity: 'common' as const,
    strength: config.strength,
    defense: config.defense,
    quantity,
    createdAt: new Date(),
    ...(producedAt ? { producedAt } : {}),
  } as PlayerUnit;
}
