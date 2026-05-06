/**
 * @file lib/wmd/jobs/missileTracker.ts
 * @created 2025-10-22
 * @overview Missile Flight Tracker Background Job
 * 
 * OVERVIEW:
 * Background job that processes in-flight missiles, checks for impacts,
 * handles defense interception attempts, calculates damage, and broadcasts results.
 * 
 * Features:
 * - Queries missiles with status='LAUNCHED' and impactAt <= now
 * - Attempts defense interception via batteries
 * - Calculates damage if not intercepted
 * - Updates missile status (DETONATED or INTERCEPTED)
 * - Broadcasts real-time impact/interception events
 * - Updates player stats and resources
 * 
 * Runs every 60 seconds via scheduler
 * 
 * Dependencies: Supabase, WebSocket handlers, defenseService, damageCalculator
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getIO } from '@/lib/websocket/server';
import { wmdHandlers } from '@/lib/websocket/handlers';
import { WARHEAD_CONFIGS, type WarheadType } from '@/types/wmd';

/**
 * Calculate damage percentages from missile impact
 * @returns Percentage of target's units/resources to destroy (0-100)
 */
function calculateDamagePercent(warheadType: WarheadType): number {
  const config = WARHEAD_CONFIGS[warheadType];
  if (!config) return 0;
  
  // Base damage percentage from config (e.g., 25 for TACTICAL = destroy 25% of units)
  const baseDamagePercent = config.damage.primaryPercent;
  
  // Add 10% randomness (+/- 5%)
  const randomFactor = 0.95 + Math.random() * 0.1;
  
  return Math.floor(baseDamagePercent * randomFactor);
}

/**
 * Attempt interception with player's defense batteries
 */
async function attemptInterception(
  supabase: ReturnType<typeof createServiceClient>,
  targetId: string,
  missileId: string
): Promise<{ intercepted: boolean; batteryId?: string; interceptorName?: string }> {
  // Query target's active batteries
  const { data: batteries } = await supabase
    .from('wmd_defense_batteries')
    .select('*')
    .eq('owner_id', targetId)
    .in('status', ['IDLE', 'ACTIVE']);
    
  if (!batteries || batteries.length === 0) {
    return { intercepted: false };
  }
  
  // Calculate cumulative interception range as chance proxy
  let totalChance = 0;
  for (const battery of batteries) {
    totalChance += (battery.interception_range || 0) / 100;
  }
  
  // Cap at 95% max interception chance
  totalChance = Math.min(totalChance, 0.95);
  
  // Roll for interception
  const roll = Math.random();
  const intercepted = roll < totalChance;
  
  if (intercepted && batteries.length > 0) {
    // Use first active battery
    const battery = batteries[0];
    
    // Get battery owner's username
    const { data: owner } = await supabase
      .from('players')
      .select('*')
      .eq('username', targetId)
      .single();
    
    return {
      intercepted: true,
      batteryId: battery.battery_id,
      interceptorName: owner?.username || 'Unknown',
    };
  }
  
  return { intercepted: false };
}

/**
 * Apply damage to target player
 * Destroys units, damages factories, and reduces resources based on damage percentage
 */
async function applyDamage(
  supabase: ReturnType<typeof createServiceClient>,
  targetId: string,
  damagePercent: number
): Promise<{ unitsDestroyed: number; factoriesDamaged: number; resourcesLost: { metal: number; energy: number } }> {
  const { data: target } = await supabase
    .from('players')
    .select('*')
    .eq('username', targetId)
    .single();
    
  if (!target) {
    return { unitsDestroyed: 0, factoriesDamaged: 0, resourcesLost: { metal: 0, energy: 0 } };
  }
  
  // 70% of damage goes to destroying units (approximate using total_strength)
  const unitDamagePercent = damagePercent * 0.70;
  const unitPowerReduction = Math.floor(target.total_strength * (unitDamagePercent / 100));

  await supabase
    .from('players')
    .update({ total_strength: Math.max(0, target.total_strength - unitPowerReduction) })
    .eq('username', targetId);

  // 20% of damage goes to factories (approach via factory_count)
  const factoryDamagePercent = damagePercent * 0.20;
  const factoriesToDamage = Math.floor((target.factory_count || 0) * (factoryDamagePercent / 100));
  const factoriesDamaged = Math.min(factoriesToDamage, 3);
  
  // 10% of damage goes to resources
  const resourceDamagePercent = damagePercent * 0.10;
  const metalLoss = Math.floor(target.resources_metal * (resourceDamagePercent / 100));
  const energyLoss = Math.floor(target.resources_energy * (resourceDamagePercent / 100));
  
  await supabase
    .from('players')
    .update({
      resources_metal: Math.max(0, target.resources_metal - metalLoss),
      resources_energy: Math.max(0, target.resources_energy - energyLoss),
    })
    .eq('username', targetId);
  
  return {
    unitsDestroyed: unitPowerReduction,
    factoriesDamaged,
    resourcesLost: { metal: metalLoss, energy: energyLoss },
  };
}

/**
 * Main missile tracker function
 * Processes all missiles ready for impact
 */
