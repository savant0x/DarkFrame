/**
 * @file scripts/check-user.ts
 * @created 2025-10-31
 * @overview Script to display user account information
 * 
 * Usage:
 *   tsx scripts/check-user.ts <username>
 *   
 * Example:
 *   tsx scripts/check-user.ts FAME
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { createServiceClient } from '../../lib/supabase/server';

async function checkUser(username: string): Promise<void> {
  console.log('\n👤 User Account Information\n');

  try {
    const supabase = createServiceClient();
    const { data: user, error } = await supabase
      .from('players')
      .select('username, email, level, is_admin, created_at, current_x, current_y')
      .eq('username', username)
      .single();

    if (error || !user) {
      console.error(`❌ User "${username}" not found in database\n`);
      process.exit(1);
    }

    console.log(`Username:     ${user.username}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Level:        ${user.level || 1}`);
    console.log(`Admin:        ${user.is_admin ? 'Yes ✓' : 'No'}`);
    console.log(`Position:     (${user.current_x || 0}, ${user.current_y || 0})`);
    console.log(`Created:      ${user.created_at ? new Date(user.created_at).toLocaleString() : 'Unknown'}`);
    console.log();

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error checking user:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.error('\n❌ Usage: tsx scripts/check-user.ts <username>\n');
  console.error('Example: tsx scripts/check-user.ts FAME\n');
  process.exit(1);
}

const username = args[0];

if (!username) {
  console.error('\n❌ Username is required\n');
  process.exit(1);
}

// Run the user check
checkUser(username);
