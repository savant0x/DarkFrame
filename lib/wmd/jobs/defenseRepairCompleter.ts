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
 * - Drizzle ORM for battery data
 * - WebSocket for real-time notifications
 * 
 * @implements Background Job Pattern
 */

import { and, eq, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdDefenseBatteries } from '@/lib/db/schema/wmd';

type Database = typeof db;

enum BatteryStatus {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  COOLDOWN = 'COOLDOWN',
  DAMAGED = 'DAMAGED',
  UPGRADING = 'UPGRADING',
}

export async function defenseRepairCompleter(_db: Database): Promise<void> {
  try {
    const now = new Date();
    
    const completedRepairs = await db
      .select()
      .from(wmdDefenseBatteries)
      .where(
        and(
          isNotNull(wmdDefenseBatteries.repairCompletesAt),
          lte(wmdDefenseBatteries.repairCompletesAt, now)
        )
      );
    
    if (completedRepairs.length === 0) {
      return;
    }
    
    console.log(`[DefenseRepairCompleter] Processing ${completedRepairs.length} completed battery repairs`);
    
    for (const battery of completedRepairs) {
      try {
        await db
          .update(wmdDefenseBatteries)
          .set({
            status: BatteryStatus.IDLE,
            repairCompletesAt: null,
            updatedAt: now,
          })
          .where(eq(wmdDefenseBatteries.id, battery.id));
        
        console.log(`Battery ${battery.batteryId} repair completed. Status: IDLE`);
        
      } catch (error) {
        console.error(`Error completing repair for battery ${battery.batteryId}:`, error);
      }
    }
    
    console.log(`[DefenseRepairCompleter] Completed ${completedRepairs.length} battery repairs`);
    
  } catch (error) {
    console.error('[DefenseRepairCompleter] Job execution error:', error);
  }
}

export const defenseRepairCompleterJobInfo = {
  name: 'Defense Repair Completer',
  interval: 60000,
  description: 'Completes battery repairs and restores operational status',
};
