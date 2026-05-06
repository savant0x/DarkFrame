/**
 * @file lib/wmd/missileService.ts
 * @created 2025-10-22
 * @overview WMD Missile Service - Clan Treasury Integrated
 * 
 * OVERVIEW:
 * Handles missile assembly, launch operations, and lifecycle management.
 * ALL costs deducted from CLAN TREASURY with equal cost sharing among members.
 * 
 * Features:
 * - Missile creation via clan bank funding
 * - Component assembly with per-member cost tracking
 * - Launch mechanics with clan authorization
 * - Status tracking
 * 
 * Clan Treasury Integration:
 * - All component purchases deducted from clan bank (NOT player resources)
 * - Per-member cost calculated: totalCost / memberCount
 * - Minimum 3 clan members required (prevents solo WMD)
 * - Transaction transparency (shows per-member contribution)
 * 
 * Dependencies:
 * - /types/wmd for missile types
 * - clanTreasuryWMDService for funding validation/deduction
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  Missile,
  MissileStatus,
  WarheadType,
  WARHEAD_CONFIGS,
  MissileComponent,
  COMPONENT_COSTS,
} from '@/types/wmd';
import {
  validateClanWMDFunds,
  deductWMDCost,
  WMDPurchaseType,
} from './clanTreasuryWMDService';

/**
 * Create a new missile (clan treasury funded)
 */
