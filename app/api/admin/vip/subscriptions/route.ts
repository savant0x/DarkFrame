/**
 * @file app/api/admin/vip/subscriptions/route.ts
 * @created 2026-09-04
 * @overview Admin VIP subscription overview (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/admin/vip/subscriptions
 * Admin-only. Serves app/admin/vip/page.tsx's loadSubscriptionData() contract:
 *
 * {
 *   success: true,
 *   subscriptions: ActiveSubscription[],   // page-local interface
 *   analytics: { mrr, arr, activeCount, churnRate }
 * }
 *
 * Data sources (all real):
 * - players: vip=1 rows with unexpired vipExpiration are active subscriptions;
 *   vipTier maps to packageId, stripeSubscriptionId distinguishes Stripe-backed
 *   (autoRenew) from manual admin grants.
 * - "paymentTransactions" (migration 0012): completed payments drive MRR
 *   (monthly-normalized over the trailing 30 days); refunded share is the
 *   churn proxy. A brand-new economy reports 0s honestly — no fabricated data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';

interface ActiveSubscriptionDto {
  username: string;
  packageId: string;
  startDate: string;
  expiresAt: string;
  autoRenew: boolean;
  paymentMethod: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const adminAuth = await requireAdmin(request);
  if (adminAuth instanceof NextResponse) {
    return adminAuth;
  }

  try {
    const now = new Date();

    // Active VIP subscriptions: flag on AND (no expiration => permanent, or expiration in the future)
    const vipRows = await db
      .select({
        username: players.username,
        vipTier: players.vipTier,
        vipExpiration: players.vipExpiration,
        vipLastUpdated: players.vipLastUpdated,
        stripeCustomerId: players.stripeCustomerId,
        stripeSubscriptionId: players.stripeSubscriptionId,
      })
      .from(players)
      .where(
        and(
          eq(players.vip, 1),
          or(isNull(players.vipExpiration), gt(players.vipExpiration, now))
        )
      )
      .orderBy(desc(players.vipExpiration))
      .limit(500);

    const subscriptions: ActiveSubscriptionDto[] = vipRows.map((r) => ({
      username: r.username,
      packageId: r.vipTier || 'unknown',
      // vipLastUpdated is the closest persisted proxy for subscription start
      startDate: (r.vipLastUpdated || r.vipExpiration || now).toISOString(),
      expiresAt: (r.vipExpiration || new Date(now.getTime() + 365 * MS_PER_DAY)).toISOString(),
      autoRenew: Boolean(r.stripeSubscriptionId),
      paymentMethod: r.stripeSubscriptionId
        ? 'stripe_subscription'
        : r.stripeCustomerId
          ? 'stripe_customer'
          : 'manual_grant',
    }));

    // Analytics from real payment records (migration 0012). Zero rows => honest zeros.
    const payResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int AS completed_cents,
        COALESCE(SUM(CASE WHEN status = 'completed' AND "completedAt" >= NOW() - INTERVAL '30 days' THEN amount ELSE 0 END), 0)::int AS month_cents,
        COUNT(*)::int AS total_count,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END), 0)::int AS refunded_count
      FROM "paymentTransactions"
    `);
    const pay = (payResult.rows[0] ?? {}) as {
      completed_cents?: number;
      month_cents?: number;
      total_count?: number;
      refunded_count?: number;
    };

    const monthCents = Number(pay.month_cents ?? 0);
    const mrr = monthCents / 100; // payments recorded in trailing 30d ≈ monthly revenue
    const totalCount = Number(pay.total_count ?? 0);
    const refundedCount = Number(pay.refunded_count ?? 0);
    const churnRate = totalCount > 0 ? Math.round((refundedCount / totalCount) * 10000) / 100 : 0;

    return NextResponse.json(
      {
        success: true,
        subscriptions,
        analytics: {
          mrr,
          arr: mrr * 12,
          activeCount: subscriptions.length,
          churnRate,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /admin/vip/subscriptions GET] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load subscription data' },
      { status: 500 }
    );
  }
}
