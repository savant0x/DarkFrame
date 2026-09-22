import { eq, and, gt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { players, clans, clanRelations, wmdRetaliationRights } from '@/lib/db/schema';
import { generateId } from '@/lib/utils';

/**
 * Clan WMD consequence system (FID-20260919-018).
 *
 * HISTORY: this module was fully written but never called — and its core effect
 * was broken. `applyClanWMDCooldown` self-assigned bankTreasuryMetal and never
 * set `wmdCooldownUntil`; `isClanOnWMDCooldown` was a hardcoded `false` stub;
 * the launch path never consulted either; and retaliation rights had no reader.
 * Missile launches were therefore consequence-free.
 *
 * Now wired: `missileTracker` calls `applyClanWMDConsequences` on detonation, and
 * `missileService.launchMissile` enforces the cooldown (with a retaliation-rights
 * bypass). Balance parameters signed off by the operator: cooldowns are the
 * documented 24-72h scaled by warhead, and the reputation penalty hits the clan
 * research pool (floored at 0) rather than per-member research points.
 */

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
  /** Milliseconds. */
  cooldownDuration: number;
  severity: ConsequenceSeverity;
  allowsRetaliation: boolean;
  affectsAllMembers: boolean;
}

const HOUR = 60 * 60 * 1000;

/**
 * Keyed `${warheadType}_LAUNCH`, matching WarheadType (TACTICAL, STRATEGIC,
 * NEUTRON, CLUSTER, CLAN_BUSTER). Cooldowns are the documented 24-72h, scaled by
 * warhead severity (dev/architecture.md: "Post-attack consequences (24-72hr
 * cooldowns, retaliation windows)"). reputationLoss is charged against the
 * attacking clan's research pool.
 */
