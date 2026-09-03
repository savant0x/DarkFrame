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
 * 
 * Dependencies:
 * - /types/wmd for sabotage types
 * - Drizzle ORM for target data
 */

import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { missiles, playerResearch, wmdSabotageOperations } from '@/lib/db/schema/wmd';
import { factories } from '@/lib/db/schema/factories';

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
    const successChance = calculateSuccessChance(targetType, sabotageSkill);
    const success = Math.random() < successChance;
    
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
      const damage = await applySabotageDamage(targetType, targetId, sabotageSkill);
      Object.assign(result, damage);
    }
    
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
  const baseChance = sabotageSkill / 100;
  
  const difficultyMap: Record<string, number> = {
    'MISSILE': 0.7,
    'FACTORY': 0.5,
    'RESEARCH': 0.3,
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
  const damage: Partial<SabotageResult> = {
    damageDealt: 0,
    componentsDestroyed: [],
    progressLost: 0,
    resourcesWasted: { metal: 0, energy: 0 },
  };
  
  if (targetType === 'MISSILE') {
    const progressLost = Math.floor((sabotageSkill / 100) * 25);
    damage.progressLost = progressLost;
    damage.damageDealt = progressLost * 1000;
    damage.resourcesWasted = {
      metal: progressLost * 10000,
      energy: progressLost * 15000,
    };
    
    await db.update(missiles)
      .set({ updatedAt: new Date() })
      .where(eq(missiles.id, targetId));
  } else if (targetType === 'FACTORY') {
    damage.damageDealt = sabotageSkill * 100;
    damage.resourcesWasted = {
      metal: sabotageSkill * 500,
      energy: sabotageSkill * 750,
    };
    
    const [factoryX, factoryY] = targetId.split(',').map(Number);
    await db.update(factories)
      .set({ defense: 0 })
      .where(and(eq(factories.x, factoryX), eq(factories.y, factoryY)));
  } else if (targetType === 'RESEARCH') {
    damage.progressLost = Math.floor(sabotageSkill / 5);
    damage.damageDealt = sabotageSkill * 50;
    
    await db.update(playerResearch)
      .set({ updatedAt: new Date() })
      .where(eq(playerResearch.playerId, targetId));
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
    await db.insert(wmdSabotageOperations).values({
      id: `sabop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sabotageId: `sab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      spyId,
      targetType,
      targetId,
      operatorId: spyId,
      operatorUsername: '',
      targetPlayerId: targetId,
      success: result.success ? 1 : 0,
      detected: result.detected ? 1 : 0,
      damageDealt: {
        sabotageId: `sab_${Date.now()}`,
        missionId: '',
        saboteurId: spyId,
        saboteurName: '',
        targetId,
        damage: result.damageDealt,
        componentsDestroyed: result.componentsDestroyed,
        progressLost: result.progressLost,
        resourcesWasted: result.resourcesWasted,
      },
      executedAt: new Date(),
      createdAt: new Date(),
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
): Promise<Array<typeof wmdSabotageOperations.$inferSelect>> {
  try {
    return await db.select()
      .from(wmdSabotageOperations)
      .where(eq(wmdSabotageOperations.targetPlayerId, playerId))
      .orderBy(desc(wmdSabotageOperations.executedAt))
      .limit(limit);
  } catch (error) {
    console.error('Error getting sabotage history:', error);
    return [];
  }
}
