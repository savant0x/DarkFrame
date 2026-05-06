/**
 * Leaderboard API Endpoint
 * Created: 2025-10-17
 * Updated: 2026-05-03 — Migrated from MongoDB to Supabase
 * 
 * OVERVIEW:
 * RESTful API endpoint for player rankings and leaderboard data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';
import { createServiceClient } from '@/lib/supabase/server';
import {
  getTopPlayers,
  getPlayerRank,
  getTotalPlayerCount,
  getPlayerRankData,
  RankedPlayer
} from '@/lib/rankingService';
import { getCacheOrFetch, getCache, setCache } from '@/lib/cacheService';
import { LeaderboardKeys, PlayerKeys, CacheTTL } from '@/lib/cacheKeys';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.leaderboard);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('leaderboard-get');
  const endTimer = log.time('leaderboard-get');
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const username = auth.playerId;
    const { searchParams } = request.nextUrl;
    const limitParam = searchParams.get('limit');
    let limit = 100;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json({ error: 'Invalid limit parameter. Must be a positive integer.' }, { status: 400 });
      }
      limit = Math.min(parsedLimit, 500);
    }
    
    const topPlayers = await getCacheOrFetch(
      LeaderboardKeys.playerLevel(),
      () => getTopPlayers(limit),
      CacheTTL.LEADERBOARD
    );
    
    const totalPlayers = await getCacheOrFetch(
      'leaderboard:totalPlayers',
      () => getTotalPlayerCount(),
      CacheTTL.LEADERBOARD
    );
    
    let currentPlayerRank: number | null = null;
    let currentPlayerData: RankedPlayer | null = null;
    
    if (username) {
      const playerInTop = topPlayers.find(p => p.username === username);
      
      if (playerInTop) {
        currentPlayerRank = playerInTop.rank;
        currentPlayerData = playerInTop;
      } else {
        const cacheKey = `leaderboard:playerRank:${username}`;
        let rankData = await getCache<{ rank: number | null }>(cacheKey);
        
        if (!rankData) {
          rankData = await getPlayerRankData(username);
          if (rankData) {
            await setCache(cacheKey, rankData, CacheTTL.LEADERBOARD);
          }
        }
        
        if (rankData && rankData.rank !== null) {
          currentPlayerRank = rankData.rank;
          
          const playerData = await getCacheOrFetch(
            PlayerKeys.profile(username),
            async () => {
              const supabase = createServiceClient();
              const { data: player } = await supabase
                .from('players')
                .select('username, total_strength, total_defense, factory_count, level')
                .eq('username', username)
                .maybeSingle();
              if (!player) return null;
              
              const totalStrength = player.total_strength || 0;
              const totalDefense = player.total_defense || 0;
              
              const { calculateBalanceEffects } = await import('@/lib/balanceService');
              const balanceEffects = calculateBalanceEffects(totalStrength, totalDefense);
              const totalPower = totalStrength + totalDefense;
              const effectivePower = Math.floor(totalPower * balanceEffects.powerMultiplier);
              
              return {
                rank: rankData?.rank || 0,
                username: player.username,
                effectivePower,
                totalPower,
                balanceMultiplier: balanceEffects.powerMultiplier,
                balanceStatus: balanceEffects.status,
                totalStrength,
                totalDefense,
                factoriesOwned: player.factory_count || 0,
                level: player.level || 1
              } as RankedPlayer;
            },
            CacheTTL.PLAYER_PROFILE
          );
          currentPlayerData = playerData;
        }
      }
    }
    
    const leaderboard = topPlayers.map(player => ({
      ...player,
      combatPower: player.effectivePower
    }));
    
    const response = {
      leaderboard,
      currentPlayerRank,
      currentPlayerData: currentPlayerData ? { ...currentPlayerData, combatPower: currentPlayerData.effectivePower } : null,
      totalPlayers,
      lastUpdated: new Date().toISOString()
    };

    log.info('Leaderboard retrieved', { topPlayerCount: topPlayers.length, totalPlayers, requestedUsername: username || 'none' });
    
    return NextResponse.json(response, { status: 200 });
    
  } catch (error) {
    log.error('Error fetching leaderboard', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
