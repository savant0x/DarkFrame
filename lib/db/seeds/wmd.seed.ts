/**
 * @file lib/db/seeds/wmd.seed.ts
 * @created 2025-10-22
 * @overview Seed Data for WMD System Testing
 * 
 * OVERVIEW:
 * Provides sample data for testing WMD functionality including
 * research progress, missiles, batteries, spies, and complete scenarios.
 * 
 * Use Cases:
 * - Development environment setup
 * - Integration testing
 * - UI component testing
 * - Performance testing
 * 
 * Dependencies:
 * - Supabase for database access
 * - /types/wmd for type definitions
 * - /lib/db/schemas/wmd.schema for schema verification
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { 
  ResearchCategory, 
  ResearchStatus,
  WarheadType,
  MissileComponent,
  MissileStatus,
  BatteryType,
  BatteryStatus,
  RadarLevel,
  SpyRank,
  MissionType,
  MissionStatus,
} from '@/types/wmd';

// ============================================================================
// SEED DATA GENERATION
// ============================================================================

/**
 * Seed all WMD tables with test data
 */
export async function seedWMDData(supabase?: SupabaseClient<any>): Promise<void> {
  const client = supabase || createServiceClient();
  console.log('🌱 Starting WMD data seeding...');
  
  // Seed player research
  await seedPlayerResearch(client);
  
  // Seed missiles and components
  await seedMissiles(client);
  await seedMissileComponents(client);
  
  // Seed defense systems
  await seedDefenseBatteries(client);
  await seedClanDefenseGrid(client);
  
  // Seed intelligence
  await seedSpies(client);
  await seedSpyMissions(client);
  
  // Seed history/events
  await seedLaunchHistory(client);
  await seedInterceptionAttempts(client);
  await seedSabotageEvents(client);
  
  // Seed notifications
  await seedNotifications(client);
  
  // Seed clan votes
  await seedClanVotes(client);
  
  console.log('✅ WMD data seeding complete!');
}

// ============================================================================
// PLAYER RESEARCH SEED DATA
// ============================================================================

async function seedPlayerResearch(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      player_id: 'player_001',
      player_username: 'TestWarrior',
      clan_id: 'clan_alpha',
      completed_techs: ['missile_tier_1', 'missile_tier_2', 'defense_tier_1', 'spy_tier_1'],
      available_techs: ['missile_tier_3', 'defense_tier_2', 'spy_tier_2'],
      locked_techs: ['missile_tier_4', 'missile_tier_5', 'defense_tier_3'],
      current_research: {
        tech_id: 'missile_tier_3',
        started_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        rp_spent: 15000,
        rp_required: 20000,
      },
      total_rp_spent: 55000,
      clan_bonus_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      player_id: 'player_002',
      player_username: 'DefenseExpert',
      clan_id: 'clan_alpha',
      completed_techs: ['defense_tier_1', 'defense_tier_2', 'defense_tier_3', 'missile_tier_1'],
      available_techs: ['defense_tier_4', 'missile_tier_2'],
      locked_techs: ['defense_tier_5', 'missile_tier_3'],
      current_research: null,
      total_rp_spent: 70000,
      clan_bonus_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      player_id: 'player_003',
      player_username: 'SpyMaster',
      clan_id: null,
      completed_techs: ['spy_tier_1', 'spy_tier_2', 'spy_tier_3', 'spy_tier_4'],
      available_techs: ['spy_tier_5'],
      locked_techs: ['spy_tier_6', 'spy_tier_7'],
      current_research: {
        tech_id: 'spy_tier_5',
        started_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        rp_spent: 40000,
        rp_required: 50000,
      },
      total_rp_spent: 115000,
      clan_bonus_active: false,
      updated_at: new Date().toISOString(),
    },
  ];
  
  await client.from('wmd_player_research').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} player research records`);
}

// ============================================================================
// MISSILE SEED DATA
// ============================================================================

async function seedMissiles(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      missile_id: 'missile_001',
      owner_id: 'player_001',
      owner_username: 'TestWarrior',
      clan_id: 'clan_alpha',
      warhead_type: WarheadType.TACTICAL,
      components: {
        WARHEAD: 100,
        GUIDANCE: 100,
        PROPULSION: 100,
        FUEL: 100,
        CHASSIS: 100,
      },
      assembly_progress: 100,
      status: MissileStatus.READY,
      launched_at: null,
      target_player_id: null,
      target_clan_id: null,
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      missile_id: 'missile_002',
      owner_id: 'player_001',
      owner_username: 'TestWarrior',
      clan_id: 'clan_alpha',
      warhead_type: WarheadType.TACTICAL,
      components: {
        WARHEAD: 80,
        GUIDANCE: 60,
        PROPULSION: 75,
        FUEL: 90,
        CHASSIS: 70,
      },
      assembly_progress: 75,
      status: MissileStatus.ASSEMBLING,
      launched_at: null,
      target_player_id: null,
      target_clan_id: null,
      created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      missile_id: 'missile_003',
      owner_id: 'player_001',
      owner_username: 'TestWarrior',
      clan_id: 'clan_alpha',
      warhead_type: WarheadType.STRATEGIC,
      components: {
        WARHEAD: 100,
        GUIDANCE: 100,
        PROPULSION: 100,
        FUEL: 100,
        CHASSIS: 100,
      },
      assembly_progress: 100,
      status: MissileStatus.LAUNCHED,
      launched_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      target_player_id: 'player_003',
      target_clan_id: null,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ];
  
  await client.from('wmd_missiles').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} missiles`);
}