export async function createMissile(
  playerId: string,
  playerUsername: string,
  clanId: string,
  warheadType: WarheadType
): Promise<{ success: boolean; message: string; missileId?: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const supabase = createServiceClient();
    const warheadConfig = WARHEAD_CONFIGS[warheadType];
    
    if (!warheadConfig) {
      return { success: false, message: 'Invalid warhead type' };
    }
    
    // Initial missile creation cost (warhead base cost)
    const initialCost = warheadConfig.cost;
    
    // Validate clan has funds
    const validation = await validateClanWMDFunds(clanId, initialCost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    // Deduct from clan treasury
    const deduction = await deductWMDCost(
      clanId,
      WMDPurchaseType.MISSILE_COMPONENT,
      playerId,
      playerUsername,
      initialCost,
      `${warheadType} Missile Creation`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    // Create missile
    const missileId = `missile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error } = await supabase
      .from('wmd_missiles')
      .insert({
        missile_id: missileId,
        owner_id: playerId,
        owner_username: playerUsername,
        status: 'preparing',
        name: `${warheadType} missile`,
        damage_radius: 0,
      });
    
    if (error) {
      console.error('Error creating missile:', error);
      return { success: false, message: 'Failed to create missile' };
    }
    
    console.log(`Missile created by ${playerUsername} (Clan: ${clanId}). Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `${warheadType} missile created. Clan cost: ${initialCost.metal} metal, ${initialCost.energy} energy`,
      missileId,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error creating missile:', error);
    return { success: false, message: 'Failed to create missile' };
  }
}

/**
 * Assemble a component (clan treasury funded)
 */
export async function assembleComponent(
  missileId: string,
  component: MissileComponent,
  playerId: string,
  playerUsername: string
): Promise<{ success: boolean; message: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const supabase = createServiceClient();
    const { data: missile } = await supabase
      .from('wmd_missiles')
      .select('*')
      .eq('missile_id', missileId)
      .single();
    
    if (!missile) {
      return { success: false, message: 'Missile not found' };
    }
    
    // Check component already assembled via missile_damage tracking
    // For now, proceed with assembly
    
    // Get component cost
    const componentConfig = COMPONENT_COSTS[component];
    // Calculate cost with tier multiplier based on damage_radius tier
    const tierMultiplier = missile.damage_radius > 0 ? 2 : 1;
    
    const componentCost = {
      metal: Math.floor(componentConfig.baseCost.metal * Math.pow(componentConfig.tierMultiplier, tierMultiplier - 1)),
      energy: Math.floor(componentConfig.baseCost.energy * Math.pow(componentConfig.tierMultiplier, tierMultiplier - 1)),
    };
    
    // Validate clan funds (using owner_username to find clan)
    const { data: owner } = await supabase
      .from('players')
      .select('clan_id')
      .eq('username', missile.owner_id)
      .single();
    
    if (!owner?.clan_id) {
      return { success: false, message: 'Player not in a clan' };
    }
    
    const validation = await validateClanWMDFunds(owner.clan_id, componentCost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    // Deduct from clan treasury
    const deduction = await deductWMDCost(
      owner.clan_id,
      WMDPurchaseType.MISSILE_COMPONENT,
      playerId,
      playerUsername,
      componentCost,
      `${component} component for missile`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    // Update missile - increment damage_radius to track assembly progress
    const newProgress = (missile.damage_radius || 0) + 1;
    const allReady = newProgress >= 5; // 5 components to assemble
    
    await supabase
      .from('wmd_missiles')
      .update({
        damage_radius: newProgress,
        assembled_at: allReady ? new Date().toISOString() : null,
        status: allReady ? 'preparing' : missile.status,
      })
      .eq('missile_id', missileId);
    
    console.log(`Component ${component} assembled by ${playerUsername}. Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return {
      success: true,
      message: `${component} component assembled. Clan cost: ${componentCost.metal} metal, ${componentCost.energy} energy`,
      perMemberCost: deduction.perMemberCost,
    };
  } catch (error) {
    console.error('Error assembling component:', error);
    return { success: false, message: 'Failed to assemble component' };
  }
}

/**
 * Launch a missile
 */
export async function launchMissile(
  missileId: string,
  targetId: string,
  launchedBy: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServiceClient();
    const { data: missile } = await supabase
      .from('wmd_missiles')
      .select('*')
      .eq('missile_id', missileId)
      .single();
    
    if (!missile) {
      return { success: false, message: 'Missile not found' };
    }
    
    if (missile.status === 'in_flight' || missile.status === 'impacted') {
      return { success: false, message: 'Missile not ready for launch' };
    }
    
    // Get target player position
    const { data: target } = await supabase
      .from('players')
      .select('current_x, current_y')
      .eq('username', targetId)
      .single();
    
    const targetX = target?.current_x || 0;
    const targetY = target?.current_y || 0;
    const etaSeconds = 300; // Default 5 minute flight time
    
    await supabase
      .from('wmd_missiles')
      .update({
        status: 'in_flight',
        target_x: targetX,
        target_y: targetY,
        eta_seconds: etaSeconds,
        launched_at: new Date().toISOString(),
      })
      .eq('missile_id', missileId);
    
    // Record launch history
    await supabase
      .from('wmd_launch_history')
      .insert({
        launch_id: `launch_${Date.now()}`,
        missile_id: missileId,
        owner_id: missile.owner_id,
        owner_username: missile.owner_username,
        status: 'in_flight',
        target_x: targetX,
        target_y: targetY,
      });
    
    return {
      success: true,
      message: `Missile launched. ETA: ${Math.floor(etaSeconds / 60)} minutes`,
    };
  } catch (error) {
    console.error('Error launching missile:', error);
    return { success: false, message: 'Failed to launch missile' };
  }
}

/**
 * Get player's missiles
 */
export async function getPlayerMissiles(
  ownerId: string
): Promise<any[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wmd_missiles')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    return data || [];
  } catch (error) {
    console.error('Error fetching missiles:', error);
    return [];
  }
}

/**
 * Dismantle missile
 */
export async function dismantleMissile(
  missileId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('wmd_missiles')
      .delete()
      .eq('missile_id', missileId);
    
    if (error) {
      return { success: false, message: 'Missile not found' };
    }
    
    return {
      success: true,
      message: 'Missile dismantled',
    };
  } catch (error) {
    console.error('Error dismantling missile:', error);
    return { success: false, message: 'Failed to dismantle missile' };
  }
}
