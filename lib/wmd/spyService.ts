/**
 * @file lib/wmd/spyService.ts
 * @created 2025-10-22
 * @overview WMD Spy Service - Intelligence Operations (Clan Treasury Integrated)
 * 
 * OVERVIEW:
 * Handles all intelligence operations including spy recruitment, mission
 * planning, surveillance, sabotage operations, and counter-intelligence.
 * ALL costs deducted from CLAN TREASURY with equal cost sharing among members.
 * 
 * Features:
 * - Spy recruitment via clan bank funding
 * - Mission costs paid from clan treasury
 * - Intelligence gathering missions
 * - Sabotage operations
 * - Counter-intelligence activities
 * - Mission success calculation
 * - Network security management
 * 
 * Clan Treasury Integration:
 * - All spy recruitment deducted from clan bank (NOT player resources)
 * - Mission costs paid from clan treasury
 * - Per-member cost calculated: totalCost / memberCount
 * - Minimum 3 clan members required (prevents solo WMD)
 * - Transaction transparency (shows per-member contribution)
 * 
 * Dependencies:
 * - /types/wmd for spy types and constants
 * - clanTreasuryWMDService for funding validation/deduction
 * - Drizzle ORM for data persistence
 * - Research service for unlock validation
 */

import { eq, desc, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  wmdSpies,
  wmdSpyMissions,
  wmdSabotageOperations,
  wmdIntelligenceReports,
  wmdSecurityStatus,
  wmdCounterIntelOperations,
  wmdNotifications,
  missiles,
  playerResearch,
  wmdDefenseBatteries,
} from '@/lib/db/schema/wmd';
import { players } from '@/lib/db/schema/players';
import { clans } from '@/lib/db/schema/clans'; // FID-20260916-007: battery owner derivation (clan -> leader)
import { withTransactionRetry, type TreasuryTx } from '@/lib/db/treasuryLock'; // FID-20261002-008 §5.4
import { generateId } from '@/lib/utils'; // FID-20260919-017: 23-char PKs that fit varchar(24)
import {
  MissionType,
  MissionStatus,
  SpyRank,
  IntelligenceReport,
  MissionResult,
  SabotageDamage,
  IntelLevel,
  MISSION_CONFIGS,
  WMDEventType,
  NotificationPriority,
  NotificationScope,
  isValidMissionType,
  isValidWarheadType,
  calculateSuccessChance,
  MissileComponent,
  COMPONENT_COSTS
} from '@/types/wmd';
import type { SpyAgent, SpySpecialization, SpyStatus } from '@/types/wmd';
// FID-20260916-011: shared sabotage math (difficulty/detection tables) — delegate, never copy.
import { getSabotageDifficulty, sabotageDetectionRisk } from './sabotageMath';

/** Sabotage target categories accepted by the sabotage pipeline. */
type SabotageTargetType = 'MISSILE' | 'DEFENSE_BATTERY' | 'RESEARCH';

/** Counter-intelligence sweep areas. */
type CounterIntelTargetArea = 'FACILITIES' | 'COMMUNICATIONS' | 'PERSONNEL' | 'ALL';

/** Spy summary recorded when a counter-intel sweep detects an enemy agent. */
interface CounterIntelDetectedSpy {
  spyId: string;
  codename: string;
  specialization: string;
  operatorId: string;
  operatorClanId: string | null;
}

/** Resource cost of an operation. */
interface ResourceCost {
  metal: number;
  energy: number;
}

/** Stored wmd_spy_missions row (the runtime shape of a mission). */
type WmdSpyMissionRow = typeof wmdSpyMissions.$inferSelect;
import {
  validateClanWMDFunds,
  deductWMDCost,
  WMDPurchaseType,
} from './clanTreasuryWMDService';
import { getPlayerResearch } from './researchService';
import {
  protectionActive,
  voidProtectionOnAggression,
  PROTECTION_REFUSAL_REASON,
} from '../playerProtection'; // FID-20260916-007: target refusal + operator void at commit


interface CounterIntelResult {
  success: boolean;
  message: string;
  threatsDetected: number;
  spiesDetected: Array<{
    spyId: string;
    codename: string;
    specialization: string;
    operatorId: string;
    operatorClanId: string | null;
  }>;
}

