/**
 * Factory Release API Endpoint
 * Created: 2025-11-03
 * Updated: 2026-05-15 — Fixed: clean up orphaned units when factory is released
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/authMiddleware';
import { getMaxSlots } from '@/lib/factoryUpgradeService';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { mode, factoryX, factoryY } = body;

    const username = auth.playerId;

    if (!mode || (mode !== 'single' && mode !== 'releaseAll')) {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Must be "single" or "releaseAll"' },
        { status: 400 }
      );
    }

    if (mode === 'single' && (factoryX === undefined || factoryY === undefined)) {
      return NextResponse.json(
        { success: false, error: 'factoryX and factoryY required for single mode' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();
    let releasedFactories: Array<{x: number, y: number}> = [];
    let releasedCount = 0;
    let message = '';

    async function releaseSingleFactory(x: number, y: number) {
      const { data: factory, error } = await supabase
        .from('factories')
        .select('*')
        .eq('x', x)
        .eq('y', y)
        .eq('owner', username)
        .maybeSingle();

      if (error || !factory) {
        return { success: false, error: 'Factory not found or not owned by you' };
      }

      const now = new Date().toISOString();

      await supabase
        .from('player_units')
        .delete()
        .eq('produced_at_x', x)
        .eq('produced_at_y', y);

      await supabase
        .from('factories')
        .update({
          owner: null,
          level: 1,
          slots: getMaxSlots(1),
          used_slots: 0,
          production_rate: 1,
          last_slot_regen: now,
          last_attacked_by: null,
          last_attack_time: null,
        })
        .eq('x', x)
        .eq('y', y);

      return { success: true };
    }

    if (mode === 'single') {
      const result = await releaseSingleFactory(factoryX, factoryY);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 404 }
        );
      }

      releasedFactories.push({ x: factoryX, y: factoryY });
      releasedCount = 1;
      message = `Factory at (${factoryX}, ${factoryY}) has been released and reset to Level 1`;

    } else {
      const { data: factories, error } = await supabase
        .from('factories')
        .select('x, y')
        .eq('owner', username);

      if (error) throw error;

      for (const f of (factories || [])) {
        await releaseSingleFactory(f.x, f.y);
        releasedFactories.push({ x: f.x, y: f.y });
      }

      releasedCount = (factories || []).length;
      message = `Released all ${releasedCount} factories`;
    }

    return NextResponse.json({
      success: true,
      message,
      releasedCount,
      releasedFactories,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
