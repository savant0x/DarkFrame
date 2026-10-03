/**
 * @file lib/harvestService.ts
 * @created 2025-10-16
 * @overview Resource harvesting service with reset period tracking
 * 
 * OVERVIEW:
 * Handles metal/energy/cave tile harvesting with per-player tracking and 12-hour
 * split reset cycles. Implements diminishing returns for digger items and
 * applies gathering bonuses to final harvest amounts.
 * 
 * FID-20261002-011: the payout projection now carries the player's real
 * totalStrength/totalDefense (the shared balance multiplier was silently
 * computed from zeros — an 800 roll paid 800 instead of 600 for a mono-STR
 * army), and the (player, period) reset claim plus the relative resource
 * credit commit in ONE transaction (FID-20261002-002 boundary), so repeated
 * concurrent harvests can never pay twice.
 */

import { db } from '@/lib/db';
import { players, tiles, flags } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { 
  Player, 
  Tile, 
  TerrainType, 
  GAME_CONSTANTS,
  HarvestRecord,
  isFarmableTerrain
} from '@/types';
import { getHarvestSuccessMessage } from './harvestMessages';
import { gameDateKey, atGameTime, addGameDays } from './gameTime';
// FID-20260910-040: the estimate pipeline lives in ONE place. The service keeps
// its own base roll + DB reads, then multiplies through the shared terms so UI
// calculators (which import the same module) can never drift from the payout.
import { estimateHarvest } from './harvestEstimate';
import { getResourceHarvestDelayMs } from './research/techEffects'; // FID-20261002-012 §5.3
// FID-20261002-011 §5.6: claim + credit share one retried transaction.
import { withTransactionRetry } from './db/treasuryLock';

/**
 * Harvest result interface
 */
export interface HarvestResult {
  success: boolean;
  message: string;
  metalGained?: number;
  energyGained?: number;
  itemFound?: { name: string; rarity?: string }; // Cave drop as surfaced by CaveItemService
  updatedPlayer?: Player;
  /** FID-20261002-012 §5.3: the authoritative next resource-harvest action
   *  deadline written by THIS payout (undefined for item tiles/refusals). */
  nextResourceHarvestAt?: Date;
  /** FID-20261002-012 §5.3: present when a resource harvest was refused on
   *  the action deadline — when the client may retry (ms epoch). */
  retryAt?: number;
}

/**
 * Map a flat database row to a Player object with nested structure
 *
 * FID-20261002-011: the projection carries totalStrength/totalDefense so the
 * balance multiplier inside estimateHarvest sees the real army, not zeros.
 */
function mapRowToPlayer(row: Pick<typeof players.$inferSelect, 'username' | 'resourcesMetal' | 'resourcesEnergy' | 'gatheringBonusMetalBonus' | 'gatheringBonusEnergyBonus' | 'activeBoostsGatheringBoost' | 'activeBoostsExpiresAt' | 'shrineBoosts' | 'vip' | 'vipExpiration' | 'totalStrength' | 'totalDefense' | 'unlockedTechs' | 'nextResourceHarvestAt'>): Player {
  return {
    ...row,
    resources: {
      metal: Number(row.resourcesMetal),
      energy: Number(row.resourcesEnergy),
    },
    gatheringBonus: {
      metalBonus: Number(row.gatheringBonusMetalBonus),
      energyBonus: Number(row.gatheringBonusEnergyBonus),
    },
    activeBoosts: {
      gatheringBoost: row.activeBoostsGatheringBoost ? Number(row.activeBoostsGatheringBoost) : 0,
      expiresAt: row.activeBoostsExpiresAt,
    },
    vip: row.vip === 1,
  } as unknown as Player;
}

