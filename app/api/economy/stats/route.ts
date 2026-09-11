/**
 * @file app/api/economy/stats/route.ts
 * @created 2026-09-09 (FID-20260909-031)
 * @overview Economy Statistics aggregate — the data feed for the in-game
 *            Statistics view's Economy tab (replaces the COMING SOON stub).
 *
 * GET /api/economy/stats
 * - Session-authenticated (FID-20260909-023: identity from session, never query)
 * - Rate limited: STANDARD
 * - Cached 60s (single-flight via getCacheOrFetch)
 *
 * Read-only SQL aggregation over live economy surfaces:
 *  - trade_history   → market volume, price band, fee sink
 *  - auctions        → active book (bid/buyout spread), sell-through time
 *  - player_activity → 7-day resource flow (harvest metal/energy, cave finds)
 *  - players         → system-wide wallet + bank supply
 *
 * All aggregation is Drizzle-native (no Mongo seam). Per the FID's verified
 * schema notes: trade_history has no created_at (sell time comes from
 * auctions.createdAt→closedAt); jsonb extraction is done in SQL.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  auctions,
  playerActivity,
  players,
  tradeHistory,
} from '@/lib/db/schema';
import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { getCacheOrFetch } from '@/lib/cacheService';
import {
  withRequestLogging,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorResponse,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import { getAuthenticatedUser } from '@/lib/authMiddleware';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.STANDARD);

const CACHE_KEY = 'economy:stats:v1';
const CACHE_TTL_MS = 60 * 1000;

interface DayFlow {
  date: string;
  harvestedMetal: number;
  harvestedEnergy: number;
  caveExplorations: number;
}

interface TopTrader {
  username: string;
  trades: number;
  volume: number;
  received: number;
}

export interface EconomyStats {
  market: {
    totalTrades: number;
    tradesToday: number;
    trades7d: number;
    totalVolume: number;
    volumeToday: number;
    volume7d: number;
    avgSalePrice: number;
    medianSalePrice: number;
    priceFloor: number;
    priceCeiling: number;
    totalFeesCollected: number;
    avgFeePct: number;
  };
  auctions: {
    activeCount: number;
    avgCurrentBidOnActive: number;
    avgBuyoutPrice: number;
    soldCount: number;
    avgSoldPrice: number;
    avgTimeToSellHours: number | null;
  };
  flow7d: {
    days: DayFlow[];
    totals: {
      harvestedMetal: number;
      harvestedEnergy: number;
      caveExplorations: number;
    };
  };
  supply: {
    walletMetal: number;
    walletEnergy: number;
    bankedMetal: number;
    bankedEnergy: number;
  };
  topTraders: TopTrader[];
  generatedAt: string;
}

/** Sum a numeric aggregate returned by drizzle (pg returns bigint/numeric as strings). */
const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

