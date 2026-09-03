/**
 * @file app/api/harvest/route.ts
 * @created 2025-10-16
 * @modified 2025-10-24 - Phase 2: Production infrastructure - validation, errors, rate limiting
 * @overview Harvest API endpoint for resource and cave tiles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { harvestResourceTile, getHarvestStatus } from '@/lib/harvestService';
import { harvestCaveTile, harvestForestTile } from '@/lib/caveItemService';
import { Player, Tile, TerrainType } from '@/types';
import { awardXP, XPAction } from '@/lib/xpService';
import { checkDiscoveryDrop } from '@/lib/discoveryService';
import { trackResourcesGathered, trackCaveExplored } from '@/lib/statTrackingService';
import { logHarvest, logCaveExplore } from '@/lib/activityLogger';
import { updateSession } from '@/lib/sessionTracker';
import { detectResourceHack, detectCooldownViolation } from '@/lib/antiCheatDetector';
import { 
  withRequestLogging, 
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  HarvestSchema,
  createErrorResponse,
  createErrorFromException,
  createValidationErrorResponse,
  ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.harvest);

/**
 * POST /api/harvest
 * 
 * Harvest the tile at player's current position
 * 
 * Request body:
 * {
 *   username: string
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   metalGained?: number,
 *   energyGained?: number,
 *   item?: InventoryItem,
 *   player: Player,
 *   tile: Tile,
 *   harvestStatus: {
 *     canHarvest: boolean,
 *     timeUntilReset: number,
 *     resetPeriod: string
 *   }
 * }
 */
