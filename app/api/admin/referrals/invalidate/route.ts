/**
 * @file app/api/admin/referrals/invalidate/route.ts
 * @created 2026-09-04
 * @overview Admin referral invalidation (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/admin/referrals/invalidate
 * Admin-only. Body: { referralId: string }
 * Marks a pending referral as invalid via the invalidated column (migration 0011).
 * Status derivation ('invalid' = validated=0 AND invalidated=1) lives in
 * /api/admin/referrals — this endpoint must stay consistent with it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface InvalidateBody {
  referralId?: string;
}

export async function POST(request: NextRequest) {
  const adminAuth = await requireAdmin(request);
  if (adminAuth instanceof NextResponse) {
    return adminAuth;
  }

  try {
    let body: InvalidateBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { referralId } = body;
    if (!referralId) {
      return NextResponse.json(
        { success: false, message: 'referralId is required' },
        { status: 400 }
      );
    }

    const existing = await db
      .select({
        validated: referrals.validated,
        invalidated: referrals.invalidated,
      })
      .from(referrals)
      .where(eq(referrals.id, referralId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Referral not found' },
        { status: 404 }
      );
    }

    if (existing[0].validated === 1) {
      return NextResponse.json(
        { success: false, message: 'Cannot invalidate an already-validated referral' },
        { status: 409 }
      );
    }

    if (existing[0].invalidated === 1) {
      return NextResponse.json(
        { success: false, message: 'Referral is already invalidated' },
        { status: 409 }
      );
    }

    const now = new Date();
    const updated = await db
      .update(referrals)
      .set({ invalidated: 1, updatedAt: now })
      .where(eq(referrals.id, referralId))
      .returning({ id: referrals.id });

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Failed to invalidate referral' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Referral marked as invalid' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /admin/referrals/invalidate POST] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to invalidate referral' },
      { status: 500 }
    );
  }
}