function computeEconomyStats(): Promise<EconomyStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const harvestMetalExpr = sql<number>`COALESCE((${playerActivity.metadata}->'resourcesGained'->>'metal')::numeric, 0)`;
  const harvestEnergyExpr = sql<number>`COALESCE((${playerActivity.metadata}->'resourcesGained'->>'energy')::numeric, 0)`;

  return Promise.all([
    // 0 — full trade ledger for price band + top traders (row count is small;
    // everything else derives from this in JS).
    db
      .select({
        finalPrice: tradeHistory.finalPrice,
        saleFee: tradeHistory.saleFee,
        sellerReceived: tradeHistory.sellerReceived,
        sellerUsername: tradeHistory.sellerUsername,
        buyerUsername: tradeHistory.buyerUsername,
        completedAt: tradeHistory.completedAt,
      })
      .from(tradeHistory)
      .orderBy(desc(tradeHistory.completedAt)),
    // 1 — trade counts/volume windows
    db
      .select({
        total: count(),
        volume: sql<number>`COALESCE(SUM(${tradeHistory.finalPrice}), 0)`,
      })
      .from(tradeHistory),
    db
      .select({
        total: count(),
        volume: sql<number>`COALESCE(SUM(${tradeHistory.finalPrice}), 0)`,
      })
      .from(tradeHistory)
      .where(gte(tradeHistory.completedAt, startOfToday)),
    db
      .select({
        total: count(),
        volume: sql<number>`COALESCE(SUM(${tradeHistory.finalPrice}), 0)`,
      })
      .from(tradeHistory)
      .where(gte(tradeHistory.completedAt, sevenDaysAgo)),
    // 2 — active auction book
    db
      .select({
        activeCount: count(),
        avgBid: sql<number>`AVG(${auctions.currentBid})`,
        avgBuyout: sql<number>`AVG(${auctions.buyoutPrice})`,
      })
      .from(auctions)
      .where(eq(auctions.status, 'active')),
    // 3 — sold auction stats incl. time-to-sell (auctions has createdAt+closedAt)
    db
      .select({
        soldCount: count(),
        avgSoldPrice: sql<number>`AVG(${auctions.finalPrice})`,
        avgHours: sql<number>`AVG(EXTRACT(EPOCH FROM (${auctions.closedAt} - ${auctions.createdAt})) / 3600)`,
      })
      .from(auctions)
      .where(and(eq(auctions.status, 'sold'), isNotNull(auctions.closedAt))),
    // 4 — 7-day harvest/cave flow, bucketed per day
    db
      .select({
        bucket: sql<string>`to_char(date_trunc('day', ${playerActivity.timestamp}), 'YYYY-MM-DD')`,
        day: sql<string>`date_trunc('day', ${playerActivity.timestamp})`,
        metal: sql<number>`COALESCE(SUM(CASE WHEN ${playerActivity.action} = 'harvest' THEN ${harvestMetalExpr} ELSE 0 END), 0)`,
        energy: sql<number>`COALESCE(SUM(CASE WHEN ${playerActivity.action} = 'harvest' THEN ${harvestEnergyExpr} ELSE 0 END), 0)`,
        caves: sql<number>`COUNT(CASE WHEN ${playerActivity.action} = 'cave_explore' THEN 1 END)`,
      })
      .from(playerActivity)
      .where(
        and(
          gte(playerActivity.timestamp, sevenDaysAgo),
          sql`${playerActivity.action} IN ('harvest', 'cave_explore')`
        )
      )
      .groupBy(sql`date_trunc('day', ${playerActivity.timestamp})`)
      .orderBy(sql`date_trunc('day', ${playerActivity.timestamp})`),
    // 5 — system supply
    db
      .select({
        walletMetal: sql<number>`COALESCE(SUM(${players.resourcesMetal}), 0)`,
        walletEnergy: sql<number>`COALESCE(SUM(${players.resourcesEnergy}), 0)`,
        bankedMetal: sql<number>`COALESCE(SUM(${players.bankMetal}), 0)`,
        bankedEnergy: sql<number>`COALESCE(SUM(${players.bankEnergy}), 0)`,
      })
      .from(players),
    // 6 — top traders: combined seller+buyer participation, top 5 by volume
    db
      .select({
        username: tradeHistory.sellerUsername,
        trades: count(),
        volume: sql<number>`COALESCE(SUM(${tradeHistory.finalPrice}), 0)`,
        received: sql<number>`COALESCE(SUM(${tradeHistory.sellerReceived}), 0)`,
      })
      .from(tradeHistory)
      .groupBy(tradeHistory.sellerUsername)
      .orderBy(desc(sql`COALESCE(SUM(${tradeHistory.finalPrice}), 0)`))
      .limit(5),
  ]).then(
    ([
      tradeRows,
      allTime,
      today,
      last7d,
      activeBook,
      soldBook,
      flowRows,
      supplyRow,
      topSellerRows,
    ]) => {
      const prices = tradeRows.map((r) => r.finalPrice).sort((a, b) => a - b);
      const totalVolumeNum = num(allTime[0]?.volume);
      const totalFees = tradeRows.reduce((s, r) => s + r.saleFee, 0);
      const median =
        prices.length === 0
          ? 0
          : prices.length % 2 === 1
            ? prices[(prices.length - 1) / 2]
            : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;

      // 7-day flow calendar filled with zero days (UI needs a continuous axis)
      const byDay = new Map<string, DayFlow>();
      for (const r of flowRows) {
        byDay.set(r.bucket, {
          date: r.bucket,
          harvestedMetal: num(r.metal),
          harvestedEnergy: num(r.energy),
          caveExplorations: num(r.caves),
        });
      }
      const days: DayFlow[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toISOString().slice(0, 10);
        const row = byDay.get(key);
        days.push(
          row ?? { date: key, harvestedMetal: 0, harvestedEnergy: 0, caveExplorations: 0 }
        );
      }

      // Buyer-side participation merged into the seller-side ledger: sellers
      // carry their SQL aggregates (trades/volume/received as seller); each
      // purchase adds one participation and its price to the buyer's row.
      const traderMap = new Map<string, TopTrader>();
      for (const s of topSellerRows) {
        traderMap.set(s.username, {
          username: s.username,
          trades: num(s.trades),
          volume: num(s.volume),
          received: num(s.received),
        });
      }
      for (const r of tradeRows) {
        let buyer = traderMap.get(r.buyerUsername);
        if (!buyer) {
          buyer = { username: r.buyerUsername, trades: 0, volume: 0, received: 0 };
          traderMap.set(r.buyerUsername, buyer);
        }
        buyer.trades += 1;
        buyer.volume += r.finalPrice;
      }
      const topTraders = [...traderMap.values()]
        .sort((a, b) => b.volume - a.volume)
        .slice(0, 5);

      return {
        market: {
          totalTrades: num(allTime[0]?.total),
          tradesToday: num(today[0]?.total),
          trades7d: num(last7d[0]?.total),
          totalVolume: totalVolumeNum,
          volumeToday: num(today[0]?.volume),
          volume7d: num(last7d[0]?.volume),
          avgSalePrice:
            prices.length > 0 ? Math.round(totalVolumeNum / prices.length) : 0,
          medianSalePrice: Math.round(median),
          priceFloor: prices.length > 0 ? prices[0] : 0,
          priceCeiling: prices.length > 0 ? prices[prices.length - 1] : 0,
          totalFeesCollected: totalFees,
          avgFeePct:
            totalVolumeNum > 0
              ? Math.round((totalFees / totalVolumeNum) * 10000) / 100
              : 0,
        },
        auctions: {
          activeCount: num(activeBook[0]?.activeCount),
          avgCurrentBidOnActive: Math.round(num(activeBook[0]?.avgBid)),
          avgBuyoutPrice: Math.round(num(activeBook[0]?.avgBuyout)),
          soldCount: num(soldBook[0]?.soldCount),
          avgSoldPrice: Math.round(num(soldBook[0]?.avgSoldPrice)),
          avgTimeToSellHours:
            soldBook[0]?.soldCount == null
              ? null
              : Math.round(num(soldBook[0]?.avgHours) * 10) / 10,
        },
        flow7d: {
          days,
          totals: {
            harvestedMetal: days.reduce((s, d) => s + d.harvestedMetal, 0),
            harvestedEnergy: days.reduce((s, d) => s + d.harvestedEnergy, 0),
            caveExplorations: days.reduce((s, d) => s + d.caveExplorations, 0),
          },
        },
        supply: {
          walletMetal: num(supplyRow[0]?.walletMetal),
          walletEnergy: num(supplyRow[0]?.walletEnergy),
          bankedMetal: num(supplyRow[0]?.bankedMetal),
          bankedEnergy: num(supplyRow[0]?.bankedEnergy),
        },
        topTraders,
        generatedAt: now.toISOString(),
      };
    }
  );
}

export const GET = withRequestLogging(
  rateLimiter(async () => {
    try {
      const authUser = await getAuthenticatedUser();
      if (!authUser) {
        return createErrorResponse(ErrorCode.AUTH_UNAUTHORIZED, {
          message: 'Authentication required',
        });
      }

      const stats = await getCacheOrFetch<EconomyStats>(
        CACHE_KEY,
        computeEconomyStats,
        CACHE_TTL_MS
      );

      return NextResponse.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
    }
  })
);
