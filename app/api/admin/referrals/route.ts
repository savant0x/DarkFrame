/**
 * @file app/api/admin/referrals/route.ts
 * @created 2026-09-04
 * @overview Admin referral listing with stats (FID-20260904-005 §5.3 dead-wire rebuild).
 *
 * GET /api/admin/referrals?status=<all|pending|validated|invalid|flagged>&search=<text>
 * Admin-only (requireAdmin). Serves app/admin/referrals/page.tsx's exact contract:
 *
 * {
 *   success: true,
 *   referrals: ReferralRecord[],   // page-local interface, Mongo-era field names
 *   total: number,
 *   stats: { totalReferrals, pendingReferrals, validatedReferrals,
 *            invalidReferrals, flaggedReferrals }
 * }
 *
 * Status derivation (single source of truth, mirrored by the invalidate endpoint):
 *   validated=1                        -> 'validated'  (validation always wins)
 *   validated=0 AND invalidated=1      -> 'invalid'
 *   otherwise                          -> 'pending'
 * with flaggedForAbuse=1 surfaced as the orthogonal `flagged` flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/authMiddleware';
import { db } from '@/lib/db';
import { referrals } from '@/lib/db/schema';
import { desc, ilike, or } from 'drizzle-orm';
import type {
  InferSelectModel,
} from 'drizzle-orm';

type ReferralRow = InferSelectModel<typeof referrals>;

interface AdminReferralRecord {
  _id: string;
  referrerUsername: string;
  referredUsername: string;
  referredEmail: string;
  referralCode: string;
  status: 'pending' | 'validated' | 'invalid';
  validationDetails: {
    loginCount: number;
    lastLogin?: string;
  };
  createdAt: string;
  validatedAt?: string;
  ipAddress?: string;
  flagged?: boolean;
  flagReason?: string;
  rewardsDistributed?: boolean;
}

// Module-private: Next.js route files may only export route handlers (an extra
// export breaks the generated route-type check).
function deriveReferralStatus(row: {
  validated: number;
  invalidated: number;
}): 'pending' | 'validated' | 'invalid' {
  if (row.validated === 1) return 'validated';
  if (row.invalidated === 1) return 'invalid';
  return 'pending';
}

function rowToRecord(row: ReferralRow): AdminReferralRecord {
  return {
    _id: row.id,
    referrerUsername: row.referrerUsername,
    referredUsername: row.newPlayerUsername,
    referredEmail: row.newPlayerEmail,
    referralCode: row.referrerCode,
    status: deriveReferralStatus(row),
    validationDetails: {
      loginCount: row.loginCount,
      lastLogin: row.lastLogin ? row.lastLogin.toISOString() : undefined,
    },
    createdAt: row.signupDate.toISOString(),
    validatedAt: row.validationDate ? row.validationDate.toISOString() : undefined,
    ipAddress: row.newPlayerIP || undefined,
    flagged: row.flaggedForAbuse === 1 || undefined,
    flagReason: row.flagReason || undefined,
    rewardsDistributed: row.rewardsClaimed === 1 || undefined,
  };
}

export async function GET(request: NextRequest) {
  const adminAuth = await requireAdmin(request);
  if (adminAuth instanceof NextResponse) {
    return adminAuth;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'all';
    const search = (searchParams.get('search') || '').trim();

    const rows = await db
      .select()
      .from(referrals)
      .orderBy(desc(referrals.signupDate))
      .limit(1000);

    // Search filter is applied in SQL when provided (email/username indexed columns)
    let filtered = rows;
    if (search) {
      const like = `%${search}%`;
      const matched = await db
        .select()
        .from(referrals)
        .where(
          or(
            ilike(referrals.referrerUsername, like),
            ilike(referrals.newPlayerUsername, like),
            ilike(referrals.newPlayerEmail, like)
          )
        )
        .orderBy(desc(referrals.signupDate))
        .limit(1000);
      filtered = matched;
    }

    // Status filter (server-side so pagination/scale never leaks wrong buckets)
    if (status === 'pending') {
      filtered = filtered.filter((r) => deriveReferralStatus(r) === 'pending');
    } else if (status === 'validated') {
      filtered = filtered.filter((r) => deriveReferralStatus(r) === 'validated');
    } else if (status === 'invalid') {
      filtered = filtered.filter((r) => deriveReferralStatus(r) === 'invalid');
    } else if (status === 'flagged') {
      filtered = filtered.filter((r) => r.flaggedForAbuse === 1);
    }

    const all = rows.length > 0 ? rows : filtered;
    const stats = {
      totalReferrals: all.length,
      pendingReferrals: all.filter((r) => deriveReferralStatus(r) === 'pending').length,
      validatedReferrals: all.filter((r) => deriveReferralStatus(r) === 'validated').length,
      invalidReferrals: all.filter((r) => deriveReferralStatus(r) === 'invalid').length,
      flaggedReferrals: all.filter((r) => r.flaggedForAbuse === 1).length,
    };

    return NextResponse.json(
      {
        success: true,
        referrals: filtered.map(rowToRecord),
        total: filtered.length,
        stats,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[API /admin/referrals GET] Error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to load referrals' },
      { status: 500 }
    );
  }
}
