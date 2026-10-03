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
import { withTransactionRetry } from '@/lib/db/treasuryLock';
import type { TreasuryTx } from '@/lib/db/treasuryLock';
import {
  ResearchTech,
  PlayerResearch,
  ALL_RESEARCH_TECHS,
  ResearchCategory,
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
    
    if (tech.requiredClanLevel) {
      // FID-20260912-058: a clanless player no longer bypasses the gate —
      // high-end content genuinely requires clan membership.
      if (!pr.clanId) {
        return { canStart: false, reason: 'Requires clan membership' };
      }
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
    // FID-20261002-002 §5: the RP debit, the research-contribution update and
    // (on completion) the completion effects commit in ONE transaction. The
    // previous flow debited the player and then updated player_research in
    // separate autocommit writes, so a failure between them lost the
    // contribution, and applyTechEffects/recalculate kept their own global-db
    // writes outside the debit's atomicity. Notifications are staged strictly
    // AFTER commit so a bell/format failure cannot convert a committed
    // completion into a retryable error that would re-debit the player.
    const result = await withTransactionRetry(`spendRPOnResearch(${playerId})`, () =>
      db.transaction(async (tx): Promise<{ success: boolean; message: string; completed?: boolean; notification?: { playerId: string; tech: ResearchTech } }> => {
        const prRows = await tx.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1).for('update');
        const pr = prRows[0];
        if (!pr) {
          return { success: false, message: 'Player research not found' };
        }

        if (!pr.currentResearchTechId || pr.completedTechs === null || pr.totalRPSpent === null) {
          return { success: false, message: 'No active research' };
        }

        // Slim projection (FID-20260911-046 precedent): only the balance is
        // needed here, never the full row.
        const playerResult = await tx
          .select({ researchPoints: players.researchPoints })
          .from(players)
          .where(eq(players.username, playerId))
          .limit(1);
        const player = playerResult[0];
        const playerRP = player?.researchPoints || 0;

        if (playerRP < amount) {
          return { success: false, message: `Insufficient RP. Have ${playerRP}, need ${amount}` };
        }

        // Transaction-aware debit through the same audited writer.
        const spendResult = await spendResearchPoints(playerId, amount, 'WMD Research', tx as TreasuryTx);
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
            throw new Error('Active research tech no longer exists');
          }

          const updatedTechs = [...(pr.completedTechs ?? []), completedTech.techId];

          await tx.update(playerResearch).set({
            currentResearchTechId: null,
            currentResearchStartedAt: null,
            currentResearchRpSpent: null,
            currentResearchRpRequired: null,
            totalRPSpent: (pr.totalRPSpent ?? 0) + amount,
            completedTechs: updatedTechs,
            totalTechsUnlocked: (pr.totalTechsUnlocked ?? 0) + 1,
            updatedAt: new Date(),
          }).where(eq(playerResearch.playerId, playerId));

          // FID-20261002-002 (source-audit correction): completion effects run
          // against the CALLER's transaction — their previous global-db writes
          // would self-deadlock against this transaction's FOR UPDATE lock on
          // the same player_research row and escape the debit's atomicity.
          await applyTechEffects(playerId, completedTech, tx as TreasuryTx);
          await recalculateAvailableTechs(playerId, tx as TreasuryTx);

          // Staged for AFTER commit: the notification rides the transaction's
          // return so the post-commit send cannot re-debit or roll back the
          // completion.
          return {
            success: true,
            message: `Research completed! ${completedTech.name} unlocked.`,
            completed: true,
            notification: { playerId, tech: completedTech },
          } as { success: boolean; message: string; completed?: boolean; notification?: { playerId: string; tech: ResearchTech } };
        }

        await tx.update(playerResearch).set({
          currentResearchRpSpent: newRPSpent,
          totalRPSpent: (pr.totalRPSpent ?? 0) + amount,
          updatedAt: new Date(),
        }).where(eq(playerResearch.playerId, playerId));

        const progress = rpRequired > 0 ? Math.floor((newRPSpent / rpRequired) * 100) : 0;
        return {
          success: true,
          message: `Research progress: ${progress}% (${newRPSpent}/${rpRequired} RP)`,
          completed: false
        };
      })
    );

    // Strictly AFTER commit (FID-20261002-002 §5.6): a notification failure
    // cannot convert a committed completion into a retryable error that
    // re-debits the player.
    if (result.notification) {
      await sendResearchCompletedNotification(result.notification.playerId, result.notification.tech)
        .catch((notifyError: unknown) => {
          console.error('Research notification failed (completion stands):', notifyError);
        });
    }

    return { success: result.success, message: result.message, completed: result.completed };
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
  playerId: string,
  tx?: TreasuryTx
): Promise<void> {
  try {
    const handle = tx ?? db;
    const prRows = await handle.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1);
    const prRow = prRows[0];
    if (!prRow) return;
    const pr = rowToPlayerResearch(prRow);

    // FID-20260912-058 W1: level gates are real now (L40+2t on every tier) —
    // a tech whose level gate is unmet belongs in lockedTechs, not available,
    // or the panel offers buttons the POST handler must refuse.
    const levelRows = await handle
      .select({ level: players.level })
      .from(players)
      .where(eq(players.username, playerId))
      .limit(1);
    const playerLevel = levelRows[0]?.level ?? 1;

    const availableTechs: string[] = [];
    const lockedTechs: string[] = [];

    for (const tech of ALL_RESEARCH_TECHS) {
      if (pr.completedTechs.includes(tech.techId)) {
        continue;
      }

      const prerequisitesMet = tech.prerequisites.every(
        prereq => pr.completedTechs.includes(prereq)
      );
      const levelMet = !tech.requiredLevel || playerLevel >= tech.requiredLevel;

      if (prerequisitesMet && levelMet) {
        availableTechs.push(tech.techId);
      } else {
        lockedTechs.push(tech.techId);
      }
    }
    
    await handle.update(playerResearch).set({
      availableTechs,
      lockedTechs,
      updatedAt: new Date(),
    }).where(eq(playerResearch.playerId, playerId));
  } catch (error) {
    console.error('Error recalculating available techs:', error);
    if (tx) throw error; // composed transaction: the caller must see the failure
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

/**
 * Apply a completed tech's effects (FID-20260912-058 W1).
 *
 * The old implementation was a console.log stub — completions never touched
 * the per-domain tier columns, so the panel's tier readouts stayed 0 forever
 * and nothing downstream could ever observe progress. Domain tiers are
 * derived from the completed set (max completed tier per domain), which is
 * idempotent under the single-track model where a tier's unlock block can
 * span several domains.
 */
async function applyTechEffects(
  playerId: string,
  tech: ResearchTech,
  tx?: TreasuryTx
): Promise<void> {
  try {
    const handle = tx ?? db;
    const prRows = await handle.select().from(playerResearch).where(eq(playerResearch.playerId, playerId)).limit(1);
    const pr = prRows[0];
    if (!pr) return;

    const completed = [...(pr.completedTechs ?? []), tech.techId];
    const domainTier = (category: ResearchCategory): number =>
      ALL_RESEARCH_TECHS
        .filter((t) => t.category === category && completed.includes(t.techId))
        .reduce((max, t) => Math.max(max, t.tier), 0);

    await handle.update(playerResearch).set({
      missileTier: domainTier(ResearchCategory.MISSILE),
      defenseTier: domainTier(ResearchCategory.DEFENSE),
      intelligenceTier: domainTier(ResearchCategory.INTELLIGENCE),
      updatedAt: new Date(),
    }).where(eq(playerResearch.playerId, playerId));
  } catch (error) {
    console.error('Error applying tech effects:', error);
    if (tx) throw error; // composed transaction: the caller must see the failure
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
    
    // W1 (FID-20260912-058): a single track — tier 1 is the only starting
    // tech. (The old init seeded all three tracks' tier-1 ids, which no
    // longer exist.)
    const startingTechs = ['wmd_tier_1'];
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

/**
 * Real player level (FID-20260912-058): the W1 gates (L40+2t) are enforced
 * against the actual column — the old helper hardcoded 50, making every
 * level gate pass unconditionally. playerId is the username in this service.
 */
async function getPlayerLevel(playerId: string): Promise<number> {
  const rows = await db
    .select({ level: players.level })
    .from(players)
    .where(eq(players.username, playerId))
    .limit(1);
  return rows[0]?.level ?? 1;
}

/**
 * Real clan level (FID-20260912-058): tier-10's Clan Level 5 requirement is
 * enforced against the actual column — the old helper hardcoded 5.
 */
async function getClanLevel(clanId: string): Promise<number> {
  const { clans } = await import('@/lib/db/schema/clans');
  const rows = await db
    .select({ level: clans.levelCurrentLevel })
    .from(clans)
    .where(eq(clans.id, clanId))
    .limit(1);
  return rows[0]?.level ?? 0;
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

    // FID-20260919-013: the wmd_notifications row had zero readers — deliver
    // through the player seam (System inbox + live push), then fire the
    // previously-orphaned wmd:research_complete emitter for WMDHub toasts.
    const { notifyPlayer } = await import('@/lib/playerNotification');
    await notifyPlayer({
      systemType: 'wmd_research_complete',
      recipient: playerId,
      title: 'Research Complete',
      body: `${tech.name} unlocked!`,
      icon: '✅',
      relatedEntityId: tech.techId,
      dedupeKey: `research:${playerId}:${tech.techId}`,
    });

    const { getIO } = await import('@/lib/websocket/server');
    const { broadcastResearchComplete } = await import('@/lib/websocket/handlers/wmdHandler');
    const io = getIO();
    if (io) {
      await broadcastResearchComplete(io, {
        playerId,
        techId: tech.techId,
        techName: tech.name,
        category: tech.category,
      });
    }
  } catch (error) {
    console.error('Error sending research notification:', error);
  }
}
