/**
 * @file scripts/spawnBots.ts
 * @created 2025-10-18
 * @overview Bot spawning system with gradual deployment
 * 
 * OVERVIEW:
 * Manages initial bot population and daily auto-spawn system.
 * Spawns 100 bots initially, then 50-100 per day until cap reached.
 * Distributes bots with priority: Concentration Zones (70%) > Bot Magnet (30%) > Nests (20%) > Even (default).
 * 
 * Usage:
 * - Initial spawn: node scripts/spawnBots.ts --initial
 * - Daily spawn: node scripts/spawnBots.ts --daily
 * - Manual spawn: node scripts/spawnBots.ts --count 10 --zone 4
 */

import { connectToDatabase, getDatabase } from '../lib/mongodb';
import { createBotPlayer, calculateZone } from '../lib/botService';
import { BOT_NESTS, getRandomPositionNearNest } from '@/lib/botNestService';
import { shouldAttractToBeacon, incrementAttractedCount } from '@/lib/botMagnetService';
import { getZoneSpawnPosition } from '@/lib/concentrationZoneService';
import { type BotSpecialization } from '@/types/game.types';

// ============================================================
// SPAWN CONFIGURATION
// ============================================================

const INITIAL_SPAWN_COUNT = 100;
const DAILY_SPAWN_MIN = 50;
const DAILY_SPAWN_MAX = 100;
const BOT_CAP = 1000;
const NEST_BOT_TARGET_MIN = 15;
const NEST_BOT_TARGET_MAX = 20;

// ============================================================
// SPAWN LOGIC
// ============================================================

/**
 * Get current bot population count
 */
async function getBotCount(): Promise<number> {
  const db = await getDatabase();
  return await db.collection('players').countDocuments({ isBot: true });
}

/**
 * Get bot count by zone
 */
async function getBotCountByZone(): Promise<Record<number, number>> {
  const db = await getDatabase();
  const bots = await db.collection('players').find({
    isBot: true
  }, {
    projection: { 'botConfig.zone': 1 }
  }).toArray();
  
  const counts: Record<number, number> = {};
  for (let i = 0; i < 9; i++) {
    counts[i] = 0;
  }
  
  bots.forEach((bot: any) => {
    const zone = bot.botConfig?.zone ?? 0;
    counts[zone] = (counts[zone] || 0) + 1;
  });
  
  return counts;
}

/**
 * Get bot count by nest
 */
async function getBotCountByNest(): Promise<Record<number, number>> {
  const db = await getDatabase();
  const bots = await db.collection('players').find({
    isBot: true,
    'botConfig.nestAffinity': { $ne: null }
  }, {
    projection: { 'botConfig.nestAffinity': 1 }
  }).toArray();
  
  const counts: Record<number, number> = {};
  for (let i = 0; i < 8; i++) {
    counts[i] = 0;
  }
  
  bots.forEach((bot: any) => {
    const nestId = bot.botConfig?.nestAffinity;
    if (nestId !== null && nestId !== undefined) {
      counts[nestId] = (counts[nestId] || 0) + 1;
    }
  });
  
  return counts;
}

/**
 * Spawn bots with even zone distribution
 * 
 * @param count Number of bots to spawn
 * @param targetZone Optional specific zone to spawn in
 * @param nestAffinity Optional nest to spawn near
 */
