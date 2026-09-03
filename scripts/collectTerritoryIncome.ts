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

import { MongoClient } from 'mongodb';
import { 
  collectDailyTerritoryIncome 
} from '../lib/territoryService';

const MONGODB_URI = process.env.MONGODB_URI || '';

/**
 * Main execution function
 * Connects to database and collects income for all clans
 */
async function runDailyCollection(): Promise<void> {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting daily territory income collection...`);
  
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable not set');
    process.exit(1);
  }
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Connect to database
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('darkframe');
    
    // Get all clans with territories
    const clans = await db.collection('clans')
      .find({
        'territories.0': { $exists: true } // Has at least one territory
      })
      .project({ _id: 1, name: 1, tag: 1, level: 1, territories: 1 })
      .toArray();
    
    console.log(`Found ${clans.length} clans with territories`);
    
    if (clans.length === 0) {
      console.log('No clans to collect income for');
      return;
    }
    
    // Collect income for each clan
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let totalMetalCollected = 0;
    let totalEnergyCollected = 0;
    
    for (const clan of clans) {
      const clanId = clan._id.toString();
      const clanName = clan.name;
      const clanTag = clan.tag;
      const territoryCount = clan.territories?.length || 0;
      
      try {
        const result = await collectDailyTerritoryIncome(clanId);
        
        if (result.success) {
          if (result.metalCollected > 0) {
            successCount++;
            totalMetalCollected += result.metalCollected;
            totalEnergyCollected += result.energyCollected;
            console.log(
              `✅ [${clanTag}] ${clanName}: Collected ${result.metalCollected} M + ${result.energyCollected} E from ${territoryCount} territories`
            );
          } else {
            skipCount++;
            console.log(`⏭️  [${clanTag}] ${clanName}: ${result.message}`);
          }
        } else {
          skipCount++;
          console.log(`⏭️  [${clanTag}] ${clanName}: ${result.message}`);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${clanTag}] ${clanName}: Error - ${error.message}`);
      }
    }
    
    // Summary
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
    
    // Log to system collection for monitoring
    await db.collection('system_logs').insertOne({
      type: 'TERRITORY_INCOME_COLLECTION',
      timestamp: new Date(),
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
    
  } catch (error: any) {
    console.error('Fatal error during collection:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed');
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
