/**
 * @file lib/caveItemService.ts
 * @created 2025-10-16
 * @overview Cave item generation service with diminishing returns
 * 
 * OVERVIEW:
 * Handles cave exploration rewards including permanent digger items and
 * tradeable items for temporary boosts. Implements Option 4 diminishing
 * returns system to prevent veteran player dominance.
 */

import { db } from '@/lib/db';
import { players, tiles } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { mapRowToPlayer } from './playerService';
import { 
  Player,
  Tile,
  TerrainType,
  ItemType,
  ItemRarity,
  InventoryItem,
  GAME_CONSTANTS
} from '@/types';
import { canHarvestTile, getCurrentResetPeriod } from './harvestService';
import { generateId } from './utils';
import { getHarvestSuccessMessage } from './harvestMessages';

/**
 * Cave harvest result
 */
export interface CaveHarvestResult {
  success: boolean;
  message: string;
  item?: InventoryItem;
  bonusApplied?: number; // Bonus amount added to player's total
  updatedPlayer?: Player;
}

/**
 * Calculate digger bonus based on diminishing returns tier
 * 
 * Tier System (Option 4):
 * - Diggers 1-10: +2% each
 * - Diggers 11-30: +1% each
 * - Diggers 31-70: +0.5% each
 * - Diggers 71-150: +0.25% each
 * - Diggers 151+: +0.1% each
 * 
 * @param currentCount - Number of diggers player already has for this resource
 * @returns Bonus percentage for next digger
 * 
 * @example
 * ```typescript
 * getDiggerBonus(5);   // Returns 2.0 (5th digger, still in tier 1)
 * getDiggerBonus(25);  // Returns 1.0 (25th digger, in tier 2)
 * getDiggerBonus(100); // Returns 0.25 (100th digger, in tier 4)
 * ```
 */
export function getDiggerBonus(currentCount: number): number {
  const nextDiggerNumber = currentCount + 1;
  
  for (const tier of GAME_CONSTANTS.DIGGER_TIERS) {
    if (nextDiggerNumber >= tier.min && nextDiggerNumber <= tier.max) {
      return tier.bonusPercent;
    }
  }
  
  // Fallback to lowest tier (should never reach here)
  return 0.1;
}

/**
 * Generate a random cave item
 * 
 * Drop rates:
 * - 30% chance for ANY item
 * - Of that 30%: 80% tradeable, 20% digger
 * 
 * @returns Item or null if no drop
 */
export function generateCaveItem(): InventoryItem | null {
  // 30% chance for ANY item drop
  if (Math.random() > GAME_CONSTANTS.HARVEST.CAVE_DROP_RATE) {
    return null; // No item this time
  }
  
  // Determine if tradeable or digger (80/20 split)
  const isTradeableItem = Math.random() < GAME_CONSTANTS.HARVEST.TRADEABLE_ITEM_RATE;
  
  if (isTradeableItem) {
    // Generate tradeable item with rarity (affects shrine duration)
    // Rarity distribution: 60% Common, 25% Uncommon, 10% Rare, 4% Epic, 1% Legendary
    const rarityRoll = Math.random();
    let rarity: ItemRarity;
    
    if (rarityRoll < 0.60) {
      rarity = ItemRarity.Common;
    } else if (rarityRoll < 0.85) {
      rarity = ItemRarity.Uncommon;
    } else if (rarityRoll < 0.95) {
      rarity = ItemRarity.Rare;
    } else if (rarityRoll < 0.99) {
      rarity = ItemRarity.Epic;
    } else {
      rarity = ItemRarity.Legendary;
    }
    
    return {
      id: generateId(),
      type: ItemType.TradeableItem,
      name: `${rarity} Tradeable Item`,
      description: 'A valuable item that can be used at the Shrine for gathering boosts',
      rarity,
      bonusPercent: 0, // No passive bonus for tradeable items
      foundAt: { x: 0, y: 0 }, // Will be filled in by caller
      foundDate: new Date()
    };
  } else {
    // Generate digger item (permanent boost)
    // Randomly choose between Metal, Energy, or Universal digger
    const roll = Math.random();
    let itemType: ItemType;
    
    if (roll < 0.40) {
      itemType = ItemType.MetalDigger;
    } else if (roll < 0.80) {
      itemType = ItemType.EnergyDigger;
    } else {
      itemType = ItemType.UniversalDigger;
    }
    
    // Rarity is for flavor only (actual bonus determined by diminishing returns)
    const rarityRoll = Math.random();
    let rarity: ItemRarity;
    
    if (rarityRoll < 0.60) {
      rarity = ItemRarity.Common;
    } else if (rarityRoll < 0.85) {
      rarity = ItemRarity.Uncommon;
    } else if (rarityRoll < 0.95) {
      rarity = ItemRarity.Rare;
    } else if (rarityRoll < 0.99) {
      rarity = ItemRarity.Epic;
    } else {
      rarity = ItemRarity.Legendary;
    }
    
    // Generate name based on type
    let name: string;
    let description: string;
    
    if (itemType === ItemType.MetalDigger) {
      name = 'Metal Digger';
      description = 'Permanently increases metal gathering efficiency';
    } else if (itemType === ItemType.EnergyDigger) {
      name = 'Energy Digger';
      description = 'Permanently increases energy gathering efficiency';
    } else {
      name = 'Universal Digger';
      description = 'Permanently increases all gathering efficiency';
    }
    
    return {
      id: generateId(),
      type: itemType,
      name,
      description,
      rarity,
      bonusPercent: 0, // Will be calculated based on player's current count
      foundAt: { x: 0, y: 0 }, // Will be filled in by caller
      foundDate: new Date()
    };
  }
}

