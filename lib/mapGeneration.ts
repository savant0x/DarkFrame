/**
 * @file lib/mapGeneration.ts
 * @created 2025-10-16
 * @overview Map generation logic with exact terrain distribution
 * 
 * OVERVIEW:
 * Generates a static 150×150 tile map with precise terrain distribution.
 * Uses Fisher-Yates shuffle to ensure exact counts for each terrain type.
 * Idempotent: safe to run multiple times without duplicating data.
 *
 * Distribution (random pool, exact counts):
 * - Metal: 4,500 · Energy: 4,500 · Cave: 1,800 · Forest: 450 · Factory: 2,250 · Wasteland: 8,994
 * Six coordinates are reserved for fixed special tiles (1 Shrine + 4 Banks + 1 Auction
 * House), and the same six wasteland slots are removed from the pool so every random
 * terrain keeps its exact count regardless of shuffle order.
 */

import { getCollection } from './mongodb';
import { db } from '@/lib/db';
import { tiles } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { Tile, TerrainType, GAME_CONSTANTS } from '@/types';

/**
 * Fisher-Yates shuffle algorithm for array randomization
 * 
 * @param array - Array to shuffle in-place
 * @returns The shuffled array
 * 
 * @example
 * ```typescript
 * const arr = [1, 2, 3, 4, 5];
 * shuffle(arr);
 * // arr is now randomly shuffled
 * ```
 */
function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Fixed special tiles that replace random map cells.
 * (1 Shrine + 4 Banks + 1 Auction House = 6 of the 22,500 coordinates.)
 */
const FIXED_TILE_COUNT = 6;

/**
 * Generate the random terrain pool with exact distribution.
 *
 * Creates one terrain value per non-fixed coordinate: TERRAIN_COUNTS totals minus
 * six wasteland slots (the cells the fixed special tiles occupy). Removing only
 * wasteland keeps every harvestable terrain (metal/energy/cave/forest/factory) at
 * its exact configured count regardless of where the fixed tiles land.
 *
 * @returns Shuffled terrain array of length TOTAL_TILES - FIXED_TILE_COUNT
 */
function generateTerrainPool(): TerrainType[] {
  const terrains: TerrainType[] = [];

  // Add exact count for each terrain type
  for (const [terrain, count] of Object.entries(GAME_CONSTANTS.TERRAIN_COUNTS)) {
    for (let i = 0; i < count; i++) {
      terrains.push(terrain as TerrainType);
    }
  }

  // Verify configured counts sum to the full map size
  if (terrains.length !== GAME_CONSTANTS.TOTAL_TILES) {
    throw new Error(
      `Terrain array length mismatch: expected ${GAME_CONSTANTS.TOTAL_TILES}, got ${terrains.length}`
    );
  }

  // Shuffle, then drop exactly FIXED_TILE_COUNT wasteland slots (any positions)
  const shuffled = shuffle(terrains);
  const pool: TerrainType[] = [];
  let removed = 0;
  for (const terrain of shuffled) {
    if (terrain === TerrainType.Wasteland && removed < FIXED_TILE_COUNT) {
      removed++;
      continue;
    }
    pool.push(terrain);
  }
  if (pool.length !== GAME_CONSTANTS.TOTAL_TILES - FIXED_TILE_COUNT) {
    throw new Error(
      `Terrain pool length mismatch: expected ${GAME_CONSTANTS.TOTAL_TILES - FIXED_TILE_COUNT}, got ${pool.length}`
    );
  }
  return pool;
}

/**
 * Fixed locations for Phase 3+ special tiles
 */
const FIXED_LOCATIONS = {
  SHRINE: { x: 1, y: 1 },
  BANKS: [
    { x: 25, y: 25, type: 'metal' as const },
    { x: 75, y: 75, type: 'energy' as const },
    { x: 50, y: 50, type: 'exchange' as const },
    { x: 100, y: 100, type: 'exchange' as const }
  ],
  AUCTION_HOUSE: { x: 10, y: 10 }
};

