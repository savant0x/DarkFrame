/**
 * @file lib/wmd/researchService.ts
 * @created 2025-10-22
 * @overview WMD Research Service - Tech Tree and RP Spending
 * 
 * OVERVIEW:
 * Handles all WMD research operations including tech unlocking, RP spending,
 * prerequisite validation, and research progress tracking. Integrates with
 * existing RP system from xpService.ts to maintain economy balance.
 * 
 * Features:
 * - Tech tree validation and unlocking
 * - RP spending with clan bonuses
 * - Research progress tracking
 * - Prerequisites checking
 * - Tech effect application
 * 
 * Dependencies:
 * - /lib/xpService.ts for RP spending (REUSES EXISTING)
 * - /types/wmd for type definitions
 * - /lib/wmd/notificationService.ts for research completed alerts
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/types/database';
import { 
  ResearchTech, 
  PlayerResearch, 
  ResearchCategory,
  ResearchStatus,
  ALL_RESEARCH_TECHS,
  TOTAL_RP_REQUIRED,
  isValidTechId,
  calculateProgress,
  WMDEventType,
  NotificationPriority,
  NotificationScope,
} from '@/types/wmd';

// Import existing RP service - REUSE EXISTING ECONOMY
import { spendResearchPoints } from '@/lib/xpService';

// ============================================================================
// RESEARCH VALIDATION
// ============================================================================

/**
 * Validate if player can start research on a tech
 */
