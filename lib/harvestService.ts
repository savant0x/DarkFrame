/**
 * @file lib/harvestService.ts
 * @created 2025-10-16
 * @overview Resource harvesting service with reset period tracking
 * 
 * OVERVIEW:
 * Handles metal/energy/cave tile harvesting with per-player tracking and 12-hour
 * split reset cycles. Implements diminishing returns for digger items and
 * applies gathering bonuses to final harvest amounts.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { 
  Tile, 
  TerrainType, 
  GAME_CONSTANTS,
  HarvestRecord 
} from '@/types';
import type { Tables, Database } from '@/types/database';
import { getHarvestSuccessMessage } from './harvestMessages';

/**
 * Harvest result interface
 */
export interface HarvestResult {
  success: boolean;
  message: string;
  metalGained?: number;
  energyGained?: number;
  itemFound?: any;
  updatedPlayer?: Tables<'players'>;
}

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
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;
  
  if (x >= 1 && x <= 75) {
    return `${dateString}-AM`;
  } else {
    return `${dateString}-PM`;
  }
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
  const now = new Date();
  
  if (x >= 1 && x <= 75) {
    const nextReset = new Date(now);
    nextReset.setHours(0, 0, 0, 0);
    
    if (nextReset <= now) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    
    return nextReset.getTime() - now.getTime();
  } else {
    const nextReset = new Date(now);
    nextReset.setHours(12, 0, 0, 0);
    
    if (nextReset <= now) {
      nextReset.setDate(nextReset.getDate() + 1);
    }
    
    return nextReset.getTime() - now.getTime();
  }
}

/**
 * Check if a player can harvest a specific tile
 * 
 * Verifies:
 * - Player hasn't harvested this tile in current reset period
 * - Tile is harvestable type (Metal, Energy, or Cave)
 * 
 * @param playerId - Player's username
 * @param tile - Tile to check
 * @returns True if player can harvest, false otherwise
 */
