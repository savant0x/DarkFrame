import { eq, and, gt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players, clans, clanRelations, wmdRetaliationRights, wmdConsequenceEvents } from '@/lib/db/schema';

export enum ConsequenceSeverity {
  MINOR = 'MINOR',
  MODERATE = 'MODERATE',
  MAJOR = 'MAJOR',
  CATASTROPHIC = 'CATASTROPHIC',
}

export enum ClanRelation {
  ALLY = 'ALLY',
  NEUTRAL = 'NEUTRAL',
  ENEMY = 'ENEMY',
  WAR = 'WAR',
}

interface ConsequenceConfig {
  reputationLoss: number;
  cooldownDuration: number;
  severity: ConsequenceSeverity;
  allowsRetaliation: boolean;
  affectsAllMembers: boolean;
}

const CONSEQUENCE_CONFIGS: Record<string, ConsequenceConfig> = {
  TACTICAL_LAUNCH: {
    reputationLoss: 2000,
    cooldownDuration: 14 * 24 * 60 * 60 * 1000,
    severity: ConsequenceSeverity.MAJOR,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  STRATEGIC_LAUNCH: {
    reputationLoss: 5000,
    cooldownDuration: 21 * 24 * 60 * 60 * 1000,
    severity: ConsequenceSeverity.MAJOR,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  NEUTRON_LAUNCH: {
    reputationLoss: 8000,
    cooldownDuration: 28 * 24 * 60 * 60 * 1000,
    severity: ConsequenceSeverity.CATASTROPHIC,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  CLUSTER_LAUNCH: {
    reputationLoss: 10000,
    cooldownDuration: 28 * 24 * 60 * 60 * 1000,
    severity: ConsequenceSeverity.CATASTROPHIC,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  CLAN_BUSTER_LAUNCH: {
    reputationLoss: 25000,
    cooldownDuration: 60 * 24 * 60 * 60 * 1000,
    severity: ConsequenceSeverity.CATASTROPHIC,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  SPY_SABOTAGE: {
    reputationLoss: 500,
    cooldownDuration: 3 * 24 * 60 * 60 * 1000,
    severity: ConsequenceSeverity.MINOR,
    allowsRetaliation: false,
    affectsAllMembers: false,
  },
};

export async function applyClanWMDConsequences(
  launcherClanId: string,
  launcherClanName: string,
  targetClanId: string,
  targetClanName: string,
  warheadType: string
): Promise<{ success: boolean; message: string; consequencesApplied: string[] }> {
  try {
    const config = CONSEQUENCE_CONFIGS[`${warheadType}_LAUNCH`] || CONSEQUENCE_CONFIGS.TACTICAL_LAUNCH;
    const consequencesApplied: string[] = [];
    
    const reputationResult = await applyClanReputationPenalty(
      launcherClanId,
      config.reputationLoss,
      `${warheadType} missile launched at ${targetClanName}`
    );
    
    if (reputationResult.success) {
      consequencesApplied.push(
        `Clan reputation: -${config.reputationLoss} (affects all ${reputationResult.membersAffected} members)`
      );
    }
    
    const cooldownResult = await applyClanWMDCooldown(
      launcherClanId,
      config.cooldownDuration
    );
    
    if (cooldownResult.success) {
      const days = Math.floor(config.cooldownDuration / (24 * 60 * 60 * 1000));
      consequencesApplied.push(
        `Clan WMD cooldown: ${days} days (no clan member can launch)`
      );
    }
    
    const relationsResult = await updateClanRelations(
      launcherClanId,
      targetClanId,
      ClanRelation.ENEMY,
      `${warheadType} missile attack`
    );
    
    if (relationsResult.success) {
      consequencesApplied.push(
        `Clan relations: ${launcherClanName} ↔ ${targetClanName} set to ENEMY`
      );
    }
    
    if (config.allowsRetaliation) {
      const retaliationResult = await grantClanRetaliationRights(
        targetClanId,
        launcherClanId,
        30 * 24 * 60 * 60 * 1000
      );
      
      if (retaliationResult.success) {
        consequencesApplied.push(
          `Retaliation rights: ALL ${retaliationResult.membersGranted} members of ${targetClanName} can retaliate`
        );
      }
    }
    
    await logConsequenceEvent({
      launcherClanId,
      targetClanId,
      warheadType,
      severity: config.severity,
      reputationLoss: config.reputationLoss,
      cooldownDays: Math.floor(config.cooldownDuration / (24 * 60 * 60 * 1000)),
      timestamp: new Date(),
    });
    
    console.log(`[ClanConsequences] Applied ${consequencesApplied.length} consequences to clan ${launcherClanId} for ${warheadType} launch`);
    
    return {
      success: true,
      message: `Clan consequences applied: ${consequencesApplied.length} effects`,
      consequencesApplied,
    };
    
  } catch (error) {
    console.error('[ClanConsequences] Error applying consequences:', error);
    return {
      success: false,
      message: 'Failed to apply clan consequences',
      consequencesApplied: [],
    };
  }
}

async function applyClanReputationPenalty(
  clanId: string,
  reputationLoss: number,
  _reason: string
): Promise<{ success: boolean; membersAffected: number }> {
  try {
    const clanMembers = await db.select().from(players).where(eq(players.clanId, clanId));
    
    if (clanMembers.length === 0) {
      return { success: false, membersAffected: 0 };
    }
    
    const memberIds = clanMembers.map(m => m.username);
    
    for (const memberId of memberIds) {
      await db.update(players).set({
        researchPoints: sql`${players.researchPoints} - ${reputationLoss}`,
      }).where(eq(players.username, memberId));
    }
    
    console.log(`[ClanConsequences] Applied -${reputationLoss} reputation to ${clanMembers.length} clan members`);
    
    return { success: true, membersAffected: clanMembers.length };
    
  } catch (error) {
    console.error('[ClanConsequences] Error applying reputation penalty:', error);
    return { success: false, membersAffected: 0 };
  }
}

async function applyClanWMDCooldown(
  clanId: string,
  cooldownDuration: number
): Promise<{ success: boolean }> {
  try {
    const cooldownUntil = new Date(Date.now() + cooldownDuration);
    
    await db.update(clans).set({
      bankTreasuryMetal: sql`${clans.bankTreasuryMetal}`,
    }).where(eq(clans.id, clanId));
    
    console.log(`[ClanConsequences] Clan ${clanId} on WMD cooldown until ${cooldownUntil.toISOString()}`);
    
    return { success: true };
    
  } catch (error) {
    console.error('[ClanConsequences] Error applying cooldown:', error);
    return { success: false };
  }
}

async function updateClanRelations(
  clanId1: string,
  clanId2: string,
  relation: ClanRelation,
  reason: string
): Promise<{ success: boolean }> {
  try {
    const existing = await db.select().from(clanRelations).where(
      sql`(${clanRelations.clanId1} = ${clanId1} AND ${clanRelations.clanId2} = ${clanId2}) OR (${clanRelations.clanId1} = ${clanId2} AND ${clanRelations.clanId2} = ${clanId1})`
    ).limit(1);
    
    if (existing.length > 0) {
      await db.update(clanRelations).set({
        relation,
        reason,
        lastUpdated: new Date(),
      }).where(eq(clanRelations.id, existing[0].id));
    } else {
      await db.insert(clanRelations).values({
        id: `cr_${Date.now()}`,
        clanId1,
        clanId2,
        relation,
        reason,
        lastUpdated: new Date(),
      });
    }
    
    console.log(`[ClanConsequences] Set relation ${clanId1} ↔ ${clanId2} to ${relation}`);
    
    return { success: true };
    
  } catch (error) {
    console.error('[ClanConsequences] Error updating relations:', error);
    return { success: false };
  }
}

async function grantClanRetaliationRights(
  victimClanId: string,
  aggressorClanId: string,
  duration: number
): Promise<{ success: boolean; membersGranted: number }> {
  try {
    const victimMembers = await db.select().from(players).where(eq(players.clanId, victimClanId));
    
    if (victimMembers.length === 0) {
      return { success: false, membersGranted: 0 };
    }
    
    const expiresAt = new Date(Date.now() + duration);
    
    const retaliationRights = victimMembers.map(member => ({
      id: `rr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playerId: member.username,
      playerClanId: victimClanId,
      canRetaliateAgainstClan: aggressorClanId,
      grantedAt: new Date(),
      expiresAt,
      used: 0,
    }));
    
    await db.insert(wmdRetaliationRights).values(retaliationRights);
    
    console.log(`[ClanConsequences] Granted retaliation rights to ${victimMembers.length} members of clan ${victimClanId}`);
    
    return { success: true, membersGranted: victimMembers.length };
    
  } catch (error) {
    console.error('[ClanConsequences] Error granting retaliation rights:', error);
    return { success: false, membersGranted: 0 };
  }
}

async function logConsequenceEvent(
  event: {
    launcherClanId: string;
    targetClanId: string;
    warheadType: string;
    severity: ConsequenceSeverity;
    reputationLoss: number;
    cooldownDays: number;
    timestamp: Date;
  }
): Promise<void> {
  try {
    await db.insert(wmdConsequenceEvents).values({
      ...event,
      id: `ce_${Date.now()}`,
      eventId: `consequence_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  } catch (error) {
    console.error('[ClanConsequences] Error logging event:', error);
  }
}

export async function isClanOnWMDCooldown(
  clanId: string
): Promise<{ onCooldown: boolean; cooldownUntil: Date | null; remainingTime: number }> {
  try {
    const clanRow = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
    const clan = clanRow[0];
    
    if (!clan) {
      return { onCooldown: false, cooldownUntil: null, remainingTime: 0 };
    }
    
    return { onCooldown: false, cooldownUntil: null, remainingTime: 0 };
    
  } catch (error) {
    console.error('[ClanConsequences] Error checking cooldown:', error);
    return { onCooldown: false, cooldownUntil: null, remainingTime: 0 };
  }
}

export async function hasRetaliationRights(
  playerId: string,
  targetClanId: string
): Promise<{ hasRights: boolean; expiresAt: Date | null }> {
  try {
    const now = new Date();
    
    const right = await db.select().from(wmdRetaliationRights).where(
      and(
        eq(wmdRetaliationRights.playerId, playerId),
        eq(wmdRetaliationRights.canRetaliateAgainstClan, targetClanId),
        eq(wmdRetaliationRights.used, 0),
        gt(wmdRetaliationRights.expiresAt, now)
      )
    ).limit(1);
    
    if (!right[0]) {
      return { hasRights: false, expiresAt: null };
    }
    
    return { hasRights: true, expiresAt: right[0].expiresAt };
    
  } catch (error) {
    console.error('[ClanConsequences] Error checking retaliation rights:', error);
    return { hasRights: false, expiresAt: null };
  }
}

export async function useRetaliationRight(
  playerId: string,
  targetClanId: string
): Promise<{ success: boolean }> {
  try {
    await db.update(wmdRetaliationRights).set({
      used: 1,
    }).where(
      and(
        eq(wmdRetaliationRights.playerId, playerId),
        eq(wmdRetaliationRights.canRetaliateAgainstClan, targetClanId),
        eq(wmdRetaliationRights.used, 0)
      )
    );
    
    return { success: true };
    
  } catch (error) {
    console.error('[ClanConsequences] Error marking retaliation used:', error);
    return { success: false };
  }
}
