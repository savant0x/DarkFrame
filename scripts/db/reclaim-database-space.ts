/**
 * Reclaim Database Storage Space Script
 * Created: 2025-10-25
 * 
 * PURPOSE:
 * Guide for reclaiming storage space in Supabase after mass deletion.
 * 
 * NOTE:
 * Supabase (PostgreSQL) handles storage differently than MongoDB.
 * After large deletions, run VACUUM to reclaim space:
 * 
 * SQL to run in Supabase Dashboard:
 *   VACUUM FULL players;
 * 
 * Or to just update statistics:
 *   VACUUM ANALYZE players;
 * 
 * USAGE:
 * npx tsx scripts/reclaim-database-space.ts
 */

import { createServiceClient } from '../../lib/supabase/server';

async function reclaimSpace() {
  console.log('🔄 [STORAGE RECLAIM] Storage reclamation guide...\n');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
  }
  
  const supabase = createServiceClient();
  
  try {
    console.log('✅ Connected to Supabase\n');
    
    // Get current document counts
    console.log('📊 Current Database Stats:');
    
    const { count: docCount, error: countError } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting count:', countError);
      process.exit(1);
    }
    
    console.log(`   Players table rows: ${docCount ?? 0}\n`);
    
    console.log('💡 To reclaim storage space in Supabase (PostgreSQL), run this SQL:');
    console.log('   In Supabase Dashboard → SQL Editor → Run:');
    console.log('');
    console.log('   VACUUM ANALYZE players;');
    console.log('');
    console.log('   For full reclamation (locks the table briefly):');
    console.log('   VACUUM FULL players;');
    console.log('');
    console.log('✅ Storage reclamation guide complete');
    
  } catch (error) {
    console.error('❌ Storage check failed:', error);
    process.exit(1);
  }
}

reclaimSpace();
