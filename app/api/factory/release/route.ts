/**
 * Factory Release API Endpoint
 * Created: 2025-11-03
 * Updated: 2026-05-03 — Migrated to Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getMaxSlots } from '@/lib/factoryUpgradeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode, factoryX, factoryY, username } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, error: 'Username is required' },
        { status: 400 }
      );
    }

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

    if (mode === 'single') {
      const { data: factory, error } = await supabase
        .from('factories')
        .select('*')
        .eq('x', factoryX)
        .eq('y', factoryY)
        .eq('owner', username)
        .maybeSingle();

      if (error || !factory) {
        return NextResponse.json(
          { success: false, error: 'Factory not found or not owned by you' },
          { status: 404 }
        );
      }

      const now = new Date().toISOString();
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
        .eq('x', factoryX)
        .eq('y', factoryY);

      releasedFactories.push({ x: factoryX, y: factoryY });
      releasedCount = 1;
      message = `Factory at (${factoryX}, ${factoryY}) has been released and reset to Level 1`;

    } else {
      const { data: factories, error } = await supabase
        .from('factories')
        .select('x, y')
        .eq('owner', username);

      if (error) throw error;

      const now = new Date().toISOString();
      for (const f of (factories || [])) {
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
          .eq('x', f.x)
          .eq('y', f.y);

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
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
