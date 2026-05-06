/**
 * @file lib/wmd/sabotageEngine.ts
 * @created 2025-10-22
 * @overview WMD Sabotage Engine - Component Destruction Mechanics
 * 
 * OVERVIEW:
 * Handles sabotage operations against missiles, factories, and research.
 * Calculates damage to components and applies sabotage effects.
 * 
 * Features:
 * - Component damage calculation
 * - Progress loss mechanics
 * - Resource destruction
 * - Sabotage detection
 */

import { createServiceClient } from '@/lib/supabase/server';

/**
 * Sabotage result interface
 */
export interface SabotageResult {
  success: boolean;
  detected: boolean;
  damageDealt: number;
  componentsDestroyed: string[];
  progressLost: number;
  resourcesWasted: { metal: number; energy: number };
}

/**
 * Execute sabotage operation
 */
export async function executeSabotage(
  spyId: string,
  targetType: 'MISSILE' | 'FACTORY' | 'RESEARCH',
  targetId: string,
  sabotageSkill: number
): Promise<SabotageResult> {
  try {
    // Calculate success chance
    const successChance = calculateSuccessChance(targetType, sabotageSkill);
    const success = Math.random() < successChance;
    
    // Calculate detection risk
    const detectionRisk = calculateDetectionRisk(targetType, sabotageSkill);
    const detected = Math.random() < detectionRisk;
    
    const result: SabotageResult = {
      success,
      detected,
      damageDealt: 0,
      componentsDestroyed: [],
      progressLost: 0,
      resourcesWasted: { metal: 0, energy: 0 },
    };
    
    if (success) {
      // Apply sabotage damage
      const damage = await applySabotageDamage(targetType, targetId, sabotageSkill);
      Object.assign(result, damage);
    }
    
    // Record sabotage operation
    await recordSabotage(spyId, targetType, targetId, result);
    
    return result;
    
  } catch (error) {
    console.error('Error executing sabotage:', error);
    return {
      success: false,
      detected: true,
      damageDealt: 0,
      componentsDestroyed: [],
      progressLost: 0,
      resourcesWasted: { metal: 0, energy: 0 },
    };
  }
}

/**
 * Calculate sabotage success chance
 */
function calculateSuccessChance(targetType: string, sabotageSkill: number): number {
  const baseChance = sabotageSkill / 100; // 0-100 skill maps to 0-100% base
  
  const difficultyMap: Record<string, number> = {
    'MISSILE': 0.7,    // Easier
    'FACTORY': 0.5,    // Moderate
    'RESEARCH': 0.3,   // Harder
  };
  
  const difficulty = difficultyMap[targetType] || 0.5;
  return Math.min(0.9, baseChance * difficulty);
}

/**
 * Calculate detection risk
 */
function calculateDetectionRisk(targetType: string, sabotageSkill: number): number {
  const baseRisk: Record<string, number> = {
    'MISSILE': 0.4,
    'FACTORY': 0.5,
    'RESEARCH': 0.6,
  };
  
  const risk = (baseRisk[targetType] || 0.5) - (sabotageSkill / 200);
  return Math.max(0.1, Math.min(0.9, risk));
}

/**
 * Apply sabotage damage to target
 */
async function applySabotageDamage(
  targetType: string,
  targetId: string,
  sabotageSkill: number
): Promise<Partial<SabotageResult>> {
  const supabase = createServiceClient();
  const damage: Partial<SabotageResult> = {
    damageDealt: 0,
    componentsDestroyed: [],
    progressLost: 0,
    resourcesWasted: { metal: 0, energy: 0 },
  };
  
  if (targetType === 'MISSILE') {
    // Damage missile assembly
    const progressLost = Math.floor((sabotageSkill / 100) * 25); // Up to 25%
    damage.progressLost = progressLost;
    damage.damageDealt = progressLost * 1000;
    damage.resourcesWasted = {
      metal: progressLost * 10000,
      energy: progressLost * 15000,
    };
    
    // Update missile in database
    const { data: missile } = await supabase
      .from('wmd_missiles')
      .select('*')
      .eq('missile_id', targetId)
      .single();
    
    if (missile) {
      await supabase
        .from('wmd_missiles')
        .update({ 
          damage_radius: (missile.damage_radius || 0) + progressLost 
        })
        .eq('missile_id', targetId);
    }
  } else if (targetType === 'FACTORY') {
    // Damage factory production
    damage.damageDealt = sabotageSkill * 100;
    damage.resourcesWasted = {
      metal: sabotageSkill * 500,
      energy: sabotageSkill * 750,
    };
    
    const { data: factory } = await supabase
      .from('factories')
      .select('*')
      .eq('id', targetId)
      .single();
    
    if (factory) {
      await supabase
        .from('factories')
        .update({ 
          production_rate: Math.max(0, factory.production_rate - Math.floor(sabotageSkill / 10)) 
        })
        .eq('id', targetId);
    }
  } else if (targetType === 'RESEARCH') {
    // Delay research progress
    damage.progressLost = Math.floor(sabotageSkill / 5); // Slow down research
    damage.damageDealt = sabotageSkill * 50;
  }
  
  return damage;
}

/**
 * Record sabotage operation
 */
async function recordSabotage(
  spyId: string,
  targetType: string,
  targetId: string,
  result: SabotageResult
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('wmd_sabotage_events').insert({
      event_id: `sab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      saboteur_id: spyId,
      target_player_id: targetId,
      sabotage_type: targetType,
      severity: result.damageDealt,
      successful: result.success,
      detected: result.detected,
      damage_description: `Damage: ${result.damageDealt}, Progress Lost: ${result.progressLost}`,
    });
  } catch (error) {
    console.error('Error recording sabotage:', error);
  }
}

/**
 * Get sabotage history for player
 */
export async function getSabotageHistory(
  playerId: string,
  limit: number = 20
): Promise<any[]> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wmd_sabotage_events')
      .select('*')
      .eq('target_player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  } catch (error) {
    console.error('Error getting sabotage history:', error);
    return [];
  }
}