// ============================================================================
// MISSILE COMPONENTS SEED DATA
// ============================================================================

async function seedMissileComponents(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      player_id: 'player_001',
      player_username: 'TestWarrior',
      component_counts: {
        WARHEAD: 250,
        GUIDANCE: 180,
        PROPULSION: 320,
        FUEL: 410,
        CHASSIS: 290,
      },
      updated_at: new Date().toISOString(),
    },
    {
      player_id: 'player_002',
      player_username: 'DefenseExpert',
      component_counts: {
        WARHEAD: 50,
        GUIDANCE: 60,
        PROPULSION: 45,
        FUEL: 80,
        CHASSIS: 55,
      },
      updated_at: new Date().toISOString(),
    },
    {
      player_id: 'player_003',
      player_username: 'SpyMaster',
      component_counts: {
        WARHEAD: 0,
        GUIDANCE: 0,
        PROPULSION: 0,
        FUEL: 0,
        CHASSIS: 0,
      },
      updated_at: new Date().toISOString(),
    },
  ];
  
  await client.from('wmd_missile_components').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} component inventories`);
}

// ============================================================================
// DEFENSE BATTERIES SEED DATA
// ============================================================================

async function seedDefenseBatteries(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      battery_id: 'battery_001',
      owner_id: 'player_002',
      owner_username: 'DefenseExpert',
      clan_id: 'clan_alpha',
      battery_type: BatteryType.ADVANCED,
      status: BatteryStatus.ACTIVE,
      condition: 100,
      last_fired_at: null,
      cooldown_until: null,
      sabotage_resistance: 0,
      pooled_with_clan: true,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      battery_id: 'battery_002',
      owner_id: 'player_002',
      owner_username: 'DefenseExpert',
      clan_id: 'clan_alpha',
      battery_type: BatteryType.ADVANCED,
      status: BatteryStatus.COOLDOWN,
      condition: 95,
      last_fired_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      cooldown_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      sabotage_resistance: 0,
      pooled_with_clan: true,
      created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      battery_id: 'battery_003',
      owner_id: 'player_001',
      owner_username: 'TestWarrior',
      clan_id: 'clan_alpha',
      battery_type: BatteryType.BASIC,
      status: BatteryStatus.ACTIVE,
      condition: 80,
      last_fired_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      cooldown_until: null,
      sabotage_resistance: 0,
      pooled_with_clan: true,
      created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      battery_id: 'battery_004',
      owner_id: 'player_003',
      owner_username: 'SpyMaster',
      clan_id: null,
      battery_type: BatteryType.BASIC,
      status: BatteryStatus.ACTIVE,
      condition: 100,
      last_fired_at: null,
      cooldown_until: null,
      sabotage_resistance: 0,
      pooled_with_clan: false,
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  
  await client.from('wmd_defense_batteries').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} defense batteries`);
}

