/**
 * @file lib/wmd/spyService.ts
 * @created 2025-10-22
 * @overview WMD Spy Service - Intelligence Operations (Clan Treasury Integrated)
 * 
 * OVERVIEW:
 * Handles all intelligence operations including spy recruitment, mission
 * planning, surveillance, sabotage operations, and counter-intelligence.
 * ALL costs deducted from CLAN TREASURY with equal cost sharing among members.
 */

type SpyStatus = 'AVAILABLE' | 'ON_MISSION' | 'COMPROMISED';

import { createServiceClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import {
  SpyMission,
  MissionType,
  MissionStatus,
  SpyRank,
  IntelligenceReport,
  MissionResult,
  SabotageDamage,
  MISSION_CONFIGS,
  isValidMissionType,
  calculateSuccessChance
} from '@/types/wmd';
import {
  validateClanWMDFunds,
  deductWMDCost,
  WMDPurchaseType,
} from './clanTreasuryWMDService';

// ============================================================================
// SPY NETWORK INTERFACE
// ============================================================================

/**
 * Individual spy agent
 */
interface SpyAgent {
  spyId: string;
  ownerId: string;
  ownerUsername: string;
  clanId: string | null;
  codename: string;
  rank: SpyRank;
  experience: number;
  specialization: 'SURVEILLANCE' | 'SABOTAGE' | 'INFILTRATION' | 'CYBER';
  status: 'AVAILABLE' | 'ON_MISSION' | 'COMPROMISED' | 'RETIRED';
  currentMissionId: string | null;
  missionHistory: string[];
  skills: {
    stealth: number;
    hacking: number;
    sabotage: number;
    intelligence: number;
  };
  lastMissionAt: Date | null;
  recruitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// HELPER: GET SPY FROM SUPABASE
// ============================================================================

function mapSpyFromRow(row: any): SpyAgent | null {
  if (!row) return null;
  return {
    spyId: row.spy_id,
    ownerId: row.owner_id,
    ownerUsername: row.owner_username,
    clanId: null,
    codename: row.name || `Spy-${row.spy_id}`,
    rank: SpyRank.ROOKIE,
    experience: row.experience || 0,
    specialization: 'SURVEILLANCE',
    status: (row.status === 'active' ? 'AVAILABLE' : row.status === 'on_mission' ? 'ON_MISSION' : 'COMPROMISED') as SpyStatus,
    currentMissionId: null,
    missionHistory: [],
    skills: { stealth: 40, hacking: 20, sabotage: 10, intelligence: 30 },
    lastMissionAt: null,
    recruitedAt: new Date(row.created_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(),
  };
}

// ============================================================================
// SPY RECRUITMENT
// ============================================================================

/**
 * Recruit a new spy (clan treasury funded)
 */
export async function recruitSpy(
  recruiterId: string,
  recruiterUsername: string,
  specialization: 'SURVEILLANCE' | 'SABOTAGE' | 'INFILTRATION' | 'CYBER',
  clanId: string
): Promise<{ success: boolean; message: string; spyId?: string; perMemberCost?: { metal: number; energy: number } }> {
  try {
    const supabase = createServiceClient();
    
    // Check if player has unlocked spy recruitment
    const hasUnlocked = await hasSpyUnlocked(recruiterId);
    if (!hasUnlocked) {
      return { success: false, message: 'Intelligence operations not unlocked' };
    }
    
    // Check recruitment limits
    const currentSpies = await getPlayerSpies(recruiterId);
    const maxSpies = await getMaxSpies(recruiterId);
    
    if (currentSpies.length >= maxSpies) {
      return { success: false, message: `Maximum spy limit reached (${maxSpies})` };
    }
    
    // Get recruitment costs
    const recruitmentCosts: Record<string, { metal: number; energy: number }> = {
      'SURVEILLANCE': { metal: 100000, energy: 200000 },
      'SABOTAGE': { metal: 150000, energy: 250000 },
      'INFILTRATION': { metal: 200000, energy: 300000 },
      'CYBER': { metal: 250000, energy: 350000 },
    };
    
    const cost = recruitmentCosts[specialization] || recruitmentCosts['SURVEILLANCE'];
    
    // Validate clan has funds
    const validation = await validateClanWMDFunds(clanId, cost);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }
    
    // Deduct from clan treasury
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
    
    // Generate unique spy ID
    const spyId = `spy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const codename = generateCodename();
    
    const { error } = await supabase
      .from('wmd_spies')
      .insert({
        spy_id: spyId,
        owner_id: recruiterId,
        owner_username: recruiterUsername,
        status: 'active',
        experience: 0,
        position_x: Math.floor(Math.random() * 150),
        position_y: Math.floor(Math.random() * 150),
        name: codename,
      });
    
    if (error) {
      console.error('Error inserting spy:', error);
      return { success: false, message: 'Failed to create spy' };
    }
    
    console.log(`Spy recruited by ${recruiterUsername} (Clan: ${clanId})`);
    
    return { 
      success: true, 
      message: `${specialization} spy recruited. Codename: ${codename}. Clan cost: ${cost.metal} metal, ${cost.energy} energy`, 
      spyId,
      perMemberCost: deduction.perMemberCost,
    };
    
  } catch (error) {
    console.error('Error recruiting spy:', error);
    return { success: false, message: 'Internal server error' };
  }
}

/**
 * Train a spy to improve skills
 */
export async function trainSpy(
  spyId: string,
  skillToTrain: 'stealth' | 'hacking' | 'sabotage' | 'intelligence',
  trainingIntensity: 'BASIC' | 'ADVANCED' | 'ELITE'
): Promise<{ success: boolean; message: string; newSkillLevel?: number }> {
  try {
    const supabase = createServiceClient();
    const spy = await getSpy(spyId);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    if (spy.status !== 'AVAILABLE') {
      return { success: false, message: 'Spy is not available for training' };
    }
    
    const currentLevel = spy.skills[skillToTrain];
    const improvement = getTrainingImprovement(trainingIntensity, currentLevel);
    const newLevel = Math.min(100, currentLevel + improvement);
    const newExperience = spy.experience + improvement;
    
    // Update spy
    await supabase
      .from('wmd_spies')
      .update({ experience: newExperience })
      .eq('spy_id', spyId);
    
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

// ============================================================================
// INTELLIGENCE MISSIONS
// ============================================================================

/**
 * Start an intelligence mission
 */
export async function startMission(
  spyId: string,
  missionType: MissionType,
  targetPlayerId: string,
  targetClanId?: string
): Promise<{ success: boolean; message: string; missionId?: string }> {
  try {
    const supabase = createServiceClient();
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
    
    // Generate mission ID
    const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { error } = await supabase
      .from('wmd_spy_missions')
      .insert({
        mission_id: missionId,
        spy_id: spyId,
        owner_id: spy.ownerId,
        mission_type: missionType,
        status: 'in_progress',
        target_player_id: targetPlayerId,
        started_at: new Date().toISOString(),
      });
    
    if (error) {
      console.error('Error starting mission:', error);
      return { success: false, message: 'Failed to start mission' };
    }
    
    // Update spy status
    await supabase
      .from('wmd_spies')
      .update({ status: 'on_mission' })
      .eq('spy_id', spyId);
    
    return { 
      success: true, 
      message: `Spy started ${missionType} mission.`, 
      missionId 
    };
    
  } catch (error) {
    console.error('Error starting mission:', error);
    return { success: false, message: 'Internal server error' };
  }
}

/**
 * Complete a mission and generate results
 */
export async function completeMission(
  missionId: string
): Promise<{ success: boolean; message: string; intelligence?: IntelligenceReport }> {
  try {
    const supabase = createServiceClient();
    
    const { data: mission } = await supabase
      .from('wmd_spy_missions')
      .select('*')
      .eq('mission_id', missionId)
      .single();
    
    if (!mission) {
      return { success: false, message: 'Mission not found' };
    }
    
    if (mission.status !== 'in_progress') {
      return { success: false, message: 'Mission is not active' };
    }
    
    const spy = await getSpy(mission.spy_id);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    // Roll for mission success
    const successRoll = Math.random();
    const success = successRoll < 0.7; // 70% base success
    
    const result = success ? 'completed' : 'failed';
    
    // Update mission
    await supabase
      .from('wmd_spy_missions')
      .update({
        status: result as unknown as Database['public']['Enums']['wmd_mission_status'],
        completed_at: new Date().toISOString(),
      })
      .eq('mission_id', missionId);
    
    // Update spy
    const experienceGained = success ? 15 : 8;
    await supabase
      .from('wmd_spies')
      .update({
        status: 'active',
        experience: spy.experience + experienceGained,
      })
      .eq('spy_id', mission.spy_id);
    
    return { success, message: success ? 'Mission successful!' : 'Mission failed.' };
    
  } catch (error) {
    console.error('Error completing mission:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// ============================================================================
// SABOTAGE OPERATIONS
// ============================================================================

/**
 * Execute sabotage operation
 */
export async function executeSabotage(
  spyId: string,
  targetType: 'MISSILE' | 'DEFENSE_BATTERY' | 'RESEARCH',
  targetId: string,
  targetPlayerId: string
): Promise<{ success: boolean; message: string; damage?: SabotageDamage }> {
  try {
    const supabase = createServiceClient();
    const spy = await getSpy(spyId);
    if (!spy) {
      return { success: false, message: 'Spy not found' };
    }
    
    if (spy.status !== 'AVAILABLE') {
      return { success: false, message: 'Spy is not available' };
    }
    
    if (spy.skills.sabotage < 30) {
      return { success: false, message: 'Spy lacks sufficient sabotage skills (minimum 30)' };
    }
    
    const baseSuccess = spy.skills.sabotage / 100;
    const successChance = Math.max(0.05, baseSuccess - 0.2);
    const detectionRisk = 0.4 - (spy.skills.stealth / 200);
    
    const sabotageSuccess = Math.random() < successChance;
    const detected = Math.random() < detectionRisk;
    
    // Record sabotage
    const sabotageId = `sabotage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await supabase
      .from('wmd_sabotage_events')
      .insert({
        event_id: sabotageId,
        saboteur_id: spyId,
        target_player_id: targetPlayerId,
        sabotage_type: targetType,
        severity: spy.skills.sabotage,
        successful: sabotageSuccess,
        detected,
      });
    
    if (detected) {
      await supabase
        .from('wmd_spies')
        .update({ status: 'compromised' })
        .eq('spy_id', spyId);
    }
    
    let message = 'Sabotage operation ';
    message += sabotageSuccess ? (detected ? 'successful but spy detected!' : 'successful and undetected.') : (detected ? 'failed and spy detected!' : 'failed but spy undetected.');
    
    return { success: sabotageSuccess, message };
    
  } catch (error) {
    console.error('Error executing sabotage:', error);
    return { success: false, message: 'Internal server error' };
  }
}

// ============================================================================
// COUNTER-INTELLIGENCE
// ============================================================================

/**
 * Perform counter-intelligence sweep
 */
export async function counterIntelligenceSweep(
  playerId: string,
  targetArea: 'FACILITIES' | 'COMMUNICATIONS' | 'PERSONNEL' | 'ALL'
): Promise<{
  success: boolean;
  message: string;
  threatsDetected: number;
  spiesDetected: Array<{ spyId: string; codename: string; specialization: string; operatorId: string; operatorClanId: string | null }>;
}> {
  try {
    const supabase = createServiceClient();
    
    // Find enemy missions targeting this player
    const { data: enemyMissions } = await supabase
      .from('wmd_spy_missions')
      .select('spy_id')
      .eq('target_player_id', playerId)
      .eq('status', 'in_progress');
    
    const detectedSpies: any[] = [];
    
    if (enemyMissions && enemyMissions.length > 0) {
      // Get spy details
      const spyIds = enemyMissions.map(m => m.spy_id);
      const { data: spies } = await supabase
        .from('wmd_spies')
        .select('*')
        .in('spy_id', spyIds);
      
      if (spies) {
        detectionChance = 0.4;
        for (const spy of spies) {
          if (Math.random() < detectionChance) {
            detectedSpies.push({
              spyId: spy.spy_id,
              codename: spy.name || 'Unknown',
              specialization: 'SURVEILLANCE',
              operatorId: spy.owner_id,
              operatorClanId: null,
            });
            
            // Compromise the detected spy
            await supabase
              .from('wmd_spies')
              .update({ status: 'compromised' })
              .eq('spy_id', spy.spy_id);
          }
        }
      }
    }
    
    return {
      success: true,
      message: detectedSpies.length > 0 ? `Detected ${detectedSpies.length} hostile operative(s)` : 'No threats detected.',
      threatsDetected: detectedSpies.length,
      spiesDetected: detectedSpies,
    };
    
  } catch (error) {
    console.error('Error in counter-intelligence sweep:', error);
    return { success: false, message: 'System error', threatsDetected: 0, spiesDetected: [] };
  }
}

let detectionChance = 0.3;

// ============================================================================
// SPY QUERIES
// ============================================================================

/**
 * Get spy by ID
 */
export async function getSpy(spyId: string): Promise<SpyAgent | null> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from('wmd_spies')
      .select('*')
      .eq('spy_id', spyId)
      .single();
    return mapSpyFromRow(data);
  } catch (error) {
    console.error('Error getting spy:', error);
    return null;
  }
}

