/**
 * @file scripts/cleanup-flags-standalone.ts
 * Standalone cleanup script with direct MongoDB connection
 * 
 * Usage: npx tsx scripts/cleanup-flags-standalone.ts
 */

// Load environment variables FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { MongoClient, ObjectId } from 'mongodb';

async function cleanupDuplicateFlags() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    console.error('   Make sure .env.local exists with MONGODB_URI');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('darkframe');

    console.log('\n📊 Current State:');
    
    // Find all flag bots
    const flagBots = await db.collection('players').find({
      username: { $regex: /^Flag-Bearer-/i }
    }).toArray();
    
    console.log(`  - Flag bots found: ${flagBots.length}`);
    flagBots.forEach(bot => {
      console.log(`    • ${bot.username} (ID: ${bot._id})`);
    });

    // Find all flag documents
    const flagDocs = await db.collection('flags').find({}).toArray();
    
    console.log(`  - Flag documents found: ${flagDocs.length}`);
    flagDocs.forEach((doc, i) => {
      console.log(`    • Flag ${i + 1}: Holder = ${doc.currentHolder?.username || 'None'} (ID: ${doc._id})`);
    });

    if (flagBots.length === 0 && flagDocs.length === 0) {
      console.log('\n✅ No flags or flag bots found - system is clean');
      console.log('   Server will create flag on next startup');
      await client.close();
      process.exit(0);
    }

    if (flagBots.length === 1 && flagDocs.length === 1) {
      console.log('\n✅ Exactly one flag and one bot - system is correct');
      await client.close();
      process.exit(0);
    }

    console.log('\n⚠️  Duplicates detected - cleaning up...');

    // Keep the first flag document (if any exist)
    if (flagDocs.length > 0) {
      const keepFlagDoc = flagDocs[0];
      console.log(`\n✅ Keeping flag document: ${keepFlagDoc._id}`);
      
      // Delete other flag documents
      if (flagDocs.length > 1) {
        const deleteIds = flagDocs.slice(1).map(doc => doc._id);
        const deleteResult = await db.collection('flags').deleteMany({
          _id: { $in: deleteIds }
        });
        console.log(`   Deleted ${deleteResult.deletedCount} duplicate flag documents`);
      }

      // Find the bot that matches this flag's currentHolder (if it's a bot)
      let keepBotId: ObjectId | null = null;
      
      if (keepFlagDoc.currentHolder?.botId) {
        keepBotId = keepFlagDoc.currentHolder.botId;
        console.log(`   Flag is held by bot: ${keepBotId}`);
      }

      // Delete flag bots (keep the one referenced in the flag doc)
      for (const bot of flagBots) {
        const botId = bot._id.toString();
        const shouldKeep = keepBotId && botId === keepBotId.toString();
        
        if (shouldKeep) {
          console.log(`✅ Keeping flag bot: ${bot.username} (${bot._id})`);
        } else {
          await db.collection('players').deleteOne({ _id: bot._id });
          console.log(`   Deleted duplicate bot: ${bot.username} (${bot._id})`);
        }
      }

      // If flag is held by a player (not a bot), delete ALL bots
      if (!keepBotId && flagBots.length > 0) {
        const deleteResult = await db.collection('players').deleteMany({
          username: { $regex: /^Flag-Bearer-/i }
        });
        console.log(`   Deleted ${deleteResult.deletedCount} orphaned flag bots (flag held by player)`);
      }
    } else {
      // No flag documents but bots exist - delete all bots
      console.log('\n⚠️  No flag documents found - deleting all flag bots');
      const deleteResult = await db.collection('players').deleteMany({
        username: { $regex: /^Flag-Bearer-/i }
      });
      console.log(`   Deleted ${deleteResult.deletedCount} orphaned flag bots`);
    }

    console.log('\n📊 Final State:');
    
    const finalFlagBots = await db.collection('players').countDocuments({
      username: { $regex: /^Flag-Bearer-/i }
    });
    
    const finalFlagDocs = await db.collection('flags').countDocuments({});
    
    console.log(`  - Flag bots remaining: ${finalFlagBots}`);
    console.log(`  - Flag documents remaining: ${finalFlagDocs}`);

    console.log('\n✅ Cleanup complete!');
    console.log('   Restart your server to ensure flag system reinitializes correctly');
    
    await client.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    await client.close();
    process.exit(1);
  }
}

// Run cleanup
cleanupDuplicateFlags();
