/**
 * Beer Base Cleanup Script
 * 
 * Purpose: Remove all existing Beer Bases from database to prevent duplicate key errors
 * Run this once before restarting server after the Beer Base username fix
 * 
 * Usage: npx ts-node -r dotenv/config scripts/cleanup-beer-bases.ts dotenv_config_path=.env.local
 */

import { MongoClient } from 'mongodb';

async function cleanupBeerBases() {
  console.log('🍺 [Beer Base Cleanup] Starting cleanup...');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    // Find all Beer Bases
    const beerBases = await db.collection('players').find({ 
      isBot: true, 
      isSpecialBase: true 
    }).toArray();
    
    console.log(`🍺 Found ${beerBases.length} Beer Base(s) to remove`);
    
    if (beerBases.length === 0) {
      console.log('✅ No Beer Bases found, database is clean');
      await client.close();
      process.exit(0);
    }
    
    // List them
    beerBases.forEach((base: any, i: number) => {
      console.log(`   ${i + 1}. ${base.username} (Level ${base.level}, Position: ${base.currentPosition?.x},${base.currentPosition?.y})`);
    });
    
    // Delete all Beer Bases
    const result = await db.collection('players').deleteMany({ 
      isBot: true, 
      isSpecialBase: true 
    });
    
    console.log(`✅ Successfully removed ${result.deletedCount} Beer Base(s)`);
    console.log('🍺 Cleanup complete! New Beer Bases will be spawned with unique names on next respawn cycle.');
    
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await client.close();
    process.exit(1);
  }
}

cleanupBeerBases();