export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('HarvestAPI');
  const endTimer = log.time('harvestOperation');
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const validated = HarvestSchema.parse(body);
    const { username } = validated;
    
    log.debug('Processing harvest request', { username });
    
    // Get player
    const playersCollection = await getCollection<Player>('players');
    const player = await playersCollection.findOne({ username });
    
    if (!player) {
      log.warn('Player not found', { username });
      return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED);
    }
    
    // Get tile at player's current position
    const tilesCollection = await getCollection<Tile>('tiles');
    const tile = await tilesCollection.findOne({
      x: player.currentPosition.x,
      y: player.currentPosition.y
    });
    
    if (!tile) {
      log.warn('Tile not found', { position: player.currentPosition });
      return createErrorResponse(ErrorCode.INTERNAL_ERROR);
    }
    
    // Check tile type and harvest accordingly
    let result;
    
    if (tile.terrain === TerrainType.Metal || tile.terrain === TerrainType.Energy) {
      // Harvest resource tile
      result = await harvestResourceTile(username, tile);
    } else if (tile.terrain === TerrainType.Cave) {
      // Harvest cave tile
      result = await harvestCaveTile(username, tile);
    } else if (tile.terrain === TerrainType.Forest) {
      // Harvest forest tile (BETTER loot than caves!)
      result = await harvestForestTile(username, tile);
    } else {
      log.warn('Cannot harvest tile', { terrain: tile.terrain, position: { x: tile.x, y: tile.y } });
      return createErrorResponse(ErrorCode.HARVEST_INVALID_TILE, { terrain: tile.terrain });
    }
    
    // Get updated harvest status
    const harvestStatus = await getHarvestStatus(username, tile);
    
    // Check for discovery drop on cave harvests
    let discoveryResult;
    if (result.success && (tile.terrain === TerrainType.Cave || tile.terrain === TerrainType.Forest)) {
      discoveryResult = await checkDiscoveryDrop(username, { x: tile.x, y: tile.y });
    }
    
    // Award XP for successful harvest
    let xpResult;
    if (result.success) {
      // Track resources gathered for achievements
      if ('metalGained' in result || 'energyGained' in result) {
        const totalGained = (result.metalGained || 0) + (result.energyGained || 0);
        await trackResourcesGathered(username, totalGained);
      }
      
      // Track cave exploration for achievements
      if (tile.terrain === TerrainType.Cave || tile.terrain === TerrainType.Forest) {
        await trackCaveExplored(username);
      }
      
      // Log activity for admin tracking
      const sessionId = request.cookies.get('sessionId')?.value || 'unknown';
      
      if (tile.terrain === TerrainType.Cave || tile.terrain === TerrainType.Forest) {
        // Log cave/forest exploration
        await logCaveExplore(
          username,
          sessionId,
          { x: tile.x, y: tile.y },
          'item' in result && result.item ? [result.item.name] : []
        );
      } else if ('metalGained' in result || 'energyGained' in result) {
        // Log resource harvest (only for resource tiles)
        const harvestDuration = 5; // Default cooldown
        const metalGained = 'metalGained' in result ? result.metalGained : 0;
        const energyGained = 'energyGained' in result ? result.energyGained : 0;
        
        await logHarvest(
          username,
          sessionId,
          {
            metal: metalGained || 0,
            energy: energyGained || 0
          },
          { x: tile.x, y: tile.y },
          harvestDuration
        );
        
        // Update session with resources gained
        await updateSession(sessionId, {
          metal: metalGained || 0,
          energy: energyGained || 0
        });
        
        // Anti-cheat: Check for resource hacking
        const totalGained = (metalGained || 0) + (energyGained || 0);
        if (totalGained > 0) {
          const resourceCheck = await detectResourceHack(
            username,
            (metalGained || 0) > (energyGained || 0) ? 'metal' : 'energy',
            totalGained,
            (player as any).tier || 1
          );
          
          if (resourceCheck.suspicious) {
            console.warn(`⚠️ Resource hack detected for ${username}:`, resourceCheck.evidence);
          }
        }
        
        // Anti-cheat: Check for cooldown violations
        const cooldownCheck = await detectCooldownViolation(
          username,
          'harvest',
          Date.now()
        );
        
        if (cooldownCheck.suspicious) {
          console.warn(`⚠️ Cooldown violation detected for ${username}:`, cooldownCheck.evidence);
        }
      }
      
      if (tile.terrain === TerrainType.Cave) {
        // Cave exploration XP
        xpResult = await awardXP(username, XPAction.CAVE_EXPLORATION);
        
        // Bonus XP if rare/legendary item found
        if ('item' in result && result.item) {
          const itemRarity = result.item.rarity;
          if (itemRarity === 'LEGENDARY') {
            await awardXP(username, XPAction.CAVE_ITEM_LEGENDARY);
          } else if (itemRarity === 'RARE') {
            await awardXP(username, XPAction.CAVE_ITEM_RARE);
          }
        }
      } else {
        // Resource harvesting XP
        xpResult = await awardXP(username, XPAction.HARVEST_RESOURCE);
      }
    }
    
    // Get updated player data (includes new XP/level and discoveries)
    const updatedPlayer = await playersCollection.findOne({ username });
    
    const resultSummary = {
      success: result.success,
      metalGained: 'metalGained' in result ? result.metalGained : undefined,
      energyGained: 'energyGained' in result ? result.energyGained : undefined,
      itemFound: 'item' in result ? result.item?.name : undefined,
    };
    log.info('Harvest completed', { username, ...resultSummary });
    
    // Return harvest results WITHOUT player data to prevent auto-refresh
    // Player can manually refresh if needed, but page should stay as-is
    return NextResponse.json({
      success: result.success,
      message: result.message,
      metalGained: 'metalGained' in result ? result.metalGained : undefined,
      energyGained: 'energyGained' in result ? result.energyGained : undefined,
      item: 'item' in result ? result.item : undefined,
      bonusApplied: 'bonusApplied' in result ? result.bonusApplied : undefined,
      xpAwarded: xpResult?.xpAwarded,
      levelUp: xpResult?.levelUp,
      newLevel: xpResult?.newLevel,
      discovery: discoveryResult?.isNew ? discoveryResult.discovery : undefined,
      totalDiscoveries: discoveryResult?.totalDiscoveries,
      // DO NOT return player or tile - prevents auto-refresh
      harvestStatus
    });
    
  } catch (error) {
    log.error('Harvest API error', error as Error);
    
    // Handle validation errors
    if (error instanceof ZodError) {
      return createValidationErrorResponse(error);
    }
    
    // Handle all other errors
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Unified endpoint for metal, energy, and cave harvesting
// - Returns updated player data and harvest status
// - Validates player position and tile type
// - Handles errors gracefully with detailed messages
// ============================================================
// END OF FILE
// ============================================================