/** Slim payout-projection column set shared by the transactional claim path. */
const HARVEST_PLAYER_PROJECTION = {
  username: players.username,
  resourcesMetal: players.resourcesMetal,
  resourcesEnergy: players.resourcesEnergy,
  gatheringBonusMetalBonus: players.gatheringBonusMetalBonus,
  gatheringBonusEnergyBonus: players.gatheringBonusEnergyBonus,
  activeBoostsGatheringBoost: players.activeBoostsGatheringBoost,
  activeBoostsExpiresAt: players.activeBoostsExpiresAt,
  shrineBoosts: players.shrineBoosts,
  vip: players.vip,
  vipExpiration: players.vipExpiration,
  totalStrength: players.totalStrength,
  totalDefense: players.totalDefense,
  // FID-20261002-012 §5.3: personal tech (advanced-mining yield) + the
  // authoritative resource-harvest action deadline (admission + write).
  unlockedTechs: players.unlockedTechs,
  nextResourceHarvestAt: players.nextResourceHarvestAt,
} as const;

/**
 * Get current reset period identifier for a tile
 * 
 * Tiles 1-75 reset at midnight (12:00 AM)
 * Tiles 76-150 reset at noon (12:00 PM)
 * 
 * @param x - Tile X coordinate
 * @returns Reset period string like "2025-10-16-AM" or "2025-10-16-PM"
 * 
 * @example
 * ```typescript
 * getCurrentResetPeriod(50); // "2025-10-16-AM"
 * getCurrentResetPeriod(100); // "2025-10-16-PM"
 * ```
 */
export function getCurrentResetPeriod(x: number): string {
  // FID-20260923-002: the reset boundary is a GAME day, not a host-local day —
  // a UTC host previously rolled the harvest period at a different wall clock.
  const dateString = gameDateKey(new Date());
  return x >= 1 && x <= 75 ? `${dateString}-AM` : `${dateString}-PM`;
}

/**
 * Get time until next reset for a tile
 * 
 * @param x - Tile X coordinate
 * @returns Milliseconds until next reset
 * 
 * @example
 * ```typescript
 * const ms = getTimeUntilReset(50);
 * const hours = Math.floor(ms / (1000 * 60 * 60));
 * ```
 */
export function getTimeUntilReset(x: number): number {
  // FID-20260923-002: reset boundaries are GAME time, not host-local time.
  const now = new Date();
  const resetHour = x >= 1 && x <= 75 ? 0 : 12;
  let nextReset = atGameTime(now, resetHour);
  if (nextReset <= now) nextReset = atGameTime(addGameDays(now, 1), resetHour);
  return nextReset.getTime() - now.getTime();
}

/**
 * Check if a player can harvest a specific tile
 * 
 * Verifies:
 * - Player hasn't harvested this tile in current reset period
 * - Tile is a farmable terrain (see `FARMABLE_TERRAINS` in `types/game.types.ts`)
 * 
 * FID-20260925-003: Forest was missing from the eligibility list that used to
 * live here and had been since Forest gained a harvest path. `/api/harvest`
 * dispatches Forest to `harvestForestTile`, which gates on THIS function
 * (`lib/caveItemService.ts`), so every forest tile was refused eligibility by a
 * list that was never updated for it — reported to the player as "You have
 * already explored this forest", a cooldown the tile had never earned. Because
 * the refusal returned before any harvest record was written, the viewport chip
 * (`components/TileRenderer.tsx`) could never flip off `ready` either: ~2% of
 * the map (the generator's own Forest weight) read permanently farmable and
 * yielded nothing, for every player, through every harvest path.
 *
 * FID-20260927-001: that list is no longer duplicated here. This guard reads
 * `isFarmableTerrain` — the single definition, shared with the route's
 * dispatch, the auto-farm engine, the viewport chip, the harvest button, the
 * cooldown indicator, and the help page. The invariant the old comment was
 * really asserting still holds and is now mechanical: every terrain listed in
 * `FARMABLE_TERRAINS` must have a server payout path reachable from
 * `/api/harvest`, and every terrain a payout path can pay must be listed.
 * `__tests__/terrainTruth.test.ts` enforces both directions, so this guard
 * cannot drift from the dispatch again.
 *
 * FID-20261002-011: this check is the fail-fast preview; the authoritative
 * (player, period) check re-runs under the tile row lock inside the claim
 * transaction in `harvestResourceTile`.
 *
 * @param playerId - Player's username
 * @param tile - Tile to check
 * @returns True if player can harvest, false otherwise
 */
