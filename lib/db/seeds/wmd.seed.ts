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
 * - mongodb for database access
 * - /types/wmd for type definitions
 * - /lib/db/schemas/wmd.schema for collections
 */

import { Db } from 'mongodb';
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
 * Seed all WMD collections with test data
 */
export async function seedWMDData(db: Db): Promise<void> {
  console.log('🌱 Starting WMD data seeding...');
  
  // Seed player research
  await seedPlayerResearch(db);
  
  // Seed missiles and components
  await seedMissiles(db);
  await seedMissileComponents(db);
  
  // Seed defense systems
  await seedDefenseBatteries(db);
  await seedClanDefenseGrid(db);
  
  // Seed intelligence
  await seedSpies(db);
  await seedSpyMissions(db);
  
  // Seed history/events
  await seedLaunchHistory(db);
  await seedInterceptionAttempts(db);
  await seedSabotageEvents(db);
  
  // Seed notifications
  await seedNotifications(db);
  
  // Seed clan votes
  await seedClanVotes(db);
  
  console.log('✅ WMD data seeding complete!');
}

// ============================================================================
// PLAYER RESEARCH SEED DATA
// ============================================================================

async function seedPlayerResearch(db: Db): Promise<void> {
  const collection = db.collection('wmd_player_research');
  
  const seedData = [
    {
      playerId: 'player_001',
      playerUsername: 'TestWarrior',
      clanId: 'clan_alpha',
      completedTechs: ['missile_tier_1', 'missile_tier_2', 'defense_tier_1', 'spy_tier_1'],
      availableTechs: ['missile_tier_3', 'defense_tier_2', 'spy_tier_2'],
      lockedTechs: ['missile_tier_4', 'missile_tier_5', 'defense_tier_3'],
      currentResearch: {
        techId: 'missile_tier_3',
        startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        rpSpent: 15000,
        rpRequired: 20000,
      },
      totalRPSpent: 55000,
      clanBonusActive: true,
      updatedAt: new Date(),
    },
    {
      playerId: 'player_002',
      playerUsername: 'DefenseExpert',
      clanId: 'clan_alpha',
      completedTechs: ['defense_tier_1', 'defense_tier_2', 'defense_tier_3', 'missile_tier_1'],
      availableTechs: ['defense_tier_4', 'missile_tier_2'],
      lockedTechs: ['defense_tier_5', 'missile_tier_3'],
      currentResearch: null,
      totalRPSpent: 70000,
      clanBonusActive: true,
      updatedAt: new Date(),
    },
    {
      playerId: 'player_003',
      playerUsername: 'SpyMaster',
      clanId: null,
      completedTechs: ['spy_tier_1', 'spy_tier_2', 'spy_tier_3', 'spy_tier_4'],
      availableTechs: ['spy_tier_5'],
      lockedTechs: ['spy_tier_6', 'spy_tier_7'],
      currentResearch: {
        techId: 'spy_tier_5',
        startedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
        rpSpent: 40000,
        rpRequired: 50000,
      },
      totalRPSpent: 115000,
      clanBonusActive: false,
      updatedAt: new Date(),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} player research records`);
}

// ============================================================================
// MISSILE SEED DATA
// ============================================================================

async function seedMissiles(db: Db): Promise<void> {
  const collection = db.collection('wmd_missiles');
  
  const seedData = [
    {
      missileId: 'missile_001',
      ownerId: 'player_001',
      ownerUsername: 'TestWarrior',
      clanId: 'clan_alpha',
      warheadType: WarheadType.TACTICAL,
      components: {
        WARHEAD: 100,
        GUIDANCE: 100,
        PROPULSION: 100,
        FUEL: 100,
        CHASSIS: 100,
      },
      assemblyProgress: 100,
      status: MissileStatus.READY,
      launchedAt: null,
      targetPlayerId: null,
      targetClanId: null,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      updatedAt: new Date(),
    },
    {
      missileId: 'missile_002',
      ownerId: 'player_001',
      ownerUsername: 'TestWarrior',
      clanId: 'clan_alpha',
      warheadType: WarheadType.TACTICAL,
      components: {
        WARHEAD: 80,
        GUIDANCE: 60,
        PROPULSION: 75,
        FUEL: 90,
        CHASSIS: 70,
      },
      assemblyProgress: 75,
      status: MissileStatus.ASSEMBLING,
      launchedAt: null,
      targetPlayerId: null,
      targetClanId: null,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      updatedAt: new Date(),
    },
    {
      missileId: 'missile_003',
      ownerId: 'player_001',
      ownerUsername: 'TestWarrior',
      clanId: 'clan_alpha',
      warheadType: WarheadType.STRATEGIC,
      components: {
        WARHEAD: 100,
        GUIDANCE: 100,
        PROPULSION: 100,
        FUEL: 100,
        CHASSIS: 100,
      },
      assemblyProgress: 100,
      status: MissileStatus.LAUNCHED,
      launchedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      targetPlayerId: 'player_003',
      targetClanId: null,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} missiles`);
}