/**
 * Check if coordinate is a fixed special location
 */
function isFixedLocation(x: number, y: number): { 
  type: 'shrine' | 'bank' | 'auction' | null; 
  bankType?: 'metal' | 'energy' | 'exchange' 
} {
  // Check shrine
  if (x === FIXED_LOCATIONS.SHRINE.x && y === FIXED_LOCATIONS.SHRINE.y) {
    return { type: 'shrine' };
  }
  
  // Check banks
  const bank = FIXED_LOCATIONS.BANKS.find((b) => b.x === x && b.y === y);
  if (bank) {
    return { type: 'bank', bankType: bank.type };
  }
  
  // Check auction house
  if (x === FIXED_LOCATIONS.AUCTION_HOUSE.x && y === FIXED_LOCATIONS.AUCTION_HOUSE.y) {
    return { type: 'auction' };
  }
  
  return { type: null };
}

/**
 * Generate all tiles for the 150×150 map
 * 
 * Creates tiles with coordinates (1,1) to (150,150) with randomized terrain distribution
 * Special fixed locations (Phase 3+):
 * - Shrine at (1,1)
 * - Metal Bank at (25,25)
 * - Energy Bank at (75,75)
 * - Exchange Banks at (50,50) and (100,100)
 * - Auction House at (10,10)
 * 
 * Note: Beer Bases spawn dynamically at random bot locations (not fixed map tiles)
 * 
 * @returns Array of 22,500 tile objects
 */
function generateTiles(): Tile[] {
  const pool = generateTerrainPool();
  const tiles: Tile[] = [];

  let poolIndex = 0;

  // Generate tiles for each coordinate
  for (let y = 1; y <= GAME_CONSTANTS.MAP_HEIGHT; y++) {
    for (let x = 1; x <= GAME_CONSTANTS.MAP_WIDTH; x++) {
      const fixedLoc = isFixedLocation(x, y);

      if (fixedLoc.type === 'shrine') {
        // Shrine of Remembrance at (1,1) — fixed, does not consume the pool
        tiles.push({ x, y, terrain: TerrainType.Shrine });
      } else if (fixedLoc.type === 'bank') {
        // Bank at fixed location — fixed, does not consume the pool
        tiles.push({ x, y, terrain: TerrainType.Bank, bankType: fixedLoc.bankType });
      } else if (fixedLoc.type === 'auction') {
        // Auction House at (10,10) — fixed, does not consume the pool
        tiles.push({ x, y, terrain: TerrainType.AuctionHouse });
      } else {
        // Regular terrain from the randomized pool
        tiles.push({ x, y, terrain: pool[poolIndex] });
        poolIndex++;
      }
    }
  }

  if (poolIndex !== pool.length) {
    throw new Error(`Terrain pool under-consumed: used ${poolIndex} of ${pool.length}`);
  }

  return tiles;
}

/**
 * Check if map already exists in database
 * 
 * @returns Promise that resolves to true if map exists, false otherwise
 */
export async function mapExists(): Promise<boolean> {
  try {
    const tilesCollection = await getCollection<Tile>('tiles');
    const count = await tilesCollection.countDocuments();
    
    console.log(`📊 Current tile count in database: ${count}`);
    
    return count === GAME_CONSTANTS.TOTAL_TILES;
  } catch (error) {
    console.error('❌ Error checking map existence:', error);
    return false;
  }
}

/**
 * Create indexes for tiles collection
 * Ensures efficient queries and prevents duplicate coordinates
 * 
 * @returns Promise that resolves when indexes are created
 */
export async function createTileIndexes(): Promise<void> {
  try {
    const tilesCollection = await getCollection<Tile>('tiles');
    
    // Create unique compound index on (x, y) coordinates
    await tilesCollection.createIndex(
      { x: 1, y: 1 },
      { unique: true, name: 'coordinate_index' }
    );
    
    // Create index on terrain type for efficient filtering
    await tilesCollection.createIndex(
      { terrain: 1 },
      { name: 'terrain_index' }
    );
    
    // Create index on occupiedByBase for spawn queries
    await tilesCollection.createIndex(
      { occupiedByBase: 1, terrain: 1 },
      { name: 'spawn_index' }
    );
    
    console.log('✅ Tile indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating tile indexes:', error);
    throw error;
  }
}