export async function canHarvestTile(
  playerId: string,
  tile: Tile
): Promise<boolean> {
  try {
    // Check if tile is a farmable terrain (single source of truth)
    if (!isFarmableTerrain(tile.terrain)) {
      return false;
    }
    
    // Get current reset period
    const currentPeriod = getCurrentResetPeriod(tile.x);
    
    // Check if player has already harvested this tile in current period
    const tileRows = await db.select().from(tiles).where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y))).limit(1);
    const tileDoc = tileRows[0];
    
    if (!tileDoc || !tileDoc.lastHarvestedBy) {
      return true; // No harvest records, can harvest
    }
    
    const existingHarvest = tileDoc.lastHarvestedBy.find(
      (record: HarvestRecord) => 
        record.playerId === playerId && record.resetPeriod === currentPeriod
    );
    
    return !existingHarvest; // Can harvest if no record found
    
  } catch (error) {
    console.error('❌ Error checking harvest eligibility:', error);
    throw error;
  }
}

/**
 * Calculate harvest amount with bonuses
 * 
 * Applies permanent digger bonuses and temporary boosts
 * 
 * @param baseAmount - Random base amount (800-1500)
 * @param permanentBonus - Percentage bonus from diggers (e.g., 25 = +25%)
 * @param temporaryBonus - Percentage bonus from active boost (e.g., 50 = +50%)
 * @returns Final harvest amount after all bonuses
 * 
 * @example
 * ```typescript
 * const base = 1000;
 * const permanent = 30; // +30% from diggers
 * const temp = 50; // +50% from boost
 * const final = calculateHarvestAmount(base, permanent, temp);
 * // Result: 1000 * (1 + 0.30 + 0.50) = 1,800
 * ```
 */
export function calculateHarvestAmount(
  baseAmount: number,
  permanentBonus: number,
  temporaryBonus: number
): number {
  const multiplier = 1 + (permanentBonus / 100) + (temporaryBonus / 100);
  return Math.floor(baseAmount * multiplier);
}

/**
 * Generate random base harvest amount
 * 
 * @returns Random value between MIN_AMOUNT and MAX_AMOUNT (800-1500)
 */
export function generateBaseHarvestAmount(): number {
  const { MIN_AMOUNT, MAX_AMOUNT } = GAME_CONSTANTS.HARVEST;
  return Math.floor(Math.random() * (MAX_AMOUNT - MIN_AMOUNT + 1)) + MIN_AMOUNT;
}

/**
 * Harvest a metal or energy tile
 * 
 * Adds resources to player's inventory and marks tile as harvested
 * 
 * FID-20261002-011 §5.6: the (player, period) reset claim (tile row locked FOR
 * UPDATE), the payout computation against the REAL army totals, and the
 * relative resource credit commit in ONE transaction — two concurrent
 * harvests of the same tile serialize on the claim, and exactly one pays.
 * Session earnings and milestone rewards consume the committed claim identity
 * strictly after commit: a reward failure can never become a duplicate payout
 * retry.
 * 
 * @param playerId - Player's username
 * @param tile - Tile to harvest
 * @returns Harvest result with amount gained
 */