async function spawnBots(
  count: number,
  targetZone?: number,
  nestAffinity?: number
): Promise<void> {
  const db = await getDatabase();
  const currentCount = await getBotCount();
  
  if (currentCount >= BOT_CAP) {
    console.log(`🚫 Bot cap reached (${BOT_CAP}). No new bots spawned.`);
    return;
  }
  
  const actualCount = Math.min(count, BOT_CAP - currentCount);
  const zoneCounts = await getBotCountByZone();
  
  console.log(`🤖 Spawning ${actualCount} bots...`);
  
  const botsToInsert = [];
  
  for (let i = 0; i < actualCount; i++) {
    let zone: number;
    let position;
    let affinity = nestAffinity;
    
    // PRIORITY 1: Concentration Zones (70% chance if zones exist)
    const concentrationPosition = await getZoneSpawnPosition();
    if (concentrationPosition && targetZone === undefined && nestAffinity === undefined) {
      position = { x: concentrationPosition.x, y: concentrationPosition.y };
      zone = calculateZone(position);
    } else if (targetZone !== undefined) {
      // PRIORITY 2: Manual spawn to specific zone
      zone = targetZone;
    } else if (nestAffinity !== undefined) {
      // PRIORITY 3: Spawn near specific nest
      position = getRandomPositionNearNest(nestAffinity, 10);
      if (position) {
        zone = calculateZone(position);
      } else {
        // Fallback to zone with fewest bots
        zone = Object.entries(zoneCounts).reduce((min, [z, c]) => 
          c < zoneCounts[min] ? parseInt(z) : min, 0
        );
      }
    } else {
      // PRIORITY 4: Even distribution with optional nest affinity
      zone = Object.entries(zoneCounts).reduce((min, [z, c]) => 
        c < zoneCounts[min] ? parseInt(z) : min, 0
      );
      
      // 20% chance to assign nest affinity for natural nest clustering
      if (Math.random() < 0.20) {
        const nestCounts = await getBotCountByNest();
        affinity = Object.entries(nestCounts).reduce((min, [n, c]) => 
          c < nestCounts[min] ? parseInt(n) : min, 0
        );
        
        // Spawn near nest if affinity assigned
        const nestPosition = getRandomPositionNearNest(affinity, 10);
        if (nestPosition) {
          position = nestPosition;
          zone = calculateZone(position);
        }
      }
    }
    
    const bot = await createBotPlayer(zone, null, Math.random() < 0.07); // 7% Beer Bases
    
    // Set position from concentration zone or nest
    if (position) {
      bot.base = position;
      bot.currentPosition = position;
      if (bot.botConfig && affinity !== undefined) {
        bot.botConfig.nestAffinity = affinity;
      }
    }
    
    // Check for Bot Magnet beacon attraction (only if not in concentration zone/nest)
    if (!position && bot.currentPosition) {
      const attraction = await shouldAttractToBeacon(
        bot.currentPosition.x,
        bot.currentPosition.y
      );
      
      if (attraction.attracted && attraction.targetX !== undefined && attraction.targetY !== undefined) {
        // Redirect bot to beacon area
        bot.base = { x: attraction.targetX, y: attraction.targetY };
        bot.currentPosition = { x: attraction.targetX, y: attraction.targetY };
        
        // Recalculate zone based on new position
        zone = calculateZone({ x: attraction.targetX, y: attraction.targetY });
        if (bot.botConfig) {
          bot.botConfig.zone = zone;
        }
        
        // Track attraction
        if (attraction.beaconId) {
          await incrementAttractedCount(attraction.beaconId);
        }
      }
    }
    
    botsToInsert.push(bot);
    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  }
  
  if (botsToInsert.length > 0) {
    await db.collection('players').insertMany(botsToInsert);
    console.log(`✅ Successfully spawned ${botsToInsert.length} bots`);
    
    // Log distribution
    const finalZoneCounts = await getBotCountByZone();
    console.log('\n📊 Bot Distribution by Zone:');
    for (let i = 0; i < 9; i++) {
      console.log(`   Zone ${i}: ${finalZoneCounts[i]} bots`);
    }
    
    const nestCounts = await getBotCountByNest();
    console.log('\n🏠 Bot Distribution by Nest:');
    BOT_NESTS.forEach(nest => {
      console.log(`   ${nest.name}: ${nestCounts[nest.id]} bots`);
    });
  }
}

/**
 * Spawn initial bot population (100 bots)
 */
async function initialSpawn(): Promise<void> {
  console.log('🚀 Starting initial bot spawn...\n');
  
  // First, spawn 15-20 bots per nest (8 nests × 17.5 avg = 140 target)
  // But we only want 100 total, so we'll do proportional distribution
  const botsPerNest = Math.floor(INITIAL_SPAWN_COUNT / BOT_NESTS.length);
  const remainder = INITIAL_SPAWN_COUNT % BOT_NESTS.length;
  
  for (let i = 0; i < BOT_NESTS.length; i++) {
    const count = botsPerNest + (i < remainder ? 1 : 0);
    await spawnBots(count, undefined, i);
  }
  
  const totalCount = await getBotCount();
  console.log(`\n🎉 Initial spawn complete! Total bots: ${totalCount}`);
}