/**
 * Generate a random forest item (BETTER than cave items)
 * 
 * Drop rates:
 * - 50% chance for ANY item (vs 30% for caves)
 * - Of that 50%: 70% tradeable, 30% digger (more diggers than caves!)
 * - Better rarity distribution for diggers
 * 
 * @returns Item or null if no drop
 */
export function generateForestItem(): InventoryItem | null {
  // 50% chance for ANY item drop (much better than caves!)
  if (Math.random() > 0.50) {
    return null; // No item this time
  }
  
  // Determine if tradeable or digger (70/30 split - more diggers than caves!)
  const isTradeableItem = Math.random() < 0.70;
  
  if (isTradeableItem) {
    // Generate tradeable item (for future trading system)
    return {
      id: generateId(),
      type: ItemType.TradeableItem,
      name: 'Premium Tradeable Item',
      description: 'A highly valuable item that can be traded at the Boost Station',
      rarity: ItemRarity.Uncommon, // Forest items start at Uncommon rarity
      bonusPercent: 0, // No bonus for tradeable items
      foundAt: { x: 0, y: 0 }, // Will be filled in by caller
      foundDate: new Date()
    };
  } else {
    // Generate digger item (permanent boost)
    // Randomly choose between Metal, Energy, or Universal digger
    const roll = Math.random();
    let itemType: ItemType;
    
    if (roll < 0.35) {
      itemType = ItemType.MetalDigger;
    } else if (roll < 0.70) {
      itemType = ItemType.EnergyDigger;
    } else {
      itemType = ItemType.UniversalDigger; // 30% chance for universal (vs 20% in caves)
    }
    
    // BETTER rarity distribution than caves
    const rarityRoll = Math.random();
    let rarity: ItemRarity;
    
    if (rarityRoll < 0.30) {
      rarity = ItemRarity.Common; // 30% common (vs 60% in caves)
    } else if (rarityRoll < 0.65) {
      rarity = ItemRarity.Uncommon; // 35% uncommon (vs 25% in caves)
    } else if (rarityRoll < 0.85) {
      rarity = ItemRarity.Rare; // 20% rare (vs 10% in caves)
    } else if (rarityRoll < 0.97) {
      rarity = ItemRarity.Epic; // 12% epic (vs 4% in caves)
    } else {
      rarity = ItemRarity.Legendary; // 3% legendary (vs 1% in caves)
    }
    
    // Generate name based on type
    let name: string;
    let description: string;
    
    if (itemType === ItemType.MetalDigger) {
      name = 'Ancient Metal Digger';
      description = 'A rare and powerful metal gathering artifact from the old forests';
    } else if (itemType === ItemType.EnergyDigger) {
      name = 'Ancient Energy Digger';
      description = 'A rare and powerful energy gathering artifact from the old forests';
    } else {
      name = 'Ancient Universal Digger';
      description = 'A legendary gathering artifact that enhances all resource collection';
    }
    
    return {
      id: generateId(),
      type: itemType,
      name,
      description,
      rarity,
      bonusPercent: 0, // Will be calculated based on player's current count
      foundAt: { x: 0, y: 0 }, // Will be filled in by caller
      foundDate: new Date()
    };
  }
}

