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

      // FID-074: full factory settings surface — canonical curves, raid
      // config, ownership breakdown. One GET powers the whole panel.
      const { FACTORY_UPGRADE, getMaxSlots, getRegenRate, getProductionRate, getFactoryDefense, calculateUpgradeCost } = await import('@/lib/factoryUpgradeService');
      const curveTable = Array.from({ length: FACTORY_UPGRADE.MAX_LEVEL }, (_, i) => {
        const level = i + 1;
        const cost = level < FACTORY_UPGRADE.MAX_LEVEL ? calculateUpgradeCost(level) : null;
        return {
          level,
          slots: getMaxSlots(level),
          regenPerHour: getRegenRate(level),
          productionPerHour: getProductionRate(level),
          defense: getFactoryDefense(level),
          upgradeCost: cost ? { metal: cost.metal, energy: cost.energy } : null,
        };
      });

      const raidConfig = (await import('@/lib/botFactoryRaid')).BOT_FACTORY_RAID_CONFIG;
      const players = await getCollection<{ isBot?: boolean; username?: string; totalStrength?: number; botConfig?: { tier?: number; attackCooldown?: string } }>('players');
      const bots = await players.find({ isBot: true }).toArray();
      const botNames = new Set(bots.map((b) => b.username));
      const now = Date.now();
      const raidEligible = bots.filter(
        (b) => raidConfig.RAID_ELIGIBLE_TIERS.includes(b.botConfig?.tier ?? 1) && (b.totalStrength ?? 0) >= raidConfig.MIN_RAID_STRENGTH
      );
      const raidStats = {
        eligibleBots: raidEligible.length,
        onCooldown: raidEligible.filter((b) => {
          const cd = b.botConfig?.attackCooldown;
          return cd ? now - new Date(cd).getTime() < 6 * 3_600_000 : false;
        }).length,
        botOwnedFactories: all.filter((f) => f.owner && botNames.has(f.owner)).length,
      };

      const ownedRows = all.filter((f) => f.owner);
      const ownership = Object.entries(
        ownedRows.reduce<Record<string, number>>((acc, f) => {
          acc[f.owner!] = (acc[f.owner!] ?? 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([owner, count]) => ({ owner, count }));

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
          // FID-074 additions:
          curves: {
            maxLevel: FACTORY_UPGRADE.MAX_LEVEL,
            costMultiplier: FACTORY_UPGRADE.COST_MULTIPLIER,
            table: curveTable,
          },
          raids: { config: raidConfig, stats: raidStats },
          ownership,
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
