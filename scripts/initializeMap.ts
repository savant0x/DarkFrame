/**
 * @file scripts/initializeMap.ts
 * @created 2025-10-16
 * @overview One-time map initialization script
 * 
 * OVERVIEW:
 * Script to generate the game map. Can be run manually or as part of deployment.
 * Idempotent: safe to run multiple times.
 * 
 * Usage: npx tsx scripts/initializeMap.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { testConnection } from '../lib/mongodb';
import { initializeMap } from '../lib/mapGeneration';

/**
 * Main initialization function
 */
async function main() {
  console.log('🚀 DarkFrame Map Initialization');
  console.log('================================\n');
  
  try {
    // Test MongoDB connection
    console.log('📡 Testing MongoDB connection...');
    await testConnection();
    console.log('');
    
    // Initialize map
    await initializeMap();
    
    console.log('\n================================');
    console.log('✅ Initialization complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n================================');
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export default main;