/**
 * Apply digger item bonus to player
 * 
 * Calculates bonus based on diminishing returns and updates player's
 * gathering bonus and digger counts
 * 
 * @param player - Player object
 * @param item - Digger item to apply
 * @returns Updated bonus amount
 */
export function applyDiggerBonus(player: Player, item: InventoryItem): number {
  let bonusAmount = 0;
  
  if (item.type === ItemType.MetalDigger) {
    bonusAmount = getDiggerBonus(player.inventory.metalDiggerCount);
    player.gatheringBonus.metalBonus += bonusAmount;
    player.inventory.metalDiggerCount += 1;
  } else if (item.type === ItemType.EnergyDigger) {
    bonusAmount = getDiggerBonus(player.inventory.energyDiggerCount);
    player.gatheringBonus.energyBonus += bonusAmount;
    player.inventory.energyDiggerCount += 1;
  } else if (item.type === ItemType.UniversalDigger) {
    // Universal diggers apply to BOTH resources
    // Use average of both counts for diminishing returns calculation
    const avgCount = Math.floor(
      (player.inventory.metalDiggerCount + player.inventory.energyDiggerCount) / 2
    );
    bonusAmount = getDiggerBonus(avgCount);
    
    player.gatheringBonus.metalBonus += bonusAmount;
    player.gatheringBonus.energyBonus += bonusAmount;
    player.inventory.metalDiggerCount += 1;
    player.inventory.energyDiggerCount += 1;
  }
  
  // Update item with actual bonus amount
  item.bonusPercent = bonusAmount;
  
  return bonusAmount;
}

/**
 * Harvest a cave tile
 * 
 * Randomly generates items with diminishing returns for diggers
 * 
 * @param playerId - Player's username
 * @param tile - Cave tile to harvest
 * @returns Cave harvest result
 */
