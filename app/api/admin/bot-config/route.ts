/**
 * Admin Bot Config API
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest) {
  return NextResponse.json({
    success: true,
    data: {
      spawnRateMin: 5,
      spawnRateMax: 10,
      regenInterval: 3600,
      maxBots: 500,
      enabled: true,
    },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      data: { ...body, updated: true },
      message: 'Bot config updated',
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 });
  }
}
