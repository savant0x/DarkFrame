/**
 * @file scripts/cleanup-duplicate-users.ts
 * @created 2025-02-01
 * @overview Script to remove duplicate test users (Fame, demo)
 * 
 * OVERVIEW:
 * Removes duplicate test accounts that are not the actual admin user.
 * Keeps: FAME (admin)
 * Removes: Fame, demo
 */

import { createServiceClient } from '../../lib/supabase/server';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment variables');
}

async function cleanupDuplicateUsers() {
  const supabase = createServiceClient();
  
  try {
    console.log('📡 Connected to Supabase');
    
    // Find duplicate users
    const { data: duplicates, error: findError } = await supabase
      .from('players')
      .select('*')
      .in('username', ['Fame', 'demo']);
    
    if (findError) {
      console.error('❌ Error finding duplicates:', findError);
      throw findError;
    }
    
    console.log(`\n🔍 Found ${duplicates.length} duplicate users:`);
    duplicates.forEach(user => {
      console.log(`  - ${user.username} (Level ${user.level})`);
    });
    
    // Delete duplicates
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .in('username', ['Fame', 'demo']);
    
    if (deleteError) {
      console.error('❌ Error deleting duplicates:', deleteError);
      throw deleteError;
    }
    
    console.log(`\n✅ Deleted duplicate users`);
    
    // Verify FAME still exists
    const { data: admin, error: adminError } = await supabase
      .from('players')
      .select('*')
      .eq('username', 'FAME')
      .single();
    
    if (admin) {
      console.log(`\n👑 Admin user "FAME" confirmed (Level ${admin.level})`);
    } else {
      console.log('\n⚠️  Warning: Admin user "FAME" not found!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    console.log('\n📡 Cleanup complete');
  }
}

// Run script
cleanupDuplicateUsers()
  .then(() => {
    console.log('\n✨ Cleanup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  });
