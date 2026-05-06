/**
 * @file scripts/cleanup-flags-standalone.ts
 * Standalone cleanup script with direct Supabase connection
 * 
 * Usage: npx tsx scripts/cleanup-flags-standalone.ts
 */

// Load environment variables FIRST
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createServiceClient } from '../../lib/supabase/server';

async function cleanupDuplicateFlags() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
    console.error('   Make sure .env.local exists with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createServiceClient();

  try {
    console.log('🔄 Connected to Supabase');
    console.log('✅ Connected to Supabase');

    console.log('\n📊 Current State:');
    
    // Find all flag bots
    const { data: flagBots, error: flagBotsError } = await supabase
      .from('players')
      .select('username')
      .ilike('username', 'Flag-Bearer-%');
    
    if (flagBotsError) {
      console.error('Error finding flag bots:', flagBotsError);
      process.exit(1);
    }
    
    console.log(`  - Flag bots found: ${flagBots.length}`);
    flagBots.forEach(bot => {
      console.log(`    \u2022 ${bot.username}`);
    });

    // Find all flag documents
    const { data: flagDocs, error: flagDocsError } = await supabase
      .from('flags')
      .select('*');
    
    if (flagDocsError) {
      console.error('❌ Error finding flag documents:', flagDocsError);
      process.exit(1);
    }
    
    console.log(`  - Flag documents found: ${flagDocs.length}`);
    flagDocs.forEach((doc, i) => {
      console.log(`    Flag ${i + 1}: Holder = ${doc.bearer_username || 'None'} (ID: ${doc.id})`);
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
        const deleteIds = flagDocs.slice(1).map(doc => doc.id);
        const { error: flagDeleteError } = await supabase
          .from('flags')
          .delete()
          .in('id', deleteIds);
        if (flagDeleteError) {
          console.error(`   Error deleting duplicate flags:`, flagDeleteError);
        } else {
          console.log(`   Deleted ${deleteIds.length} duplicate flag documents`);
        }
      }

      // Find the bot that matches this flag's bearer (if it's a bot)
      let keepBotUsername: string | null = null;
      
      if (keepFlagDoc.bearer_username) {
        keepBotUsername = keepFlagDoc.bearer_username;
        console.log(`   Flag is held by bot: ${keepBotUsername}`);
      }

      // Delete flag bots (keep the one referenced in the flag doc)
      for (const bot of flagBots) {
        const shouldKeep = keepBotUsername && bot.username === keepBotUsername;
        
        if (shouldKeep) {
          console.log(`\u2705 Keeping flag bot: ${bot.username}`);
        } else {
          const { error: botDeleteError } = await supabase
            .from('players')
            .delete()
            .eq('username', bot.username);
          if (!botDeleteError) {
            console.log(`   Deleted duplicate bot: ${bot.username}`);
          }
        }
      }

      // If flag is held by a player (not a bot), delete ALL bots
      if (!keepBotUsername && flagBots.length > 0) {
        const { error: botsDeleteError } = await supabase
          .from('players')
          .delete()
          .ilike('username', 'Flag-Bearer-%');
        if (!botsDeleteError) {
          console.log(`   Deleted orphaned flag bots (flag held by player)`);
        }
      }
    } else {
      // No flag documents but bots exist - delete all bots
      console.log('\n⚠️  No flag documents found - deleting all flag bots');
      const { error: botsDeleteError } = await supabase
        .from('players')
        .delete()
        .ilike('username', 'Flag-Bearer-%');
      if (!botsDeleteError) {
        console.log(`   Deleted orphaned flag bots`);
      }
    }

    console.log('\n📊 Final State:');
    
    const { count: finalFlagBotsCount } = await supabase
      .from('players')
      .select('username', { count: 'exact', head: true })
      .ilike('username', 'Flag-Bearer-%');
    
    const { count: finalFlagDocsCount } = await supabase
      .from('flags')
      .select('id', { count: 'exact', head: true });
    
    console.log(`  - Flag bots remaining: ${finalFlagBotsCount ?? 0}`);
    console.log(`  - Flag documents remaining: ${finalFlagDocsCount ?? 0}`);

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