// ============================================================================
// MISSILE COMPONENTS SEED DATA
// ============================================================================

async function seedMissileComponents(db: Db): Promise<void> {
  const collection = db.collection('wmd_missile_components');
  
  const seedData = [
    {
      playerId: 'player_001',
      playerUsername: 'TestWarrior',
      componentCounts: {
        WARHEAD: 250,
        GUIDANCE: 180,
        PROPULSION: 320,
        FUEL: 410,
        CHASSIS: 290,
      },
      updatedAt: new Date(),
    },
    {
      playerId: 'player_002',
      playerUsername: 'DefenseExpert',
      componentCounts: {
        WARHEAD: 50,
        GUIDANCE: 60,
        PROPULSION: 45,
        FUEL: 80,
        CHASSIS: 55,
      },
      updatedAt: new Date(),
    },
    {
      playerId: 'player_003',
      playerUsername: 'SpyMaster',
      componentCounts: {
        WARHEAD: 0,
        GUIDANCE: 0,
        PROPULSION: 0,
        FUEL: 0,
        CHASSIS: 0,
      },
      updatedAt: new Date(),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} component inventories`);
}

// ============================================================================
// DEFENSE BATTERIES SEED DATA
// ============================================================================

async function seedDefenseBatteries(db: Db): Promise<void> {
  const collection = db.collection('wmd_defense_batteries');
  
  const seedData = [
    {
      batteryId: 'battery_001',
      ownerId: 'player_002',
      ownerUsername: 'DefenseExpert',
      clanId: 'clan_alpha',
      batteryType: BatteryType.ADVANCED,
      status: BatteryStatus.ACTIVE,
      condition: 100,
      lastFiredAt: null,
      cooldownUntil: null,
      sabotageResistance: 0,
      pooledWithClan: true,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      batteryId: 'battery_002',
      ownerId: 'player_002',
      ownerUsername: 'DefenseExpert',
      clanId: 'clan_alpha',
      batteryType: BatteryType.ADVANCED,
      status: BatteryStatus.COOLDOWN,
      condition: 95,
      lastFiredAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
      cooldownUntil: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
      sabotageResistance: 0,
      pooledWithClan: true,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    },
    {
      batteryId: 'battery_003',
      ownerId: 'player_001',
      ownerUsername: 'TestWarrior',
      clanId: 'clan_alpha',
      batteryType: BatteryType.BASIC,
      status: BatteryStatus.ACTIVE,
      condition: 80,
      lastFiredAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      cooldownUntil: null,
      sabotageResistance: 0,
      pooledWithClan: true,
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      batteryId: 'battery_004',
      ownerId: 'player_003',
      ownerUsername: 'SpyMaster',
      clanId: null,
      batteryType: BatteryType.BASIC,
      status: BatteryStatus.ACTIVE,
      condition: 100,
      lastFiredAt: null,
      cooldownUntil: null,
      sabotageResistance: 0,
      pooledWithClan: false,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} defense batteries`);
}

// ============================================================================
// CLAN DEFENSE GRID SEED DATA
// ============================================================================

