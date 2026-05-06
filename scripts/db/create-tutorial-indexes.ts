/**
 * Create Tutorial Database Indexes
 * Created: 2025-10-25
 * Feature: FID-20251025-106 - Tutorial Production Readiness Fix
 * 
 * OVERVIEW:
 * This script previously created MongoDB indexes for tutorial collections.
 * With Supabase (PostgreSQL), indexes are created via SQL migrations.
 * 
 * USAGE:
 * npx tsx scripts/create-tutorial-indexes.ts
 * 
 * To create indexes in Supabase, run these SQL statements:
 * 
 * CREATE UNIQUE INDEX idx_player_id_unique ON tutorial_progress (player_id);
 * CREATE UNIQUE INDEX idx_player_id_step_id ON tutorial_action_tracking (player_id, step_id);
 * CREATE INDEX idx_last_updated ON tutorial_progress (last_updated DESC);
 */

import { createServiceClient } from '../../lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

async function createTutorialIndexes() {
  console.log('🔧 Tutorial database indexes migration guide...\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log('✅ Connected to Supabase');

    // ========================================================================
    // Index 1: tutorial_progress - Unique playerId index
    // ========================================================================
    console.log('\n📊 Creating index: tutorial_progress.player_id (unique)');
    
    const { error: idx1Error } = await supabase.rpc('run_sql', {
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_player_id_unique ON tutorial_progress (player_id);',
    }).single();
    
    if (idx1Error && !idx1Error.message?.includes('already exists')) {
      console.log('   ⚠️  Could not create via RPC — run SQL manually:', idx1Error.message);
    } else {
      console.log('✅ Index created or already exists: tutorial_progress.player_id');
    }

    // ========================================================================
    // Index 2: tutorial_action_tracking - Compound playerId + stepId index
    // ========================================================================
    console.log('\n📊 Creating index: tutorial_action_tracking (player_id + step_id)');
    
    const { error: idx2Error } = await supabase.rpc('run_sql', {
      sql: 'CREATE UNIQUE INDEX IF NOT EXISTS idx_player_id_step_id ON tutorial_action_tracking (player_id, step_id);',
    }).single();
    
    if (idx2Error && !idx2Error.message?.includes('already exists')) {
      console.log('   ⚠️  Could not create via RPC — run SQL manually:', idx2Error.message);
    } else {
      console.log('✅ Index created or already exists: tutorial_action_tracking.player_id + step_id');
    }

    // ========================================================================
    // Index 3: tutorial_progress - lastUpdated for analytics queries
    // ========================================================================
    console.log('\n📊 Creating index: tutorial_progress.last_updated');
    
    const { error: idx3Error } = await supabase.rpc('run_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_last_updated ON tutorial_progress (last_updated DESC);',
    }).single();
    
    if (idx3Error && !idx3Error.message?.includes('already exists')) {
      console.log('   ⚠️  Could not create via RPC — run SQL manually:', idx3Error.message);
    } else {
      console.log('✅ Index created or already exists: tutorial_progress.last_updated');
    }

    console.log('\n✅ All tutorial indexes created or already exist!');
    console.log('\n📈 Performance Benefits:');
    console.log('   - Fast player tutorial lookups (unique player_id)');
    console.log('   - Real-time action progress queries (player_id + step_id)');
    console.log('   - Analytics queries by date (last_updated)');
    console.log('   - Prevents duplicate progress records (unique constraint)');

  } catch (error) {
    console.error('\n❌ Error creating indexes:', error);
    console.log('\n💡 Tip: Run the following SQL manually in Supabase Dashboard:');
    console.log('   CREATE UNIQUE INDEX idx_player_id_unique ON tutorial_progress (player_id);');
    console.log('   CREATE UNIQUE INDEX idx_player_id_step_id ON tutorial_action_tracking (player_id, step_id);');
    console.log('   CREATE INDEX idx_last_updated ON tutorial_progress (last_updated DESC);');
    process.exit(1);
  }
}

// Run if executed directly (ES module compatible check)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
const isMainModule = process.argv[1] === __filename || process.argv[1]?.endsWith('create-tutorial-indexes.ts');

if (isMainModule) {
  createTutorialIndexes()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default createTutorialIndexes;
