/**
 * hostileBase — the operator's hostility rule for base raids.
 *
 * PVP_BASE_RAID_DESIGN.md §2/§4 (ratified 2026-09-28): every base is hostile
 * EXCEPT self, same clan/tribe, or an active alliance between the two clans.
 * All four alliance types block (NAP/TRADE/MILITARY/FEDERATION — none removes
 * protection; ENHANCED_WARFARE_DESIGN.md's NAP contract prohibits aggression
 * between parties and the higher tiers only add benefits). Bots are hostile
 * unconditionally; this rule only ever widened the target set by admitting
 * human defenders (FID-20260928-006).
 *
 * Constants here are the design doc's tuning knobs (§4.1/§4.2) — edit the doc
 * and this module together, one source of truth.
 */

/** §4.1: PvP loot ceiling per resource = 5,000 × attacker level (base 1×). */
export const PVP_LOOT_CAP_PER_LEVEL = 5_000;

/** §4.2: one raid can never drop a human defender's army below 25% of its pre-battle pool. */
export const DEFENDER_LOSS_FLOOR = 0.25;

export interface HostilityInput {
  attackerUsername: string;
  defenderUsername: string;
  /** `players.clanId` — null/undefined when unclanned. */
  attackerClanId: string | null | undefined;
  defenderClanId: string | null | undefined;
  /** Already-resolved `areAllies(...)` result (the route performs the async lookup). */
  allied: boolean;
}

export interface HostilityVerdict {
  /** true = the raid may proceed. */
  hostile: boolean;
  /** When not hostile: the player-facing refusal reason (surfaced verbatim). */
  reason?: string;
}

/**
 * Pure truth table — the route performs the DB lookups (it already holds both
 * player rows) and passes the resolved values. Same-username is checked first
 * (the route also blocks self-attack upstream); same-clan beats alliance in
 * the reason string but both refuse.
 */
export function evaluateHostility(input: HostilityInput): HostilityVerdict {
  if (input.attackerUsername === input.defenderUsername) {
    return { hostile: false, reason: 'You cannot attack your own base' };
  }
  const sameClan =
    input.attackerClanId != null &&
    input.defenderClanId != null &&
    input.attackerClanId === input.defenderClanId;
  if (sameClan) {
    return { hostile: false, reason: 'Target is in your clan — bases are not hostile within a clan' };
  }
  if (input.allied) {
    return { hostile: false, reason: 'Target is in an allied clan — the alliance forbids aggression' };
  }
  // Unclanned players are hostile both ways: no social structure protects them.
  return { hostile: true };
}

/** §4.1: the per-resource loot ceiling for a raider of the given level. */
export function pvpLootCap(attackerLevel: number): number {
  return Math.max(1, Math.floor(attackerLevel)) * PVP_LOOT_CAP_PER_LEVEL;
}