async function seedClanDefenseGrid(db: Db): Promise<void> {
  const collection = db.collection('wmd_clan_defense_grid');
  
  const seedData = [
    {
      clanId: 'clan_alpha',
      clanName: 'Alpha Squadron',
      pooledBatteries: [
        {
          batteryId: 'battery_001',
          batteryType: BatteryType.ADVANCED,
          ownerId: 'player_002',
          status: BatteryStatus.ACTIVE,
        },
        {
          batteryId: 'battery_002',
          batteryType: BatteryType.ADVANCED,
          ownerId: 'player_002',
          status: BatteryStatus.COOLDOWN,
        },
        {
          batteryId: 'battery_003',
          batteryType: BatteryType.BASIC,
          ownerId: 'player_001',
          status: BatteryStatus.ACTIVE,
        },
      ],
      totalInterceptChance: 35, // 25% + 10% (one on cooldown)
      radarLevel: RadarLevel.LOCAL,
      radarWarningTime: 30,
      radarRange: 50,
      canDetectStealth: false,
      memberCount: 5,
      updatedAt: new Date(),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} clan defense grids`);
}

// ============================================================================
// SPIES SEED DATA
// ============================================================================

async function seedSpies(db: Db): Promise<void> {
  const collection = db.collection('wmd_spies');
  
  const seedData = [
    {
      spyId: 'spy_001',
      ownerId: 'player_003',
      ownerUsername: 'SpyMaster',
      spyName: 'Agent Shadow',
      rank: SpyRank.AGENT,
      status: 'AVAILABLE',
      experience: 8500,
      successfulMissions: 12,
      failedMissions: 3,
      currentMissionId: null,
      specialty: MissionType.SABOTAGE_LIGHT,
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
    {
      spyId: 'spy_002',
      ownerId: 'player_003',
      ownerUsername: 'SpyMaster',
      spyName: 'Operative Ghost',
      rank: SpyRank.OPERATIVE,
      status: 'ON_MISSION',
      experience: 2800,
      successfulMissions: 5,
      failedMissions: 1,
      currentMissionId: 'mission_001',
      specialty: MissionType.RECONNAISSANCE,
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      spyId: 'spy_003',
      ownerId: 'player_001',
      ownerUsername: 'TestWarrior',
      spyName: 'Recruit Echo',
      rank: SpyRank.ROOKIE,
      status: 'AVAILABLE',
      experience: 500,
      successfulMissions: 2,
      failedMissions: 0,
      currentMissionId: null,
      specialty: 'NONE' as any,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} spies`);
}

// ============================================================================
// SPY MISSIONS SEED DATA
// ============================================================================

