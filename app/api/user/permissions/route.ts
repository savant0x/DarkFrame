/**
 * @file app/api/user/permissions/route.ts
 * @created 2026-09-04
 * @overview Session-derived permission flags for client-side access gating
 *           (FID-20260904-005 §5.3 — the dead /api/user/permissions wire).
 *
 * GET /api/user/permissions
 * Identity comes EXCLUSIVELY from the session cookie (requireAuth) — never from
 * body/query. Returns only non-sensitive booleans/labels a panel needs to decide
 * what to render; every privileged action is still enforced server-side by the
 * routes themselves (this endpoint is UX gating, not an authorization boundary).
 *
 * Consumers: components/admin/ModerationPanel.tsx (isAdmin + userId).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/authMiddleware';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);

  if (auth instanceof NextResponse) {
    return auth; // 401
  }

  return NextResponse.json(
    {
      success: true,
      userId: auth.username,
      isAdmin: auth.isAdmin,
    },
    { status: 200 }
  );
}
