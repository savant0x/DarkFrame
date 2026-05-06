/**
 * Territory Income Collection Script
 * 
 * Created: 2025-10-18
 * 
 * OVERVIEW:
 * Background cron job that runs daily at midnight UTC to collect passive
 * territory income for all clans. Income scales with clan level (1K-5.9K
 * Metal/Energy per territory per day).
 * 
 * Schedule: Runs at 00:00 UTC daily
 * 
 * Features:
 * - Collects income for all clans with territories
 * - Auto-deposits to clan bank
 * - Logs transactions and activities
 * - Handles errors gracefully
 * - Prevents double-collection
 * 
 * Usage:
 * - Run manually: node scripts/collectTerritoryIncome.js
 * - Automated: Set up cron job or task scheduler
 * 
 * @module scripts/collectTerritoryIncome
 */

import { createServiceClient } from '../../lib/supabase/server';
import { collectDailyTerritoryIncome } from '../../lib/territoryService';

async function runDailyCollection(): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting daily territory income collection...`);
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    process.exit(1);
  }
  
  const supabase = createServiceClient();
  
  try {
    console.log('Connected to Supabase');
    
    const { data: clans, error: clansError } = await supabase
      .from('clans')
      .select('id, name, tag, clan_level, total_territories')
      .not('total_territories', 'is', null);
    
    if (clansError) {
      console.error('Error fetching clans:', clansError);
      process.exit(1);
    }
    
    console.log(`Found ${clans.length} clans with territories`);
    
    if (clans.length === 0) {
      console.log('No clans to collect income for');
      return;
    }
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let totalMetalCollected = 0;
    let totalEnergyCollected = 0;
    
    for (const clan of clans) {
      const clanId = clan.id;
      const clanName = clan.name;
      const clanTag = clan.tag;
      const territoryCount = clan.total_territories || 0;
      
      try {
        const result = await collectDailyTerritoryIncome(clanId);
        
        if (result.success) {
          if (result.metalCollected > 0) {
            successCount++;
            totalMetalCollected += result.metalCollected;
            totalEnergyCollected += result.energyCollected;
            console.log(
              `\u2705 [${clanTag}] ${clanName}: Collected ${result.metalCollected} M + ${result.energyCollected} E from ${territoryCount} territories`
            );
          } else {
            skipCount++;
            console.log(`\u23ED\uFE0F  [${clanTag}] ${clanName}: ${result.message}`);
          }
        } else {
          skipCount++;
          console.log(`\u23ED\uFE0F  [${clanTag}] ${clanName}: ${result.message}`);
        }
      } catch (error: unknown) {
        errorCount++;
        console.error(`\u274C [${clanTag}] ${clanName}: Error - ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    const duration = Date.now() - startTime;
    console.log('\n=== Collection Summary ===');
    console.log(`Total clans processed: ${clans.length}`);
    console.log(`Successful collections: ${successCount}`);
    console.log(`Skipped (already collected): ${skipCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log(`Total Metal collected: ${totalMetalCollected.toLocaleString()}`);
    console.log(`Total Energy collected: ${totalEnergyCollected.toLocaleString()}`);
    console.log(`Duration: ${duration}ms`);
    console.log('=========================\n');
    
    console.log('[LOG] TERRITORY_INCOME_COLLECTION:', {
      timestamp: new Date().toISOString(),
      stats: {
        totalClans: clans.length,
        successCount,
        skipCount,
        errorCount,
        totalMetalCollected,
        totalEnergyCollected,
        durationMs: duration,
      },
    });
    
  } catch (error: unknown) {
    console.error('Fatal error during collection:', error);
    process.exit(1);
  } finally {
    console.log('Collection process complete');
  }
}

// Execute if run directly
if (require.main === module) {
  runDailyCollection()
    .then(() => {
      console.log('Collection complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Collection failed:', error);
      process.exit(1);
    });
}

export { runDailyCollection };
