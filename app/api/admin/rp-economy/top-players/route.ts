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
  const log = createRouteLogger('admin/rp-economy/top-players');
  const endTimer = log.time('get-top-players');

  try {
    const adminUser = await getAuthenticatedUser();
    if (!adminUser?.isAdmin) {
      return createErrorResponse(ErrorCode.ADMIN_ACCESS_REQUIRED);
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || '7d';

    const now = new Date();
    let dateFilter: Date | null = null;
    
    if (period === '24h') {
      dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === '7d') {
      dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const allPlayers = await db.select({
      username: players.username,
      vip: players.vip,
      vipExpiration: players.vipExpiration,
      rpHistory: players.rpHistory,
    }).from(players);

    const earningsMap = new Map<string, number>();
    const spendingMap = new Map<string, number>();

    for (const player of allPlayers) {
      if (!player.rpHistory || !Array.isArray(player.rpHistory)) continue;

      for (const entry of player.rpHistory) {
        if (!entry.timestamp) continue;
        const entryDate = new Date(entry.timestamp);
        if (dateFilter && entryDate < dateFilter) continue;

        if (entry.amount > 0) {
          earningsMap.set(player.username, (earningsMap.get(player.username) || 0) + entry.amount);
        } else {
          spendingMap.set(player.username, (spendingMap.get(player.username) || 0) + Math.abs(entry.amount));
        }
      }
    }

    const topEarnersData = Array.from(earningsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topSpendersData = Array.from(spendingMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const allUsernames = [
      ...topEarnersData.map(e => e[0]),
      ...topSpendersData.map(s => s[0])
    ];

    const playerVIPMap = new Map(
      allPlayers
        .filter(p => allUsernames.includes(p.username))
        .map(p => [
          p.username,
          !!(p.vip === 1 && p.vipExpiration && new Date(p.vipExpiration) > new Date())
        ])
    );

    const topEarners = topEarnersData.map(([username, amount]) => ({
      username,
      amount,
      isVIP: playerVIPMap.get(username) || false
    }));

    const topSpenders = topSpendersData.map(([username, amount]) => ({
      username,
      amount,
      isVIP: playerVIPMap.get(username) || false
    }));

    log.info('Top players retrieved', {
      topEarnersCount: topEarners.length,
      topSpendersCount: topSpenders.length,
      period,
    });

    return NextResponse.json({ topEarners, topSpenders });

  } catch (error) {
    log.error('Failed to fetch top players', error instanceof Error ? error : new Error(String(error)));
    return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
  } finally {
    endTimer();
  }
}));
