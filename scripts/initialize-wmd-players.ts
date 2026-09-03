/**
 * @file scripts/initialize-wmd-players.ts
 * @created 2025-10-22
 * @overview Initialize WMD system for existing players
 * 
 * OVERVIEW:
 * Creates basic WMD research records for all existing players who don't have them.
 * This fixes 401 errors on WMD endpoints for players created before WMD system.
 * 
 * Usage:
 *   npx tsx scripts/initialize-wmd-players.ts
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI!;

async function initializeWMDForPlayers() {
  console.log('🔄 Connecting to MongoDB...');
  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db('darkframe');

  try {
    // Get all players
    const players = await db.collection('players').find({}).toArray();
    console.log(`📊 Found ${players.length} total players`);

    // Get existing WMD research records
    const existingResearch = await db.collection('wmd_player_research').find({}).toArray();
    const existingPlayerIds = new Set(existingResearch.map(r => r.playerId.toString()));
    console.log(`📊 ${existingResearch.length} players already have WMD research`);

    // Find players without WMD research
    const playersNeedingInit = players.filter(p => !existingPlayerIds.has(p._id.toString()));
    console.log(`🎯 ${playersNeedingInit.length} players need WMD initialization`);

    if (playersNeedingInit.length === 0) {
      console.log('✅ All players already have WMD research initialized');
      return;
    }

    // Initialize WMD research for each player
    const operations = playersNeedingInit.map(player => ({
      insertOne: {
        document: {
          playerId: player._id.toString(),
          username: player.username,
          currentRP: 0,
          totalRPEarned: 0,
          researchCompleted: [],
          researchInProgress: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    }));

    const result = await db.collection('wmd_player_research').bulkWrite(operations);
    console.log(`✅ Initialized WMD research for ${result.insertedCount} players`);

    // List initialized players
    playersNeedingInit.forEach(player => {
      console.log(`  ✓ ${player.username}`);
    });

  } catch (error) {
    console.error('❌ Error initializing WMD:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run initialization
initializeWMDForPlayers()
  .then(() => {
    console.log('✅ WMD initialization complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  });

// ============================================================
// END OF FILE
// ============================================================
