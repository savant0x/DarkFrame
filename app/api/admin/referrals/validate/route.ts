/**
 * @file app/api/admin/referrals/validate/route.ts
 * @created 2026-09-04
 * @overview Admin manual referral validation + reward distribution
 *           (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/admin/referrals/validate
 * Admin-only. Body: { referralId: string }
 * Delegates to referralService.validateReferral (marks validated, distributes
 * rewards to the referrer, handles milestones + VIP days). Returns a distinct
 * message when the referral was already validated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { validateReferral } from '@/lib/referralService';
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface ValidateBody {
  referralId?: string;
}

export async function POST(request: NextRequest) {
  const adminAuth = await requireAdmin(request);
  if (adminAuth instanceof NextResponse) {
    return adminAuth;
  }

  try {
    let body: ValidateBody;
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
      .select({ validated: referrals.validated })
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
        { success: false, message: 'Referral is already validated' },
        { status: 409 }
      );
    }

    const ok = await validateReferral(referralId);

    if (!ok) {
      // validateReferral returns false if the referrer row vanished mid-flight
      return NextResponse.json(
        { success: false, message: 'Failed to validate referral (referrer record missing)' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Referral validated and rewards distributed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /admin/referrals/validate POST] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to validate referral' },
      { status: 500 }
    );
  }
}
