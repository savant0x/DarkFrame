/**
 * Database Index Creation Script
 * 
 * Creates compound indexes for optimal query performance across all collections.
 * Run this script once to setup indexes, then verify with collection.getIndexes()
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-040 (Database Query Optimization)
 * 
 * OVERVIEW:
 * This script creates 15+ compound indexes optimized for the most frequent and
 * expensive queries in the DarkFrame game. Each index is designed based on query
 * patterns identified during the audit phase.
 * 
 * Usage:
 *   npm run create-indexes
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in .env.local');
  process.exit(1);
}

interface IndexDefinition {
  collection: string;
  index: Record<string, 1 | -1>;
  name: string;
  description: string;
}

/**
 * Index definitions optimized for DarkFrame query patterns
 */
const indexes: IndexDefinition[] = [
  // ========================================
  // CLANS COLLECTION
  // ========================================
  {
    collection: 'clans',
    index: { level: -1, power: -1 },
    name: 'level_power_leaderboard',
    description: 'Optimize clan leaderboard queries (sorted by level desc, then power desc)',
  },
  {
    collection: 'clans',
    index: { power: -1 },
    name: 'power_leaderboard',
    description: 'Optimize power-based leaderboard queries',
  },
  {
    collection: 'clans',
    index: { territoryCount: -1 },
    name: 'territory_leaderboard',
    description: 'Optimize territory count leaderboard',
  },
  {
    collection: 'clans',
    index: { totalWealth: -1 },
    name: 'wealth_leaderboard',
    description: 'Optimize wealth leaderboard',
  },

  // ========================================
  // CLAN_TERRITORIES COLLECTION
  // ========================================
  {
    collection: 'clan_territories',
    index: { clanId: 1, x: 1, y: 1 },
    name: 'clan_territory_lookup',
    description: 'Fast lookup of clan territories and adjacency checks',
  },
  {
    collection: 'clan_territories',
    index: { x: 1, y: 1 },
    name: 'coordinate_lookup',
    description: 'Fast lookup by coordinates (who owns this tile)',
  },
  {
    collection: 'clan_territories',
    index: { clanId: 1 },
    name: 'clan_territories_list',
    description: 'Fast retrieval of all territories for a clan',
  },

  // ========================================
  // CLAN_WARS COLLECTION
  // ========================================
  {
    collection: 'clan_wars',
    index: { status: 1, endDate: 1 },
    name: 'active_wars_lookup',
    description: 'Find active wars and wars ending soon',
  },
  {
    collection: 'clan_wars',
    index: { attackerClanId: 1, status: 1 },
    name: 'attacker_wars',
    description: 'Find wars where clan is attacker',
  },
  {
    collection: 'clan_wars',
    index: { defenderClanId: 1, status: 1 },
    name: 'defender_wars',
    description: 'Find wars where clan is defender',
  },

  // ========================================
  // BATTLE_LOGS COLLECTION
  // ========================================
  {
    collection: 'battleLogs',
    index: { attackerId: 1, timestamp: -1 },
    name: 'attacker_battle_history',
    description: 'Retrieve battle history for attacker (recent first)',
  },
  {
    collection: 'battleLogs',
    index: { defenderId: 1, timestamp: -1 },
    name: 'defender_battle_history',
    description: 'Retrieve battle history for defender (recent first)',
  },
  {
    collection: 'battleLogs',
    index: { timestamp: -1 },
    name: 'recent_battles',
    description: 'Global recent battle feed',
  },

  // ========================================
  // PLAYERS COLLECTION
  // ========================================
  {
    collection: 'players',
    index: { clanId: 1, role: 1 },
    name: 'clan_members_by_role',
    description: 'Retrieve clan members filtered by role',
  },
  {
    collection: 'players',
    index: { level: -1 },
    name: 'player_level_leaderboard',
    description: 'Player leaderboard by level',
  },
  {
    collection: 'players',
    index: { totalKills: -1 },
    name: 'player_kills_leaderboard',
    description: 'Player leaderboard by kills',
  },
  {
    collection: 'players',
    index: { username: 1 },
    name: 'username_lookup',
    description: 'Fast username lookup (case-sensitive)',
  },
  {
    collection: 'players',
    index: { email: 1 },
    name: 'email_lookup_unique',
    description: 'Fast email lookup for login (unique constraint)',
  },

  // ========================================
  // AUCTIONS COLLECTION
  // ========================================
  {
    collection: 'auctions',
    index: { status: 1, endTime: 1 },
    name: 'active_auctions',
    description: 'Find active auctions sorted by ending soonest',
  },
  {
    collection: 'auctions',
    index: { sellerId: 1, status: 1 },
    name: 'seller_auctions',
    description: 'Find auctions by seller',
  },
  {
    collection: 'auctions',
    index: { status: 1, currentBid: -1 },
    name: 'auctions_by_price',
    description: 'Sort auctions by current bid (high to low)',
  },

  // ========================================
  // ACHIEVEMENTS COLLECTION
  // ========================================
  {
    collection: 'achievements',
    index: { playerId: 1, unlockedAt: -1 },
    name: 'player_achievements',
    description: 'Player achievement history (recent first)',
  },
  {
    collection: 'achievements',
    index: { playerId: 1, achievementType: 1 },
    name: 'player_achievement_lookup',
    description: 'Check if player has specific achievement',
  },

  // ========================================
  // FACTORIES COLLECTION
  // ========================================
  {
    collection: 'factories',
    index: { x: 1, y: 1 },
    name: 'factory_location_lookup',
    description: 'Fast lookup of factory by coordinates',
  },
  {
    collection: 'factories',
    index: { ownerId: 1 },
    name: 'player_factories',
    description: 'Find all factories owned by player',
  },
  {
    collection: 'factories',
    index: { clanId: 1 },
    name: 'clan_factories',
    description: 'Find all factories owned by clan',
  },

  // ========================================
  // MAP COLLECTION
  // ========================================
  {
    collection: 'map',
    index: { x: 1, y: 1 },
    name: 'tile_coordinate_lookup',
    description: 'Fast tile lookup by coordinates (if not already indexed)',
  },

  // ========================================
  // SHRINE_BLESSINGS COLLECTION
  // ========================================
  {
    collection: 'shrine_blessings',
    index: { playerId: 1, expiresAt: 1 },
    name: 'active_player_blessings',
    description: 'Find active blessings for player',
  },
  {
    collection: 'shrine_blessings',
    index: { expiresAt: 1 },
    name: 'expiring_blessings',
    description: 'Find blessings that are expiring soon (for cleanup)',
  },

  // ========================================
  // TUTORIAL SYSTEM COLLECTION
  // ========================================
  {
    collection: 'tutorial_progress',
    index: { playerId: 1 },
    name: 'player_tutorial_progress',
    description: 'Fast lookup of player tutorial progress (unique constraint)',
  },
  {
    collection: 'tutorial_progress',
    index: { tutorialComplete: 1, completedAt: -1 },
    name: 'completed_tutorials',
    description: 'Analytics: find completed tutorials sorted by completion date',
  },
  {
    collection: 'tutorial_progress',
    index: { currentQuestId: 1, tutorialSkipped: 1 },
    name: 'active_quest_tracking',
    description: 'Fast lookup of players on specific quest (for analytics)',
  },
  {
    collection: 'tutorial_action_tracking',
    index: { playerId: 1, stepId: 1 },
    name: 'player_step_tracking',
    description: 'Fast lookup of action tracking for specific step (unique constraint)',
  },
  {
    collection: 'tutorial_action_tracking',
    index: { lastUpdated: 1 },
    name: 'stale_tracking_cleanup',
    description: 'Find stale action tracking records (for cleanup)',
  },

  // ========================================
  // HTTP POLLING SYSTEM (FID-20251026-017)
  // ========================================
  {
    collection: 'typing_indicators',
    index: { expiresAt: 1 },
    name: 'typing_ttl',
    description: 'TTL index for automatic cleanup of typing indicators (5s expiry)',
  },
  {
    collection: 'typing_indicators',
    index: { channelId: 1, userId: 1 },
    name: 'channel_user_typing',
    description: 'Unique constraint for typing indicators per user per channel',
  },
  {
    collection: 'user_presence',
    index: { expiresAt: 1 },
    name: 'presence_ttl',
    description: 'TTL index for automatic cleanup of presence records (60s expiry)',
  },
  {
    collection: 'user_presence',
    index: { userId: 1 },
    name: 'user_presence_lookup',
    description: 'Unique constraint for presence records per user',
  },
  {
    collection: 'user_presence',
    index: { lastSeen: 1 },
    name: 'online_users_lookup',
    description: 'Fast query for online users (lastSeen > now - 60s)',
  },
];

