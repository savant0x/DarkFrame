/**
 * @file app/api/admin/beer-bases/recalculate-predictions/route.ts
 * @created 2026-09-04
 * @overview Admin recalculation of the predictive Beer Base tier distribution
 *           (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/admin/beer-bases/recalculate-predictions
 * Admin-only. Body: { weeksAhead?: number } (default 2, clamped 1-12).
 *
 * Delegates to playerHistoryService.generatePredictiveDistribution (linear
 * regression over daily player snapshots) and returns the distribution the
 * spawner will draw from when usePredictiveSpawning is enabled. Response shape
 * matches app/admin/AdminView.tsx's handler: { success, playerCount,
 * weeksAhead, distribution }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { generatePredictiveDistribution } from '@/lib/playerHistoryService';

interface RecalcBody {
  weeksAhead?: number;
}

export async function POST(request: NextRequest) {
  const adminAuth = await requireAdmin(request);
  if (adminAuth instanceof NextResponse) {
    return adminAuth;
  }

  try {
    let body: RecalcBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is valid — defaults apply
    }

    const raw = Number(body.weeksAhead ?? 2);
    const weeksAhead = Number.isFinite(raw) ? Math.min(12, Math.max(1, Math.floor(raw))) : 2;

    const distribution = await generatePredictiveDistribution(weeksAhead);

    return NextResponse.json(
      {
        success: true,
        playerCount: distribution.projectedPlayerLevels.length,
        weeksAhead: distribution.weeksAhead,
        generatedAt: distribution.generatedAt.toISOString(),
        distribution: distribution.tierDistribution,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /admin/beer-bases/recalculate-predictions POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to recalculate predictions' },
      { status: 500 }
    );
  }
}
