/**
 * @file app/api/harvest/route.ts
 * @overview Harvest API endpoint — Supabase backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { harvestResourceTile, getHarvestStatus } from '@/lib/harvestService';
import { harvestCaveTile, harvestForestTile } from '@/lib/caveItemService';
import type { Tables } from '@/types/database';
import { ItemRarity, TerrainType } from '@/types';
import { awardXP, XPAction } from '@/lib/xpService';
import { checkDiscoveryDrop } from '@/lib/discoveryService';
import { trackResourcesGathered, trackCaveExplored } from '@/lib/statTrackingService';
import { logHarvest, logCaveExplore } from '@/lib/activityLogger';
import { updateSession } from '@/lib/sessionTracker';
import { detectResourceHack, detectCooldownViolation } from '@/lib/antiCheatDetector';
import {
  withRequestLogging, createRouteLogger, createRateLimiter, ENDPOINT_RATE_LIMITS,
  HarvestSchema, createErrorResponse, createErrorFromException, createValidationErrorResponse, ErrorCode
} from '@/lib';
import { ZodError } from 'zod';

interface TileServiceData { x: number; y: number; terrain: TerrainType; occupied_by_base: boolean | null; }
interface ResourceResult { success: boolean; message: string; metalGained?: number; energyGained?: number; bonusApplied?: number; }
interface CaveResult { success: boolean; message: string; item?: { name: string; rarity: ItemRarity }; bonusApplied?: number; }
type HarvestResult = ResourceResult | CaveResult;

type PlayerRow = Tables<'players'>;
type TileRow = Tables<'tiles'>;

function isResourceResult(r: HarvestResult): r is ResourceResult { return 'metalGained' in r || 'energyGained' in r; }
function isCaveResult(r: HarvestResult): r is CaveResult { return 'item' in r; }

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.harvest);

export const POST = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('HarvestAPI');
  const endTimer = log.time('harvestOperation');

  try {
    const body = await request.json();
    const validated = HarvestSchema.parse(body);
    const { username } = validated;
    log.debug('Processing harvest request', { username });

    const supabase = createServiceClient();
    const { data: player } = await supabase.from('players').select('*').eq('username', username).maybeSingle();
    if (!player) { log.warn('Player not found', { username }); return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED); }

    const { data: tile } = await supabase.from('tiles').select('*').eq('x', player.current_x).eq('y', player.current_y).maybeSingle();
    if (!tile) { log.warn('Tile not found'); return createErrorResponse(ErrorCode.INTERNAL_ERROR); }

    const tileForService: TileServiceData = { x: tile.x, y: tile.y, terrain: tile.terrain as unknown as TerrainType, occupied_by_base: tile.occupied_by_base };
    let result: HarvestResult;

    if (tile.terrain === 'Metal' || tile.terrain === 'Energy') {
      result = await harvestResourceTile(username, tileForService);
    } else if (tile.terrain === 'Cave') {
      result = await harvestCaveTile(username, tileForService);
    } else if (tile.terrain === 'Forest') {
      result = await harvestForestTile(username, tileForService);
    } else {
      log.warn('Cannot harvest tile', { terrain: tile.terrain });
      return createErrorResponse(ErrorCode.HARVEST_INVALID_TILE, { terrain: tile.terrain });
    }

    const harvestStatus = await getHarvestStatus(username, tileForService);

    let discoveryResult;
    if (result.success && (tile.terrain === 'Cave' || tile.terrain === 'Forest')) {
      discoveryResult = await checkDiscoveryDrop(username, { x: tile.x, y: tile.y });
    }

    let xpResult;
    if (result.success) {
      // Record harvest for tile cooldown (AM/PM based on X coordinate)
      const resetPeriod = tile.x >= 1 && tile.x <= 75 ? 'AM' : 'PM';
      try {
        await supabase.from('tile_harvest_records').insert({
          tile_x: tile.x,
          tile_y: tile.y,
          player_id: username,
          reset_period: resetPeriod,
        });
      } catch (err) {
        log.error('Failed to record tile harvest', err instanceof Error ? err : new Error(String(err)));
      }

      if (isResourceResult(result)) {
        const totalGained = (result.metalGained || 0) + (result.energyGained || 0);
        await trackResourcesGathered(username, totalGained);
      }
      if (tile.terrain === 'Cave' || tile.terrain === 'Forest') {
        await trackCaveExplored(username);
      }

      const sessionId = request.cookies.get('sessionId')?.value || 'unknown';

      if (tile.terrain === 'Cave' || tile.terrain === 'Forest') {
        const itemNames = isCaveResult(result) && result.item ? [result.item.name] : [];
        await logCaveExplore(username, sessionId, { x: tile.x, y: tile.y }, itemNames);
      } else if (isResourceResult(result)) {
        const harvestDuration = 5;
        const metalGained = result.metalGained || 0;
        const energyGained = result.energyGained || 0;
        await logHarvest(username, sessionId, { metal: metalGained, energy: energyGained }, { x: tile.x, y: tile.y }, harvestDuration);
        await updateSession(sessionId, { metal: metalGained, energy: energyGained });
        const totalGained = metalGained + energyGained;
        if (totalGained > 0) {
          const resourceCheck = await detectResourceHack(username, metalGained > energyGained ? 'metal' : 'energy', totalGained, player.level || 1);
          if (resourceCheck.suspicious) console.warn(`Resource hack detected for ${username}`);
        }
        const cooldownCheck = await detectCooldownViolation(username, 'harvest', Date.now());
        if (cooldownCheck.suspicious) console.warn(`Cooldown violation detected for ${username}`);
      }

      if (tile.terrain === 'Cave') {
        xpResult = await awardXP(username, XPAction.CAVE_EXPLORATION);
        if (isCaveResult(result) && result.item) {
          const rarity = result.item.rarity;
          if (rarity === ItemRarity.Legendary) await awardXP(username, XPAction.CAVE_ITEM_LEGENDARY);
          else if (rarity === ItemRarity.Rare) await awardXP(username, XPAction.CAVE_ITEM_RARE);
        }
      } else {
        xpResult = await awardXP(username, XPAction.HARVEST_RESOURCE);
      }
    }

    const { data: updatedPlayer } = await supabase.from('players').select('resources_metal, resources_energy').eq('username', username).single();

    return NextResponse.json({
      success: result.success, message: result.message,
      metalGained: isResourceResult(result) ? result.metalGained : undefined,
      energyGained: isResourceResult(result) ? result.energyGained : undefined,
      item: isCaveResult(result) ? result.item : undefined,
      bonusApplied: result.bonusApplied,
      xpAwarded: xpResult?.xpAwarded, levelUp: xpResult?.levelUp, newLevel: xpResult?.newLevel,
      discovery: discoveryResult?.isNew ? discoveryResult.discovery : undefined,
      totalDiscoveries: discoveryResult?.totalDiscoveries, harvestStatus,
      player: { resources: { metal: updatedPlayer?.resources_metal || 0, energy: updatedPlayer?.resources_energy || 0 } },
      tile: { x: tile.x, y: tile.y, terrain: tile.terrain },
    });
  } catch (error) {
    log.error('Harvest API error', error as Error);
    if (error instanceof ZodError) return createValidationErrorResponse(error);
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally { endTimer(); }
}));