/**
 * Create all indexes in the database
 */
async function createIndexes(): Promise<void> {
  console.log('🚀 Starting index creation for DarkFrame database...\n');

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    const db = client.db();
    let successCount = 0;
    let errorCount = 0;

    for (const indexDef of indexes) {
      try {
        const collection = db.collection(indexDef.collection);
        
        // Create the index
        await collection.createIndex(indexDef.index, { name: indexDef.name });
        
        console.log(`✅ Created index: ${indexDef.name}`);
        console.log(`   Collection: ${indexDef.collection}`);
        console.log(`   Index: ${JSON.stringify(indexDef.index)}`);
        console.log(`   Purpose: ${indexDef.description}\n`);
        
        successCount++;
      } catch (error) {
        console.error(`❌ Error creating index ${indexDef.name}:`, error);
        errorCount++;
      }
    }

    console.log('=====================================');
    console.log(`✅ Successfully created ${successCount} indexes`);
    if (errorCount > 0) {
      console.log(`❌ Failed to create ${errorCount} indexes`);
    }
    console.log('=====================================\n');

    // Print index statistics for each collection
    console.log('📊 Index Statistics:\n');
    const collections = [...new Set(indexes.map(i => i.collection))];
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const indexInfo = await collection.indexes();
      console.log(`${collectionName}: ${indexInfo.length} indexes total`);
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Database connection closed');
  }
}

