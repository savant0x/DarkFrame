/**
 * @file app/api/admin/bot-factory-economy/route.ts
 * @created 2026-09-12
 * @overview FID-20260912-067 — admin control surface for the bot factory
 * economy. GET: job stats + live level distribution. POST: trigger one
 * economy cycle on demand (serialized with the scheduler in the manager).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import {
  withRequestLogging,
  createRouteLogger,
  createRateLimiter,
  ENDPOINT_RATE_LIMITS,
  createErrorFromException,
  ErrorCode,
} from '@/lib';
import {
  getBotFactoryEconomyStats,
  triggerBotFactoryEconomyCycle,
} from '@/lib/jobs/botFactoryEconomyManager';
import { getCollection } from '@/lib/mongodb';

const rateLimiter = createRateLimiter(ENDPOINT_RATE_LIMITS.adminBot);

// ============================================================================
// GET - Economy stats + factory level distribution
// ============================================================================

export const GET = withRequestLogging(
  rateLimiter(async (request: NextRequest) => {
    try {
      const adminAuth = await requireAdmin(request);
      if (adminAuth instanceof NextResponse) {
        return adminAuth;
      }

      const stats = getBotFactoryEconomyStats();

      // Live level distribution for the admin's economy-at-a-glance readout.
      const factories = await getCollection<{ level?: number; owner: string | null }>('factories');
      const all = await factories.find({}).limit(2000).toArray();
      const distribution: Record<string, number> = {};
      let wild = 0;
      let playerOwned = 0;
      for (const f of all) {
        const lvl = String(f.level ?? 1);
        distribution[lvl] = (distribution[lvl] ?? 0) + 1;
        if (f.owner) playerOwned += 1;
        else wild += 1;
      }

      return NextResponse.json({
        success: true,
        data: {
          job: stats,
          factories: {
            total: all.length,
            wild,
            playerOwned,
            levelDistribution: Object.fromEntries(
              Object.entries(distribution).sort((a, b) => Number(a[0]) - Number(b[0]))
            ),
          },
        },
      });
    } catch (error) {
      return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
    }
  })
);

// ============================================================================
// POST - Trigger one economy cycle on demand
// ============================================================================

export const POST = withRequestLogging(
  rateLimiter(async (request: NextRequest) => {
    const log = createRouteLogger('AdminBotFactoryEconomyAPI');

    try {
      const adminAuth = await requireAdmin(request);
      if (adminAuth instanceof NextResponse) {
        return adminAuth;
      }

      const result = await triggerBotFactoryEconomyCycle();
      log.info('Admin triggered bot factory economy cycle', {
        admin: adminAuth.username,
      });
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      return createErrorFromException(error, ErrorCode.INTERNAL_ERROR);
    }
  })
);