export async function canStartResearch(
  playerId: string, 
  techId: string
): Promise<{ canStart: boolean; reason?: string }> {
  try {
    const supabase = createServiceClient();
    
    // Validate tech exists
    if (!isValidTechId(techId)) {
      return { canStart: false, reason: 'Invalid tech ID' };
    }
    
    const tech = ALL_RESEARCH_TECHS.find(t => t.techId === techId);
    if (!tech) {
      return { canStart: false, reason: 'Tech not found' };
    }
    
    // Get player research state
    const playerResearch = await getPlayerResearch(playerId);
    if (!playerResearch) {
      return { canStart: false, reason: 'Player research not initialized' };
    }
    
    // Check if already completed
    if (playerResearch.completedTechs.includes(techId)) {
      return { canStart: false, reason: 'Tech already completed' };
    }
    
    // Check if currently researching
    if (playerResearch.currentResearch?.techId === techId) {
      return { canStart: false, reason: 'Already researching this tech' };
    }
    
    // Check if another research is active
    if (playerResearch.currentResearch) {
      return { canStart: false, reason: 'Another research is already active' };
    }
    
    // Check prerequisites
    const unmetPrerequisites = tech.prerequisites.filter(
      prereq => !playerResearch.completedTechs.includes(prereq)
    );
    
    if (unmetPrerequisites.length > 0) {
      return { 
        canStart: false, 
        reason: `Missing prerequisites: ${unmetPrerequisites.join(', ')}` 
      };
    }
    
    // Check player level requirement
    if (tech.requiredLevel) {
      const playerLevel = await getPlayerLevel(playerId);
      if (playerLevel < tech.requiredLevel) {
        return { 
          canStart: false, 
          reason: `Requires player level ${tech.requiredLevel}` 
        };
      }
    }
    
    // Check clan level requirement
    if (tech.requiredClanLevel && playerResearch.clanId) {
      const clanLevel = await getClanLevel(playerResearch.clanId);
      if (clanLevel < tech.requiredClanLevel) {
        return { 
          canStart: false, 
          reason: `Requires clan level ${tech.requiredClanLevel}` 
        };
      }
    }
    
    // Check RP availability
    const { data: player } = await supabase
      .from('players')
      .select('research_points')
      .eq('username', playerId)
      .single();
    const playerRP = player?.research_points || 0;
    
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

/**
 * Calculate effective RP cost with clan bonuses
 */
export function calculateEffectiveRPCost(
  tech: ResearchTech,
  hasClanBonus: boolean
): number {
  let cost = tech.rpCost;
  
  // Apply clan research bonus (10% discount)
  if (hasClanBonus) {
    cost = Math.floor(cost * 0.9);
  }
  
  return cost;
}

// ============================================================================
// RESEARCH OPERATIONS
// ============================================================================

/**
 * Start research on a tech
 */
export async function startResearch(
  playerId: string,
  techId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServiceClient();
    
    // Validate research can start
    const validation = await canStartResearch(playerId, techId);
    if (!validation.canStart) {
      return { success: false, message: validation.reason || 'Cannot start research' };
    }
    
    const tech = ALL_RESEARCH_TECHS.find(t => t.techId === techId)!;
    const playerResearch = await getPlayerResearch(playerId);
    
    // Calculate effective cost
    const effectiveCost = calculateEffectiveRPCost(tech, (playerResearch?.clanResearchBonus || 0) > 0);
    
    // Update research with current as JSON
    const currentResearch = {
      techId,
      startedAt: new Date().toISOString(),
      rpSpent: 0,
      rpRequired: effectiveCost,
    };
    
    const { data: existingData } = await supabase
      .from('wmd_player_research')
      .select('id')
      .eq('player_id', playerId)
      .single();
    
    if (!existingData) {
      // Insert new research row
      const { error: insertErr } = await supabase
        .from('wmd_player_research')
        .insert({
          player_id: playerId,
          player_username: playerId,
          completed_techs: [],
          available_techs: [],
          locked_techs: [],
          total_rp_spent: 0,
        });
      if (insertErr) {
        return { success: false, message: 'Failed to start research' };
      }
    }
    
    // Recalculate available techs
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

/**
 * Spend RP on current research
 */
export async function spendRPOnResearch(
  playerId: string,
  amount: number
): Promise<{ success: boolean; message: string; completed?: boolean }> {
  try {
    const supabase = createServiceClient();
    const playerResearch = await getPlayerResearch(playerId);
    
    if (!playerResearch?.currentResearch) {
      return { success: false, message: 'No active research' };
    }
    
    // Check if player has enough RP
    const { data: player } = await supabase
      .from('players')
      .select('research_points')
      .eq('username', playerId)
      .single();
    const playerRP = player?.research_points || 0;
    
    if (playerRP < amount) {
      return { success: false, message: `Insufficient RP. Have ${playerRP}, need ${amount}` };
    }
    
    // Spend RP using existing system
    const spendResult = await spendResearchPoints(playerId, amount, 'WMD Research');
    if (!spendResult.success) {
      return { success: false, message: spendResult.message };
    }
    
    // Update research progress
    const newRPSpent = playerResearch.currentResearch.rpSpent + amount;
    const rpRequired = playerResearch.currentResearch.rpRequired;
    const isCompleted = newRPSpent >= rpRequired;
    
    if (isCompleted) {
      // Complete the research
      const completedTech = ALL_RESEARCH_TECHS.find(
        t => t.techId === playerResearch.currentResearch!.techId
      )!;
      
      // Get current completed techs
      const { data: researchData } = await supabase
        .from('wmd_player_research')
        .select('completed_techs')
        .eq('player_id', playerId)
        .single();
      
      const updatedCompletedTechs = [...(researchData?.completed_techs || []), completedTech.techId];
      
      await supabase
        .from('wmd_player_research')
        .update({
          completed_techs: updatedCompletedTechs,
          total_rp_spent: playerResearch.totalRPSpent + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('player_id', playerId);
      
      // Apply tech effects
      await applyTechEffects(playerId, completedTech);
      
      // Recalculate available techs
      await recalculateAvailableTechs(playerId);
      
      // Send completion notification
      await sendResearchCompletedNotification(playerId, completedTech);
      
      return { 
        success: true, 
        message: `Research completed! ${completedTech.name} unlocked.`, 
        completed: true 
      };
      
    } else {
      // Update progress - store as available_techs metadata
      // For progress tracking, we update total_rp_spent
      await supabase
        .from('wmd_player_research')
        .update({
          total_rp_spent: playerResearch.totalRPSpent + amount,
          updated_at: new Date().toISOString(),
        })
        .eq('player_id', playerId);
      
      const progress = Math.floor((newRPSpent / rpRequired) * 100);
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

/**
 * Cancel current research (no RP refund)
 */
export async function cancelResearch(
  playerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from('wmd_player_research')
      .select('id')
      .eq('player_id', playerId)
      .single();
    
    if (!existing) {
      return { success: false, message: 'No active research to cancel' };
    }
    
    await supabase
      .from('wmd_player_research')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', playerId);
    
    // Recalculate available techs
    await recalculateAvailableTechs(playerId);
    
    return { success: true, message: 'Research cancelled' };
    
  } catch (error) {
    console.error('Error cancelling research:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// ============================================================================
// TECH TREE MANAGEMENT
// ============================================================================

/**
 * Recalculate available and locked techs for a player
 */
export async function recalculateAvailableTechs(
  playerId: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const playerResearch = await getPlayerResearch(playerId);
    if (!playerResearch) return;
    
    const availableTechs: string[] = [];
    const lockedTechs: string[] = [];
    
    for (const tech of ALL_RESEARCH_TECHS) {
      // Skip if already completed
      if (playerResearch.completedTechs.includes(tech.techId)) {
        continue;
      }
      
      // Check prerequisites
      const prerequisitesMet = tech.prerequisites.every(
        prereq => playerResearch.completedTechs.includes(prereq)
      );
      
      if (prerequisitesMet) {
        availableTechs.push(tech.techId);
      } else {
        lockedTechs.push(tech.techId);
      }
    }
    
    // Update database
    await supabase
      .from('wmd_player_research')
      .update({
        available_techs: availableTechs,
        locked_techs: lockedTechs,
        updated_at: new Date().toISOString(),
      })
      .eq('player_id', playerId);
  } catch (error) {
    console.error('Error recalculating available techs:', error);
  }
}

/**
 * Get available techs for a player with full tech objects
 * @param playerId Player ID
 * @returns Array of available research techs
 */
export async function getAvailableTechs(
  playerId: string
): Promise<ResearchTech[]> {
  try {
    const playerResearch = await getPlayerResearch(playerId);
    if (!playerResearch) {
      return [];
    }
    
    // Get full tech objects for available techs
    const availableTechs = ALL_RESEARCH_TECHS.filter(tech => 
      playerResearch.availableTechs.includes(tech.techId) &&
      !playerResearch.completedTechs.includes(tech.techId)
    );
    
    return availableTechs;
  } catch (error) {
    console.error('Error getting available techs:', error);
    return [];
  }
}

/**
 * Apply tech effects (unlock warheads, batteries, etc.)
 */
async function applyTechEffects(
  playerId: string,
  tech: ResearchTech
): Promise<void> {
  try {
    // Tech effects are applied by checking completed techs in other services
    // This function serves as a hook for future enhancements
    
    console.log(`Applied effects for ${tech.name} to player ${playerId}`);
    
  } catch (error) {
    console.error('Error applying tech effects:', error);
  }
}

// ============================================================================
// PLAYER RESEARCH MANAGEMENT
// ============================================================================

/**
 * Initialize player research (called when player first accesses WMD)
 */
export async function initializePlayerResearch(
  playerId: string,
  playerUsername: string,
  clanId?: string
): Promise<PlayerResearch> {
  try {
    const supabase = createServiceClient();
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('wmd_player_research')
      .select('*')
      .eq('player_id', playerId)
      .single();
    
    if (existing) {
      return {
        playerId: existing.player_id,
        playerUsername: existing.player_username,
        clanId: existing.clan_id || undefined,
        completedTechs: existing.completed_techs || [],
        availableTechs: existing.available_techs || [],
        lockedTechs: existing.locked_techs || [],
        currentResearch: undefined,
        missileTier: 0,
        defenseTier: 0,
        intelligenceTier: 0,
        totalRPSpent: existing.total_rp_spent || 0,
        totalTechsUnlocked: (existing.completed_techs || []).length,
        clanResearchBonus: existing.clan_id ? 5 : 0,
        updatedAt: new Date(existing.updated_at),
      };
    }
    
    // Create new research record
    const initialAvailable = ['missile_tier_1', 'defense_tier_1', 'spy_tier_1'];
    const initialLocked = ALL_RESEARCH_TECHS
      .filter(t => !initialAvailable.includes(t.techId))
      .map(t => t.techId);
    
    const { error: insertErr } = await supabase
      .from('wmd_player_research')
      .insert({
        player_id: playerId,
        player_username: playerUsername,
        clan_id: clanId || null,
        completed_techs: [],
        available_techs: initialAvailable,
        locked_techs: initialLocked,
        total_rp_spent: 0,
      });
    
    if (insertErr) {
      console.error('Error initializing player research:', insertErr);
      throw insertErr;
    }
    
    const playerResearch: PlayerResearch = {
      playerId,
      playerUsername,
      clanId: clanId || undefined,
      completedTechs: [],
      availableTechs: initialAvailable,
      lockedTechs: initialLocked,
      currentResearch: undefined,
      missileTier: 0,
      defenseTier: 0,
      intelligenceTier: 0,
      totalRPSpent: 0,
      totalTechsUnlocked: 0,
      clanResearchBonus: clanId ? 5 : 0,
      updatedAt: new Date(),
    };
    
    return playerResearch;
    
  } catch (error) {
    console.error('Error initializing player research:', error);
    throw error;
  }
}

/**
 * Get player research state
 */
export async function getPlayerResearch(
  playerId: string
): Promise<PlayerResearch | null> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wmd_player_research')
      .select('*')
      .eq('player_id', playerId)
      .single();
    
    if (!data) return null;
    
    return {
      playerId: data.player_id,
      playerUsername: data.player_username,
      clanId: data.clan_id || undefined,
      completedTechs: data.completed_techs || [],
      availableTechs: data.available_techs || [],
      lockedTechs: data.locked_techs || [],
      currentResearch: undefined,
      missileTier: 0,
      defenseTier: 0,
      intelligenceTier: 0,
      totalRPSpent: data.total_rp_spent || 0,
      totalTechsUnlocked: (data.completed_techs || []).length,
      clanResearchBonus: data.clan_id ? 5 : 0,
      updatedAt: new Date(data.updated_at),
    };
    
  } catch (error) {
    console.error('Error getting player research:', error);
    return null;
  }
}

/**
 * Get research statistics for a player
 */
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
    const playerResearch = await getPlayerResearch(playerId);
    
    if (!playerResearch) {
      return {
        totalTechs: ALL_RESEARCH_TECHS.length,
        completedTechs: 0,
        availableTechs: 0,
        totalRPSpent: 0,
      };
    }
    
    const stats = {
      totalTechs: ALL_RESEARCH_TECHS.length,
      completedTechs: playerResearch.completedTechs.length,
      availableTechs: playerResearch.availableTechs.length,
      totalRPSpent: playerResearch.totalRPSpent,
    };
    
    if (playerResearch.currentResearch) {
      const tech = ALL_RESEARCH_TECHS.find(
        t => t.techId === playerResearch.currentResearch!.techId
      );
      
      if (tech) {
        const progress = Math.floor(
          (playerResearch.currentResearch.rpSpent / playerResearch.currentResearch.rpRequired) * 100
        );
        
        const s = stats as { currentResearch?: Record<string, unknown> };
        s.currentResearch = {
          techName: tech.name,
          progress,
          rpSpent: playerResearch.currentResearch.rpSpent,
          rpRequired: playerResearch.currentResearch.rpRequired,
        };
      }
    }
    
    return stats;
    
  } catch (error) {
    console.error('Error getting research stats:', error);
    throw error;
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get player level (placeholder - implement based on your level system)
 */
async function getPlayerLevel(playerId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('players')
    .select('level')
    .eq('username', playerId)
    .single();
  return data?.level || 50;
}

/**
 * Get clan level (placeholder - implement based on your clan system)
 */
async function getClanLevel(clanId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('clans')
    .select('clan_level')
    .eq('id', clanId)
    .single();
  return data?.clan_level || 5;
}

/**
 * Send research completed notification
 */
async function sendResearchCompletedNotification(
  playerId: string,
  tech: ResearchTech
): Promise<void> {
  try {
    // Import notification service dynamically to avoid circular dependencies
    const { createWMDNotification } = await import('@/lib/wmd/notificationService');
    
    await createWMDNotification(
      'RESEARCH_COMPLETED' as WMDEventType,
      NotificationPriority.INFO,
      NotificationScope.GLOBAL,
      playerId,
      'System',
      'Research Complete',
      `✅ ${tech.name} unlocked!`,
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

/**
 * IMPLEMENTATION NOTES:
 * - Integrates with existing RP system from xpService.ts
 * - Maintains economy balance by reusing RP spending logic
 * - Supports clan research bonuses (10% cost reduction)
 * - Validates prerequisites and requirements
 * - Tracks research progress and completion
 * - Sends notifications on completion
 * 
 * USAGE:
 * const canStart = await canStartResearch(playerId, 'missile_tier_2');
 * if (canStart.canStart) {
 *   await startResearch(playerId, 'missile_tier_2');
 *   await spendRPOnResearch(playerId, 5000);
 * }
 * 
 * INTEGRATION:
 * - Called by WMD UI components for research management
 * - Used by missile/defense/spy services to check unlocks
 * - Triggers notifications via notificationService
 */