/**
 * Verify indexes exist and are being used
 */
async function verifyIndexes(): Promise<void> {
  console.log('\n🔍 Verifying index usage with sample queries...\n');

  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    return;
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();

    // Test 1: Clan leaderboard query
    console.log('Test 1: Clan leaderboard query');
    const clansExplain = await db.collection('clans')
      .find({})
      .sort({ level: -1, power: -1 })
      .limit(10)
      .explain('executionStats');
    
    const clansUsesIndex = clansExplain.executionStats?.executionStages?.inputStage?.indexName;
    console.log(`   Uses index: ${clansUsesIndex || 'NONE (COLLSCAN!)'}`);
    console.log(`   Execution time: ${clansExplain.executionStats?.executionTimeMillis}ms\n`);

    // Test 2: Territory lookup
    console.log('Test 2: Territory coordinate lookup');
    const territoryExplain = await db.collection('clan_territories')
      .find({ x: 50, y: 50 })
      .explain('executionStats');
    
    const territoryUsesIndex = territoryExplain.executionStats?.executionStages?.inputStage?.indexName;
    console.log(`   Uses index: ${territoryUsesIndex || 'NONE (COLLSCAN!)'}`);
    console.log(`   Execution time: ${territoryExplain.executionStats?.executionTimeMillis}ms\n`);

    // Test 3: Battle log history
    console.log('Test 3: Battle log history');
    const battleExplain = await db.collection('battleLogs')
      .find({ attackerId: 'sample_id' })
      .sort({ timestamp: -1 })
      .limit(20)
      .explain('executionStats');
    
    const battleUsesIndex = battleExplain.executionStats?.executionStages?.inputStage?.indexName;
    console.log(`   Uses index: ${battleUsesIndex || 'NONE (COLLSCAN!)'}`);
    console.log(`   Execution time: ${battleExplain.executionStats?.executionTimeMillis}ms\n`);

    console.log('✅ Index verification complete');

  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await client.close();
  }
}

// Run the script
(async () => {
  await createIndexes();
  await verifyIndexes();
  process.exit(0);
})();