export async function harvestResourceTile(
  playerId: string,
  tile: Tile
): Promise<HarvestResult> {
  try {
    // Verify tile type
    if (![TerrainType.Metal, TerrainType.Energy].includes(tile.terrain)) {
      return {
        success: false,
        message: 'This tile does not contain harvestable resources'
      };
    }
    
    // Fail-fast eligibility preview (authoritative check re-runs under the lock)
    const canHarvest = await canHarvestTile(playerId, tile);
    if (!canHarvest) {
      return {
        success: false,
        message: 'You have already harvested this tile. It will reset later.'
      };
    }
    
    // ===== Transactional claim + payout (FID-20261002-011 §5.6) =====
    const commit = await withTransactionRetry(`harvestResourceTile(${playerId})`, () =>
      db.transaction(async (tx): Promise<
        | { claimed: false; reason: 'already-harvested' | 'player-not-found' | 'action-deadline'; retryAt?: number }
        | {
            claimed: true;
            finalAmount: number;
            vipMultiplier: number;
            flagBearerMultiplier: number;
            isPlayerFlagBearer: boolean;
            currentPeriod: string;
            nextResourceHarvestAt: Date;
          }
      > => {
        const currentPeriod = getCurrentResetPeriod(tile.x);
        
        // Lock the tile row: the (player, period) claim is the conservation
        // seam — a second concurrent claimant blocks here and then sees the
        // committed record and refuses, instead of paying a second time.
        const tileRows = await tx
          .select()
          .from(tiles)
          .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)))
          .limit(1)
          .for('update');
        const tileDoc = tileRows[0];
        const existingRecords: HarvestRecord[] = tileDoc?.lastHarvestedBy || [];
        
        if (
          existingRecords.some(
            (record) => record.playerId === playerId && record.resetPeriod === currentPeriod,
          )
        ) {
          return { claimed: false, reason: 'already-harvested' };
        }
        
        // Get player data — slim projection for the gather math (FID-20260911-046),
        // now carrying totalStrength/totalDefense for the balance multiplier
        // (FID-20261002-011: the totals defaulted to zero and mono-STR armies
        // were paid the full roll instead of the gathering nerf).
        const playerRows = await tx
          .select(HARVEST_PLAYER_PROJECTION)
          .from(players)
          .where(eq(players.username, playerId))
          .limit(1);
        const playerRow = playerRows[0];
        
        if (!playerRow) {
          return { claimed: false, reason: 'player-not-found' };
        }
        
        // FID-20261002-012 §5.3 (source-audit correction): the authoritative
        // resource-harvest action deadline — admission IN-LOCK, after the
        // claim check (a depleted tile refuses on the claim, not the clock).
        // Item tiles (cave/forest) never reach this transaction.
        const nowForDeadline = new Date();
        if (playerRow.nextResourceHarvestAt && playerRow.nextResourceHarvestAt > nowForDeadline) {
          return {
            claimed: false,
            reason: 'action-deadline',
            retryAt: playerRow.nextResourceHarvestAt.getTime(),
          };
        }
        
        const player = mapRowToPlayer(playerRow);
        
        // FID-20260910-040: expire+persist stale shrine boosts (inside the same
        // transaction), then hand the (now-clean) list to the shared estimate
        // module, which sums live yields.
        let shrineBoosts = player.shrineBoosts || [];
        if (shrineBoosts.length > 0) {
          const now = new Date();
          const filtered = shrineBoosts.filter((boost) => new Date(boost.expiresAt) > now);
          if (filtered.length < shrineBoosts.length) {
            shrineBoosts = filtered;
            await tx
              .update(players)
              .set({ shrineBoosts: filtered })
              .where(eq(players.username, playerId));
          }
        }
        
        // Get permanent digger bonuses
        const permanentBonus = tile.terrain === TerrainType.Metal
          ? player.gatheringBonus.metalBonus
          : player.gatheringBonus.energyBonus;
        
        // Get temporary boost (DEPRECATED - kept for backwards compatibility)
        const temporaryBonus = player.activeBoosts.gatheringBoost || 0;
        
        // Check VIP status for 2x resource multiplier
        let vipMultiplier = 1;
        if (player.vip && player.vipExpiration && new Date(player.vipExpiration) > new Date()) {
          vipMultiplier = 2; // VIP gets 2x resources
        }
        
        // Check Flag Bearer status for +100% bonus (2x multiplier)
        let flagBearerMultiplier = 1;
        let isPlayerFlagBearer = false;
        try {
          const flagRows = await tx.select().from(flags).limit(1);
          const flagRow = flagRows[0];
          if (flagRow && flagRow.currentHolderUsername === playerId) {
            flagBearerMultiplier = 2; // Flag bearer gets +100% = 2x resources
            isPlayerFlagBearer = true;
          }
        } catch (error) {
          console.error('❌ Error checking flag bearer status:', error);
          // Don't fail harvest if flag check fails
        }
        
        // FID-20260910-040: compute the payout through the shared estimate module
        // (identical pipeline: additive % → floor → ×2 VIP → floor → ×2 bearer →
        // floor → × balance gathering → floor → × advanced-mining yield) so UI
        // calculators reading the same module can never drift from what this
        // route actually credits. FID-20261002-012 §5.3: estimates and payouts
        // use the SAME advanced-mining flag, read from the locked row.
        const advancedMining = (playerRow.unlockedTechs ?? []).includes('advanced-mining');
        const baseAmount = generateBaseHarvestAmount();
        const estimate = estimateHarvest({
          gatheringBonusPct: permanentBonus,
          temporaryBonusPct: temporaryBonus,
          shrineBoosts,
          vip: player.vip === true,
          vipExpiration: player.vipExpiration,
          isFlagBearer: isPlayerFlagBearer,
          totalStrength: player.totalStrength || 0,
          totalDefense: player.totalDefense || 0,
          base: baseAmount,
          advancedMining,
        });
        const finalAmount = estimate.final;
        
        // FID-20261002-012 §5.3: the action deadline commits WITH the payout
        // (same transaction) — 3000ms base, 2400ms for advanced-mining owners.
        // Reset periods and claim eligibility are untouched (yield + cadence
        // only). Item tiles and refusals never write a deadline.
        const nextResourceHarvestAt = new Date(
          nowForDeadline.getTime() + getResourceHarvestDelayMs(advancedMining)
        );
        
        // Claim: append the harvest record on the LOCKED row.
        const harvestRecords: HarvestRecord[] = [
          ...existingRecords,
          {
            playerId,
            timestamp: new Date(),
            resetPeriod: currentPeriod,
          },
        ];
        await tx
          .update(tiles)
          .set({ lastHarvestedBy: harvestRecords })
          .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)));
        
        // Relative resource credit — commutative SQL delta on the same row the
        // claim locks, so claim and credit commit (or roll back) together.
        // FID-20261002-012 §5.3: the action deadline commits in the SAME write.
        if (tile.terrain === TerrainType.Metal) {
          await tx
            .update(players)
            .set({ resourcesMetal: sql`${players.resourcesMetal} + ${finalAmount}`, nextResourceHarvestAt })
            .where(eq(players.username, playerId));
        } else {
          await tx
            .update(players)
            .set({ resourcesEnergy: sql`${players.resourcesEnergy} + ${finalAmount}`, nextResourceHarvestAt })
            .where(eq(players.username, playerId));
        }
        
        return {
          claimed: true,
          finalAmount,
          vipMultiplier,
          flagBearerMultiplier,
          isPlayerFlagBearer,
          currentPeriod,
          nextResourceHarvestAt,
        };
      })
    );
    
    if (!commit.claimed) {
      if (commit.reason === 'action-deadline') {
        return {
          success: false,
          message: `Harvest actions are rate-limited. Try again shortly.`,
          retryAt: commit.retryAt,
        };
      }
      return {
        success: false,
        message:
          commit.reason === 'player-not-found'
            ? 'Player not found'
            : 'You have already harvested this tile. It will reset later.',
      };
    }
    
    const { finalAmount, vipMultiplier, flagBearerMultiplier, isPlayerFlagBearer, currentPeriod, nextResourceHarvestAt } = commit;
    
    // ===== Post-commit rewards (consume the committed claim identity) =====
    
    // FID-20260906-001 §5.4: GROSS session-earnings accrual while holding the
    // Flag (powers the escalating flee-cost economy). Doc: tracks ALL income
    // gained while holding; never decremented; resets on holder change.
    try {
      if (isPlayerFlagBearer) {
        const { addSessionEarnings } = await import('@/lib/flagBonusService');
        await addSessionEarnings(
          playerId,
          tile.terrain === TerrainType.Metal ? finalAmount : 0,
          tile.terrain === TerrainType.Metal ? 0 : finalAmount,
        );
      }
    } catch (earnErr) {
      console.error('⚠️ Session earnings accrual failed:', earnErr);
    }
    
    // Track daily harvest milestone progress and award RP — post-commit, so a
    // milestone failure can never retry the payout (FID-20261002-011 §5.6).
    try {
      const { checkDailyHarvestMilestone } = await import('./researchPointService');
      const milestoneResult = await checkDailyHarvestMilestone(playerId, currentPeriod);
      
      if (milestoneResult.milestoneReached) {
        console.log(`🎯 Milestone reached: ${playerId} earned ${milestoneResult.rpAwarded} RP at ${milestoneResult.milestoneThreshold} harvests`);
      }
    } catch (error) {
      console.error('❌ Error checking harvest milestone:', error);
      // Don't fail harvest if milestone check fails
    }
    
    // FID-20260911-043: slim post-write read — the harvest route never ships
    // updatedPlayer (route contract: "DO NOT return player"), so reading the
    // full 39 KB row here was pure waste on the hottest loop in the game.
    // Keep to the slim projection; the claim transaction supplies the gather
    // math inputs.
    const updatedPlayerRows = await db.select({
      username: players.username,
      xp: players.xp,
      level: players.level,
      currentPositionX: players.currentPositionX,
      currentPositionY: players.currentPositionY,
      resourcesMetal: players.resourcesMetal,
      resourcesEnergy: players.resourcesEnergy,
      bankMetal: players.bankMetal,
      bankEnergy: players.bankEnergy,
      totalStrength: players.totalStrength,
      totalDefense: players.totalDefense,
    }).from(players).where(eq(players.username, playerId)).limit(1);
    const updatedPlayer = updatedPlayerRows[0] ? mapRowToPlayer(updatedPlayerRows[0] as typeof players.$inferSelect) : undefined;
    
    // Generate success message with VIP and Flag Bearer indicators
    let successMessage = getHarvestSuccessMessage(tile.terrain, finalAmount);
    if (vipMultiplier === 2) {
      const baseHarvestAmount = Math.floor(finalAmount / (flagBearerMultiplier === 2 ? 4 : 2)); // Divide by 4 if both VIP and Flag, else 2
      successMessage += ` ⚡ VIP 2x Boost! (+${baseHarvestAmount} bonus)`;
    }
    if (isPlayerFlagBearer) {
      const baseHarvestAmount = Math.floor(finalAmount / (vipMultiplier === 2 ? 4 : 2)); // Divide by 4 if both VIP and Flag, else 2
      successMessage += ` 🚩 Flag Bearer +100%! (+${baseHarvestAmount} bonus)`;
    }
    
    const result: HarvestResult = {
      success: true,
      message: successMessage,
      updatedPlayer: updatedPlayer || undefined,
      // FID-20261002-012 §5.3: the authoritative deadline this payout wrote —
      // the route's timing DTO and auto-farm clients consume it.
      nextResourceHarvestAt,
    };
    
    if (tile.terrain === TerrainType.Metal) {
      result.metalGained = finalAmount;
    } else {
      result.energyGained = finalAmount;
    }
    
    console.log(`✅ Player ${playerId} harvested ${finalAmount} ${tile.terrain} at (${tile.x}, ${tile.y})`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error harvesting resource tile:', error);
    return {
      success: false,
      message: 'An error occurred while harvesting'
    };
  }
}

/**
 * Get harvest status for a tile
 * 
 * @param playerId - Player's username
 * @param tile - Tile to check
 * @returns Object with harvest availability info
 */
export async function getHarvestStatus(
  playerId: string,
  tile: Tile
): Promise<{
  canHarvest: boolean;
  timeUntilReset: number;
  resetPeriod: string;
}> {
  try {
    const canHarvest = await canHarvestTile(playerId, tile);
    const timeUntilReset = getTimeUntilReset(tile.x);
    const resetPeriod = getCurrentResetPeriod(tile.x);
    
    return {
      canHarvest,
      timeUntilReset,
      resetPeriod
    };
  } catch (error) {
    console.error('❌ Error getting harvest status:', error);
    throw error;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Reset periods calculated based on server time
// - Tiles 1-75 reset at 00:00, tiles 76-150 reset at 12:00
// - Per-player harvest tracking prevents farming same tile multiple times
// - Bonuses stack: permanent + temporary
// - Cave tile harvesting handled by CaveItemService
// - Reset scheduler will clean old harvest records periodically
// - FID-20261002-011: claim + credit are one transaction; the tile row lock
//   serializes concurrent harvests of the same tile in the same period
// ============================================================
// END OF FILE
// ============================================================
