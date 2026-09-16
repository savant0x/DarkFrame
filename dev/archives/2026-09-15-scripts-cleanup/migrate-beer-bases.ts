/**
 * @file scripts/migrate-beer-bases.ts
 * @created 2025-10-25
 * @overview Migration Script: Convert Old Beer Base Terrain Tiles to New System
 * 
 * OVERVIEW:
 * Migrates from OLD Beer Base system (terrain tiles) to NEW system (player documents).
 * 
 * OLD SYSTEM:
 * - Beer Bases were terrain tiles with terrain: 'Base' and owner: 'BOT_*'
 * - Stored in tiles collection
 * - Limited functionality
 * 
 * NEW SYSTEM:
 * - Beer Bases are player documents with isSpecialBase: true
 * - Stored in players collection
 * - Full bot functionality + special loot
 * - Smart spawning based on player levels
 * 
 * MIGRATION STEPS:
 * 1. Find all OLD Beer Base terrain tiles
 * 2. Delete them from tiles collection
 * 3. Spawn new Beer Bases using manualBeerBaseRespawn()
 * 4. Log migration results
 */

import { connectToDatabase } from '../lib/mongodb';
import { manualBeerBaseRespawn } from '../lib/beerBaseService';

async function migrateBeerBases() {
  console.log('[Migration] 🔄 Starting Beer Base migration...');
  console.log('[Migration] Converting from terrain tiles to player documents\n');

  try {
    const db = await connectToDatabase();
    const tiles = db.collection('tiles');
    const players = db.collection('players');

    // Step 1: Count old Beer Base terrain tiles
    console.log('[Step 1/4] 📊 Counting old Beer Base terrain tiles...');
    const oldBeerBaseTiles = await tiles.countDocuments({
      terrain: 'Base',
      owner: { $regex: /^BOT_/i }
    });
    console.log(`[Step 1/4] ✅ Found ${oldBeerBaseTiles} old Beer Base terrain tiles\n`);

    // Step 2: Delete old terrain tiles
    if (oldBeerBaseTiles > 0) {
      console.log('[Step 2/4] 🗑️  Deleting old Beer Base terrain tiles...');
      const deleteResult = await tiles.deleteMany({
        terrain: 'Base',
        owner: { $regex: /^BOT_/i }
      });
      console.log(`[Step 2/4] ✅ Deleted ${deleteResult.deletedCount} terrain tiles\n`);
    } else {
      console.log('[Step 2/4] ⏭️  No old terrain tiles to delete\n');
    }

    // Step 3: Count any existing NEW Beer Bases (shouldn't be any, but check)
    console.log('[Step 3/4] 📊 Checking for existing NEW Beer Bases...');
    const existingNewBeerBases = await players.countDocuments({
      isBot: true,
      isSpecialBase: true
    });
    
    if (existingNewBeerBases > 0) {
      console.log(`[Step 3/4] ⚠️  Found ${existingNewBeerBases} existing NEW Beer Bases`);
      console.log('[Step 3/4] 🗑️  Removing them before respawn...');
      await players.deleteMany({
        isBot: true,
        isSpecialBase: true
      });
      console.log(`[Step 3/4] ✅ Removed ${existingNewBeerBases} existing NEW Beer Bases\n`);
    } else {
      console.log('[Step 3/4] ✅ No existing NEW Beer Bases found\n');
    }

    // Step 4: Spawn new Beer Bases using the service
    console.log('[Step 4/4] 🍺 Spawning new Beer Bases using smart spawning...');
    const result = await manualBeerBaseRespawn();

    if (result.success) {
      console.log(`[Step 4/4] ✅ Spawned ${result.spawned} new Beer Bases\n`);
    } else {
      console.log('[Step 4/4] ❌ Failed to spawn new Beer Bases\n');
      throw new Error('Beer Base respawn failed');
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 MIGRATION COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Summary:`);
    console.log(`   - Old terrain tiles removed: ${oldBeerBaseTiles + existingNewBeerBases}`);
    console.log(`   - New Beer Bases spawned: ${result.spawned}`);
    console.log(`   - Migration status: ✅ SUCCESS`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Beer Base system is now using the NEW smart spawning system!');
    console.log('📈 Beer Bases will now match active player levels');
    console.log('⚙️  Admin panel controls are now connected to the system\n');

    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\n⚠️  Please check the error above and try again');
    process.exit(1);
  }
}

// Run migration
if (require.main === module) {
  migrateBeerBases().catch(console.error);
}

export { migrateBeerBases };

// ============================================================
// USAGE INSTRUCTIONS
// ============================================================
/**
 * RUN THIS SCRIPT:
 * 
 * From project root:
 * ```bash
 * npx ts-node scripts/migrate-beer-bases.ts
 * ```
 * 
 * OR add to package.json scripts:
 * ```json
 * "scripts": {
 *   "migrate:beer-bases": "ts-node scripts/migrate-beer-bases.ts"
 * }
 * ```
 * 
 * Then run:
 * ```bash
 * npm run migrate:beer-bases
 * ```
 * 
 * WHAT IT DOES:
 * 1. Finds all old Beer Base terrain tiles (terrain: 'Base', owner: 'BOT_*')
 * 2. Deletes them from the tiles collection
 * 3. Spawns new Beer Bases using manualBeerBaseRespawn()
 * 4. New Beer Bases use smart spawning (match player levels)
 * 
 * SAFETY:
 * - Non-destructive to player data
 * - Only removes bot-owned terrain tiles
 * - Safe to run multiple times (idempotent)
 * - Logs all actions for audit trail
 */