async function seedSpyMissions(db: Db): Promise<void> {
  const collection = db.collection('wmd_spy_missions');
  
  const seedData = [
    {
      missionId: 'mission_001',
      spyId: 'spy_002',
      operatorId: 'player_003',
      operatorUsername: 'SpyMaster',
      missionType: MissionType.RECONNAISSANCE,
      targetPlayerId: 'player_001',
      targetUsername: 'TestWarrior',
      targetClanId: 'clan_alpha',
      status: MissionStatus.ACTIVE,
      startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      completedAt: null,
      duration: 14400, // 4 hours
      successChance: 75,
      detectionChance: 15,
      result: null,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
    {
      missionId: 'mission_002',
      spyId: 'spy_001',
      operatorId: 'player_003',
      operatorUsername: 'SpyMaster',
      missionType: MissionType.SABOTAGE_LIGHT,
      targetPlayerId: 'player_002',
      targetUsername: 'DefenseExpert',
      targetClanId: 'clan_alpha',
      status: MissionStatus.COMPLETED,
      startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      duration: 21600,
      successChance: 65,
      detectionChance: 25,
      result: {
        success: true,
        detected: false,
        spyCaptured: false,
        spyKilled: false,
        intelGained: null,
        damageDealt: {
          batteriesDamaged: 1,
          conditionLoss: 5,
        },
        resourcesStolen: null,
      },
      createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} spy missions`);
}

// ============================================================================
// LAUNCH HISTORY SEED DATA
// ============================================================================

async function seedLaunchHistory(db: Db): Promise<void> {
  const collection = db.collection('wmd_launch_history');
  
  const seedData = [
    {
      launchId: 'launch_001',
      missileId: 'missile_003',
      attackerId: 'player_001',
      attackerUsername: 'TestWarrior',
      attackerClanId: 'clan_alpha',
      targetPlayerId: 'player_003',
      targetUsername: 'SpyMaster',
      targetClanId: null,
      targetLocation: { x: 150, y: 250 },
      warheadType: WarheadType.STRATEGIC,
      flightTime: 1800, // 30 minutes
      launchedAt: new Date(Date.now() - 30 * 60 * 1000),
      impactAt: new Date(Date.now()),
      status: 'IN_FLIGHT',
      interceptedBy: null,
      damageDealt: null,
      clanVoteId: 'vote_001',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} launch history records`);
}

// ============================================================================
// INTERCEPTION ATTEMPTS SEED DATA
// ============================================================================

async function seedInterceptionAttempts(db: Db): Promise<void> {
  const collection = db.collection('wmd_interception_attempts');
  
  const seedData = [
    {
      attemptId: 'intercept_001',
      launchId: 'launch_001',
      batteryId: 'battery_002',
      defenderId: 'player_002',
      defenderUsername: 'DefenseExpert',
      defenderClanId: 'clan_alpha',
      targetedMissile: {
        missileId: 'missile_003',
        warheadType: WarheadType.STRATEGIC,
        attackerId: 'player_001',
      },
      interceptChance: 25,
      roll: 45,
      success: false,
      damageReduced: null,
      attemptedAt: new Date(Date.now() - 45 * 60 * 1000),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} interception attempts`);
}

// ============================================================================
// SABOTAGE EVENTS SEED DATA
// ============================================================================

async function seedSabotageEvents(db: Db): Promise<void> {
  const collection = db.collection('wmd_sabotage_events');
  
  const seedData = [
    {
      sabotageId: 'sabotage_001',
      missionId: 'mission_002',
      attackerId: 'player_003',
      attackerUsername: 'SpyMaster',
      targetPlayerId: 'player_002',
      targetUsername: 'DefenseExpert',
      sabotageType: 'LIGHT',
      targetType: 'BATTERY',
      success: true,
      damageDealt: {
        missilesDestroyed: null,
        batteriesDamaged: 1,
        componentsLost: null,
        researchDelayed: null,
      },
      detected: false,
      occurredAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} sabotage events`);
}

// ============================================================================
// NOTIFICATIONS SEED DATA
// ============================================================================

async function seedNotifications(db: Db): Promise<void> {
  const collection = db.collection('wmd_notifications');
  
  const seedData = [
    {
      notificationId: 'notif_001',
      recipientId: 'player_003',
      recipientClanId: null,
      eventType: 'MISSILE_INCOMING',
      priority: 'CRITICAL',
      scope: 'PERSONAL',
      message: '🚨 INCOMING MISSILE! Strategic warhead inbound from TestWarrior. ETA: 30 minutes.',
      icon: '🚀',
      color: '#ff0000',
      actionUrl: '/game?view=defense',
      metadata: {
        launchId: 'launch_001',
        attackerId: 'player_001',
        warheadType: WarheadType.STRATEGIC,
        eta: 1800,
      },
      read: false,
      readAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      notificationId: 'notif_002',
      recipientId: 'player_001',
      recipientClanId: 'clan_alpha',
      eventType: 'RESEARCH_COMPLETED',
      priority: 'MEDIUM',
      scope: 'PERSONAL',
      message: '✅ Research Complete! Advanced Guidance Systems unlocked. Targeting accuracy +20%.',
      icon: '🔬',
      color: '#00ff00',
      actionUrl: '/game?view=research',
      metadata: {
        techId: 'missile_tier_3',
        techName: 'Advanced Guidance Systems',
      },
      read: false,
      readAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    },
    {
      notificationId: 'notif_003',
      recipientId: 'player_002',
      recipientClanId: 'clan_alpha',
      eventType: 'SABOTAGE_DETECTED',
      priority: 'HIGH',
      scope: 'PERSONAL',
      message: '⚠️ Sabotage Detected! Enemy spy damaged your Advanced Battery. Condition reduced to 95%.',
      icon: '🔍',
      color: '#ff9900',
      actionUrl: '/game?view=defense',
      metadata: {
        sabotageId: 'sabotage_001',
        attackerId: 'player_003',
        damageType: 'BATTERY',
      },
      read: true,
      readAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} notifications`);
}

// ============================================================================
// CLAN VOTES SEED DATA
// ============================================================================

async function seedClanVotes(db: Db): Promise<void> {
  const collection = db.collection('wmd_clan_votes');
  
  const seedData = [
    {
      voteId: 'vote_001',
      clanId: 'clan_alpha',
      clanName: 'Alpha Squadron',
      proposerId: 'player_001',
      proposerUsername: 'TestWarrior',
      voteType: 'MISSILE_LAUNCH',
      status: 'PASSED',
      subject: 'Launch Strategic Warhead at SpyMaster',
      requiredVotes: 3,
      yesVotes: 4,
      noVotes: 1,
      abstainVotes: 0,
      voters: [
        { playerId: 'player_001', vote: 'YES', votedAt: new Date(Date.now() - 35 * 60 * 1000) },
        { playerId: 'player_002', vote: 'YES', votedAt: new Date(Date.now() - 33 * 60 * 1000) },
        { playerId: 'player_004', vote: 'NO', votedAt: new Date(Date.now() - 32 * 60 * 1000) },
        { playerId: 'player_005', vote: 'YES', votedAt: new Date(Date.now() - 31 * 60 * 1000) },
        { playerId: 'player_006', vote: 'YES', votedAt: new Date(Date.now() - 30 * 60 * 1000) },
      ],
      relatedEntityId: 'missile_003',
      createdAt: new Date(Date.now() - 40 * 60 * 1000),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 30 * 60 * 1000),
    },
    {
      voteId: 'vote_002',
      clanId: 'clan_alpha',
      clanName: 'Alpha Squadron',
      proposerId: 'player_002',
      proposerUsername: 'DefenseExpert',
      voteType: 'DEFENSE_UPGRADE',
      status: 'ACTIVE',
      subject: 'Upgrade to Elite Defense Systems',
      requiredVotes: 3,
      yesVotes: 2,
      noVotes: 0,
      abstainVotes: 1,
      voters: [
        { playerId: 'player_002', vote: 'YES', votedAt: new Date(Date.now() - 1 * 60 * 60 * 1000) },
        { playerId: 'player_001', vote: 'YES', votedAt: new Date(Date.now() - 45 * 60 * 1000) },
        { playerId: 'player_004', vote: 'ABSTAIN', votedAt: new Date(Date.now() - 20 * 60 * 1000) },
      ],
      relatedEntityId: null,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000),
      completedAt: null,
    },
  ];
  
  await collection.insertMany(seedData);
  console.log(`✅ Seeded ${seedData.length} clan votes`);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clear all WMD seed data
 */
export async function clearWMDSeedData(db: Db): Promise<void> {
  const collectionNames = [
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
  ];
  
  for (const name of collectionNames) {
    await db.collection(name).deleteMany({});
    console.log(`🗑️  Cleared collection: ${name}`);
  }
  
  console.log('✅ All WMD seed data cleared');
}

/**
 * Reseed all data (clear and seed)
 */
export async function reseedWMDData(db: Db): Promise<void> {
  await clearWMDSeedData(db);
  await seedWMDData(db);
}

// ============================================================================
// FOOTER
// ============================================================================

/**
 * USAGE:
 * import { seedWMDData } from '@/lib/db/seeds/wmd.seed';
 * await seedWMDData(db);
 * 
 * TESTING SCENARIOS:
 * - Active missile launch with defense attempts
 * - Spy mission in progress
 * - Clan defense grid with pooled batteries
 * - Research progression at different stages
 * - Notifications for various event types
 * - Clan voting process (active and completed)
 */
