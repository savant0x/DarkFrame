/**
 * @file lib/wmd/jobs/spyMissionCompleter.ts
 * @overview Completes spy missions after duration expires — Supabase backend
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers/wmdHandler';

export async function spyMissionCompleter(): Promise<number> {
  try {
    const supabase = createServiceClient();
    const now = new Date().toISOString();

    const { data: missions } = await supabase
      .from('wmd_spy_missions')
      .select('*')
      .eq('status', 'in_progress')
      .lte('estimated_completion', now);

    if (!missions || missions.length === 0) return 0;

    let processed = 0;
    for (const mission of missions) {
      try {
        const successRoll = Math.random();
        const finalChance = parseFloat(mission.result as string) || 0.5;
        const successful = successRoll <= finalChance;
        const newStatus = successful ? 'completed' : 'failed';

        await supabase.from('wmd_spy_missions').update({
          status: newStatus,
          completed_at: now,
          result: { outcome: newStatus, rolled: successRoll, threshold: finalChance },
        }).eq('mission_id', mission.mission_id);

        await supabase.from('wmd_spies').update({
          status: successful ? 'available' : 'compromised',
        }).eq('spy_id', mission.spy_id);

        const io = getIO();
        if (io) {
          await wmdHandlers.broadcastCounterIntelDetection(io, {
            playerId: mission.owner_id,
            spiesDetected: [],
          });
        }

        processed++;
      } catch (missionError) {
        console.error(`[Spy Completer] Error processing mission ${mission.mission_id}:`, missionError);
      }
    }
    return processed;
  } catch (error) {
    console.error('[Spy Completer] Error:', error);
    return 0;
  }
}