export async function canHarvestTile(
  playerId: string,
  tile: { x: number; y: number; terrain: string }
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    
    const terrainValues = [TerrainType.Metal, TerrainType.Energy, TerrainType.Cave, TerrainType.Forest] as string[];
    if (!terrainValues.includes(tile.terrain)) {
      return false;
    }
    
    const currentPeriod = getCurrentResetPeriod(tile.x);
    
    const { data: records, error } = await supabase
      .from('tile_harvest_records')
      .select('*')
      .eq('tile_x', tile.x)
      .eq('tile_y', tile.y)
      .eq('player_id', playerId)
      .eq('reset_period', currentPeriod);
    
    if (error) throw error;
    
    return !records || records.length === 0;
    
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
 * @param playerId - Player's username
 * @param tile - Tile to harvest
 * @returns Harvest result with amount gained
 */
export async function harvestResourceTile(
  playerId: string,
  tile: Tile
): Promise<HarvestResult> {
  try {
    const supabase = createServiceClient();
    
    if (![TerrainType.Metal, TerrainType.Energy].includes(tile.terrain)) {
      return {
        success: false,
        message: 'This tile does not contain harvestable resources'
      };
    }
    
    const canHarvest = await canHarvestTile(playerId, tile);
    if (!canHarvest) {
      return {
        success: false,
        message: 'You have already harvested this tile. It will reset later.'
      };
    }
    
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('username', playerId)
      .single();
    
    if (playerError || !player) {
      return {
        success: false,
        message: 'Player not found'
      };
    }
    
    const baseAmount = generateBaseHarvestAmount();

    const permanentBonus = tile.terrain === TerrainType.Metal
      ? player.gathering_metal_bonus
      : player.gathering_energy_bonus;

    // DEPRECATED: kept for backwards compatibility
    const temporaryBonus = 0;

    // Fetch shrine bonus from player's active boosts
    let shrineBonus = 0;
    try {
      const { data: shrineBoosts } = await supabase
        .from('player_shrine_boosts')
        .select('yield_bonus')
        .eq('player_username', playerId)
        .gt('expires_at', new Date().toISOString());
      if (shrineBoosts && shrineBoosts.length > 0) {
        // Use diminishing stacking for shrine: +25/+20/+15/+10 = +70% max
        const raw = shrineBoosts.reduce((sum, b) => sum + (b.yield_bonus || 0), 0);
        let effective = 0;
        let remaining = raw * 100; // Convert to percentage points
        const t1 = Math.min(remaining, 25); effective += t1; remaining -= t1;
        if (remaining > 0) { const t2 = Math.min(remaining, 20); effective += t2; remaining -= t2; }
        if (remaining > 0) { const t3 = Math.min(remaining, 15); effective += t3; remaining -= t3; }
        if (remaining > 0) { effective += Math.min(remaining, 10); }
        shrineBonus = effective;
      }
    } catch (error) {
      console.error('❌ Error fetching shrine boosts:', error);
    }

    // Check VIP status for +50% bonus (additive, not multiplicative)
    let vipBonus = 0;
    if (player.is_vip && player.vip_expiration && new Date(player.vip_expiration) > new Date()) {
      vipBonus = 50; // +50% additive
    }

    // Check Flag Bearer status for +50% bonus (additive, not multiplicative)
    let flagBearerBonus = 0;
    let isPlayerFlagBearer = false;
    try {
      const { data: flagDoc } = await supabase
        .from('flags')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (flagDoc && flagDoc.bearer_username === playerId) {
        flagBearerBonus = 50; // +50% additive
        isPlayerFlagBearer = true;
      }
    } catch (error) {
      console.error('❌ Error checking flag bearer status:', error);
    }

    // Calculate total multiplier using additive diminishing returns
    const { calculateTotalMultiplier } = await import('@/lib/multiplierService');
    const totalMultiplier = calculateTotalMultiplier([
      { name: 'VIP', bonusPercent: vipBonus },
      { name: 'Flag Bearer', bonusPercent: flagBearerBonus },
      { name: 'Shrine', bonusPercent: shrineBonus },
    ]);

    // Calculate final amount: base × (1 + permanent%) × totalMultiplier
    let finalAmount = calculateHarvestAmount(baseAmount, permanentBonus, temporaryBonus);
    finalAmount = Math.floor(finalAmount * totalMultiplier);

    // Apply balance penalty/bonus to gathering (if player has units)
    if (player.total_strength || player.total_defense) {
      const { calculateBalanceEffects, applyBalanceToGathering } = await import('@/lib/balanceService');
      const balanceEffects = calculateBalanceEffects(
        player.total_strength || 0,
        player.total_defense || 0
      );
      finalAmount = applyBalanceToGathering(finalAmount, balanceEffects);
    }
    
    // Update player resources
    const resourceColumn = tile.terrain === TerrainType.Metal ? 'resources_metal' : 'resources_energy';
    const currentAmount = tile.terrain === TerrainType.Metal ? player.resources_metal : player.resources_energy;
    
    const { error: updateError } = await supabase
      .from('players')
      .update({ [resourceColumn]: currentAmount + finalAmount } as Database['public']['Tables']['players']['Update'])
      .eq('username', playerId);
    
    if (updateError) throw new Error(updateError.message);
    
    // Mark tile as harvested
    const currentPeriod = getCurrentResetPeriod(tile.x);
    
    const { error: recordError } = await supabase
      .from('tile_harvest_records')
      .insert({
        tile_x: tile.x,
        tile_y: tile.y,
        player_id: playerId,
        reset_period: currentPeriod,
        harvested_at: new Date().toISOString()
      });
    
    if (recordError) throw new Error(recordError.message);
    
    // Track daily harvest milestone progress and award RP
    try {
      const { checkDailyHarvestMilestone } = await import('./researchPointService');
      const milestoneResult = await checkDailyHarvestMilestone(playerId, currentPeriod);
      
      if (milestoneResult.milestoneReached) {
        console.log(`🎯 Milestone reached: ${playerId} earned ${milestoneResult.rpAwarded} RP at ${milestoneResult.milestoneThreshold} harvests`);
      }
    } catch (error) {
      console.error('❌ Error checking harvest milestone:', error);
    }
    
    // Get updated player
    const { data: updatedPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('username', playerId)
      .single();
    
    // Generate success message with VIP and Flag Bearer indicators
    let successMessage = getHarvestSuccessMessage(tile.terrain, finalAmount);
    if (vipBonus > 0) {
      successMessage += ` ⚡ VIP +${vipBonus}%!`;
    }
    if (isPlayerFlagBearer) {
      successMessage += ` 🚩 Flag Bearer +${flagBearerBonus}%!`;
    }
    
    const result: HarvestResult = {
      success: true,
      message: successMessage,
      updatedPlayer: updatedPlayer || undefined
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
  tile: { x: number; y: number; terrain: string }
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
// - Per-player harvest tracking via tile_harvest_records table
// - Bonuses stack: permanent + temporary
// - Cave tile harvesting handled by CaveItemService
// - Reset scheduler will clean old harvest records periodically
// ============================================================
// END OF FILE
// ============================================================
