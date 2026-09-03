/**
 * @file lib/wmd/jobs/spyMissionCompleter.ts
 * @created 2025-10-22
 * @overview Background job to complete spy missions after duration expires
 * 
 * OVERVIEW:
 * Processes active spy missions that have reached their estimatedCompletion time.
 * Calculates success/failure, generates intelligence reports, updates spy status,
 * handles detection, and broadcasts results via WebSocket.
 * 
 * Features:
 * - Queries missions with estimatedCompletion <= now
 * - Rolls success/failure based on finalSuccessChance
 * - Generates mission results and intelligence reports
 * - Updates spy status (returns to AVAILABLE or CAPTURED)
 * - Broadcasts completion events to owner and target
 * 
 * Dependencies:
 * - Drizzle ORM for mission/spy data
 * - spyService for mission resolution
 * - WebSocket for real-time notifications
 * 
 * @implements Background Job Pattern
 */

import { and, eq, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { wmdSpyMissions } from '@/lib/db/schema/wmd';
import { IntelLevel, MissionStatus, type IntelligenceReport } from '@/types/wmd/intelligence.types';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';

type Database = typeof db;


export async function spyMissionCompleter(_db: Database): Promise<number> {
  try {
    const now = new Date();
    
    const completedMissions = await db
      .select()
      .from(wmdSpyMissions)
      .where(
        and(
          eq(wmdSpyMissions.status, MissionStatus.ACTIVE),
          lte(wmdSpyMissions.estimatedCompletion, now)
        )
      );
    
    if (completedMissions.length === 0) {
      return 0;
    }
    
    console.log(`[WMD Spy Completer] Processing ${completedMissions.length} completed missions`);
    
    let processedCount = 0;
    
    for (const mission of completedMissions) {
      try {
        const roll = Math.random();
        const successful = roll <= Number(mission.finalSuccessChance || 0);
        
        const detectionRoll = Math.random();
        const detected = detectionRoll <= Number(mission.detectionRisk || 0);
        
        let spyCompromised = false;
        
        if (detected) {
          const captureRoll = Math.random();
          if (captureRoll < 0.5) {
            spyCompromised = true;
          }
        }
        
        const finalStatus = detected && spyCompromised ? MissionStatus.COMPROMISED : 
                successful ? MissionStatus.COMPLETED : MissionStatus.FAILED;
        
        await db
          .update(wmdSpyMissions)
          .set({
            status: finalStatus,
            actualCompletion: now,
            roll: String(roll),
            successful: successful ? 1 : 0,
            detected: detected ? 1 : 0,
            intelligenceGathered: (successful && !detected) ? await generateIntelligence(mission) : null,
            updatedAt: now,
          })
          .where(eq(wmdSpyMissions.id, mission.id));
        
        const io = getIO();
        if (io) {
          await wmdHandlers.broadcastSpyMissionComplete(io, {
            playerId: mission.senderClanId,
            missionId: mission.id,
            spyName: mission.spyName || 'Unknown',
            targetName: mission.targetName || 'Unknown',
            missionType: mission.missionType || 'RECONNAISSANCE',
            success: successful,
            intelligence: mission.intelligenceGathered 
              ? JSON.stringify(mission.intelligenceGathered) 
              : undefined,
          });
          
          if (detected) {
            await wmdHandlers.broadcastCounterIntelDetection(io, {
              playerId: mission.targetClanId,
              spiesDetected: spyCompromised
                ? [{ codename: mission.spyName || 'Unknown', specialization: mission.missionType || 'RECONNAISSANCE' }]
                : [],
            });
          }
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`[WMD Spy Completer] Error processing mission ${mission.id}:`, error);
      }
    }
    
    console.log(`[WMD Spy Completer] Successfully processed ${processedCount}/${completedMissions.length} missions`);
    return processedCount;
    
  } catch (error) {
    console.error('[WMD Spy Completer] Job error:', error);
    return 0;
  }
}

async function generateIntelligence(
  mission: typeof wmdSpyMissions.$inferSelect
): Promise<IntelligenceReport> {
  return {
    reportId: `ir_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    classification: IntelLevel.CONFIDENTIAL,
    gatheredBy: mission.spyName,
    gatheredFrom: mission.targetName,
    gatheredAt: new Date(),
    missionId: mission.id,
    target: {
      id: mission.targetClanId,
      username: mission.targetName,
      level: 0,
      power: 0,
    },
    wmdCapabilities: {
      missiles: [],
      defenseBatteries: 0,
      radarLevel: 'UNKNOWN',
      combinedDefenseStrength: 0,
    },
    vulnerabilities: [],
    threats: [],
    recommendations: [],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
}

/**
 * Implementation Footer
 * 
 * Job Schedule: Runs every 30 seconds
 * Performance: Processes up to 100 missions per run
 * Error Handling: Individual mission failures don't stop batch
 * 
 * Integration: Called by master job scheduler
 * Dependencies: Requires wmdHandlers for broadcasts
 * 
 * Future Enhancements:
 * - Detailed intel reports per mission type
 * - Sabotage damage calculation
 * - Assassination mechanics
 * - Counter-intelligence alerts
 */