export async function harvestCaveTile(
  playerId: string,
  tile: Tile
): Promise<CaveHarvestResult> {
  try {
    // Verify tile type
    if (tile.terrain !== TerrainType.Cave) {
      return {
        success: false,
        message: 'This is not a cave tile'
      };
    }
    
    // Check if can harvest
    const canHarvest = await canHarvestTile(playerId, tile);
    if (!canHarvest) {
      return {
        success: false,
        message: 'You have already explored this cave. It will refresh later.'
      };
    }
    
    // Get player data (drizzle — the Mongo shim returns raw rows without domain nesting)
    const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const playerRow = playerRows[0];
    if (!playerRow) {
      return {
        success: false,
        message: 'Player not found'
      };
    }
    const player = mapRowToPlayer(playerRow);
    
    // Check inventory capacity
    if (player.inventory.items.length >= player.inventory.capacity) {
      return {
        success: false,
        message: 'Your inventory is full! You cannot carry any more items.'
      };
    }
    
    // Generate item (30% chance)
    const item = generateCaveItem();
    
    if (!item) {
      // No item dropped (70% of the time)
      // Mark tile as harvested (drizzle: append record to the jsonb harvest log atomically)
      const currentPeriod = getCurrentResetPeriod(tile.x);
      
      await db.update(tiles)
        .set({
          lastHarvestedBy: sql`coalesce(${tiles.lastHarvestedBy}, '[]'::jsonb) || ${JSON.stringify([{
            playerId,
            timestamp: new Date(),
            resetPeriod: currentPeriod
          }])}::jsonb`,
        })
        .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)));
      
      return {
        success: true,
        message: getHarvestSuccessMessage(TerrainType.Cave, undefined, 'none')
      };
    }
    
    // Item dropped! Fill in location
    item.foundAt = { x: tile.x, y: tile.y };
    
    let bonusApplied = 0;
    let bonusUpdates: Partial<typeof players.$inferInsert> = {};
    
    // If it's a digger, apply bonus
    if ([ItemType.MetalDigger, ItemType.EnergyDigger, ItemType.UniversalDigger].includes(item.type)) {
      bonusApplied = applyDiggerBonus(player, item);
      
      // Update player's gathering bonus and digger counts
      bonusUpdates = {
        gatheringBonusMetalBonus: String(player.gatheringBonus.metalBonus),
        gatheringBonusEnergyBonus: String(player.gatheringBonus.energyBonus),
        inventoryMetalDiggerCount: player.inventory.metalDiggerCount,
        inventoryEnergyDiggerCount: player.inventory.energyDiggerCount,
      };
    }
    
    // Update player: append the item to the inventory jsonb + apply digger-bonus fields
    await db.update(players)
      .set({
        inventoryItems: sql`coalesce(${players.inventoryItems}, '[]'::jsonb) || ${JSON.stringify([item])}::jsonb`,
        ...bonusUpdates,
      })
      .where(eq(players.username, playerId));
    
    // Mark tile as harvested (drizzle: append record to the jsonb harvest log atomically)
    const currentPeriod = getCurrentResetPeriod(tile.x);
    
    await db.update(tiles)
      .set({
        lastHarvestedBy: sql`coalesce(${tiles.lastHarvestedBy}, '[]'::jsonb) || ${JSON.stringify([{
          playerId,
          timestamp: new Date(),
          resetPeriod: currentPeriod
        }])}::jsonb`,
      })
      .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)));
    
    // Get updated player (domain-mapped)
    const updatedRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const updatedPlayer = updatedRows[0] ? mapRowToPlayer(updatedRows[0]) : null;
    
    // Generate success message
    let message = '';
    if (item.type === ItemType.TradeableItem) {
      message = getHarvestSuccessMessage(TerrainType.Cave, undefined, 'tradeable');
    } else {
      const baseMessage = getHarvestSuccessMessage(TerrainType.Cave, undefined, 'digger');
      const itemName = item.type === ItemType.UniversalDigger 
        ? 'Universal Digger' 
        : item.type === ItemType.MetalDigger 
          ? 'Metal Digger' 
          : 'Energy Digger';
      message = `${baseMessage}\n${itemName} (+${bonusApplied.toFixed(2)}%)`;
    }
    
    console.log(`✅ Player ${playerId} found ${item.type} at cave (${tile.x}, ${tile.y})`);
    
    return {
      success: true,
      message,
      item,
      bonusApplied,
      updatedPlayer: updatedPlayer || undefined
    };
    
  } catch (error) {
    console.error('❌ Error harvesting cave tile:', error);
    return {
      success: false,
      message: 'An error occurred while exploring the cave'
    };
  }
}

/**
 * Harvest a forest tile (BETTER rewards than caves!)
 * 
 * Randomly generates items with better drop rates and quality than caves
 * 
 * @param playerId - Player's username
 * @param tile - Forest tile to harvest
 * @returns Cave harvest result (same structure as cave)
 */
