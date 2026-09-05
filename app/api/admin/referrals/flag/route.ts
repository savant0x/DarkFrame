/**
 * @file app/api/admin/referrals/flag/route.ts
 * @created 2026-09-04
 * @overview Admin referral flag/unflag (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * POST /api/admin/referrals/flag
 * Admin-only. Body: { referralId: string, flagged: boolean, reason?: string }
 * Persists flaggedForAbuse + flagReason on the referrals row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface FlagBody {
  referralId?: string;
  flagged?: boolean;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const adminAuth = await requireAdmin(request);
  if (adminAuth instanceof NextResponse) {
    return adminAuth;
  }

  try {
    let body: FlagBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { referralId, flagged, reason } = body;
    if (!referralId || typeof flagged !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'referralId and flagged (boolean) are required' },
        { status: 400 }
      );
    }
    if (flagged && (!reason || reason.trim().length === 0)) {
      return NextResponse.json(
        { success: false, message: 'A reason is required when flagging a referral' },
        { status: 400 }
      );
    }

    const now = new Date();
    const updated = await db
      .update(referrals)
      .set({
        flaggedForAbuse: flagged ? 1 : 0,
        flagReason: flagged ? reason!.trim() : null,
        updatedAt: now,
      })
      .where(eq(referrals.id, referralId))
      .returning({ id: referrals.id });

    if (updated.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Referral not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, message: flagged ? 'Referral flagged' : 'Flag removed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /admin/referrals/flag POST] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update flag' },
      { status: 500 }
    );
  }
}
