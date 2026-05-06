/**
 * @file lib/wmd/defenseService.ts
 * @created 2025-10-22
 * @overview WMD Defense Service - Clan Treasury Integrated
 * 
 * OVERVIEW:
 * Handles defense battery deployment and interception mechanics.
 * ALL costs deducted from CLAN TREASURY with equal cost sharing among members.
 * 
 * Features:
 * - Battery deployment via clan bank funding
 * - Battery repairs funded by clan treasury
 * - Interception attempts
 * - Defense status tracking
 * 
 * Clan Treasury Integration:
 * - All battery purchases deducted from clan bank (NOT player resources)
 * - Repair costs paid from clan treasury
 * - Per-member cost calculated: totalCost / memberCount
 * - Minimum 3 clan members required (prevents solo WMD)
 * - Transaction transparency (shows per-member contribution)
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  DefenseBattery,
  BatteryType,
  BatteryStatus,
  InterceptionResult,
  BATTERY_CONFIGS,
} from '@/types/wmd';
import {
  validateClanWMDFunds,
  deductWMDCost,
  WMDPurchaseType,
} from './clanTreasuryWMDService';

/**
 * Deploy a defense battery (clan treasury funded)
 */
export async function deployBattery(
  playerId: string,
  playerUsername: string,
  clanId: string,
  batteryType: BatteryType
): Promise<{ success: boolean; message: string; batteryId?: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const supabase = createServiceClient();
    const batteryConfig = BATTERY_CONFIGS[batteryType];
    
    if (!batteryConfig) {
      return { success: false, message: 'Invalid battery type' };
    }
    
    // Validate clan has funds
    const validation = await validateClanWMDFunds(clanId, batteryConfig.cost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    // Deduct from clan treasury
    const deduction = await deductWMDCost(
      clanId,
      WMDPurchaseType.DEFENSE_BATTERY,
      playerId,
      playerUsername,
      batteryConfig.cost,
      `${batteryType} Defense Battery Deployment`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    const batteryId = `battery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get player position
    const { data: player } = await supabase
      .from('players')
      .select('current_x, current_y')
      .eq('username', playerId)
      .single();
    
    const { error } = await supabase
      .from('wmd_defense_batteries')
      .insert({
        battery_id: batteryId,
        owner_id: playerId,
        owner_username: playerUsername,
        status: 'active',
        tier: batteryConfig.tier,
        interception_range: Math.floor(batteryConfig.interceptChance * 100),
        position_x: player?.current_x || 0,
        position_y: player?.current_y || 0,
      });
    
    if (error) {
      console.error('Error deploying battery:', error);
      return { success: false, message: 'Failed to deploy battery' };
    }
    
    console.log(`Battery deployed by ${playerUsername} (Clan: ${clanId}). Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `${batteryType} battery deployed. Clan cost: ${batteryConfig.cost.metal} metal, ${batteryConfig.cost.energy} energy`,
      batteryId,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error deploying battery:', error);
    return { success: false, message: 'Failed to deploy battery' };
  }
}

/**
 * Attempt missile interception
 */
export async function attemptInterception(
  missileId: string,
  defenderId: string
): Promise<{ success: boolean; result: InterceptionResult; message: string }> {
  try {
    const supabase = createServiceClient();
    
    // Get defender's active batteries
    const { data: batteries } = await supabase
      .from('wmd_defense_batteries')
      .select('*')
      .eq('owner_id', defenderId)
      .eq('status', 'active');
    
    if (!batteries || batteries.length === 0) {
      return {
        success: false,
        result: InterceptionResult.FAILURE,
        message: 'No active defenses available',
      };
    }
    
    // Try each battery
    for (const battery of batteries) {
      const interceptChance = (battery.interception_range || 50) / 100;
      const interceptSuccess = Math.random() < interceptChance;
      
      // Update battery stats
      await supabase
        .from('wmd_defense_batteries')
        .update({
          recharges_at: new Date(Date.now() + (batteryConfig?.cooldownDuration || 30000)).toISOString(),
          status: 'recharging',
        })
        .eq('battery_id', battery.battery_id);
      
      if (interceptSuccess) {
        // Record successful interception
        await supabase
          .from('wmd_interception_attempts')
          .insert({
            launch_id: missileId,
            defender_id: defenderId,
            defender_username: defenderId,
            battery_id: battery.battery_id,
            success: true,
          });
        
        return {
          success: true,
          result: InterceptionResult.SUCCESS,
          message: 'Missile intercepted!',
        };
      }
    }
    
    return {
      success: false,
      result: InterceptionResult.FAILURE,
      message: 'All interception attempts failed',
    };
  } catch (error) {
    console.error('Error attempting interception:', error);
    return {
      success: false,
      result: InterceptionResult.MALFUNCTION,
      message: 'Interception system malfunction',
    };
  }
}

// Helper for cooldown lookup
interface BatteryConfig { cooldownDuration?: number }
const batteryConfig: BatteryConfig | null = null;

/**
 * Get player's defense batteries
 */
export async function getPlayerBatteries(
  ownerId: string
): Promise<any[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wmd_defense_batteries')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    return data || [];
  } catch (error) {
    console.error('Error fetching batteries:', error);
    return [];
  }
}

/**
 * Repair battery (clan treasury funded)
 */
export async function repairBattery(
  batteryId: string,
  playerId: string,
  playerUsername: string
): Promise<{ success: boolean; message: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const supabase = createServiceClient();
    const { data: battery } = await supabase
      .from('wmd_defense_batteries')
      .select('*')
      .eq('battery_id', batteryId)
      .single();
    
    if (!battery) {
      return { success: false, message: 'Battery not found' };
    }
    
    const batteryType = 'STANDARD' as BatteryType;
    const batteryConfigData = BATTERY_CONFIGS[batteryType];
    const repairCost = {
      metal: Math.floor(batteryConfigData.cost.metal * 0.5),
      energy: Math.floor(batteryConfigData.cost.energy * 0.5),
    };
    
    // Find owner clan
    const { data: owner } = await supabase
      .from('players')
      .select('clan_id')
      .eq('username', battery.owner_id)
      .single();
    
    if (!owner?.clan_id) {
      return { success: false, message: 'Owner not in a clan' };
    }
    
    // Validate clan has funds
    const validation = await validateClanWMDFunds(owner.clan_id, repairCost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    // Deduct from clan treasury
    const deduction = await deductWMDCost(
      owner.clan_id,
      WMDPurchaseType.DEFENSE_BATTERY,
      playerId,
      playerUsername,
      repairCost,
      'Battery Repair'
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    const repairMinutes = 1;
    const rechargesAt = new Date(Date.now() + repairMinutes * 60 * 1000).toISOString();
    
    await supabase
      .from('wmd_defense_batteries')
      .update({
        status: 'active',
        recharges_at: rechargesAt,
      })
      .eq('battery_id', batteryId);
    
    console.log(`Battery repair started by ${playerUsername}. Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `Battery repair initiated. Completes in ${repairMinutes} minutes.`,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error repairing battery:', error);
    return { success: false, message: 'Failed to repair battery' };
  }
}

/**
 * Dismantle battery
 */
export async function dismantleBattery(
  batteryId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('wmd_defense_batteries')
      .delete()
      .eq('battery_id', batteryId);
    
    if (error) {
      return { success: false, message: 'Battery not found' };
    }
    
    return {
      success: true,
      message: 'Battery dismantled',
    };
  } catch (error) {
    console.error('Error dismantling battery:', error);
    return { success: false, message: 'Failed to dismantle battery' };
  }
}
