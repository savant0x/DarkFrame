/**
 * @file scripts/cleanup-duplicate-flags.ts
 * Created: 2025-01-19
 * 
 * OVERVIEW:
 * One-time cleanup script to remove duplicate flag bearers and ensure
 * singleton flag system. Run this to fix the "multiple flag bearers" issue.
 * 
 * What it does:
 * 1. Finds all flag bearer bots in players collection
 * 2. Finds all flag documents in flags collection
 * 3. Keeps only ONE flag and ONE flag bot
 * 4. Deletes all duplicates
 * 
 * Usage:
 * npx tsx scripts/cleanup-duplicate-flags.ts
 */

// CRITICAL: Load env vars FIRST before any other imports
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

// Now safe to import mongodb
import { connectToDatabase, getDatabase } from '../lib/mongodb';
import type { Player } from '../types/game.types';

/** Shape of the flag-bearer docs maintained by this cleanup script. */
interface FlagBotDoc extends Player {
  _id: string;
}

/** Shape of the `flags` singleton document. */
interface FlagDoc {
  _id: string;
  currentHolder?: {
    playerId?: string;
    botId?: string;
  };
}
import { ObjectId } from 'mongodb';

async function cleanupDuplicateFlags() {
  try {
    console.log('🔄 Connecting to database...');
    await connectToDatabase();
    const db = await getDatabase();

    console.log('\n📊 Current State:');
    
    // Find all flag bots
    const flagBots = await db.collection<FlagBotDoc>('players').find({
      username: { $regex: /^Flag-Bearer-/i }
    }).toArray();
    
    console.log(`  - Flag bots found: ${flagBots.length}`);
    flagBots.forEach((bot: any) => {
      console.log(`    • ${bot.username} (ID: ${bot._id})`);
    });

    // Find all flag documents
    const flagDocs = await db.collection<FlagDoc>('flags').find({}).toArray();
    
    console.log(`  - Flag documents found: ${flagDocs.length}`);
    flagDocs.forEach((doc: any, i: any) => {
      console.log(`    • Flag ${i + 1}: Holder = ${doc.currentHolder?.username || 'None'} (ID: ${doc._id})`);
    });

    if (flagBots.length === 0 && flagDocs.length === 0) {
      console.log('\n✅ No flags or flag bots found - system is clean');
      console.log('   Server will create flag on next startup');
      process.exit(0);
    }

    if (flagBots.length === 1 && flagDocs.length === 1) {
      console.log('\n✅ Exactly one flag and one bot - system is correct');
      process.exit(0);
    }

    console.log('\n⚠️  Duplicates detected - cleaning up...');

    // Keep the first flag document (if any exist)
    if (flagDocs.length > 0) {
      const keepFlagDoc = flagDocs[0];
      console.log(`\n✅ Keeping flag document: ${keepFlagDoc._id}`);
      
      // Delete other flag documents
      if (flagDocs.length > 1) {
        const deleteIds = flagDocs.slice(1).map((doc: any) => doc._id);
        const deleteResult = await db.collection('flags').deleteMany({
          _id: { $in: deleteIds }
        });
        console.log(`   Deleted ${deleteResult.deletedCount} duplicate flag documents`);
      }

      // Find the bot that matches this flag's currentHolder (if it's a bot)
      let keepBotId: string | null = null;
      
      if (keepFlagDoc.currentHolder?.botId) {
        keepBotId = keepFlagDoc.currentHolder.botId;
        console.log(`   Flag is held by bot: ${keepBotId}`);
      }

      // Delete flag bots (keep the one referenced in the flag doc)
      for (const bot of flagBots) {
        const botId = bot._id;
        const shouldKeep = keepBotId !== null && botId === keepBotId;
        
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
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run cleanup
cleanupDuplicateFlags();
