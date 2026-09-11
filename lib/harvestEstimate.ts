/**
 * @file lib/harvestEstimate.ts
 * @created 2026-09-11
 * @overview FID-20260910-040 — single source of truth for harvest-yield math.
 *
 * WHY THIS EXISTS: the two UI estimators (StatsPanel's Harvest Calculator and
 * the Stats view's Harvest Calc tab) each hand-rolled their own formula, and
 * both had drifted from what `harvestResourceTile` actually pays:
 *  - wrong base ranges (1,000 flat / 500–1,500 vs the real 800–1,500 roll),
 *  - a fabricated "Cave / Forest 500–1,500 resources" block (caves/forests
 *    credit ZERO resources — they roll items at 30%/50%),
 *  - an invented balance curve (±20% by ratio bands) vs the real four-tier
 *    system (0.75 / 0.90 / 1.00 / 1.10 gathering multiplier),
 *  - inventories scraped for `item.equipped`/`item.yieldBonus` — fields that
 *    do not exist on InventoryItem — so the digger bonus always read 0.
 *
 * This module mirrors `harvestResourceTile`'s exact pipeline:
 *   base roll → (1 + permanent% + temp%/shrine%) → ×2 VIP → ×2 bearer
 *   → × balance.gatheringMultiplier → floor.
 *
 * The server is authoritative; this module exists so the UI can show honest
 * numbers without duplicating (and re-drifting) the pipeline. When the server
 * math changes, change it here too — both consumers render from this.
 */

import { GAME_CONSTANTS } from '@/types';
import { calculateBalanceEffects, type BalanceEffects } from './balanceService';

/** One estimate result per resource type. */
export interface HarvestEstimate {
  /** Random base roll (800–1500) — the only non-deterministic term. */
  base: number;
  /** Final yield the server would credit for this base roll. */
  final: number;
  /** The terms, broken out for UI display. */
  terms: {
    /** Digger permanent bonus, percent (e.g. 25 → +25%). */
    gatheringBonusPct: number;
    /** Legacy active-boost percent — usually 0; kept for parity. */
    temporaryBonusPct: number;
    /** Active shrine yield bonuses summed, percent. */
    shrineBonusPct: number;
    /** true when VIP 2× applied. */
    vip: boolean;
    /** true when Flag Bearer 2× applied. */
    flagBearer: boolean;
    /** Balance gathering multiplier actually applied (0.75–1.10). */
    balanceMultiplier: number;
    /** Balance status label driving the multiplier. */
    balanceStatus: BalanceEffects['status'];
  };
}

export interface HarvestEstimateInput {
  /** Digger permanent bonus percent for this resource (players.gatheringBonus).
   *  Optional — omitting it is equivalent to 0 (no diggers found). */
  gatheringBonusPct?: number;
  /** Legacy temporary boost percent (players.activeBoosts.gatheringBoost). */
  temporaryBonusPct?: number;
  /** Active shrine boosts ({ yieldBonus: 0.25 }-shaped). */
  shrineBoosts?: Array<{ yieldBonus: number; expiresAt: string | Date }>;
  /** VIP flag + expiration (both required, matching the server check). */
  vip?: boolean;
  vipExpiration?: string | Date | null;
  /** Whether this viewer currently holds the Flag. */
  isFlagBearer?: boolean;
  /** Army balance (players.totalStrength / totalDefense). */
  totalStrength?: number;
  totalDefense?: number;
  /** Overrides the random base roll (tests / deterministic UI). */
  base?: number;
}

function activeShrinePct(
  shrineBoosts: HarvestEstimateInput['shrineBoosts'],
  now: Date,
): number {
  if (!shrineBoosts || shrineBoosts.length === 0) return 0;
  return shrineBoosts
    .filter((b) => new Date(b.expiresAt) > now)
    .reduce((sum, b) => sum + (b.yieldBonus || 0) * 100, 0);
}

function vipActive(input: HarvestEstimateInput, now: Date): boolean {
  return Boolean(input.vip && input.vipExpiration && new Date(input.vipExpiration) > now);
}

/**
 * Estimate one resource type's yield, term-for-term identical to
 * `harvestResourceTile` (which adds the base roll server-side).
 */
export function estimateHarvest(input: HarvestEstimateInput, now = new Date()): HarvestEstimate {
  const base =
    input.base ??
    Math.floor(
      Math.random() *
        (GAME_CONSTANTS.HARVEST.MAX_AMOUNT - GAME_CONSTANTS.HARVEST.MIN_AMOUNT + 1),
    ) + GAME_CONSTANTS.HARVEST.MIN_AMOUNT;

  const shrineBonusPct = activeShrinePct(input.shrineBoosts, now);
  const temporaryBonusPct = input.temporaryBonusPct ?? 0;
  const vip = vipActive(input, now);
  const flagBearer = Boolean(input.isFlagBearer);

  // Server pipeline — EXACTLY replicated, including the intermediate floors
  // (calculateHarvestAmount floors after the additive term; then VIP, bearer,
  // and balance each floor again). Skipping intermediate floors drifts ±1.
  let amount = Math.floor(
    base * (1 + (input.gatheringBonusPct || 0) / 100 + (temporaryBonusPct + shrineBonusPct) / 100),
  );
  if (vip) amount = Math.floor(amount * 2);
  if (flagBearer) amount = Math.floor(amount * 2);

  let balanceMultiplier = 1;
  let balanceStatus: BalanceEffects['status'] = 'BALANCED';
  if (input.totalStrength || input.totalDefense) {
    const effects = calculateBalanceEffects(input.totalStrength || 0, input.totalDefense || 0);
    balanceMultiplier = effects.gatheringMultiplier;
    balanceStatus = effects.status;
    amount = Math.floor(amount * balanceMultiplier);
  }

  return {
    base,
    final: Math.floor(amount),
    terms: {
      gatheringBonusPct: input.gatheringBonusPct || 0,
      temporaryBonusPct,
      shrineBonusPct,
      vip,
      flagBearer,
      balanceMultiplier,
      balanceStatus,
    },
  };
}

/** Expected value over the 800–1500 uniform roll (mean 1150), same pipeline. */
export function estimateHarvestExpected(input: HarvestEstimateInput, now = new Date()): HarvestEstimate {
  const mean = (GAME_CONSTANTS.HARVEST.MIN_AMOUNT + GAME_CONSTANTS.HARVEST.MAX_AMOUNT) / 2;
  return estimateHarvest({ ...input, base: mean }, now);
}