// ============================================================================
// CLAN DEFENSE GRID SEED DATA
// ============================================================================

async function seedClanDefenseGrid(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      clan_id: 'clan_alpha',
      clan_name: 'Alpha Squadron',
      pooled_batteries: [
        {
          battery_id: 'battery_001',
          battery_type: BatteryType.ADVANCED,
          owner_id: 'player_002',
          status: BatteryStatus.ACTIVE,
        },
        {
          battery_id: 'battery_002',
          battery_type: BatteryType.ADVANCED,
          owner_id: 'player_002',
          status: BatteryStatus.COOLDOWN,
        },
        {
          battery_id: 'battery_003',
          battery_type: BatteryType.BASIC,
          owner_id: 'player_001',
          status: BatteryStatus.ACTIVE,
        },
      ],
      total_intercept_chance: 35,
      radar_level: RadarLevel.LOCAL,
      radar_warning_time: 30,
      radar_range: 50,
      can_detect_stealth: false,
      member_count: 5,
      updated_at: new Date().toISOString(),
    },
  ];
  
  await client.from('wmd_clan_defense_grid').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} clan defense grids`);
}

// ============================================================================
// SPIES SEED DATA
// ============================================================================

async function seedSpies(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      spy_id: 'spy_001',
      owner_id: 'player_003',
      owner_username: 'SpyMaster',
      spy_name: 'Agent Shadow',
      rank: SpyRank.AGENT,
      status: 'AVAILABLE',
      experience: 8500,
      successful_missions: 12,
      failed_missions: 3,
      current_mission_id: null,
      specialty: MissionType.SABOTAGE_LIGHT,
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      spy_id: 'spy_002',
      owner_id: 'player_003',
      owner_username: 'SpyMaster',
      spy_name: 'Operative Ghost',
      rank: SpyRank.OPERATIVE,
      status: 'ON_MISSION',
      experience: 2800,
      successful_missions: 5,
      failed_missions: 1,
      current_mission_id: 'mission_001',
      specialty: MissionType.RECONNAISSANCE,
      created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      spy_id: 'spy_003',
      owner_id: 'player_001',
      owner_username: 'TestWarrior',
      spy_name: 'Recruit Echo',
      rank: SpyRank.ROOKIE,
      status: 'AVAILABLE',
      experience: 500,
      successful_missions: 2,
      failed_missions: 0,
      current_mission_id: null,
      specialty: 'NONE' as 'NONE',
      created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  
  await client.from('wmd_spies').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} spies`);
}

// ============================================================================
// SPY MISSIONS SEED DATA
// ============================================================================

async function seedSpyMissions(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      mission_id: 'mission_001',
      spy_id: 'spy_002',
      operator_id: 'player_003',
      operator_username: 'SpyMaster',
      mission_type: MissionType.RECONNAISSANCE,
      target_player_id: 'player_001',
      target_username: 'TestWarrior',
      target_clan_id: 'clan_alpha',
      status: MissionStatus.ACTIVE,
      started_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
      duration: 14400,
      success_chance: 75,
      detection_chance: 15,
      result: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      mission_id: 'mission_002',
      spy_id: 'spy_001',
      operator_id: 'player_003',
      operator_username: 'SpyMaster',
      mission_type: MissionType.SABOTAGE_LIGHT,
      target_player_id: 'player_002',
      target_username: 'DefenseExpert',
      target_clan_id: 'clan_alpha',
      status: MissionStatus.COMPLETED,
      started_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      duration: 21600,
      success_chance: 65,
      detection_chance: 25,
      result: {
        success: true,
        detected: false,
        spy_captured: false,
        spy_killed: false,
        intel_gained: null,
        damage_dealt: {
          batteries_damaged: 1,
          condition_loss: 5,
        },
        resources_stolen: null,
      },
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];
  
  await client.from('wmd_spy_missions').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} spy missions`);
}

// ============================================================================
// LAUNCH HISTORY SEED DATA
// ============================================================================

async function seedLaunchHistory(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      launch_id: 'launch_001',
      missile_id: 'missile_003',
      attacker_id: 'player_001',
      attacker_username: 'TestWarrior',
      attacker_clan_id: 'clan_alpha',
      target_player_id: 'player_003',
      target_username: 'SpyMaster',
      target_clan_id: null,
      target_location: { x: 150, y: 250 },
      warhead_type: WarheadType.STRATEGIC,
      flight_time: 1800,
      launched_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      impact_at: new Date().toISOString(),
      status: 'IN_FLIGHT',
      intercepted_by: null,
      damage_dealt: null,
      clan_vote_id: 'vote_001',
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ];
  
  await client.from('wmd_launch_history').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} launch history records`);
}