export async function harvestForestTile(
  playerId: string,
  tile: Tile
): Promise<CaveHarvestResult> {
  try {
    // Verify tile type
    if (tile.terrain !== TerrainType.Forest) {
      return {
        success: false,
        message: 'This is not a forest tile'
      };
    }
    
    // Check if can harvest
    const canHarvest = await canHarvestTile(playerId, tile);
    if (!canHarvest) {
      return {
        success: false,
        message: 'You have already explored this forest. It will refresh later.'
      };
    }
    
    // Get player data (drizzle — the Mongo shim returns raw rows without domain nesting)
    const playerRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const playerRow = playerRows[0];
    if (!playerRow) {
      return {
        success: false,
        message: 'Player not found'
      };
    }
    const player = mapRowToPlayer(playerRow);
    
    // Check inventory capacity
    if (player.inventory.items.length >= player.inventory.capacity) {
      return {
        success: false,
        message: 'Your inventory is full! You cannot carry any more items.'
      };
    }
    
    // Generate item (50% chance - much better than caves!)
    const item = generateForestItem();
    
    if (!item) {
      // No item dropped (50% of the time, better than caves at 70%)
      // Mark tile as harvested (drizzle: append record to the jsonb harvest log atomically)
      const currentPeriod = getCurrentResetPeriod(tile.x);
      
      await db.update(tiles)
        .set({
          lastHarvestedBy: sql`coalesce(${tiles.lastHarvestedBy}, '[]'::jsonb) || ${JSON.stringify([{
            playerId,
            timestamp: new Date(),
            resetPeriod: currentPeriod
          }])}::jsonb`,
        })
        .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)));
      
      return {
        success: true,
        message: '🌲 You explored the ancient forest but found nothing this time. The dense foliage whispers of hidden treasures...'
      };
    }
    
    // Item dropped! Fill in location
    item.foundAt = { x: tile.x, y: tile.y };
    
    let bonusApplied = 0;
    let bonusUpdates: Partial<typeof players.$inferInsert> = {};
    
    // If it's a digger, apply bonus
    if ([ItemType.MetalDigger, ItemType.EnergyDigger, ItemType.UniversalDigger].includes(item.type)) {
      bonusApplied = applyDiggerBonus(player, item);
      
      // Update player's gathering bonus and digger counts
      bonusUpdates = {
        gatheringBonusMetalBonus: String(player.gatheringBonus.metalBonus),
        gatheringBonusEnergyBonus: String(player.gatheringBonus.energyBonus),
        inventoryMetalDiggerCount: player.inventory.metalDiggerCount,
        inventoryEnergyDiggerCount: player.inventory.energyDiggerCount,
      };
    }
    
    // Update player: append the item to the inventory jsonb + apply digger-bonus fields
    await db.update(players)
      .set({
        inventoryItems: sql`coalesce(${players.inventoryItems}, '[]'::jsonb) || ${JSON.stringify([item])}::jsonb`,
        ...bonusUpdates,
      })
      .where(eq(players.username, playerId));
    
    // Mark tile as harvested (drizzle: append record to the jsonb harvest log atomically)
    const currentPeriod = getCurrentResetPeriod(tile.x);
    
    await db.update(tiles)
      .set({
        lastHarvestedBy: sql`coalesce(${tiles.lastHarvestedBy}, '[]'::jsonb) || ${JSON.stringify([{
          playerId,
          timestamp: new Date(),
          resetPeriod: currentPeriod
        }])}::jsonb`,
      })
      .where(and(eq(tiles.x, tile.x), eq(tiles.y, tile.y)));
    
    // Get updated player (domain-mapped)
    const updatedRows = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const updatedPlayer = updatedRows[0] ? mapRowToPlayer(updatedRows[0]) : null;
    
    // Generate success message
    let message = '';
    if (item.type === ItemType.TradeableItem) {
      message = '🌲✨ You discovered a premium item in the ancient forest! This rare artifact will fetch a high price.';
    } else {
      const itemName = item.type === ItemType.UniversalDigger 
        ? 'Ancient Universal Digger' 
        : item.type === ItemType.MetalDigger 
          ? 'Ancient Metal Digger' 
          : 'Ancient Energy Digger';
      message = `🌲🎉 FOREST TREASURE! You found an ${itemName}!\nGathering Bonus: +${bonusApplied.toFixed(2)}%\nRarity: ${item.rarity}`;
    }
    
    console.log(`✅ Player ${playerId} found ${item.type} at forest (${tile.x}, ${tile.y})`);
    
    return {
      success: true,
      message,
      item,
      bonusApplied,
      updatedPlayer: updatedPlayer || undefined
    };
    
  } catch (error) {
    console.error('❌ Error harvesting forest tile:', error);
    return {
      success: false,
      message: 'An error occurred while exploring the forest'
    };
  }
}

