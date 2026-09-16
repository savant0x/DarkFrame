/**
 * Tutorial Timestamp Migration Script
 * Created: 2025-10-26
 * Feature: FID-20251026-003 - Tutorial System Refactor
 * 
 * OVERVIEW:
 * Migrates existing tutorial_progress documents to include currentStepStartedAt field.
 * This field enables proper per-step timing for auto-complete functionality.
 * 
 * USAGE (PowerShell):
 * ```powershell
 * # Dry-run mode (safe, no changes):
 * npx ts-node scripts/migrate-tutorial-timestamps.ts --dry-run
 * 
 * # Live migration:
 * npx ts-node scripts/migrate-tutorial-timestamps.ts
 * ```
 * 
 * USAGE (Bash/Linux):
 * ```bash
 * # Dry-run:
 * DRY_RUN=true npx ts-node scripts/migrate-tutorial-timestamps.ts
 * 
 * # Live:
 * npx ts-node scripts/migrate-tutorial-timestamps.ts
 * ```
 * 
 * WHAT IT DOES:
 * 1. Finds all tutorial_progress documents without currentStepStartedAt
 * 2. Sets currentStepStartedAt = lastUpdated (best approximation)
 * 3. Logs migration progress and results
 * 
 * SAFETY:
 * - Dry-run mode available (--dry-run flag)
 * - Only updates documents missing the field
 * - Uses lastUpdated as safe fallback value
 */

import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'darkframe';
// Check both NODE_ENV and explicit DRY_RUN for dry-run mode
// Usage: node -e "process.env.DRY_RUN='true'; require('./scripts/migrate-tutorial-timestamps.ts')"
// Or pass --dry-run as command line argument
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

console.log('📋 Configuration:');
console.log(`   MongoDB URI: ${MONGODB_URI ? 'Loaded from environment ✅' : 'Using default (localhost) ⚠️'}`);
console.log(`   Database: ${DB_NAME}`);
console.log(`   Mode: ${DRY_RUN ? 'DRY RUN 🧪' : 'LIVE ✍️'}`);
console.log('');

interface TutorialProgress {
  playerId: string;
  currentQuestId?: string;
  currentStepIndex: number;
  startedAt: Date;
  currentStepStartedAt?: Date;
  lastUpdated: Date;
  tutorialComplete: boolean;
  tutorialSkipped: boolean;
}

async function migrateTutorialTimestamps() {
  let client: MongoClient | null = null;
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected successfully');
    
    const db = client.db(DB_NAME);
    const progressCollection = db.collection<TutorialProgress>('tutorial_progress');
    
    console.log(`\n📊 Analyzing tutorial_progress collection...`);
    console.log(`   Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes will be made)' : '✍️ LIVE (documents will be updated)'}`);
    
    // Find all documents without currentStepStartedAt
    const documentsToMigrate = await progressCollection.find({
      currentStepStartedAt: { $exists: false }
    }).toArray();
    
    console.log(`\n📈 Migration Statistics:`);
    console.log(`   Total documents needing migration: ${documentsToMigrate.length}`);
    
    if (documentsToMigrate.length === 0) {
      console.log(`\n✅ No documents need migration. All up to date!`);
      return;
    }
    
    // Group by tutorial status for reporting
    const activeCount = documentsToMigrate.filter(d => !d.tutorialComplete && !d.tutorialSkipped).length;
    const completedCount = documentsToMigrate.filter(d => d.tutorialComplete).length;
    const skippedCount = documentsToMigrate.filter(d => d.tutorialSkipped).length;
    
    console.log(`   - Active tutorials: ${activeCount}`);
    console.log(`   - Completed tutorials: ${completedCount}`);
    console.log(`   - Skipped tutorials: ${skippedCount}`);
    
    if (DRY_RUN) {
      console.log(`\n🧪 DRY RUN - Sample documents that would be updated:`);
      documentsToMigrate.slice(0, 3).forEach((doc, index) => {
        console.log(`   ${index + 1}. Player: ${doc.playerId}`);
        console.log(`      Current step: ${doc.currentStepIndex} in quest ${doc.currentQuestId || 'NONE'}`);
        console.log(`      lastUpdated: ${doc.lastUpdated}`);
        console.log(`      Would set currentStepStartedAt: ${doc.lastUpdated}`);
      });
      
      if (documentsToMigrate.length > 3) {
        console.log(`\n   ... and ${documentsToMigrate.length - 3} more documents`);
      }
      console.log(`\n💡 Run without --dry-run flag to perform migration:`);
      console.log(`   npx ts-node scripts/migrate-tutorial-timestamps.ts`);
      return;
    }
    
    // Perform migration
    console.log(`\n🚀 Starting migration...`);
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const doc of documentsToMigrate) {
      try {
        // Set currentStepStartedAt to lastUpdated (best approximation)
        const result = await progressCollection.updateOne(
          { playerId: doc.playerId },
          {
            $set: {
              currentStepStartedAt: doc.lastUpdated
            }
          }
        );
        
        if (result.modifiedCount === 1) {
          successCount++;
          console.log(`   ✅ Migrated: ${doc.playerId}`);
        } else {
          failureCount++;
          console.log(`   ❌ Failed to migrate: ${doc.playerId} (no documents modified)`);
        }
      } catch (error) {
        failureCount++;
        console.error(`   ❌ Error migrating ${doc.playerId}:`, error);
      }
    }
    
    console.log(`\n📊 Migration Results:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);
    console.log(`   📈 Total processed: ${successCount + failureCount}`);
    
    if (failureCount > 0) {
      console.log(`\n⚠️ Some migrations failed. Check errors above.`);
    } else {
      console.log(`\n🎉 Migration completed successfully!`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration script error:', error);
    throw error;
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 MongoDB connection closed');
    }
  }
}

// Run migration
migrateTutorialTimestamps()
  .then(() => {
    console.log('\n✨ Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error);
    process.exit(1);
  });