// ============================================================================
// INTERCEPTION ATTEMPTS SEED DATA
// ============================================================================

async function seedInterceptionAttempts(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      attempt_id: 'intercept_001',
      launch_id: 'launch_001',
      battery_id: 'battery_002',
      defender_id: 'player_002',
      defender_username: 'DefenseExpert',
      defender_clan_id: 'clan_alpha',
      targeted_missile: {
        missile_id: 'missile_003',
        warhead_type: WarheadType.STRATEGIC,
        attacker_id: 'player_001',
      },
      intercept_chance: 25,
      roll: 45,
      success: false,
      damage_reduced: null,
      attempted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
  ];
  
  await client.from('wmd_interception_attempts').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} interception attempts`);
}

// ============================================================================
// SABOTAGE EVENTS SEED DATA
// ============================================================================

async function seedSabotageEvents(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      sabotage_id: 'sabotage_001',
      mission_id: 'mission_002',
      attacker_id: 'player_003',
      attacker_username: 'SpyMaster',
      target_player_id: 'player_002',
      target_username: 'DefenseExpert',
      sabotage_type: 'LIGHT',
      target_type: 'BATTERY',
      success: true,
      damage_dealt: {
        missiles_destroyed: null,
        batteries_damaged: 1,
        components_lost: null,
        research_delayed: null,
      },
      detected: false,
      occurred_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];
  
  await client.from('wmd_sabotage_events').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} sabotage events`);
}

// ============================================================================
// NOTIFICATIONS SEED DATA
// ============================================================================

