/**
 * @file app/api/cron/wmd-tick/route.ts
 * @created 2026-09-06
 * @overview WMD background-job tick endpoint (FID-20260906-002 G6).
 *
 * OVERVIEW:
 * Runs the WMD due-missile pass (impact processing) on demand so missile
 * flights resolve even in environments where server.ts — and with it the
 * in-process WMD scheduler — never executes (e.g. Vercel serverless).
 *
 * Security:
 * - Bearer CRON_SECRET, fail-closed when unset (same pattern as
 *   /api/cron/player-snapshot).
 * - Vercel Hobby supports daily crons only; wire this path in vercel.json
 *   once the project is on Pro, or poll it externally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDueMissiles } from '@/lib/wmd/jobs/missileTracker';

export async function POST(request: NextRequest) {
  // Verify cron secret — fail closed when unset (a literal 'Bearer undefined'
  // must never authenticate).
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const handled = await processDueMissiles();
    return NextResponse.json({ success: true, missilesProcessed: handled });
  } catch (error) {
    console.error('[cron/wmd-tick] Error processing missiles:', error);
    return NextResponse.json(
      { error: 'Failed to process missiles' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Convenience alias for schedulers that speak GET (Vercel Cron sends GET).
  return POST(request);
}
