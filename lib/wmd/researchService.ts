/**
 * @file lib/wmd/researchService.ts
 * @created 2025-10-22
 * @updated 2026-04-04 (Migrated to Drizzle ORM)
 * @overview WMD Research Service - Tech Tree and RP Spending
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { playerResearch } from '@/lib/db/schema/wmd';
import { players } from '@/lib/db/schema/players';
import {
  ResearchTech,
  PlayerResearch,
  ALL_RESEARCH_TECHS,
  isValidTechId,
  WMDEventType,
  NotificationPriority,
  NotificationScope,
} from '@/types/wmd';

import { spendResearchPoints } from '@/lib/xpService';

/** The real shape stored in `player_research` (one row per player). */
export type PlayerResearchRow = typeof playerResearch.$inferSelect;

/** Maps a stored row to the domain shape, computing the nested `currentResearch`. */
function rowToPlayerResearch(row: PlayerResearchRow): PlayerResearch {
  const bonusValue = Number(row.clanResearchBonus ?? 0);
  return {
    playerId: row.playerId,
    playerUsername: row.playerUsername,
    clanId: row.clanId ?? undefined,
    completedTechs: row.completedTechs ?? [],
    availableTechs: row.availableTechs ?? [],
    lockedTechs: row.lockedTechs ?? [],
    currentResearch:
      row.currentResearchTechId !== null &&
      row.currentResearchStartedAt !== null &&
      row.currentResearchRpSpent !== null &&
      row.currentResearchRpRequired !== null &&
      row.currentResearchRpRequired > 0
        ? {
            techId: row.currentResearchTechId,
            startedAt: row.currentResearchStartedAt,
            rpSpent: row.currentResearchRpSpent,
            rpRequired: row.currentResearchRpRequired,
            progress: Math.floor(
              (row.currentResearchRpSpent / row.currentResearchRpRequired) * 100
            ),
          }
        : undefined,
    missileTier: row.missileTier ?? 0,
    defenseTier: row.defenseTier ?? 0,
    intelligenceTier: row.intelligenceTier ?? 0,
    totalRPSpent: row.totalRPSpent ?? 0,
    totalTechsUnlocked: row.totalTechsUnlocked ?? 0,
    clanResearchBonus: bonusValue,
    updatedAt: row.updatedAt,
  };
}

export async function canStartResearch(
  playerId: string, 
  techId: string
): Promise<{ canStart: boolean; reason?: string }> {
  try {
    if (!isValidTechId(techId)) {
      return { canStart: false, reason: 'Invalid tech ID' };
    }
    
    const tech = ALL_RESEARCH_TECHS.find(t => t.techId === techId);
    if (!tech) {
      return { canStart: false, reason: 'Tech not found' };
    }
    
    const pr = await getPlayerResearch(playerId);
    if (!pr) {
      return { canStart: false, reason: 'Player research not initialized' };
    }
    
    if (pr.completedTechs.includes(techId)) {
      return { canStart: false, reason: 'Tech already completed' };
    }
    
    if (pr.currentResearch?.techId === techId) {
      return { canStart: false, reason: 'Already researching this tech' };
    }
    
    if (pr.currentResearch) {
      return { canStart: false, reason: 'Another research is already active' };
    }
    
    const unmetPrerequisites = tech.prerequisites.filter(
      prereq => !pr.completedTechs.includes(prereq)
    );
    
    if (unmetPrerequisites.length > 0) {
      return { 
        canStart: false, 
        reason: `Missing prerequisites: ${unmetPrerequisites.join(', ')}` 
      };
    }
    
    if (tech.requiredLevel) {
      const playerLevel = await getPlayerLevel(playerId);
      if (playerLevel < tech.requiredLevel) {
        return { 
          canStart: false, 
          reason: `Requires player level ${tech.requiredLevel}` 
        };
      }
    }
    
    if (tech.requiredClanLevel && pr.clanId) {
      const clanLevel = await getClanLevel(pr.clanId);
      if (clanLevel < tech.requiredClanLevel) {
        return { 
          canStart: false, 
          reason: `Requires clan level ${tech.requiredClanLevel}` 
        };
      }
    }
    
    const playerResult = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const player = playerResult[0];
    const playerRP = player?.researchPoints || 0;
    
    if (playerRP < tech.rpCost) {
      return { 
        canStart: false, 
        reason: `Insufficient RP. Need ${tech.rpCost}, have ${playerRP}` 
      };
    }
    
    return { canStart: true };
  } catch (error) {
    console.error('Error validating research:', error);
    return { canStart: false, reason: 'Internal server error' };
  }
}

