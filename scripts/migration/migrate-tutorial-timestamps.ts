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

import { createServiceClient } from '../../lib/supabase/server';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Configuration
const DRY_RUN = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';

console.log('📋 Configuration:');
console.log(`   Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Loaded ✅' : 'Missing ⚠️'}`);
console.log(`   Mode: ${DRY_RUN ? 'DRY RUN 🧪' : 'LIVE ✍️'}`);
console.log('');

interface TutorialProgress {
  player_id: string;
  current_quest_id?: string;
  current_step_index: number;
  started_at: string;
  current_step_started_at?: string;
  last_updated: string;
  tutorial_complete: boolean;
  tutorial_skipped: boolean;
}

async function migrateTutorialTimestamps() {
  try {
    console.log('🔌 Connecting to Supabase...');
    const supabase = createServiceClient();
    console.log('✅ Connected successfully');
    
    console.log(`\n📊 Analyzing tutorial_progress table...`);
    console.log(`   Mode: ${DRY_RUN ? '🧪 DRY RUN (no changes will be made)' : '✍️ LIVE (documents will be updated)'}`);
    
    // Find all documents without current_step_started_at
    const { data: documentsToMigrate, error: findError } = await supabase
      .from('tutorial_progress')
      .select('*')
      .is('current_step_started_at', null);
    
    if (findError) {
      console.error('❌ Error finding documents:', findError);
      throw findError;
    }
    
    console.log(`\n📈 Migration Statistics:`);
    console.log(`   Total documents needing migration: ${documentsToMigrate.length}`);
    
    if (documentsToMigrate.length === 0) {
      console.log(`\n✅ No documents need migration. All up to date!`);
      return;
    }
    
    // Group by tutorial status for reporting
    const activeCount = documentsToMigrate.filter(d => !d.tutorial_complete && !d.tutorial_skipped).length;
    const completedCount = documentsToMigrate.filter(d => d.tutorial_complete).length;
    const skippedCount = documentsToMigrate.filter(d => d.tutorial_skipped).length;
    
    console.log(`   - Active tutorials: ${activeCount}`);
    console.log(`   - Completed tutorials: ${completedCount}`);
    console.log(`   - Skipped tutorials: ${skippedCount}`);
    
    if (DRY_RUN) {
      console.log(`\n🧪 DRY RUN - Sample documents that would be updated:`);
      documentsToMigrate.slice(0, 3).forEach((doc, index) => {
        console.log(`   ${index + 1}. Player: ${doc.player_username}`);
        console.log(`      Current step: ${doc.current_step_index} in quest ${doc.current_quest_id || 'NONE'}`);
        console.log(`      last_updated: ${doc.last_updated}`);
        console.log(`      Would set current_step_started_at: ${doc.last_updated}`);
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
        // Set current_step_started_at to last_updated (best approximation)
        const { error: updateError } = await supabase
          .from('tutorial_progress')
          .update({ current_step_started_at: doc.last_updated })
          .eq('player_username', doc.player_username);
        
        if (!updateError) {
          successCount++;
          console.log(`   ✅ Migrated: ${doc.player_username}`);
        } else {
          failureCount++;
          console.log(`   ❌ Failed to migrate: ${doc.player_username} (${updateError.message})`);
        }
      } catch (error) {
        failureCount++;
        console.error(`   ❌ Error migrating ${doc.player_username}:`, error);
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