async function seedNotifications(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      notification_id: 'notif_001',
      recipient_id: 'player_003',
      recipient_clan_id: null,
      event_type: 'MISSILE_INCOMING',
      priority: 'CRITICAL',
      scope: 'PERSONAL',
      message: '🚨 INCOMING MISSILE! Strategic warhead inbound from TestWarrior. ETA: 30 minutes.',
      icon: '🚀',
      color: '#ff0000',
      action_url: '/game?view=defense',
      metadata: {
        launch_id: 'launch_001',
        attacker_id: 'player_001',
        warhead_type: WarheadType.STRATEGIC,
        eta: 1800,
      },
      read: false,
      read_at: null,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      notification_id: 'notif_002',
      recipient_id: 'player_001',
      recipient_clan_id: 'clan_alpha',
      event_type: 'RESEARCH_COMPLETED',
      priority: 'MEDIUM',
      scope: 'PERSONAL',
      message: '✅ Research Complete! Advanced Guidance Systems unlocked. Targeting accuracy +20%.',
      icon: '🔬',
      color: '#00ff00',
      action_url: '/game?view=research',
      metadata: {
        tech_id: 'missile_tier_3',
        tech_name: 'Advanced Guidance Systems',
      },
      read: false,
      read_at: null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      notification_id: 'notif_003',
      recipient_id: 'player_002',
      recipient_clan_id: 'clan_alpha',
      event_type: 'SABOTAGE_DETECTED',
      priority: 'HIGH',
      scope: 'PERSONAL',
      message: '⚠️ Sabotage Detected! Enemy spy damaged your Advanced Battery. Condition reduced to 95%.',
      icon: '🔍',
      color: '#ff9900',
      action_url: '/game?view=defense',
      metadata: {
        sabotage_id: 'sabotage_001',
        attacker_id: 'player_003',
        damage_type: 'BATTERY',
      },
      read: true,
      read_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
  ];
  
  await client.from('wmd_notifications').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} notifications`);
}

// ============================================================================
// CLAN VOTES SEED DATA
// ============================================================================

async function seedClanVotes(client: SupabaseClient<any>): Promise<void> {
  const seedData = [
    {
      vote_id: 'vote_001',
      clan_id: 'clan_alpha',
      clan_name: 'Alpha Squadron',
      proposer_id: 'player_001',
      proposer_username: 'TestWarrior',
      vote_type: 'MISSILE_LAUNCH',
      status: 'PASSED',
      subject: 'Launch Strategic Warhead at SpyMaster',
      required_votes: 3,
      yes_votes: 4,
      no_votes: 1,
      abstain_votes: 0,
      voters: [
        { player_id: 'player_001', vote: 'YES', voted_at: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
        { player_id: 'player_002', vote: 'YES', voted_at: new Date(Date.now() - 33 * 60 * 1000).toISOString() },
        { player_id: 'player_004', vote: 'NO', voted_at: new Date(Date.now() - 32 * 60 * 1000).toISOString() },
        { player_id: 'player_005', vote: 'YES', voted_at: new Date(Date.now() - 31 * 60 * 1000).toISOString() },
        { player_id: 'player_006', vote: 'YES', voted_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      ],
      related_entity_id: 'missile_003',
      created_at: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
    {
      vote_id: 'vote_002',
      clan_id: 'clan_alpha',
      clan_name: 'Alpha Squadron',
      proposer_id: 'player_002',
      proposer_username: 'DefenseExpert',
      vote_type: 'DEFENSE_UPGRADE',
      status: 'ACTIVE',
      subject: 'Upgrade to Elite Defense Systems',
      required_votes: 3,
      yes_votes: 2,
      no_votes: 0,
      abstain_votes: 1,
      voters: [
        { player_id: 'player_002', vote: 'YES', voted_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
        { player_id: 'player_001', vote: 'YES', voted_at: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
        { player_id: 'player_004', vote: 'ABSTAIN', voted_at: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
      ],
      related_entity_id: null,
      created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      completed_at: null,
    },
  ];
  
  await client.from('wmd_clan_votes').insert(seedData);
  console.log(`✅ Seeded ${seedData.length} clan votes`);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear all WMD seed data
 */
export async function clearWMDSeedData(): Promise<void> {
  const client = createServiceClient();
  const tableNames = [
    'wmd_player_research',
    'wmd_missiles',
    'wmd_missile_components',
    'wmd_defense_batteries',
    'wmd_clan_defense_grid',
    'wmd_spies',
    'wmd_spy_missions',
    'wmd_launch_history',
    'wmd_interception_attempts',
    'wmd_sabotage_events',
    'wmd_notifications',
    'wmd_clan_votes',
  ] as const;
  
  for (const name of tableNames) {
    await client.from(name).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log(`🗑️  Cleared table: ${name}`);
  }
  
  console.log('✅ All WMD seed data cleared');
}

/**
 * Reseed all data (clear and seed)
 */
export async function reseedWMDData(supabase?: SupabaseClient<any>): Promise<void> {
  await clearWMDSeedData();
  await seedWMDData(supabase);
}

// ============================================================================
// FOOTER
// ============================================================================

/**
 * USAGE:
 * import { seedWMDData } from '@/lib/db/seeds/wmd.seed';
 * await seedWMDData();
 * 
 * TESTING SCENARIOS:
 * - Active missile launch with defense attempts
 * - Spy mission in progress
 * - Clan defense grid with pooled batteries
 * - Research progression at different stages
 * - Notifications for various event types
 * - Clan voting process (active and completed)
 */