/**
 * Initialize the game map (idempotent)
 * 
 * Generates and stores 22,500 tiles if they don't already exist.
 * Safe to run multiple times - will skip generation if map already exists.
 * 
 * @returns Promise that resolves when initialization is complete
 * 
 * @example
 * ```typescript
 * await initializeMap();
 * console.log('Map ready!');
 * ```
 */
export async function initializeMap(): Promise<void> {
  console.log('🗺️  Initializing map...');
  
  try {
    // Check if map already exists
    const exists = await mapExists();
    
    if (exists) {
      console.log('✅ Map already exists, skipping generation');
      return;
    }
    
    console.log('🔨 Generating new map...');
    
    // Generate all tiles
    const tiles = generateTiles();
    
    console.log(`📦 Generated ${tiles.length} tiles`);
    
    // Insert tiles into database
    const tilesCollection = await getCollection<Tile>('tiles');
    
    // Use ordered: false to continue on duplicate key errors (shouldn't happen, but safety measure)
    await tilesCollection.insertMany(tiles, { ordered: false });
    
    console.log('✅ Tiles inserted successfully');
    
    // Create indexes
    await createTileIndexes();
    
    // Verify final count
    const finalCount = await tilesCollection.countDocuments();
    console.log(`✅ Map initialization complete! Total tiles: ${finalCount}`);
    
    // Verify terrain distribution
    const distribution = await fetchDistribution();
    console.log('📊 Terrain distribution:');
    for (const [terrain, count] of Object.entries(distribution)) {
      const expected = expectedTerrainCount(terrain as TerrainType);
      const match = count === expected ? '✅' : '❌';
      console.log(`  ${match} ${terrain}: ${count} (expected: ${expected})`);
    }
    
  } catch (error) {
    console.error('❌ Error initializing map:', error);
    throw error;
  }
}

/**
 * Expected count of a terrain type after generation.
 * Random types keep their exact TERRAIN_COUNTS value except Wasteland, which
 * gives up six slots to the fixed special tiles; Bank/Shrine/AuctionHouse are
 * the fixed tiles themselves.
 */
function expectedTerrainCount(terrain: TerrainType): number {
  if (terrain === TerrainType.Bank) return 4;
  if (terrain === TerrainType.Shrine || terrain === TerrainType.AuctionHouse) return 1;
  const configured = GAME_CONSTANTS.TERRAIN_COUNTS[terrain as keyof typeof GAME_CONSTANTS.TERRAIN_COUNTS];
  if (configured === undefined) return 0;
  return terrain === TerrainType.Wasteland ? configured - FIXED_TILE_COUNT : configured;
}

/**
 * Terrain counts by type, read straight from the database (GROUP BY terrain).
 */
async function fetchDistribution(): Promise<Record<string, number>> {
  const rows = await db
    .select({ terrain: tiles.terrain, count: sql<number>`count(*)::int` })
    .from(tiles)
    .groupBy(tiles.terrain);
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.terrain] = row.count;
  }
  return result;
}

/**
 * Get terrain distribution statistics from database
 * 
 * @returns Promise that resolves to terrain count distribution
 */
export async function getTerrainDistribution(): Promise<Record<TerrainType, number>> {
  try {
    return (await fetchDistribution()) as Record<TerrainType, number>;
  } catch (error) {
    console.error('❌ Error getting terrain distribution:', error);
    throw error;
  }
}

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Fisher-Yates shuffle ensures truly random distribution
// - Pre-allocated array guarantees exact terrain counts
// - Idempotent design prevents duplicate data
// - Bulk insert operation for efficiency
// - Compound unique index prevents coordinate conflicts
// - Additional indexes optimize spawn and query operations
// - Comprehensive logging for debugging and verification
// ============================================================
// END OF FILE
// ============================================================