const CONSEQUENCE_CONFIGS: Record<string, ConsequenceConfig> = {
  TACTICAL_LAUNCH: {
    reputationLoss: 2000,
    cooldownDuration: 24 * HOUR,
    severity: ConsequenceSeverity.MAJOR,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  STRATEGIC_LAUNCH: {
    reputationLoss: 5000,
    cooldownDuration: 36 * HOUR,
    severity: ConsequenceSeverity.MAJOR,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  NEUTRON_LAUNCH: {
    reputationLoss: 8000,
    cooldownDuration: 48 * HOUR,
    severity: ConsequenceSeverity.CATASTROPHIC,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  CLUSTER_LAUNCH: {
    reputationLoss: 10000,
    cooldownDuration: 60 * HOUR,
    severity: ConsequenceSeverity.CATASTROPHIC,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
  CLAN_BUSTER_LAUNCH: {
    reputationLoss: 25000,
    cooldownDuration: 72 * HOUR,
    severity: ConsequenceSeverity.CATASTROPHIC,
    allowsRetaliation: true,
    affectsAllMembers: true,
  },
};

const RETALIATION_WINDOW = 30 * 24 * HOUR;

/**
 * Apply the post-attack consequences of a WMD detonation.
 * Nullable clan ids: a clanless attacker still gets no cooldown (there is
 * nothing clan-scoped to constrain), but the call is safe either way.
 */
export async function applyClanWMDConsequences(
  launcherClanId: string | null,
  launcherClanName: string,
  targetClanId: string | null,
  targetClanName: string,
  warheadType: string
): Promise<{ success: boolean; message: string; consequencesApplied: string[] }> {
  try {
    const config = CONSEQUENCE_CONFIGS[`${warheadType}_LAUNCH`] || CONSEQUENCE_CONFIGS.TACTICAL_LAUNCH;
    const consequencesApplied: string[] = [];

    if (launcherClanId) {
      const reputationResult = await applyClanReputationPenalty(
        launcherClanId,
        config.reputationLoss,
        `${warheadType} missile launched at ${targetClanName || 'an unaffiliated target'}`
      );
      if (reputationResult.success) {
        consequencesApplied.push(
          `Clan research pool: -${config.reputationLoss}`
        );
      }

      const cooldownResult = await applyClanWMDCooldown(launcherClanId, config.cooldownDuration);
      if (cooldownResult.success) {
        const hours = Math.round(config.cooldownDuration / HOUR);
        consequencesApplied.push(
          `Clan WMD cooldown: ${hours}h (no clan member can launch)`
        );
      }
    }

    if (launcherClanId && targetClanId) {
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
          RETALIATION_WINDOW
        );
        if (retaliationResult.success) {
          consequencesApplied.push(
            `Retaliation rights: ALL ${retaliationResult.membersGranted} members of ${targetClanName} can retaliate`
          );
        }
      }
    }

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

/**
 * FID-20260919-018: re-targeted from per-member `players.researchPoints` (the tech
 * currency, which could go deeply negative) to the CLAN research pool, floored at
 * 0. Operator-signed.
 */
async function applyClanReputationPenalty(
  clanId: string,
  reputationLoss: number,
  _reason: string
): Promise<{ success: boolean; membersAffected: number }> {
  try {
    const clanRow = await db.select().from(clans).where(eq(clans.id, clanId)).limit(1);
    if (!clanRow[0]) {
      return { success: false, membersAffected: 0 };
    }

    await db.update(clans).set({
      researchResearchPoints: sql`GREATEST(0, ${clans.researchResearchPoints} - ${reputationLoss})`,
    }).where(eq(clans.id, clanId));

    const members = await db.select({ username: players.username }).from(players).where(eq(players.clanId, clanId));
    console.log(`[ClanConsequences] Applied -${reputationLoss} clan research to ${clanId}`);

    return { success: true, membersAffected: members.length };

  } catch (error) {
    console.error('[ClanConsequences] Error applying reputation penalty:', error);
    return { success: false, membersAffected: 0 };
  }
}

/**
 * FID-20260919-018: this used to compute `cooldownUntil` and then write
 * `bankTreasuryMetal = bankTreasuryMetal` — a no-op that never set the cooldown
 * column. It now sets the real field.
 */
async function applyClanWMDCooldown(
  clanId: string,
  cooldownDuration: number
): Promise<{ success: boolean }> {
  try {
    const now = new Date();
    const cooldownUntil = new Date(now.getTime() + cooldownDuration);

    await db.update(clans).set({
      wmdCooldownUntil: cooldownUntil,
      lastWMDLaunch: now,
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
    // Canonical orientation (lexicographically sorted) — the schema's documented
    // invariant, which makes the unique pair index and the symmetric lookup agree.
    const [a, b] = [clanId1, clanId2].sort();

    const existing = await db.select().from(clanRelations).where(
      and(eq(clanRelations.clanId1, a), eq(clanRelations.clanId2, b))
    ).limit(1);

    if (existing.length > 0) {
      await db.update(clanRelations).set({
        relation,
        reason,
        lastUpdated: new Date(),
      }).where(eq(clanRelations.id, existing[0].id));
    } else {
      await db.insert(clanRelations).values({
        id: generateId(),
        clanId1: a,
        clanId2: b,
        relation,
        reason,
        lastUpdated: new Date(),
      });
    }

    console.log(`[ClanConsequences] Set relation ${a} ↔ ${b} to ${relation}`);

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
      // FID-20260919-018: convention, not a bug fix — the old
      // `rr_<ts>_<rand>` id (26 chars) FIT this column (varchar(50); an earlier
      // claim that it overflowed varchar(24) was wrong). generateId() is used
      // to match the codebase's id convention.
      id: generateId(),
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

/**
 * FID-20260919-018: was a hardcoded `{ onCooldown: false }` stub. Now reads
 * `clans.wmdCooldownUntil` and reports the truth (the column is also written by
 * the admin `adjustClanCooldown` action, so this is the shared reader).
 */
export async function isClanOnWMDCooldown(
  clanId: string
): Promise<{ onCooldown: boolean; cooldownUntil: Date | null; remainingTime: number }> {
  try {
    const clanRow = await db
      .select({ wmdCooldownUntil: clans.wmdCooldownUntil })
      .from(clans)
      .where(eq(clans.id, clanId))
      .limit(1);
    const until = clanRow[0]?.wmdCooldownUntil ?? null;

    if (!until) {
      return { onCooldown: false, cooldownUntil: null, remainingTime: 0 };
    }

    const cooldownUntil = new Date(until);
    const remainingTime = cooldownUntil.getTime() - Date.now();
    if (remainingTime <= 0) {
      return { onCooldown: false, cooldownUntil, remainingTime: 0 };
    }

    return { onCooldown: true, cooldownUntil, remainingTime };

  } catch (error) {
    console.error('[ClanConsequences] Error checking cooldown:', error);
    // Fail-open for a read-only check: a DB error must not brick launches forever.
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

/**
 * Consume one retaliation right (mark it used).
 *
 * FID-20260919-018: named `consumeRetaliationRight`, not `useRetaliationRight`
 * — the `use*` prefix collides with React's hook namespace, so
 * `react-hooks/rules-of-hooks` flagged every call site in this non-React
 * service module.
 */
export async function consumeRetaliationRight(
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