export function calculateEffectiveRPCost(
  tech: ResearchTech,
  hasClanBonus: boolean
): number {
  let cost = tech.rpCost;
  if (hasClanBonus) {
    cost = Math.floor(cost * 0.9);
  }
  return cost;
}

export async function startResearch(
  playerId: string,
  techId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const validation = await canStartResearch(playerId, techId);
    if (!validation.canStart) {
      return { success: false, message: validation.reason || 'Cannot start research' };
    }
    
    const tech = ALL_RESEARCH_TECHS.find(t => t.techId === techId)!;
    const pr = await getPlayerResearchRow(playerId);
    const hasBonus = Number(pr?.clanResearchBonus ?? 0) > 0;
    const effectiveCost = calculateEffectiveRPCost(tech, hasBonus);
    
    const existingCheck = await db.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1);
    if (existingCheck.length === 0) {
      return { success: false, message: 'Failed to start research' };
    }
    
    await db.update(playerResearch).set({
      currentResearchTechId: techId,
      currentResearchStartedAt: new Date(),
      currentResearchRpSpent: 0,
      currentResearchRpRequired: effectiveCost,
      updatedAt: new Date(),
    }).where(eq(playerResearch.playerId, playerId));
    
    await recalculateAvailableTechs(playerId);
    
    return { 
      success: true, 
      message: `Started research on ${tech.name}. Cost: ${effectiveCost} RP` 
    };
  } catch (error) {
    console.error('Error starting research:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function spendRPOnResearch(
  playerId: string,
  amount: number
): Promise<{ success: boolean; message: string; completed?: boolean }> {
  try {
    const pr = await getPlayerResearchRow(playerId);
    if (!pr) {
      return { success: false, message: 'Player research not found' };
    }
    
    if (!pr.currentResearchTechId || pr.completedTechs === null || pr.totalRPSpent === null) {
      return { success: false, message: 'No active research' };
    }
    
    const playerResult = await db.select().from(players).where(eq(players.username, playerId)).limit(1);
    const player = playerResult[0];
    const playerRP = player?.researchPoints || 0;
    
    if (playerRP < amount) {
      return { success: false, message: `Insufficient RP. Have ${playerRP}, need ${amount}` };
    }
    
    const spendResult = await spendResearchPoints(playerId, amount, 'WMD Research');
    if (!spendResult.success) {
      return { success: false, message: spendResult.message };
    }
    
    const currentRpSpent = pr.currentResearchRpSpent ?? 0;
    const newRPSpent = currentRpSpent + amount;
    const rpRequired = pr.currentResearchRpRequired ?? 0;
    const activeTechId = pr.currentResearchTechId;
    const isCompleted = newRPSpent >= rpRequired;
    
    if (isCompleted) {
      const completedTech = ALL_RESEARCH_TECHS.find(t => t.techId === activeTechId);
      if (!completedTech) {
        return { success: false, message: 'Active research tech no longer exists' };
      }
      
      const updatedTechs = [...pr.completedTechs, completedTech.techId];
      
      await db.update(playerResearch).set({
        currentResearchTechId: null,
        currentResearchStartedAt: null,
        currentResearchRpSpent: null,
        currentResearchRpRequired: null,
        totalRPSpent: pr.totalRPSpent + amount,
        completedTechs: updatedTechs,
        totalTechsUnlocked: pr.totalTechsUnlocked === null ? 1 : pr.totalTechsUnlocked + 1,
        updatedAt: new Date(),
      }).where(eq(playerResearch.playerId, playerId));
      
      await applyTechEffects(playerId, completedTech);
      await recalculateAvailableTechs(playerId);
      await sendResearchCompletedNotification(playerId, completedTech);
      
      return { 
        success: true, 
        message: `Research completed! ${completedTech.name} unlocked.`, 
        completed: true 
      };
    } else {
      await db.update(playerResearch).set({
        currentResearchRpSpent: newRPSpent,
        totalRPSpent: pr.totalRPSpent + amount,
        updatedAt: new Date(),
      }).where(eq(playerResearch.playerId, playerId));
      
      const progress = rpRequired > 0 ? Math.floor((newRPSpent / rpRequired) * 100) : 0;
      return { 
        success: true, 
        message: `Research progress: ${progress}% (${newRPSpent}/${rpRequired} RP)`,
        completed: false
      };
    }
  } catch (error) {
    console.error('Error spending RP on research:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function cancelResearch(
  playerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const existingCheck = await db.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1);
    if (existingCheck.length === 0 || !existingCheck[0].currentResearchTechId) {
      return { success: false, message: 'No active research to cancel' };
    }
    
    await db.update(playerResearch).set({
      currentResearchTechId: null,
      currentResearchStartedAt: null,
      currentResearchRpSpent: null,
      currentResearchRpRequired: null,
      updatedAt: new Date(),
    }).where(eq(playerResearch.playerId, playerId));
    
    await recalculateAvailableTechs(playerId);
    
    return { success: true, message: 'Research cancelled' };
  } catch (error) {
    console.error('Error cancelling research:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function recalculateAvailableTechs(
  playerId: string
): Promise<void> {
  try {
    const pr = await getPlayerResearch(playerId);
    if (!pr) return;
    
    const availableTechs: string[] = [];
    const lockedTechs: string[] = [];
    
    for (const tech of ALL_RESEARCH_TECHS) {
      if (pr.completedTechs.includes(tech.techId)) {
        continue;
      }
      
      const prerequisitesMet = tech.prerequisites.every(
        prereq => pr.completedTechs.includes(prereq)
      );
      
      if (prerequisitesMet) {
        availableTechs.push(tech.techId);
      } else {
        lockedTechs.push(tech.techId);
      }
    }
    
    await db.update(playerResearch).set({
      availableTechs,
      lockedTechs,
      updatedAt: new Date(),
    }).where(eq(playerResearch.playerId, playerId));
  } catch (error) {
    console.error('Error recalculating available techs:', error);
  }
}

export async function getAvailableTechs(
  playerId: string
): Promise<ResearchTech[]> {
  try {
    const pr = await getPlayerResearch(playerId);
    if (!pr) {
      return [];
    }
    
    const availableTechs = ALL_RESEARCH_TECHS.filter(tech => 
      pr.availableTechs.includes(tech.techId) &&
      !pr.completedTechs.includes(tech.techId)
    );
    
    return availableTechs;
  } catch (error) {
    console.error('Error getting available techs:', error);
    return [];
  }
}

async function applyTechEffects(
  playerId: string,
  tech: ResearchTech
): Promise<void> {
  try {
    console.log(`Applied effects for ${tech.name} to player ${playerId}`);
  } catch (error) {
    console.error('Error applying tech effects:', error);
  }
}

export async function initializePlayerResearch(
  playerId: string,
  playerUsername: string,
  clanId?: string
): Promise<PlayerResearch> {
  try {
    const existingResult = await db.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1);
    const existing = existingResult[0];
    if (existing) {
      return rowToPlayerResearch(existing);
    }
    
    const startingTechs = ['missile_tier_1', 'defense_tier_1', 'spy_tier_1'];
    const lockedTechs = ALL_RESEARCH_TECHS
      .filter(t => !startingTechs.includes(t.techId))
      .map(t => t.techId);
    
    const id = `pr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newResearch: typeof playerResearch.$inferInsert = {
      id,
      playerId,
      playerUsername,
      clanId: clanId || null,
      completedTechs: [],
      availableTechs: startingTechs,
      lockedTechs,
      currentResearchTechId: null,
      currentResearchStartedAt: null,
      currentResearchRpSpent: null,
      currentResearchRpRequired: null,
      missileTier: 0,
      defenseTier: 0,
      intelligenceTier: 0,
      totalRPSpent: 0,
      totalTechsUnlocked: 0,
      clanResearchBonus: clanId ? '5' : '0',
      updatedAt: new Date(),
    };
    
    await db.insert(playerResearch).values(newResearch);
    const insertedRow: PlayerResearchRow = {
      id,
      playerId,
      playerUsername,
      clanId: clanId ?? null,
      completedTechs: [],
      availableTechs: startingTechs,
      lockedTechs,
      currentResearchTechId: null,
      currentResearchStartedAt: null,
      currentResearchRpSpent: null,
      currentResearchRpRequired: null,
      currentResearchProgress: null,
      missileTier: 0,
      defenseTier: 0,
      intelligenceTier: 0,
      totalRPSpent: 0,
      totalTechsUnlocked: 0,
      clanResearchBonus: newResearch.clanResearchBonus ?? null,
      updatedAt: newResearch.updatedAt,
    };
    return rowToPlayerResearch(insertedRow);
  } catch (error) {
    console.error('Error initializing player research:', error);
    throw error;
  }
}

/** Fetches the raw stored row, or null when the player has no research record. */
export async function getPlayerResearchRow(
  playerId: string
): Promise<PlayerResearchRow | null> {
  try {
    const result = await db.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1);
    return result[0] ?? null;
  } catch (error) {
    console.error('Error getting player research row:', error);
    return null;
  }
}

export async function getPlayerResearch(
  playerId: string
): Promise<PlayerResearch | null> {
  try {
    const row = await getPlayerResearchRow(playerId);
    return row ? rowToPlayerResearch(row) : null;
  } catch (error) {
    console.error('Error getting player research:', error);
    return null;
  }
}

export async function getResearchStats(
  playerId: string
): Promise<{
  totalTechs: number;
  completedTechs: number;
  availableTechs: number;
  totalRPSpent: number;
  currentResearch?: {
    techName: string;
    progress: number;
    rpSpent: number;
    rpRequired: number;
  };
}> {
  try {
    const pr = await getPlayerResearch(playerId);
    
    if (!pr) {
      return {
        totalTechs: ALL_RESEARCH_TECHS.length,
        completedTechs: 0,
        availableTechs: 0,
        totalRPSpent: 0,
      };
    }
    
    const stats = {
      totalTechs: ALL_RESEARCH_TECHS.length,
      completedTechs: pr.completedTechs.length,
      availableTechs: pr.availableTechs.length,
      totalRPSpent: pr.totalRPSpent,
      ...(pr.currentResearch
        ? {
            currentResearch: {
              techName:
                ALL_RESEARCH_TECHS.find(t => t.techId === pr.currentResearch?.techId)?.name ??
                pr.currentResearch.techId,
              progress: pr.currentResearch.progress,
              rpSpent: pr.currentResearch.rpSpent,
              rpRequired: pr.currentResearch.rpRequired,
            },
          }
        : {}),
    };
    
    return stats;
  } catch (error) {
    console.error('Error getting research stats:', error);
    throw error;
  }
}

async function getPlayerLevel(_playerId: string): Promise<number> {
  return 50;
}

async function getClanLevel(_clanId: string): Promise<number> {
  return 5;
}

async function sendResearchCompletedNotification(
  playerId: string,
  tech: ResearchTech
): Promise<void> {
  try {
    const { createWMDNotification } = await import('@/lib/wmd/notificationService');
    
    await createWMDNotification(
      WMDEventType.RESEARCH_COMPLETED,
      NotificationPriority.INFO,
      NotificationScope.GLOBAL,
      playerId,
      'System',
      'Research Complete',
      `\u2705 ${tech.name} unlocked!`,
      {
        techId: tech.techId,
        techName: tech.name,
        category: tech.category,
      },
      playerId,
      'You'
    );
  } catch (error) {
    console.error('Error sending research notification:', error);
  }
}