function mapDrizzleSpyToAgent(row: typeof wmdSpies.$inferSelect): SpyAgent {
  return {
    id: row.id,
    spyId: row.spyId,
    ownerId: row.ownerId,
    ownerUsername: row.ownerUsername,
    clanId: row.clanId,
    codename: row.codename,
    rank: row.rank as SpyRank,
    experience: row.experience,
    specialization: row.specialization as SpyAgent['specialization'],
    status: row.status as SpyAgent['status'],
    currentMissionId: row.currentMissionId,
    missionHistory: row.missionHistory || [],
    skills: {
      stealth: row.skillsStealth,
      hacking: row.skillsHacking,
      sabotage: row.skillsSabotage,
      intelligence: row.skillsIntelligence,
    },
    lastMissionAt: row.lastMissionAt,
    recruitedAt: row.recruitedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function recruitSpy(
  recruiterId: string,
  recruiterUsername: string,
  specialization: SpySpecialization,
  clanId: string
): Promise<{ success: boolean; message: string; spyId?: string; codename?: string; perMemberCost?: ResourceCost }> {
  try {
    const hasUnlocked = await hasSpyUnlocked(recruiterId);
    if (!hasUnlocked) {
      return { success: false, message: 'Intelligence operations not unlocked' };
    }
    
    const currentSpies = await getPlayerSpies(recruiterId);
    const maxSpies = await getMaxSpies(recruiterId);
    
    if (currentSpies.length >= maxSpies) {
      return { success: false, message: `Maximum spy limit reached (${maxSpies})` };
    }
    
    const recruitmentCosts = {
      'SURVEILLANCE': { metal: 100000, energy: 200000 },
      'SABOTAGE': { metal: 150000, energy: 250000 },
      'INFILTRATION': { metal: 200000, energy: 300000 },
      'CYBER': { metal: 250000, energy: 350000 },
    } satisfies Record<SpySpecialization, ResourceCost>;
    
    const cost = recruitmentCosts[specialization];
    
    const validation = await validateClanWMDFunds(clanId, cost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    const deduction = await deductWMDCost(
      clanId,
      WMDPurchaseType.SPY_RECRUITMENT,
      recruiterId,
      recruiterUsername,
      cost,
      `${specialization} Spy Recruitment`
    );
    
    if (!deduction.success) {
      return { success: false, message: deduction.message || 'Failed to deduct funds' };
    }
    
    const spyId = `spy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const id = `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const skills = getBaseSkills(specialization);
    const codename = generateCodename();
    const now = new Date();
    
    await db.insert(wmdSpies).values({
      id,
      spyId,
      ownerId: recruiterId,
      ownerUsername: recruiterUsername,
      clanId,
      codename,
      rank: SpyRank.ROOKIE,
      experience: 0,
      specialization,
      status: 'AVAILABLE',
      currentMissionId: null,
      missionHistory: [],
      skillsStealth: skills.stealth,
      skillsHacking: skills.hacking,
      skillsSabotage: skills.sabotage,
      skillsIntelligence: skills.intelligence,
      lastMissionAt: null,
      recruitedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    
    console.log(`Spy recruited by ${recruiterUsername} (Clan: ${clanId}). Per-member cost: ${deduction.perMemberCost?.metal || 0} metal, ${deduction.perMemberCost?.energy || 0} energy`);
    
    return { 
      success: true, 
      message: `${specialization} spy recruited. Codename: ${codename}. Clan cost: ${cost.metal} metal, ${cost.energy} energy`, 
      spyId,
      codename,
      perMemberCost: deduction.perMemberCost,
    };
    
  } catch (error) {
    console.error('Error recruiting spy:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function trainSpy(
  spyId: string,
  skillToTrain: 'stealth' | 'hacking' | 'sabotage' | 'intelligence',
  trainingIntensity: 'BASIC' | 'ADVANCED' | 'ELITE'
): Promise<{ success: boolean; message: string; newSkillLevel?: number }> {
  try {
    const spy = await getSpy(spyId);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    if (spy.status !== 'AVAILABLE') {
      return { success: false, message: 'Spy is not available for training' };
    }
    
    const canAfford = await canAffordTraining(spy.ownerId, trainingIntensity);
    if (!canAfford) {
      return { success: false, message: 'Insufficient resources for training' };
    }
    
    const currentLevel = spy.skills[skillToTrain];
    const improvement = getTrainingImprovement(trainingIntensity, currentLevel);
    const newLevel = Math.min(100, currentLevel + improvement);
    
    await deductTrainingCosts(spy.ownerId, trainingIntensity);
    
    const skillField = `skills${skillToTrain.charAt(0).toUpperCase() + skillToTrain.slice(1)}` as keyof typeof wmdSpies;
    
    await db.update(wmdSpies).set({
      [skillField]: newLevel,
      experience: spy.experience + improvement,
      updatedAt: new Date(),
    }).where(eq(wmdSpies.spyId, spyId));
    
    const newRank = calculateSpyRank(spy.experience + improvement, spy.missionHistory.length);
    if (newRank !== spy.rank) {
      await promoteSpyRank(spyId, newRank);
    }
    
    return { 
      success: true, 
      message: `${spy.codename}'s ${skillToTrain} improved by ${improvement} points`,
      newSkillLevel: newLevel
    };
    
  } catch (error) {
    console.error('Error training spy:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function startMission(
  spyId: string,
  missionType: MissionType,
  targetPlayerId: string,
  targetClanId?: string
): Promise<{ success: boolean; message: string; missionId?: string }> {
  try {
    const spy = await getSpy(spyId);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    if (spy.status !== 'AVAILABLE') {
      return { success: false, message: 'Spy is not available' };
    }
    
    if (!isValidMissionType(missionType)) {
      return { success: false, message: 'Invalid mission type' };
    }
    
    const hasSkills = validateMissionSkills(spy, missionType);
    if (!hasSkills) {
      return { success: false, message: 'Spy lacks required skills for this mission' };
    }
    
    const targetValid = await validateMissionTarget(targetPlayerId, targetClanId);
    if (!targetValid) {
      return { success: false, message: 'Invalid target' };
    }
    
    const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const missionConfig = MISSION_CONFIGS[missionType];
    const startTime = new Date();
    const completionTime = new Date(startTime.getTime() + missionConfig.duration);
    
    const targetUsername = await getPlayerUsername(targetPlayerId);
    
    const targetSecurity = await getTargetSecurity(targetPlayerId);
    const clanBonus = spy.clanId ? 0.05 : 0;
    const equipmentBonus = 0;
    
    const successChance = calculateSuccessChance(
      spy.rank,
      missionType,
      targetSecurity,
      clanBonus,
      equipmentBonus
    );
    
    await db.update(wmdSpies).set({
      status: 'ON_MISSION',
      currentMissionId: missionId,
      updatedAt: startTime,
    }).where(eq(wmdSpies.spyId, spyId));
    
    const missionRowId = `wsm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(wmdSpyMissions).values({
      id: missionRowId,
      senderClanId: spy.clanId || spy.ownerId,
      targetClanId: targetClanId || targetPlayerId,
      spyId,
      spyName: spy.codename,
      targetName: targetUsername,
      missionType,
      status: MissionStatus.ACTIVE,
      estimatedCompletion: completionTime,
      finalSuccessChance: String(successChance),
      detectionRisk: String(missionConfig.detectionRisk),
      successful: 0,
      detected: 0,
      createdAt: startTime,
      updatedAt: startTime,
    });
    
    await scheduleMissionCompletion(missionId, completionTime);
    
    return { 
      success: true, 
      message: `${spy.codename} started ${missionType} mission. Completion in ${Math.ceil(missionConfig.duration / 60000)} minutes.`,
      missionId 
    };
    
  } catch (error) {
    console.error('Error starting mission:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function completeMission(
  missionId: string
): Promise<{ success: boolean; message: string; intelligence?: IntelligenceReport }> {
  try {
    const mission = await getMission(missionId);
    if (!mission) {
      return { success: false, message: 'Mission not found' };
    }
    
    if (mission.status !== MissionStatus.ACTIVE) {
      return { success: false, message: 'Mission is not active' };
    }
    
    if (!mission.missionType) {
      return { success: false, message: 'Mission has no mission type' };
    }
    
    const spy = await getSpy(mission.spyId);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    const successRoll = Math.random();
    const finalChance = parseFloat(mission.finalSuccessChance ?? '0');
    const success = successRoll < finalChance;
    
    const detectionRoll = Math.random();
    const detectionRisk = parseFloat(mission.detectionRisk ?? '1');
    const detected = detectionRoll < detectionRisk;
    
    let intelligence: IntelligenceReport | undefined = undefined;
    let missionResult = 'FAILED';
    
    if (success) {
      intelligence = await generateIntelligence(mission);
      missionResult = detected ? 'SUCCESS_DETECTED' : 'SUCCESS_UNDETECTED';
    } else {
      missionResult = detected ? 'FAILED_DETECTED' : 'FAILED_UNDETECTED';
    }
    
    const result: MissionResult = {
      success,
      missionType: mission.missionType,
      outcome: missionResult,
    };
    
    if (success && intelligence) {
      switch (mission.missionType) {
        case MissionType.RECONNAISSANCE:
          result.reconnaissance = {
            targetLevel: 50,
            targetPower: 10000,
            missileCount: 2,
            defenseStrength: 75,
          };
          break;
        case MissionType.SURVEILLANCE:
          result.surveillance = {
            recentActivity: ['Missile assembly detected', 'Defense battery upgraded'],
            missileProgress: 75,
            vulnerabilities: ['Weak southern perimeter', 'Limited counter-intelligence'],
          };
          break;
      }
    }
    
    await db.update(wmdSpyMissions).set({
      status: MissionStatus.COMPLETED,
      actualCompletion: new Date(),
      roll: String(successRoll),
      successful: success ? 1 : 0,
      intelligenceGathered: intelligence,
      detected: detected ? 1 : 0,
      updatedAt: new Date(),
    }).where(eq(wmdSpyMissions.id, missionId));
    
    const experienceGained = success ? 15 : 8;
    const updatedMissionHistory = [...(spy.missionHistory || []), missionId];
    
    await db.update(wmdSpies).set({
      status: detected ? 'COMPROMISED' : 'AVAILABLE',
      currentMissionId: null,
      lastMissionAt: new Date(),
      experience: spy.experience + experienceGained,
      missionHistory: updatedMissionHistory,
      updatedAt: new Date(),
    }).where(eq(wmdSpies.spyId, mission.spyId));
    
    await sendMissionNotifications(mission, missionResult, intelligence);
    
    if (detected) {
      await handleDetection(mission, spy);
    }
    
    const message = success 
      ? `Mission successful! Intelligence gathered${detected ? ' (spy detected)' : ''}.`
      : `Mission failed${detected ? ' and spy detected' : ''}.`;
    
    return { success, message, intelligence };
    
  } catch (error) {
    console.error('Error completing mission:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function executeSabotage(
  spyId: string,
  targetType: 'MISSILE' | 'DEFENSE_BATTERY' | 'RESEARCH',
  targetId: string,
  operatorId: string
): Promise<{ success: boolean; message: string; damage?: SabotageDamage }> {
  try {
    const spy = await getSpy(spyId);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    // FID-20260916-007: operator binding — the caller must own the spy.
    // getSpy never bound ownership (any authenticated session could operate
    // another player's agent), and this refusal is what guarantees the void
    // below can never fire on a hijacked spy's innocent owner.
    if (spy.ownerId !== operatorId) {
      return { success: false, message: 'Not your spy' };
    }
    
    if (spy.status !== 'AVAILABLE') {
      return { success: false, message: 'Spy is not available' };
    }
    
    if (spy.skills.sabotage < 30) {
      return { success: false, message: 'Spy lacks sufficient sabotage skills (minimum 30)' };
    }
    
    // FID-20260916-007: owner-derived validation. The historical signature
    // demanded the CALLER assert the victim's identity, which the route filled
    // with auth.playerId — unsatisfiable by construction (the operator never
    // owns the victim's missile). The validator now resolves the victim FROM
    // the target asset and returns the owner username.
    const target = await resolveSabotageTarget(targetType, targetId);
    if (!target.ok) {
      return { success: false, message: 'Invalid sabotage target' };
    }
    
    // FID-20260916-007: target-side protection refusal (parity with infantry /
    // factory / WMD-launch messages).
    if (target.protectionUntil !== null && protectionActive(target.protectionUntil)) {
      return { success: false, message: PROTECTION_REFUSAL_REASON };
    }
    
    // FID-20260916-007: void at commit — execution is the committed action
    // regardless of the success roll (mirrors the FID-004 placement: after
    // every refusal precondition, before effects). The operator binding above
    // guarantees this hits the spy's own owner, never a hijacked victim. The
    // spies row's ownerUsername is the signup-immutable identity, so the
    // denormalized column is a safe void source.
    await voidProtectionOnAggression(spy.ownerUsername);
    
    const baseSuccess = spy.skills.sabotage / 100;
    const targetDifficulty = getSabotageTargetDifficulty(targetType);
    const successChance = Math.max(0.05, baseSuccess - targetDifficulty);
    
    const detectionRisk = getSabotageDetectionRisk(targetType, spy.skills.stealth);
    
    const success = Math.random() < successChance;
    const detected = Math.random() < detectionRisk;
    
    let damage: SabotageDamage | undefined = undefined;
    let effectMessage = '';
    
    // FID-20261002-008 §5.4: the target mutation, the spy exposure and the
    // operation damage record commit TOGETHER in ONE transaction — a
    // persistence failure propagates and rolls everything back, so a
    // success-with-no-write response is impossible. The rolls were decided
    // OUTSIDE the retrying transaction: a retry replays the same outcome
    // instead of rerolling. For a roll success with nothing to damage, the
    // record carries the zero-delta damage + explicit noEffectReason —
    // truthful, never fabricated.
    const sabotageId = `sabotage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (success) {
      const now = new Date();
      damage = await withTransactionRetry('wmd:sabotage', () =>
        db.transaction(async (tx): Promise<SabotageDamage> => {
          const effect = await applySabotageDamageTx(tx, targetType, targetId, spy.skills.sabotage, now);
          effectMessage = effect.noEffectReason
            ? ` — no effect: ${effect.noEffectReason}`
            : '';
          
          // §5.4: the record and the spy exposure ride the SAME transaction
          // as the target mutation — they commit together or not at all.
          const sabotageRecord = buildSabotageRecord({
            id: `wso_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`,
            sabotageId,
            spyId,
            spy,
            targetType,
            targetId,
            target,
            success,
            detected,
            damage: effect,
            executedAt: now,
          });
          await tx.insert(wmdSabotageOperations).values(sabotageRecord);
          
          if (detected) {
            await tx.update(wmdSpies).set({
              status: 'COMPROMISED',
              updatedAt: now,
            }).where(eq(wmdSpies.spyId, spyId));
          }
          
          return effect;
        })
      );
      
      // §5.6: the notification seam runs strictly POST-commit (a notification
      // failure cannot change the committed success or duplicate damage).
      await sendSabotageNotifications(buildSabotageRecord({
        id: '', // not persisted again — notification payload only
        sabotageId,
        spyId,
        spy,
        targetType,
        targetId,
        target,
        success,
        detected,
        damage,
        executedAt: damage.executedAt,
      }));
    } else {
      // Roll failed: no target effect exists — the record + exposure still
      // commit (execution is the committed action, mirroring the void rule).
      const now = new Date();
      const targetUsername = target.ownerUsername ?? 'Unknown';
      const sabotageRecord = {
        id: `wso_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`,
        sabotageId,
        spyId,
        spyCodename: spy.codename,
        operatorId: spy.ownerId,
        operatorUsername: spy.ownerUsername,
        targetType,
        targetId,
        targetPlayerId: target.ownerId ?? '',
        targetUsername,
        success: 0,
        detected: detected ? 1 : 0,
        damageDealt: undefined,
        executedAt: now,
        createdAt: now,
      };
      await withTransactionRetry('wmd:sabotage:failed', () =>
        db.transaction(async (tx) => {
          await tx.insert(wmdSabotageOperations).values(sabotageRecord);
          if (detected) {
            await tx.update(wmdSpies).set({
              status: 'COMPROMISED',
              updatedAt: now,
            }).where(eq(wmdSpies.spyId, spyId));
          }
        })
      );
      await sendSabotageNotifications(sabotageRecord);
    }
    
    let message = 'Sabotage operation ';
    if (success) {
      message += detected ? 'successful but spy detected!' : 'successful and undetected.';
      message += effectMessage;
    } else {
      message += detected ? 'failed and spy detected!' : 'failed but spy undetected.';
    }
    
    return { success, message, damage };
    
  } catch (error) {
    console.error('Error executing sabotage:', error);
    return { success: false, message: 'Internal server error' };
  }
}

export async function counterIntelligenceSweep(
  playerId: string,
  targetArea: 'FACILITIES' | 'COMMUNICATIONS' | 'PERSONNEL' | 'ALL'
): Promise<CounterIntelResult> {
  try {
    const hasCapability = await hasCounterIntelUnlocked(playerId);
    if (!hasCapability) {
      return { 
        success: false, 
        message: 'Counter-intelligence not unlocked',
        threatsDetected: 0,
        spiesDetected: []
      };
    }
    
    const enemySpies = await getSpiesTargetingPlayer(playerId);
    
    if (enemySpies.length === 0) {
      return {
        success: true,
        message: 'No hostile intelligence activities detected',
        threatsDetected: 0,
        spiesDetected: []
      };
    }
    
    const detectedSpies = [];
    
    for (const spy of enemySpies) {
      const detectionChance = calculateCounterIntelChance(targetArea, spy);
      
      if (Math.random() < detectionChance) {
        detectedSpies.push({
          spyId: spy.spyId,
          codename: spy.codename,
          specialization: spy.specialization,
          operatorId: spy.ownerId,
          operatorClanId: spy.clanId,
        });
        
        await compromiseSpy(spy.spyId);
      }
    }
    
    await recordCounterIntelOperation(playerId, targetArea, detectedSpies);
    
    const message = detectedSpies.length > 0
      ? `Counter-intelligence sweep detected ${detectedSpies.length} hostile operative(s)`
      : 'Counter-intelligence sweep completed. No threats detected.';
    
    return {
      success: true,
      message,
      threatsDetected: detectedSpies.length,
      spiesDetected: detectedSpies
    };
    
  } catch (error) {
    console.error('Error in counter-intelligence sweep:', error);
    return {
      success: false,
      message: 'Counter-intelligence system error',
      threatsDetected: 0,
      spiesDetected: []
    };
  }
}

export async function getSpy(spyId: string): Promise<SpyAgent | null> {
  try {
    const result = await db.select()
      .from(wmdSpies)
      .where(eq(wmdSpies.spyId, spyId))
      .limit(1);
    
    if (!result[0]) return null;
    return mapDrizzleSpyToAgent(result[0]);
    
  } catch (error) {
    console.error('Error getting spy:', error);
    return null;
  }
}

export async function getPlayerSpies(
  playerId: string,
  statusFilter?: SpyStatus,
  operators: string[] = []
): Promise<SpyAgent[]> {
  try {
    const ownerCondition = operators.length
      ? and(eq(wmdSpies.ownerId, playerId), inArray(wmdSpies.ownerId, operators))
      : eq(wmdSpies.ownerId, playerId);
    const results = statusFilter
      ? await db.select().from(wmdSpies)
          .where(and(ownerCondition, eq(wmdSpies.status, statusFilter)))
          .orderBy(desc(wmdSpies.recruitedAt))
      : await db.select().from(wmdSpies)
          .where(ownerCondition)
          .orderBy(desc(wmdSpies.recruitedAt));
    return results.map(mapDrizzleSpyToAgent);
    
  } catch (error) {
    console.error('Error getting player spies:', error);
    return [];
  }
}

export async function getMission(missionId: string): Promise<WmdSpyMissionRow | null> {
  try {
    const result = await db.select()
      .from(wmdSpyMissions)
      .where(eq(wmdSpyMissions.id, missionId))
      .limit(1);
    
    if (!result[0]) {
      const result2 = await db.select()
        .from(wmdSpyMissions)
        .where(eq(wmdSpyMissions.senderClanId, missionId))
        .limit(1);
      return result2[0] || null;
    }
    
    return result[0] || null;
    
  } catch (error) {
    console.error('Error getting mission:', error);
    return null;
  }
}

export async function getPlayerMissions(
  playerId: string,
  statusFilter?: MissionStatus
): Promise<WmdSpyMissionRow[]> {
  try {
    const results = statusFilter
      ? await db.select().from(wmdSpyMissions)
          .where(and(eq(wmdSpyMissions.senderClanId, playerId), eq(wmdSpyMissions.status, statusFilter)))
          .orderBy(desc(wmdSpyMissions.createdAt))
      : await db.select().from(wmdSpyMissions)
          .where(eq(wmdSpyMissions.senderClanId, playerId))
          .orderBy(desc(wmdSpyMissions.createdAt));
    return results;
    
  } catch (error) {
    console.error('Error getting player missions:', error);
    return [];
  }
}

/**
 * FID-20260919-017: the reader the intelligence-reports table never had. A
 * player's reports are those whose mission belongs to one of the player's spies
 * (wmdIntelligenceReports has no owner column; missionId links the mission).
 */
export async function getPlayerIntelligenceReports(
  playerId: string,
  limit: number = 25
): Promise<Array<typeof wmdIntelligenceReports.$inferSelect>> {
  try {
    const spyRows = await db
      .select({ spyId: wmdSpies.spyId })
      .from(wmdSpies)
      .where(eq(wmdSpies.ownerId, playerId));
    const spyIds = spyRows.map((r) => r.spyId).filter(Boolean);
    if (spyIds.length === 0) return [];

    const missionRows = await db
      .select({ id: wmdSpyMissions.id })
      .from(wmdSpyMissions)
      .where(inArray(wmdSpyMissions.spyId, spyIds));
    const missionIds = missionRows.map((r) => r.id).filter(Boolean);
    if (missionIds.length === 0) return [];

    return await db
      .select()
      .from(wmdIntelligenceReports)
      .where(inArray(wmdIntelligenceReports.missionId, missionIds))
      .orderBy(desc(wmdIntelligenceReports.createdAt))
      .limit(limit);
  } catch (error) {
    console.error('Error getting intelligence reports:', error);
    return [];
  }
}

/**
 * FID-20260919-017: the reader the counter-intel table never had (operatorId is
 * the sweep's executor).
 */
export async function getPlayerCounterIntelHistory(
  playerId: string,
  limit: number = 25
): Promise<Array<typeof wmdCounterIntelOperations.$inferSelect>> {
  try {
    return await db
      .select()
      .from(wmdCounterIntelOperations)
      .where(eq(wmdCounterIntelOperations.operatorId, playerId))
      .orderBy(desc(wmdCounterIntelOperations.executedAt))
      .limit(limit);
  } catch (error) {
    console.error('Error getting counter-intel history:', error);
    return [];
  }
}

function generateCodename(): string {
  const adjectives = ['Shadow', 'Silent', 'Swift', 'Steel', 'Dark', 'Ghost', 'Wolf', 'Raven', 'Crimson', 'Silver'];
  const nouns = ['Fox', 'Hawk', 'Storm', 'Blade', 'Echo', 'Viper', 'Lynx', 'Falcon', 'Cobra', 'Tiger'];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  
  return `${adj}${noun}${num.toString().padStart(2, '0')}`;
}

function getBaseSkills(specialization: string): { stealth: number; hacking: number; sabotage: number; intelligence: number } {
  switch (specialization) {
    case 'SURVEILLANCE':
      return { stealth: 40, hacking: 20, sabotage: 10, intelligence: 30 };
    case 'SABOTAGE':
      return { stealth: 30, hacking: 10, sabotage: 40, intelligence: 20 };
    case 'INFILTRATION':
      return { stealth: 50, hacking: 30, sabotage: 10, intelligence: 10 };
    case 'CYBER':
      return { stealth: 20, hacking: 50, sabotage: 10, intelligence: 20 };
    default:
      return { stealth: 25, hacking: 25, sabotage: 25, intelligence: 25 };
  }
}

function validateMissionSkills(spy: SpyAgent, missionType: MissionType): boolean {
  const requiredSkills = {
    [MissionType.RECONNAISSANCE]: { intelligence: 20 },
    [MissionType.SURVEILLANCE]: { stealth: 30, intelligence: 25 },
    [MissionType.INFILTRATION]: { stealth: 40, hacking: 30 },
    [MissionType.SABOTAGE_LIGHT]: { sabotage: 25, stealth: 20 },
    [MissionType.SABOTAGE_HEAVY]: { sabotage: 40, stealth: 30 },
    [MissionType.SABOTAGE_NUCLEAR]: { sabotage: 60, stealth: 50 },
    [MissionType.INTELLIGENCE_LEAK]: { hacking: 35, intelligence: 30 },
    [MissionType.COUNTER_INTELLIGENCE]: { intelligence: 40, stealth: 30 },
    [MissionType.ASSASSINATION]: { stealth: 50, sabotage: 40 },
    [MissionType.THEFT]: { hacking: 40, stealth: 35 },
  };
  
  const requirements = requiredSkills[missionType];
  if (!requirements) return true;
  
  return Object.entries(requirements).every(([skill, minLevel]) => 
    spy.skills[skill as keyof typeof spy.skills] >= minLevel
  );
}

function getTrainingImprovement(intensity: 'BASIC' | 'ADVANCED' | 'ELITE', currentLevel: number): number {
  const baseImprovement: Record<'BASIC' | 'ADVANCED' | 'ELITE', number> = {
    'BASIC': 5,
    'ADVANCED': 10,
    'ELITE': 20
  };
  
  const improvement = baseImprovement[intensity];
  const diminishingFactor = Math.max(0.1, 1 - (currentLevel / 100));
  
  return Math.floor(improvement * diminishingFactor);
}

function calculateSpyRank(experience: number, missionCount: number): SpyRank {
  if (experience >= 500 && missionCount >= 100) return SpyRank.ELITE;
  if (experience >= 300 && missionCount >= 60) return SpyRank.VETERAN;
  if (experience >= 150 && missionCount >= 30) return SpyRank.AGENT;
  if (experience >= 50 && missionCount >= 10) return SpyRank.OPERATIVE;
  return SpyRank.ROOKIE;
}

async function hasSpyUnlocked(playerId: string): Promise<boolean> {
  try {
    const pr = await getPlayerResearch(playerId);
    // FID-20260912-058: the old intel_tier_* ids never existed in any catalog
    // (the Intelligence track sold spy_tier_*), so every gate here was dead.
    // Gates now sit on the single track's intel milestones: first spy at t3.
    return pr?.completedTechs?.includes('wmd_tier_3') || false;
  } catch (error) {
    console.error('Error checking spy unlock:', error);
    return false;
  }
}

async function getMaxSpies(playerId: string): Promise<number> {
  try {
    const pr = await getPlayerResearch(playerId);
    if (!pr) return 1;
    
    let maxSpies = 1;
    if (pr.completedTechs?.includes('wmd_tier_5')) maxSpies = 3;
    if (pr.completedTechs?.includes('wmd_tier_9')) maxSpies = 5;
    if (pr.completedTechs?.includes('wmd_tier_10')) maxSpies = 10;
    
    return maxSpies;
  } catch (error) {
    console.error('Error getting max spies:', error);
    return 1;
  }
}

async function hasCounterIntelUnlocked(playerId: string): Promise<boolean> {
  try {
    const pr = await getPlayerResearch(playerId);
    return pr?.completedTechs?.includes('wmd_tier_5') || false;
  } catch (error) {
    console.error('Error checking counter-intel unlock:', error);
    return false;
  }
}

async function promoteSpyRank(spyId: string, newRank: SpyRank): Promise<void> {
  try {
    const spy = await getSpy(spyId);
    if (!spy) return;
    
    await db.update(wmdSpies).set({
      rank: newRank,
      skillsStealth: spy.skills.stealth + 5,
      skillsHacking: spy.skills.hacking + 5,
      skillsSabotage: spy.skills.sabotage + 5,
      skillsIntelligence: spy.skills.intelligence + 5,
      updatedAt: new Date(),
    }).where(eq(wmdSpies.spyId, spyId));
  } catch (error) {
    console.error('Error promoting spy rank:', error);
  }
}

async function compromiseSpy(spyId: string): Promise<void> {
  try {
    const spy = await getSpy(spyId);
    if (!spy) return;
    
    await db.update(wmdSpies).set({
      status: 'COMPROMISED',
      skillsStealth: Math.max(0, spy.skills.stealth - 10),
      skillsIntelligence: Math.max(0, spy.skills.intelligence - 5),
      updatedAt: new Date(),
    }).where(eq(wmdSpies.spyId, spyId));
  } catch (error) {
    console.error('Error compromising spy:', error);
  }
}

async function validateMissionTarget(
  targetPlayerId: string,
  targetClanId?: string
): Promise<boolean> {
  try {
    const result = await db.select()
      .from(players)
      .where(eq(players.username, targetPlayerId))
      .limit(1);
    
    if (!result[0]) return false;
    
    if (targetClanId && result[0].clanId === targetClanId) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error validating mission target:', error);
    return false;
  }
}

async function getPlayerUsername(playerId: string): Promise<string> {
  try {
    const result = await db.select()
      .from(players)
      .where(eq(players.username, playerId))
      .limit(1);
    return result[0]?.username || 'Unknown';
  } catch (error) {
    console.error('Error getting player username:', error);
    return 'Unknown';
  }
}

async function getTargetSecurity(playerId: string): Promise<number> {
  try {
    const pr = await getPlayerResearch(playerId);
    
    let security = 0.1;
    
    if (pr?.completedTechs?.includes('wmd_tier_5')) security += 0.15;
    if (pr?.completedTechs?.includes('wmd_tier_7')) security += 0.25;
    if (pr?.completedTechs?.includes('wmd_tier_10')) security += 0.35;
    
    return Math.min(0.8, security);
  } catch (error) {
    console.error('Error getting target security:', error);
    return 0.1;
  }
}

async function generateIntelligence(mission: WmdSpyMissionRow): Promise<IntelligenceReport> {
  const reportId = `intel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const targetPlayerRows = await db.select()
    .from(players)
    .where(eq(players.username, mission.targetClanId))
    .limit(1);
  const targetPlayer = targetPlayerRows[0];
  
  const targetMissilesResult = await db.select()
    .from(missiles)
    .where(eq(missiles.ownerId, mission.targetClanId));
  
  const targetDefensesResult = await db.select()
    .from(wmdDefenseBatteries)
    .where(eq(wmdDefenseBatteries.clanId, mission.targetClanId));
  
  const intelligence: IntelligenceReport = {
    reportId,
    classification: IntelLevel.SECRET,
    gatheredBy: mission.spyName,
    gatheredFrom: mission.targetName,
    gatheredAt: new Date(),
    missionId: mission.id,
    target: {
      id: mission.targetClanId,
      username: mission.targetName,
      level: targetPlayer?.level || 0,
      power: targetPlayer?.totalStrength || 0,
      clanId: targetPlayer?.clanId || undefined,
      clanName: targetPlayer?.clanName || undefined,
    },
    wmdCapabilities: {
      missiles: targetMissilesResult.flatMap((missile) => {
        if (!isValidWarheadType(missile.warheadType)) return [];
        return [{
          missileId: missile.missileId,
          warheadType: missile.warheadType,
          progress: (missile.componentsWarhead ?? 0) * 20, // 5 components, each worth 20%
          estimatedCompletion: missile.status === 'READY' ? new Date() : undefined,
        }];
      }),
      defenseBatteries: targetDefensesResult.length,
      radarLevel: 'BASIC',
      combinedDefenseStrength: targetDefensesResult.reduce((sum, battery) => sum + parseFloat(battery.interceptChance ?? '0'), 0),
    },
    vulnerabilities: [
      'Limited counter-intelligence capabilities',
      'Weak perimeter security',
      'Predictable patrol patterns'
    ],
    threats: [
      'Active missile development program',
      'Expanding defense network',
      'Possible clan alliance'
    ],
    recommendations: [
      'Continue surveillance operations',
      'Consider sabotage of key facilities',
      'Monitor clan communications'
    ],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };
  
  await db.insert(wmdIntelligenceReports).values({
    // FID-20260919-017: varchar(24) PK — the old `wir_<ts>_<rand>` (27 chars)
    // overflowed it, so every successful mission's report insert threw and
    // mission completion failed. generateId() is 23 chars.
    id: generateId(),
    reportId,
    classification: 'SECRET',
    gatheredBy: mission.spyName,
    gatheredFrom: mission.targetName,
    gatheredAt: new Date(),
    missionId: mission.id,
    targetId: mission.targetClanId,
    targetUsername: mission.targetName,
    targetLevel: targetPlayer?.level || 0,
    targetPower: targetPlayer?.totalStrength || 0,
    targetClanId: targetPlayer?.clanId,
    targetClanName: targetPlayer?.clanName,
    wmdCapabilities: intelligence.wmdCapabilities,
    vulnerabilities: intelligence.vulnerabilities,
    threats: intelligence.threats,
    recommendations: intelligence.recommendations,
    expiresAt: intelligence.expiresAt,
    createdAt: new Date(),
  });
  
  return intelligence;
}

async function scheduleMissionCompletion(
  missionId: string,
  completionTime: Date
): Promise<void> {
  try {
    console.log(`Mission ${missionId} scheduled to complete at ${completionTime}`);
  } catch (error) {
    console.error('Error scheduling mission completion:', error);
  }
}

async function sendMissionNotifications(
  mission: WmdSpyMissionRow,
  result: string,
  intelligence?: IntelligenceReport
): Promise<void> {
  try {
    const operatorNotificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await db.insert(wmdNotifications).values({
      id: `wn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notificationId: operatorNotificationId,
      eventType: WMDEventType.SPY_MISSION_COMPLETED,
      priority: result.includes('SUCCESS') ? NotificationPriority.MEDIUM : NotificationPriority.LOW,
      scope: NotificationScope.PERSONAL,
      sourceId: mission.senderClanId,
      sourceName: 'System',
      targetId: mission.senderClanId,
      targetName: 'You',
      title: 'Spy Mission Completed',
      message: `Mission ${mission.missionType ?? 'UNKNOWN'} completed: ${result}`,
      details: {
        missionId: mission.id,
        spyName: mission.spyName,
        result,
        intelligenceGathered: !!intelligence,
        intelligenceReportId: intelligence?.reportId,
      },
      viewCount: 0,
      broadcastAt: new Date(),
      createdAt: new Date(),
    });
    
    if (result.includes('DETECTED') && mission.targetClanId) {
      await db.insert(wmdNotifications).values({
        id: `wn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: WMDEventType.SPY_DETECTED,
        priority: NotificationPriority.HIGH,
        scope: NotificationScope.PERSONAL,
        sourceId: mission.senderClanId,
        sourceName: 'System',
        targetId: mission.targetClanId,
        targetName: 'You',
        title: 'Hostile Intelligence Detected',
        message: `Hostile intelligence operation detected! ${mission.missionType ?? 'UNKNOWN'} mission intercepted.`,
        details: {
          missionId: mission.id,
          operatorId: mission.senderClanId,
          spyName: mission.spyName,
          missionType: mission.missionType,
        },
        viewCount: 0,
        broadcastAt: new Date(),
        createdAt: new Date(),
      });
    }
    
    if (intelligence && mission.missionType === MissionType.INTELLIGENCE_LEAK) {
      await db.insert(wmdNotifications).values({
        id: `wn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: WMDEventType.INTELLIGENCE_LEAKED,
        priority: NotificationPriority.CRITICAL,
        scope: NotificationScope.GLOBAL,
        sourceId: 'GLOBAL',
        sourceName: 'System',
        targetId: 'GLOBAL',
        targetName: 'Global',
        title: 'Intelligence Leaked',
        message: 'INTELLIGENCE LEAKED: Classified WMD information has been exposed!',
        details: {
          reportId: intelligence.reportId,
          targetId: mission.targetClanId,
          classification: intelligence.classification,
        },
        viewCount: 0,
        broadcastAt: new Date(),
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error('Error sending mission notifications:', error);
    throw new Error('Failed to send mission notifications');
  }
}

async function handleDetection(mission: WmdSpyMissionRow, spy: SpyAgent): Promise<void> {
  try {
    await db.update(wmdSpies).set({
      skillsStealth: Math.max(0, spy.skills.stealth - 5),
      skillsIntelligence: Math.max(0, spy.skills.intelligence - 3),
      updatedAt: new Date(),
    }).where(eq(wmdSpies.spyId, spy.spyId));
    
    const existingStatus = await db.select()
      .from(wmdSecurityStatus)
      .where(eq(wmdSecurityStatus.playerId, mission.targetClanId))
      .limit(1);
    
    if (existingStatus[0]) {
      const currentAlert = parseFloat(existingStatus[0].alertLevel);
      await db.update(wmdSecurityStatus).set({
        alertLevel: String(Math.min(1, currentAlert + 0.1)),
        lastIncident: new Date(),
        updatedAt: new Date(),
      }).where(eq(wmdSecurityStatus.playerId, mission.targetClanId));
    } else {
      await db.insert(wmdSecurityStatus).values({
        id: `wss_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        playerId: mission.targetClanId,
        alertLevel: '0.1',
        lastIncident: new Date(),
        updatedAt: new Date(),
      });
    }
  } catch (error) {
    console.error('Error handling detection:', error);
  }
}

async function canAffordTraining(playerId: string, intensity: 'BASIC' | 'ADVANCED' | 'ELITE'): Promise<boolean> {
  try {
    const result = await db.select()
      .from(players)
      .where(eq(players.username, playerId))
      .limit(1);
    
    const player = result[0];
    if (!player) return false;
    
    const trainingCosts = {
      'BASIC': { metal: 25000, energy: 50000 },
      'ADVANCED': { metal: 75000, energy: 150000 },
      'ELITE': { metal: 200000, energy: 400000 },
    } satisfies Record<'BASIC' | 'ADVANCED' | 'ELITE', ResourceCost>;
    
    const cost = trainingCosts[intensity];
    
    const playerMetal = Number(player.resourcesMetal || 0);
    const playerEnergy = Number(player.resourcesEnergy || 0);
    
    return playerMetal >= cost.metal && playerEnergy >= cost.energy;
  } catch (error) {
    console.error('Error checking training affordability:', error);
    return false;
  }
}

async function deductTrainingCosts(playerId: string, intensity: 'BASIC' | 'ADVANCED' | 'ELITE'): Promise<void> {
  try {
    const trainingCosts = {
      'BASIC': { metal: 25000, energy: 50000 },
      'ADVANCED': { metal: 75000, energy: 150000 },
      'ELITE': { metal: 200000, energy: 400000 },
    } satisfies Record<'BASIC' | 'ADVANCED' | 'ELITE', ResourceCost>;
    
    const cost = trainingCosts[intensity];
    
    const playerResult = await db.select()
      .from(players)
      .where(eq(players.username, playerId))
      .limit(1);
    
    const player = playerResult[0];
    if (!player) return;
    
    await db.update(players).set({
      resourcesMetal: Number(BigInt(Number(player.resourcesMetal || 0n) - cost.metal)),
      resourcesEnergy: Number(BigInt(Number(player.resourcesEnergy || 0n) - cost.energy)),
    }).where(eq(players.username, playerId));
  } catch (error) {
    console.error('Error deducting training costs:', error);
  }
}

function getSabotageTargetDifficulty(targetType: SabotageTargetType): number {
  // FID-20260916-011: single source of truth lives in sabotageMath (importable
  // by the enumeration route and the client preview); delegate, never copy.
  return getSabotageDifficulty(targetType);
}

function getSabotageDetectionRisk(targetType: SabotageTargetType, stealthSkill: number): number {
  // FID-20260916-011: delegated to sabotageMath — identical clamp + formula.
  return sabotageDetectionRisk(stealthSkill, targetType);
}

/**
 * FID-20260916-007: owner-derived sabotage-target validation.
 *
 * The historical `validateSabotageTarget` required the CALLER to assert the
 * victim's identity and matched the asset only if its owner equaled that
 * assertion — unsatisfiable for the live route, which passed the operator's
 * own id. This resolver instead identifies the victim FROM the asset:
 *   MISSILE          -> missiles.ownerId -> players.username
 *   DEFENSE_BATTERY  -> wmd_defense_batteries.clanId -> clans.leaderId -> players
 *   RESEARCH         -> player_research.playerId -> players.username
 * and returns the owner's protection window so executeSabotage can refuse
 * protected victims before any committed action. Missing asset or owner
 * resolves to not-found (refusal); DB errors fail closed (refusal).
 */
async function resolveSabotageTarget(
  targetType: string,
  targetId: string
): Promise<{ ok: boolean; ownerId: string | null; ownerUsername: string | null; protectionUntil: Date | string | null }> {
  try {
    let ownerRow: { username: string; protectionUntil: Date | string | null } | undefined;
    const notFound = { ok: false, ownerId: null, ownerUsername: null, protectionUntil: null } as const;

    switch (targetType) {
      case 'MISSILE': {
        const [missile] = await db.select({ ownerId: missiles.ownerId })
          .from(missiles)
          .where(eq(missiles.missileId, targetId))
          .limit(1);
        if (!missile) return notFound;
        [ownerRow] = await db.select({ username: players.username, protectionUntil: players.protectionUntil })
          .from(players)
          .where(eq(players.username, missile.ownerId))
          .limit(1);
        break;
      }
      case 'DEFENSE_BATTERY': {
        const [battery] = await db.select({ clanId: wmdDefenseBatteries.clanId })
          .from(wmdDefenseBatteries)
          .where(eq(wmdDefenseBatteries.batteryId, targetId))
          .limit(1);
        if (!battery) return notFound;
        const [clan] = await db.select({ leaderId: clans.leaderId })
          .from(clans)
          .where(eq(clans.id, battery.clanId))
          .limit(1);
        if (!clan) return notFound;
        [ownerRow] = await db.select({ username: players.username, protectionUntil: players.protectionUntil })
          .from(players)
          .where(eq(players.username, clan.leaderId))
          .limit(1);
        break;
      }
      case 'RESEARCH': {
        const [research] = await db.select({ playerId: playerResearch.playerId })
          .from(playerResearch)
          .where(eq(playerResearch.id, targetId))
          .limit(1);
        if (!research) return notFound;
        [ownerRow] = await db.select({ username: players.username, protectionUntil: players.protectionUntil })
          .from(players)
          .where(eq(players.username, research.playerId))
          .limit(1);
        break;
      }
      default:
        return notFound;
    }

    if (!ownerRow) return notFound;
    // players is username-keyed (no surrogate id column): the asset ownerId
    // columns store the username, so ownerId here IS the username.
    return { ok: true, ownerId: ownerRow.username, ownerUsername: ownerRow.username, protectionUntil: ownerRow.protectionUntil };
  } catch (error) {
    // Fail closed: a lookup outage refuses the operation (conservative for a
    // weapon-adjacent pipeline), matching the -005 precedent.
    console.error('Error resolving sabotage target:', error);
    return { ok: false, ownerId: null, ownerUsername: null, protectionUntil: null };
  }
}

/**
 * FID-20261002-008: the operation record shape, shared by the success and
 * failure paths so the persisted row always describes the VICTIM (the
 * FID-20260916-007 owner-derived identity) and the COMMITTED effect.
 */
function buildSabotageRecord(args: {
  id: string;
  sabotageId: string;
  spyId: string;
  spy: { codename: string; ownerId: string; ownerUsername: string };
  targetType: 'MISSILE' | 'DEFENSE_BATTERY' | 'RESEARCH';
  targetId: string;
  target: { ownerId: string | null; ownerUsername: string | null };
  success: boolean;
  detected: boolean;
  damage: SabotageDamage | undefined;
  executedAt: Date;
}): typeof wmdSabotageOperations.$inferInsert {
  return {
    id: args.id,
    sabotageId: args.sabotageId,
    spyId: args.spyId,
    spyCodename: args.spy.codename,
    operatorId: args.spy.ownerId,
    operatorUsername: args.spy.ownerUsername,
    targetType: args.targetType,
    targetId: args.targetId,
    targetPlayerId: args.target.ownerId ?? '',
    targetUsername: args.target.ownerUsername ?? 'Unknown',
    success: args.success ? 1 : 0,
    detected: args.detected ? 1 : 0,
    damageDealt: args.damage,
    executedAt: args.executedAt,
    createdAt: args.executedAt,
  };
}

/**
 * FID-20261002-008 — the truthful target-effect engine. TRANSACTION-AWARE:
 * every read runs on the caller's tx with the target row FOR UPDATE-locked
 * (the same active row 002's research writer locks), every write commits (or
 * rolls back) WITH the operation record and spy exposure.
 *
 * R12 (RED): the battery branch reported success with ZERO target writes —
 * it only computed a hypothetical resource-waste figure — and research had no
 * branch at all; the missile branch fabricated metal/energy losses.
 *
 * Effects use REAL schema state only:
 *  - DEFENSE_BATTERY → the 007 lifecycle: cooldownUntil extended by
 *    ceil(clamped skill/100 × cooldownDuration) (≥1 ms for positive skill)
 *    from max(now, existing deadline); eligible IDLE/COOLDOWN batteries move
 *    to COOLDOWN; DAMAGED/UPGRADING are unavailable. delayDuration records the
 *    ACTUAL extension — no invented resource loss, no health write (the schema
 *    has no health column).
 *  - RESEARCH → currentResearchRpSpent reduced by
 *    min(spent, floor(required × clamped skill/100 × 0.25));
 *    currentResearchProgress rewritten from remaining/required as a validated
 *    decimal string. Completed techs, domain tiers and lifetime RP spent are
 *    NEVER revoked. No active research / zero destructible progress is a
 *    truthful NO-EFFECT result, not a damaging success.
 *  - MISSILE → preserved behavior with a truthful ACTUAL components delta;
 *    resourcesWasted computed from the REAL COMPONENT_COSTS evidence for the
 *    components actually destroyed (the invented progressLost×cost figures are
 *    gone).
 *
 * A no-effect outcome carries zero applied deltas + an explicit reason; the
 * caller records it as a successful roll with zero effect, never as damage.
 */
async function applySabotageDamageTx(
  tx: TreasuryTx,
  targetType: string,
  targetId: string,
  sabotageSkill: number,
  now: Date
): Promise<SabotageDamage> {
  const sabotageId = `sabotage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const clampedSkill = Math.min(Math.max(sabotageSkill, 0), 100);
  
  const damage: SabotageDamage = {
    sabotageId,
    missionId: '',
    saboteurId: '',
    saboteurName: '',
    targetId: '',
    targetUsername: '',
    missileId: targetType === 'MISSILE' ? targetId : '',
    componentsDestroyed: [],
    componentsDelayed: [],
    delayDuration: 0,
    progressLost: 0,
    resourcesWasted: { metal: 0, energy: 0 },
    detected: false,
    executedAt: now,
  };
  
  if (targetType === 'MISSILE') {
    const progressLost = Math.floor((clampedSkill / 100) * 25);
    damage.progressLost = progressLost;
    
    const [missile] = await tx
      .select()
      .from(missiles)
      .where(eq(missiles.missileId, targetId))
      .limit(1)
      .for('update');
    
    if (!missile) {
      // §5.1: the locked truth is authoritative — a vanished target yields a
      // truthful no-effect, never fabricated damage.
      damage.noEffectReason = 'Target missile no longer exists';
      return damage;
    }
    
    const currentComponents = missile.componentsWarhead || 0;
    const newComponents = Math.max(0, currentComponents - Math.floor(progressLost / 10));
    const actuallyDestroyed = currentComponents - newComponents;
    
    await tx.update(missiles).set({
      componentsWarhead: newComponents,
      updatedAt: now,
    }).where(eq(missiles.missileId, targetId));
    
    if (actuallyDestroyed > 0) {
      damage.componentsDestroyed = [MissileComponent.WARHEAD];
      // §5.5: real spend evidence only — the catalog's base component cost;
      // the tier-multiplier exponent semantics are undefined so the
      // conservative base is used, never an invented figure.
      damage.resourcesWasted = {
        metal: actuallyDestroyed * COMPONENT_COSTS[MissileComponent.WARHEAD].baseCost.metal,
        energy: actuallyDestroyed * COMPONENT_COSTS[MissileComponent.WARHEAD].baseCost.energy,
      };
    }
  } else if (targetType === 'DEFENSE_BATTERY') {
    const [battery] = await tx
      .select()
      .from(wmdDefenseBatteries)
      .where(eq(wmdDefenseBatteries.batteryId, targetId))
      .limit(1)
      .for('update');
    
    if (!battery) {
      damage.noEffectReason = 'Target battery no longer exists';
      return damage;
    }
    if (battery.status === 'DAMAGED' || battery.status === 'UPGRADING') {
      // §5.2: only IDLE/COOLDOWN batteries are eligible targets.
      damage.noEffectReason = `Battery is unavailable (status ${battery.status})`;
      return damage;
    }
    
    // §5.2 the 007 lifecycle: extend the persisted shot deadline from
    // max(now, existing deadline); the conditional transition reserves the
    // battery into COOLDOWN (IDLE) or extends it in place (already COOLDOWN).
    const existingDeadline = battery.cooldownUntil ?? null;
    const base = existingDeadline && existingDeadline > now ? existingDeadline : now;
    const durationMs = battery.cooldownDuration ?? 0;
    // executeSabotage refuses spies below the sabotage floor (30), so the
    // clamped skill is always positive here; the ≥1 ms bound is the spec's
    // explicit floor for positive skill.
    const extension = Math.max(1, Math.ceil((clampedSkill / 100) * durationMs));
    const newDeadline = new Date(base.getTime() + extension);
    
    // Under the row lock the battery cannot change status; the conditional
    // predicate is defense-in-depth against any non-tx writer.
    const claim = await tx
      .update(wmdDefenseBatteries)
      .set({
        status: 'COOLDOWN',
        cooldownUntil: newDeadline,
        updatedAt: now,
      })
      .where(and(
        eq(wmdDefenseBatteries.id, battery.id),
        inArray(wmdDefenseBatteries.status, ['IDLE', 'COOLDOWN'])
      ))
      .returning({ id: wmdDefenseBatteries.id });
    if (claim.length === 0) {
      // Lost the row to a concurrent writer — truthful no-effect.
      damage.noEffectReason = 'Battery state changed during the operation';
      return damage;
    }
    
    damage.delayDuration = extension;
    // Time is time: a cooldown extension is NOT metal/energy destruction.
  } else if (targetType === 'RESEARCH') {
    // §5.3: lock the SAME active research row the 002 writer locks.
    const [research] = await tx
      .select()
      .from(playerResearch)
      .where(eq(playerResearch.id, targetId))
      .limit(1)
      .for('update');
    
    if (!research) {
      damage.noEffectReason = 'Target research record no longer exists';
      return damage;
    }
    const techId = research.currentResearchTechId;
    const spent = research.currentResearchRpSpent ?? 0;
    const required = research.currentResearchRpRequired ?? 0;
    if (!techId || spent <= 0 || required <= 0) {
      damage.noEffectReason = !techId
        ? 'Target has no active research in progress'
        : 'Active research has no destructible RP progress';
      return damage;
    }
    
    const destroy = Math.min(spent, Math.floor(required * (clampedSkill / 100) * 0.25));
    if (destroy <= 0) {
      damage.noEffectReason = 'Sabotage strength destroys no RP at this research scale';
      return damage;
    }
    const remaining = spent - destroy;
    
    await tx
      .update(playerResearch)
      .set({
        currentResearchRpSpent: remaining,
        // §5.3 source-audit correction: currentResearchProgress is a numeric
        // column — write a validated decimal string derived from the LOCKED
        // row's remaining/required.
        currentResearchProgress: String(Math.min(100, Math.max(0, (remaining / required) * 100)).toFixed(2)),
        updatedAt: now,
      })
      .where(eq(playerResearch.id, targetId));
    
    damage.progressLost = destroy; // ACTUAL RP destroyed
    // RP is RP: research destruction is NOT metal/energy destruction.
  }
  
  return damage;
}

async function sendSabotageNotifications(sabotage: typeof wmdSabotageOperations.$inferInsert): Promise<void> {
  try {
    await db.insert(wmdNotifications).values({
      id: `wn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      eventType: WMDEventType.SABOTAGE_COMPLETED,
      priority: sabotage.success ? NotificationPriority.MEDIUM : NotificationPriority.LOW,
      scope: NotificationScope.PERSONAL,
      sourceId: sabotage.operatorId,
      sourceName: 'System',
      targetId: sabotage.operatorId,
      targetName: 'You',
      title: 'Sabotage Operation',
      message: `Sabotage operation ${sabotage.success ? 'successful' : 'failed'}${sabotage.detected ? ' (detected)' : ''}`,
      details: {
        sabotageId: sabotage.sabotageId,
        targetType: sabotage.targetType,
        targetId: sabotage.targetId,
        damage: sabotage.damageDealt,
      },
      viewCount: 0,
      broadcastAt: new Date(),
      createdAt: new Date(),
    });
    
    if (sabotage.detected) {
      await db.insert(wmdNotifications).values({
        id: `wn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        notificationId: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventType: WMDEventType.SABOTAGE_DETECTED,
        priority: NotificationPriority.HIGH,
        scope: NotificationScope.PERSONAL,
        sourceId: sabotage.operatorId,
        sourceName: 'System',
        targetId: sabotage.targetPlayerId,
        targetName: 'You',
        title: 'Sabotage Detected',
        message: `Sabotage detected! Your ${sabotage.targetType.toLowerCase()} was targeted.`,
        details: {
          sabotageId: sabotage.sabotageId,
          operatorId: sabotage.operatorId,
          damage: sabotage.damageDealt,
        },
        viewCount: 0,
        broadcastAt: new Date(),
        createdAt: new Date(),
      });
    }
  } catch (error) {
    console.error('Error sending sabotage notifications:', error);
  }
}

async function getSpiesTargetingPlayer(playerId: string): Promise<SpyAgent[]> {
  try {
    const activeMissions = await db.select()
      .from(wmdSpyMissions)
      .where(and(
        eq(wmdSpyMissions.targetClanId, playerId),
        eq(wmdSpyMissions.status, MissionStatus.ACTIVE)
      ));
    
    const spyIds = activeMissions.map(mission => mission.spyId).filter(Boolean);
    
    if (spyIds.length === 0) return [];
    
    const spies = await db.select()
      .from(wmdSpies)
      .where(inArray(wmdSpies.spyId, spyIds as [string, ...string[]]));
    
    return spies.map(mapDrizzleSpyToAgent);
  } catch (error) {
    console.error('Error getting spies targeting player:', error);
    return [];
  }
}

function calculateCounterIntelChance(targetArea: CounterIntelTargetArea, spy: SpyAgent): number {
  let baseChance = 0.3;
  
  const areaBonuses: Record<CounterIntelTargetArea, number> = {
    'FACILITIES': 0.2,
    'COMMUNICATIONS': 0.15,
    'PERSONNEL': 0.25,
    'ALL': 0.1,
  };
  
  baseChance += areaBonuses[targetArea];
  const stealthReduction = spy.skills.stealth / 200;
  
  return Math.max(0.05, Math.min(0.8, baseChance - stealthReduction));
}

async function recordCounterIntelOperation(
  playerId: string,
  targetArea: CounterIntelTargetArea,
  detectedSpies: CounterIntelDetectedSpy[]
): Promise<void> {
  try {
    await db.insert(wmdCounterIntelOperations).values({
      // FID-20260919-017: varchar(24) PK — the old `wcio_<ts>_<rand>` (28 chars)
      // overflowed it; the surrounding try/catch swallowed the failure, so this
      // writer recorded nothing. generateId() is 23 chars.
      id: generateId(),
      operationId: `counter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      operatorId: playerId,
      targetArea,
      spiesDetected: detectedSpies.length,
      detectedSpies: detectedSpies,
      executedAt: new Date(),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error recording counter-intel operation:', error);
  }
}