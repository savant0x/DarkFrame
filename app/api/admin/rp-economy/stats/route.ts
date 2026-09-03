import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { getAuthenticatedUser } from '@/lib/authService';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.admin);

export const GET = withRequestLogging(rateLimiter(async (request: NextRequest) => {
  const log = createRouteLogger('admin/rp-economy/stats');
  const endTimer = log.time('get-rp-economy-stats');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const allPlayers = await db.select({
      username: players.username,
      researchPoints: players.researchPoints,
      vip: players.vip,
      vipExpiration: players.vipExpiration,
      rpHistory: players.rpHistory,
    }).from(players);
    
    const totalRP = allPlayers.reduce((sum, p) => sum + (p.researchPoints || 0), 0);
    const vipPlayers = allPlayers.filter((p) => p.vip === 1 && p.vipExpiration && new Date(p.vipExpiration) > new Date()).length;
    
    let totalGenerated = 0;
    let totalSpent = 0;
    
    for (const player of allPlayers) {
      if (player.rpHistory && Array.isArray(player.rpHistory)) {
        for (const entry of player.rpHistory) {
          if (entry.amount > 0) {
            totalGenerated += entry.amount;
          } else {
            totalSpent += Math.abs(entry.amount);
          }
        }
      }
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeEarners24h = allPlayers.filter((p) => {
      if (!p.rpHistory || !Array.isArray(p.rpHistory)) return false;
      return p.rpHistory.some((entry: any) => 
        entry.amount > 0 && 
        entry.timestamp && 
        new Date(entry.timestamp) > oneDayAgo
      );
    }).length;

    let dailyGeneration = 0;
    for (const player of allPlayers) {
      if (player.rpHistory && Array.isArray(player.rpHistory)) {
        for (const entry of player.rpHistory) {
          if (entry.amount > 0 && entry.timestamp && new Date(entry.timestamp) > oneDayAgo) {
            dailyGeneration += entry.amount;
          }
        }
      }
    }

    const balances = allPlayers.map((p) => p.researchPoints || 0).sort((a, b) => a - b);
    const averageBalance = Math.round(totalRP / allPlayers.length);
    const medianBalance = balances.length > 0 ? balances[Math.floor(balances.length / 2)] : 0;

    log.info('RP economy stats retrieved', {
      totalRP,
      dailyGeneration,
      activeEarners24h,
      vipPlayers,
    });

    return NextResponse.json({
      totalRP,
      totalGenerated,
      totalSpent,
      dailyGeneration,
      activeEarners24h,
      averageBalance,
      medianBalance,
      vipPlayers
    });

  } catch (error) {
    log.error('Failed to fetch RP economy stats', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
