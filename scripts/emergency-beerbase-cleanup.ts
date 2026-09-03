/**
 * Emergency Beer Base Cleanup Script
 * Created: 2025-10-25
 * 
 * PURPOSE:
 * Removes all fake Beer Base player documents that accumulated due to infinite spawn bug.
 * Preserves real players (non-bot accounts).
 * 
 * ISSUE:
 * - 153,708 Beer Base player documents created (485 MB / 512 MB database)
 * - Root cause: getTargetBeerBaseCount() included Beer Bases in total count
 * - Created infinite feedback loop over 10 days
 * 
 * USAGE:
 * npx ts-node -r dotenv/config scripts/emergency-beerbase-cleanup.ts dotenv_config_path=.env.local
 */

import { MongoClient } from 'mongodb';

async function emergencyCleanup() {
  console.log('🚨 [EMERGENCY] Beer Base Cleanup Starting...\n');
  
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');
    
    const db = client.db('darkframe');
    const players = db.collection('players');
    
    // Count current state
    console.log('📊 Current Database State:');
    const totalPlayers = await players.countDocuments({});
    const realPlayers = await players.countDocuments({ isBot: { $ne: true } });
    const allBots = await players.countDocuments({ isBot: true });
    
    // BUG FIX: Original code checked for isSpecialBase, but that field was never set by createBot()
    // All Beer Bases have username starting with 🍺BeerBase, so match by pattern instead
    const beerBases = await players.countDocuments({ username: { $regex: /^🍺BeerBase/ } });
    const regularBots = allBots - beerBases;
    
    console.log(`   Total Documents: ${totalPlayers}`);
    console.log(`   Real Players: ${realPlayers}`);
    console.log(`   Regular Bots: ${regularBots}`);
    console.log(`   Beer Bases: ${beerBases}`);
    console.log('');
    
    // Get size before cleanup
    const stats = await db.command({ collStats: 'players' });
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   Collection Size: ${sizeMB} MB\n`);
    
    // Confirm cleanup
    if (beerBases === 0) {
      console.log('✅ No Beer Bases found - database is clean!');
      await client.close();
      process.exit(0);
    }
    
    console.log(`⚠️  About to delete ${beerBases} Beer Base documents`);
    console.log('   This will free up approximately', ((beerBases * 3) / 1024).toFixed(2), 'MB\n');
    
    // Show sample of what will be deleted
    const samples = await players.find({ 
      username: { $regex: /^🍺BeerBase/ } // Match by username pattern
    }).limit(5).toArray();
    
    console.log('📋 Sample Beer Bases to be deleted:');
    samples.forEach((base: any, i: number) => {
      console.log(`   ${i + 1}. ${base.username} (Level ${base.level || 1}, Position: ${base.position?.x || 0},${base.position?.y || 0})`);
    });
    console.log('   ... and', beerBases - 5, 'more\n');
    
    // Execute cleanup
    console.log('🗑️  Deleting Beer Bases...');
    const deleteResult = await players.deleteMany({ 
      username: { $regex: /^🍺BeerBase/ } // Match by username pattern
    });
    
    console.log(`✅ Deleted ${deleteResult.deletedCount} Beer Base documents\n`);
    
    // Verify cleanup
    console.log('🔍 Verifying cleanup...');
    const remainingBeerBases = await players.countDocuments({ username: { $regex: /^🍺BeerBase/ } });
    const remainingTotal = await players.countDocuments({});
    const remainingReal = await players.countDocuments({ isBot: { $ne: true } });
    const remainingRegularBots = await players.countDocuments({ 
      isBot: true, 
      username: { $not: { $regex: /^🍺BeerBase/ } } // Not a Beer Base
    });
    
    console.log(`   Remaining Documents: ${remainingTotal}`);
    console.log(`   Real Players: ${remainingReal}`);
    console.log(`   Regular Bots: ${remainingRegularBots}`);
    console.log(`   Beer Bases: ${remainingBeerBases}`);
    console.log('');
    
    // Get size after cleanup
    const newStats = await db.command({ collStats: 'players' });
    const newSizeMB = (newStats.size / 1024 / 1024).toFixed(2);
    const freedMB = (parseFloat(sizeMB) - parseFloat(newSizeMB)).toFixed(2);
    
    console.log(`   Collection Size: ${newSizeMB} MB (freed ${freedMB} MB)\n`);
    
    if (remainingBeerBases === 0) {
      console.log('✅ SUCCESS! All Beer Bases removed');
      console.log('✅ Real players preserved');
      console.log('✅ Database cleaned up successfully\n');
    } else {
      console.warn(`⚠️  Warning: ${remainingBeerBases} Beer Bases still remain`);
    }
    
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
    console.log('✅ Cleanup complete!\n');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await client.close();
    process.exit(1);
  }
}

emergencyCleanup();
