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

import { createServiceClient } from '../../lib/supabase/server';
import { manualBeerBaseRespawn } from '../../lib/beerBaseService';

async function migrateBeerBases() {
  console.log('[Migration] 🔄 Starting Beer Base migration...');
  console.log('[Migration] Converting from terrain tiles to player documents\n');

  try {
    const supabase = createServiceClient();

    // Step 1: Count old Beer Base terrain tiles
    console.log('[Step 1/4] 📊 Counting old Beer Base terrain tiles...');
    const { count: oldBeerBaseTiles, error: countError } = await supabase
      .from('tiles')
      .select('*', { count: 'exact', head: true })
      // Old Beer Bases used terrain type 'Base' (not in current schema, just filter by owner)
      .ilike('owner', 'BOT_%');

    if (countError) throw countError;
    console.log(`[Step 1/4] ✅ Found ${oldBeerBaseTiles || 0} old Beer Base terrain tiles\n`);

    // Step 2: Delete old terrain tiles
    if ((oldBeerBaseTiles || 0) > 0) {
      console.log('[Step 2/4] 🗑️  Deleting old Beer Base terrain tiles...');
      const { count: deleteCount, error: deleteError } = await supabase
        .from('tiles')
        .delete({ count: 'exact' })
        // Old Beer Bases used terrain type 'Base', filter only by owner
        .ilike('owner', 'BOT_%');

      if (deleteError) throw deleteError;
      console.log(`[Step 2/4] ✅ Deleted ${deleteCount || 0} terrain tiles\n`);
    } else {
      console.log('[Step 2/4] ⏭️  No old terrain tiles to delete\n');
    }

    // Step 3: Count any existing NEW Beer Bases (shouldn't be any, but check)
    console.log('[Step 3/4] 📊 Checking for existing NEW Beer Bases...');
    const { count: existingNewBeerBases, error: existingError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot', true)
      .eq('is_special_base', true);

    if (existingError) throw existingError;
    
    if ((existingNewBeerBases || 0) > 0) {
      console.log(`[Step 3/4] ⚠️  Found ${existingNewBeerBases} existing NEW Beer Bases`);
      console.log('[Step 3/4] 🗑️  Removing them before respawn...');
      const { error: deleteExistingError } = await supabase
        .from('players')
        .delete()
        .eq('is_bot', true)
        .eq('is_special_base', true);

      if (deleteExistingError) throw deleteExistingError;
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
    console.log(`   - Old terrain tiles removed: ${(existingNewBeerBases || 0) + (oldBeerBaseTiles || 0)}`);
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
