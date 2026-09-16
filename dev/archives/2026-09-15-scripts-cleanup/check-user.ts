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

import { getCollection } from '../lib/mongodb';
import type { Player } from '../types/game.types';

async function checkUser(username: string): Promise<void> {
  console.log('\n👤 User Account Information\n');

  try {
    const playersCollection = await getCollection<Player>('players');
    
    const user = await playersCollection.findOne(
      { username },
      { 
        projection: { 
          username: 1, 
          email: 1, 
          level: 1, 
          isAdmin: 1,
          lastActive: 1,
          createdAt: 1,
          currentPosition: 1
        } 
      }
    );

    if (!user) {
      console.error(`❌ User "${username}" not found in database\n`);
      process.exit(1);
    }

    console.log(`Username:     ${user.username}`);
    console.log(`Email:        ${user.email}`);
    console.log(`Level:        ${user.level || 1}`);
    console.log(`Admin:        ${user.isAdmin ? 'Yes ✓' : 'No'}`);
    console.log(`Position:     (${user.currentPosition?.x || 0}, ${user.currentPosition?.y || 0})`);
    console.log(`Last Active:  ${user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}`);
    console.log(`Created:      ${user.createdAt ? new Date(user.createdAt).toLocaleString() : 'Unknown'}`);
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