/**
 * Create guaranteed tutorial Universal Digger
 * 
 * TUTORIAL-ONLY: Creates a fixed 5% Universal Digger for tutorial reward
 * This bypasses RNG and diminishing returns to ensure new players get the exact
 * boost promised in the tutorial.
 * 
 * @returns Tutorial Universal Digger with fixed 5% bonus
 */
export function createTutorialDigger(): InventoryItem {
  return {
    id: generateId(),
    type: ItemType.UniversalDigger,
    name: 'Tutorial Universal Digger',
    description: 'A special training digger that permanently increases all gathering efficiency by 5%',
    rarity: ItemRarity.Rare,
    bonusPercent: 5.0, // Fixed 5% bonus (not subject to diminishing returns)
    foundAt: { x: 0, y: 0 }, // Tutorial location
    foundDate: new Date()
  };
}

/**
 * Award tutorial digger to player with full database updates
 * 
 * TUTORIAL-ONLY: Awards guaranteed 5% Universal Digger during tutorial
 * Updates ALL related fields:
 * - Adds digger to player.inventory.items
 * - Increments player.inventory.metalDiggerCount
 * - Increments player.inventory.energyDiggerCount
 * - Adds 5% to player.gatheringBonus.metalBonus
 * - Adds 5% to player.gatheringBonus.energyBonus
 * 
 * @param username - Player username (not _id)
 * @returns Result with success status, message, and digger item
 */
export async function awardTutorialDiggerToPlayer(
  username: string
): Promise<{ success: boolean; message: string; digger?: InventoryItem }> {
  try {
    // Get player (drizzle — domain-mapped row)
    const playerRows = await db.select().from(players).where(eq(players.username, username)).limit(1);
    const playerRow = playerRows[0];
    if (!playerRow) {
      return { 
        success: false, 
        message: 'Player not found' 
      };
    }
    const player = mapRowToPlayer(playerRow);
    
    // Check inventory capacity
    if (player.inventory.items.length >= player.inventory.capacity) {
      return {
        success: false,
        message: 'Inventory is full! Cannot receive tutorial digger.'
      };
    }
    
    // Create tutorial digger with fixed 5% bonus
    const digger = createTutorialDigger();
    
    // Update player with ALL digger-related fields
    await db.update(players)
      .set({
        inventoryItems: sql`coalesce(${players.inventoryItems}, '[]'::jsonb) || ${JSON.stringify([digger])}::jsonb`,
        // Universal digger increments BOTH counts
        inventoryMetalDiggerCount: sql`coalesce(${players.inventoryMetalDiggerCount}, 0) + 1`,
        inventoryEnergyDiggerCount: sql`coalesce(${players.inventoryEnergyDiggerCount}, 0) + 1`,
        // Add 5% to BOTH bonuses
        gatheringBonusMetalBonus: sql`coalesce(${players.gatheringBonusMetalBonus}, '0') + 5.0`,
        gatheringBonusEnergyBonus: sql`coalesce(${players.gatheringBonusEnergyBonus}, '0') + 5.0`,
      })
      .where(eq(players.username, username));
    
    console.log(`🎓 Tutorial digger awarded to ${username}: +5% metal & energy gathering`);
    
    return {
      success: true,
      message: 'Tutorial Universal Digger awarded! Your gathering efficiency increased by 5%!',
      digger
    };
    
  } catch (error) {
    console.error('❌ Error awarding tutorial digger:', error);
    return {
      success: false,
      message: 'An error occurred while awarding the tutorial digger'
    };
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Implements Option 4 diminishing returns system
// - First 10 diggers: +2% each = +20% total
// - After 150+ diggers: +0.1% each (soft cap)
// - Tradeable items have no bonus (used for trading system)
// - Universal diggers boost BOTH metal and energy
// - Inventory capacity enforced (default 2000 items)
// - Cave tiles follow same reset system as resource tiles
// - Tutorial digger: Fixed 5% bonus, not subject to diminishing returns
// ============================================================
// END OF FILE
// ============================================================