/**
 * Get player's spies
 */
export async function getPlayerSpies(
  playerId: string,
  statusFilter?: string
): Promise<SpyAgent[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from('wmd_spies')
      .select('*')
      .eq('owner_id', playerId);
    
    if (statusFilter) {
      const spStatus = statusFilter === 'AVAILABLE' ? 'active' : statusFilter === 'ON_MISSION' ? 'on_mission' : 'compromised';
      query = query.eq('status', spStatus);
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    if (!data) return [];
    return data.map(row => mapSpyFromRow(row)).filter((s): s is SpyAgent => s !== null);
    
  } catch (error) {
    console.error('Error getting player spies:', error);
    return [];
  }
}

/**
 * Get player's missions
 */
export async function getPlayerMissions(
  playerId: string,
  statusFilter?: MissionStatus
): Promise<SpyMission[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from('wmd_spy_missions')
      .select('*')
      .eq('owner_id', playerId);
    
    if (statusFilter) {
      const mStatus = statusFilter === MissionStatus.ACTIVE ? 'in_progress' : 'completed';
      query = query.eq('status', mStatus);
    }
    
    const { data } = await query.order('created_at', { ascending: false });
    if (!data) return [];
    
    return data.map((m: any) => ({
      missionId: m.mission_id,
      ownerId: m.owner_id,
      ownerClanId: '',
      missionType: m.mission_type as MissionType,
      status: m.status === 'in_progress' ? MissionStatus.ACTIVE : MissionStatus.COMPLETED,
      priority: 'MEDIUM',
      targetId: m.target_player_id || '',
      targetType: 'player',
      targetName: m.target_player_id || '',
      spyId: m.spy_id,
      spyName: m.spy_id,
      spyRank: SpyRank.ROOKIE,
      startTime: new Date(m.started_at || m.created_at),
      estimatedCompletion: new Date(),
      duration: 0,
      baseSuccessChance: 0.7,
      modifiers: { targetSecurity: 0, clanBonus: 0, equipmentBonus: 0 },
      finalSuccessChance: 0.7,
      detectionRisk: 0.3,
      detected: false,
      cost: { metal: 0, energy: 0 },
      createdAt: new Date(m.created_at),
      updatedAt: new Date(),
    }));
    
  } catch (error) {
    console.error('Error getting player missions:', error);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateCodename(): string {
  const adjectives = ['Shadow', 'Silent', 'Swift', 'Steel', 'Dark', 'Ghost', 'Wolf', 'Raven', 'Crimson', 'Silver'];
  const nouns = ['Fox', 'Hawk', 'Storm', 'Blade', 'Echo', 'Viper', 'Lynx', 'Falcon', 'Cobra', 'Tiger'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num.toString().padStart(2, '0')}`;
}

function getTrainingImprovement(intensity: string, currentLevel: number): number {
  const baseImprovement: Record<string, number> = { 'BASIC': 5, 'ADVANCED': 10, 'ELITE': 20 };
  const improvement = baseImprovement[intensity] || 5;
  const diminishingFactor = Math.max(0.1, 1 - (currentLevel / 100));
  return Math.floor(improvement * diminishingFactor);
}

async function hasSpyUnlocked(playerId: string): Promise<boolean> {
  try {
    const { getPlayerResearch } = await import('./researchService');
    const playerResearch = await getPlayerResearch(playerId);
    return playerResearch?.completedTechs.includes('intel_tier_1') || false;
  } catch (error) {
    return false;
  }
}

async function getMaxSpies(playerId: string): Promise<number> {
  try {
    const { getPlayerResearch } = await import('./researchService');
    const playerResearch = await getPlayerResearch(playerId);
    if (!playerResearch) return 1;
    let maxSpies = 1;
    if (playerResearch.completedTechs.includes('intel_tier_3')) maxSpies = 3;
    if (playerResearch.completedTechs.includes('intel_tier_6')) maxSpies = 5;
    if (playerResearch.completedTechs.includes('intel_tier_9')) maxSpies = 10;
    return maxSpies;
  } catch (error) {
    return 1;
  }
}