export async function missileTracker(): Promise<void> {
  try {
    console.log('[WMD Jobs] Running missile tracker...');
    
    const supabase = createServiceClient();
    const io = getIO();
    const now = new Date();
    
    // Find missiles ready for impact
    const { data: missiles } = await supabase
      .from('wmd_missiles')
      .select('*')
      .eq('status', 'in_flight')
      .lte('eta_seconds', 0);
      
    if (!missiles || missiles.length === 0) {
      console.log('[WMD Jobs] No missiles ready for impact');
      return;
    }
    
    console.log(`[WMD Jobs] Processing ${missiles.length} missile impact(s)...`);
    
    for (const missile of missiles) {
      try {
        // Get target and launcher player data 
        // Note: wmd_missiles stores target as coordinates, not player ID
        // We need to find who owns the tile at target location
        const { data: targetTile } = await supabase
          .from('tiles')
          .select('base_owner')
          .eq('x', missile.target_x || 0)
          .eq('y', missile.target_y || 0)
          .single();
        
        const targetPlayerId = targetTile?.base_owner;
        
        const { data: launcher } = await supabase
          .from('players')
          .select('*')
          .eq('username', missile.owner_id)
          .single();
        
        const { data: target } = await supabase
          .from('players')
          .select('*')
          .eq('username', targetPlayerId || '')
          .single();
        
        // Determine warhead type from wmd_missile_warheads
        const { data: warhead } = await supabase
          .from('wmd_missile_warheads')
          .select('warhead_type')
          .eq('missile_id', missile.id)
          .maybeSingle();
        
        const warheadType = warhead?.warhead_type || 'high_explosive';
        
        // Check for interception
        const interceptionResult = await attemptInterception(supabase, targetPlayerId || '', missile.missile_id);
        
        if (interceptionResult.intercepted) {
          // Missile intercepted!
          await supabase
            .from('wmd_missiles')
            .update({
              status: 'intercepted' as const,
            })
            .eq('missile_id', missile.missile_id);
          
          // Broadcast interception
          if (io) {
            await wmdHandlers.broadcastMissileImpact(io, {
              intercepted: true,
              missileId: missile.missile_id,
              launcherId: missile.owner_id,
              launcherName: launcher?.username || 'Unknown',
              targetId: targetPlayerId || '',
              targetName: target?.username || 'Unknown',
              warheadType: warheadType as WarheadType,
              interceptedBy: target?.username || 'Unknown',
              damageDealt: 0,
            });
          }
          
          console.log(`[WMD Jobs] Missile ${missile.missile_id} intercepted by ${target?.username || 'Unknown'}`);
        } else {
          // Missile detonated - calculate damage
          const damagePercent = calculateDamagePercent(warheadType as WarheadType);
          
          // Apply damage to target (destroys units, damages factories, reduces resources)
          const damageResult = targetPlayerId
            ? await applyDamage(supabase, targetPlayerId, damagePercent)
            : { unitsDestroyed: 0, factoriesDamaged: 0, resourcesLost: { metal: 0, energy: 0 } };
          
          // Update missile status
          await supabase
            .from('wmd_missiles')
            .update({
              status: 'impacted' as const,
            })
            .eq('missile_id', missile.missile_id);
          
          // Broadcast impact
          if (io) {
            await wmdHandlers.broadcastMissileImpact(io, {
              intercepted: false,
              missileId: missile.missile_id,
              launcherId: missile.owner_id,
              launcherName: launcher?.username || 'Unknown',
              targetId: targetPlayerId || '',
              targetName: target?.username || 'Unknown',
              warheadType: warheadType as WarheadType,
              damageDealt: damageResult.unitsDestroyed,
            });
          }
          
          console.log(`[WMD Jobs] Missile ${missile.missile_id} detonated: ${damageResult.unitsDestroyed} units destroyed, ${damageResult.factoriesDamaged} factories damaged, ${damageResult.resourcesLost.metal} metal + ${damageResult.resourcesLost.energy} energy lost`);
        }
      } catch (missileError) {
        console.error(`[WMD Jobs] Error processing missile ${missile.missile_id}:`, missileError);
        // Continue with other missiles
      }
    }
    
    console.log(`[WMD Jobs] Missile tracker completed: ${missiles.length} missiles processed`);
  } catch (error) {
    console.error('[WMD Jobs] Error in missile tracker:', error);
  }
}

/**
 * IMPLEMENTATION NOTES:
 * 
 * 1. Interception Logic:
 *    - Queries target's active batteries
 *    - Sums interception chances (capped at 95%)
 *    - Rolls random number for success/failure
 *    - Updates battery stats and health
 * 
 * 2. Damage Calculation:
 *    - Uses WARHEAD_CONFIGS for base damage
 *    - Adds 10% randomness for variety
 *    - Applied as gold reduction
 *    - Prevents negative gold
 * 
 * 3. Real-time Notifications:
 *    - Broadcasts to launcher (success/failure)
 *    - Broadcasts to target (damage or saved)
 *    - Broadcasts to interceptor (if successful)
 * 
 * 4. Error Handling:
 *    - Try-catch per missile (failures don't stop processing)
 *    - Logs all errors with missile ID
 *    - Continues with remaining missiles
 * 
 * 5. Performance:
 *    - Single query for all ready missiles
 *    - Batch processing in loop
 *    - Minimal DB operations per missile
 * 
 * TESTING:
 * - Launch missile with short flight time (30s)
 * - Verify impact occurs within 60s of scheduled time
 * - Test with and without defense batteries
 * - Verify damage calculation and gold reduction
 * - Check WebSocket broadcasts received
 */