/**
 * Daily auto-spawn (50-100 bots)
 */
async function dailySpawn(): Promise<void> {
  console.log('📅 Starting daily bot spawn...\n');
  
  const currentCount = await getBotCount();
  console.log(`Current bot population: ${currentCount}/${BOT_CAP}`);
  
  if (currentCount >= BOT_CAP) {
    console.log('✅ Bot cap reached. No spawn needed.');
    return;
  }
  
  const spawnCount = Math.floor(Math.random() * (DAILY_SPAWN_MAX - DAILY_SPAWN_MIN + 1)) + DAILY_SPAWN_MIN;
  await spawnBots(spawnCount);
  
  const newCount = await getBotCount();
  console.log(`\n🎉 Daily spawn complete! Total bots: ${newCount}/${BOT_CAP}`);
}

/**
 * Manual spawn with options
 */
async function manualSpawn(count: number, zone?: number): Promise<void> {
  console.log(`🔧 Manual spawn requested: ${count} bots${zone !== undefined ? ` in zone ${zone}` : ''}...\n`);
  
  await spawnBots(count, zone);
  
  const totalCount = await getBotCount();
  console.log(`\n🎉 Manual spawn complete! Total bots: ${totalCount}/${BOT_CAP}`);
}

/**
 * Fill nests to target population (15-20 per nest)
 */
async function fillNests(): Promise<void> {
  console.log('🏠 Filling nests to target population...\n');
  
  const nestCounts = await getBotCountByNest();
  
  for (const nest of BOT_NESTS) {
    const current = nestCounts[nest.id] || 0;
    const target = Math.floor(Math.random() * (NEST_BOT_TARGET_MAX - NEST_BOT_TARGET_MIN + 1)) + NEST_BOT_TARGET_MIN;
    
    if (current < target) {
      const needed = target - current;
      console.log(`${nest.name}: ${current}/${target} - spawning ${needed} bots`);
      await spawnBots(needed, undefined, nest.id);
    } else {
      console.log(`${nest.name}: ${current}/${target} - OK`);
    }
  }
  
  console.log('\n✅ Nest population balanced!');
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  
  try {
    if (args.includes('--initial')) {
      await initialSpawn();
    } else if (args.includes('--daily')) {
      await dailySpawn();
    } else if (args.includes('--fill-nests')) {
      await fillNests();
    } else if (args.includes('--count')) {
      const countIndex = args.indexOf('--count');
      const count = parseInt(args[countIndex + 1]) || 10;
      const zoneIndex = args.indexOf('--zone');
      const zone = zoneIndex >= 0 ? parseInt(args[zoneIndex + 1]) : undefined;
      await manualSpawn(count, zone);
    } else {
      console.log(`
🤖 Bot Spawn System

Usage:
  npm run spawn-bots -- --initial        Spawn initial 100 bots
  npm run spawn-bots -- --daily          Daily spawn (50-100 bots)
  npm run spawn-bots -- --fill-nests     Fill all nests to target
  npm run spawn-bots -- --count 10       Manual spawn (optional --zone N)

Examples:
  npm run spawn-bots -- --initial
  npm run spawn-bots -- --count 50 --zone 4
  npm run spawn-bots -- --fill-nests
      `);
    }
  } catch (error) {
    console.error('❌ Error spawning bots:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for API usage
export { spawnBots, initialSpawn, dailySpawn, manualSpawn, fillNests, getBotCount };

// ============================================================
// IMPLEMENTATION NOTES:
// ============================================================
// - Initial spawn: 100 bots distributed across 8 nests
// - Daily spawn: 50-100 random bots maintaining zone balance
// - 7% chance for Beer Base (special high-reward bot)
// - 20% of bots get nest affinity for natural clustering
// - Even zone distribution maintained automatically
// - Can be run via CLI or imported for API use
// ============================================================
