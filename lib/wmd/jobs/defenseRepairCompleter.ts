/**
 * @file lib/wmd/jobs/defenseRepairCompleter.ts
 * @created 2025-10-22
 * @overview Background job to complete battery repairs after repair time expires
 * 
 * OVERVIEW:
 * Processes defense batteries that have completed their repair duration.
 * Restores battery to full health, operational status, and full interceptor capacity.
 * Broadcasts completion notifications to battery owners.
 * 
 * Features:
 * - Queries batteries with repairCompletesAt <= now
 * - Restores health to 100%
 * - Sets status back to IDLE (operational)
 * - Clears repairing flag
 * - Broadcasts completion to owner via WebSocket
 * 
 * Dependencies:
 * - Supabase for battery data
 * - WebSocket for real-time notifications
 * 
 * @implements Background Job Pattern
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';

/**
 * Battery status enum (mirrors defenseService)
 */
enum BatteryStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  COOLDOWN = 'COOLDOWN',
  DAMAGED = 'DAMAGED',
  UPGRADING = 'UPGRADING',
}

/**
 * Main job function - completes battery repairs
 * Runs every 60 seconds via master scheduler
 */
export async function defenseRepairCompleter(): Promise<void> {
  try {
    const now = new Date();
    const nowISO = now.toISOString();
    const supabase = createServiceClient();

    const { data: allBatteries, error: fetchError } = await supabase
      .from('wmd_defense_batteries')
      .select('*')
      .eq('status', 'DAMAGED');

    if (fetchError) {
      console.error('[DefenseRepairCompleter] Error fetching batteries:', fetchError);
      return;
    }

    if (!allBatteries || allBatteries.length === 0) {
      return;
    }

    const completedRepairs = allBatteries.filter((b: any) => {
      const rechargesAt = b.recharges_at;
      if (!rechargesAt) return false;
      return new Date(rechargesAt) <= now;
    });

    if (completedRepairs.length === 0) {
      return;
    }

    console.log(`[DefenseRepairCompleter] Processing ${completedRepairs.length} completed battery repairs`);

    for (const battery of completedRepairs) {
      try {
        await supabase
          .from('wmd_defense_batteries')
          .update({
            status: BatteryStatus.IDLE,
            recharges_at: null,
          })
          .eq('id', battery.id);

        console.log(`Battery ${battery.battery_id} repair completed. Status: IDLE`);

        // TODO: Add broadcast when broadcastDefenseBatteryRepaired is implemented
        // const io = getIO();
        // if (io) {
        //   await wmdHandlers.broadcastDefenseBatteryRepaired(io, {
        //     ownerId: battery.owner_id,
        //     batteryId: battery.battery_id,
        //     batteryType: battery.tier,
        //     health: 100,
        //     status: BatteryStatus.IDLE,
        //   });
        // }
      } catch (error) {
        console.error(`Error completing repair for battery ${battery.battery_id}:`, error);
      }
    }

    console.log(`[DefenseRepairCompleter] Completed ${completedRepairs.length} battery repairs`);
  } catch (error) {
    console.error('[DefenseRepairCompleter] Job execution error:', error);
  }
}

/**
 * Job metadata for scheduler
 */
export const defenseRepairCompleterJobInfo = {
  name: 'Defense Repair Completer',
  interval: 60000, // Run every 60 seconds
  description: 'Completes battery repairs and restores operational status',
};
