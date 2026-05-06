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

// Now safe to import supabase
import { createServiceClient } from '../../lib/supabase/server';

async function cleanupDuplicateFlags() {
  try {
    console.log('🔄 Connecting to database...');
    const supabase = createServiceClient();

    console.log('\n📊 Current State:');
    
    // Find all flag bots
    const { data: flagBots, error: botsError } = await supabase
      .from('players')
      .select('*')
      .ilike('username', 'Flag-Bearer-%');
    
    if (botsError) throw botsError;

    console.log(`  - Flag bots found: ${flagBots.length}`);
    flagBots.forEach((bot: any) => {
      console.log(`    • ${bot.username} (ID: ${bot.id})`);
    });

    // Find all flag documents
    const { data: flagDocs, error: flagsError } = await supabase
      .from('flags')
      .select('*');

    if (flagsError) throw flagsError;

    console.log(`  - Flag documents found: ${flagDocs.length}`);
    flagDocs.forEach((doc: any, i: number) => {
      console.log(`    • Flag ${i + 1}: Holder = ${doc.bearer_username || 'None'} (ID: ${doc.id})`);
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
      console.log(`\n✅ Keeping flag document: ${keepFlagDoc.id}`);
      
      // Delete other flag documents
      if (flagDocs.length > 1) {
        const deleteIds = flagDocs.slice(1).map((doc: any) => doc.id);
        for (const id of deleteIds) {
          await supabase.from('flags').delete().eq('id', id);
        }
        console.log(`   Deleted ${deleteIds.length} duplicate flag documents`);
      }

      // Find the bot that matches this flag's currentHolder (if it's a bot)
      let keepBotId: string | null = null;
      
      if (keepFlagDoc.is_bot && keepFlagDoc.bearer_id) {
        keepBotId = keepFlagDoc.bearer_id;
        console.log(`   Flag is held by bot: ${keepBotId}`);
      }

        // Delete flag bots (keep the one referenced in the flag doc)
        for (const bot of flagBots) {
          const botId = bot.username;
          const shouldKeep = keepBotId && botId === keepBotId;

          if (shouldKeep) {
            console.log(`✅ Keeping flag bot: ${bot.username} (${bot.username})`);
          } else {
            await supabase.from('players').delete().eq('username', bot.username);
            console.log(`   Deleted duplicate bot: ${bot.username} (${bot.username})`);
          }
        }

      // If flag is held by a player (not a bot), delete ALL bots
      if (!keepBotId && flagBots.length > 0) {
        const { count } = await supabase
          .from('players')
          .delete({ count: 'exact' })
          .ilike('username', 'Flag-Bearer-%');
        console.log(`   Deleted ${count || 0} orphaned flag bots (flag held by player)`);
      }
    } else {
      // No flag documents but bots exist - delete all bots
      console.log('\n⚠️  No flag documents found - deleting all flag bots');
      const { count } = await supabase
        .from('players')
        .delete({ count: 'exact' })
        .ilike('username', 'Flag-Bearer-%');
      console.log(`   Deleted ${count || 0} orphaned flag bots`);
    }

    console.log('\n📊 Final State:');
    
    const { count: finalFlagBots } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('username', 'Flag-Bearer-%');
    
    const { count: finalFlagDocs } = await supabase
      .from('flags')
      .select('*', { count: 'exact', head: true });
    
    console.log(`  - Flag bots remaining: ${finalFlagBots || 0}`);
    console.log(`  - Flag documents remaining: ${finalFlagDocs || 0}`);

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
