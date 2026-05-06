/**
 * Database Index Creation Script
 * 
 * Creates indexes for optimal query performance across all collections.
 * Previously used MongoDB indexes — now provides SQL for Supabase (PostgreSQL).
 * 
 * Created: 2025-10-18
 * Feature: FID-20251018-040 (Database Query Optimization)
 * 
 * OVERVIEW:
 * This script outputs SQL statements to create equivalent PostgreSQL indexes
 * for the DarkFrame game. Run the SQL in your Supabase SQL editor.
 * 
 * Usage:
 *   npm run create-indexes
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

interface IndexDefinition {
  table: string;
  columns: string[];
  name: string;
  unique: boolean;
  description: string;
}

/**
 * Index definitions optimized for DarkFrame query patterns
 * Column names are converted to snake_case for Supabase
 */
const indexes: IndexDefinition[] = [
  // ========================================
  // CLANS TABLE
  // ========================================
  {
    table: 'clans',
    columns: ['level DESC', 'power DESC'],
    name: 'level_power_leaderboard',
    unique: false,
    description: 'Optimize clan leaderboard queries (sorted by level desc, then power desc)',
  },
  {
    table: 'clans',
    columns: ['power DESC'],
    name: 'power_leaderboard',
    unique: false,
    description: 'Optimize power-based leaderboard queries',
  },
  {
    table: 'clans',
    columns: ['territory_count DESC'],
    name: 'territory_leaderboard',
    unique: false,
    description: 'Optimize territory count leaderboard',
  },
  {
    table: 'clans',
    columns: ['total_wealth DESC'],
    name: 'wealth_leaderboard',
    unique: false,
    description: 'Optimize wealth leaderboard',
  },

  // ========================================
  // CLAN_TERRITORIES TABLE
  // ========================================
  {
    table: 'clan_territories',
    columns: ['clan_id', 'x', 'y'],
    name: 'clan_territory_lookup',
    unique: false,
    description: 'Fast lookup of clan territories and adjacency checks',
  },
  {
    table: 'clan_territories',
    columns: ['x', 'y'],
    name: 'coordinate_lookup',
    unique: false,
    description: 'Fast lookup by coordinates (who owns this tile)',
  },
  {
    table: 'clan_territories',
    columns: ['clan_id'],
    name: 'clan_territories_list',
    unique: false,
    description: 'Fast retrieval of all territories for a clan',
  },

  // ========================================
  // PLAYERS TABLE
  // ========================================
  {
    table: 'players',
    columns: ['clan_id', 'clan_role'],
    name: 'clan_members_by_role',
    unique: false,
    description: 'Retrieve clan members filtered by role',
  },
  {
    table: 'players',
    columns: ['level DESC'],
    name: 'player_level_leaderboard',
    unique: false,
    description: 'Player leaderboard by level',
  },
  {
    table: 'players',
    columns: ['stat_battles_won DESC'],
    name: 'player_kills_leaderboard',
    unique: false,
    description: 'Player leaderboard by kills',
  },
  {
    table: 'players',
    columns: ['username'],
    name: 'username_lookup',
    unique: true,
    description: 'Fast username lookup (unique constraint)',
  },
  {
    table: 'players',
    columns: ['email'],
    name: 'email_lookup_unique',
    unique: true,
    description: 'Fast email lookup for login (unique constraint)',
  },

  // ========================================
  // TUTORIAL SYSTEM TABLES
  // ========================================
  {
    table: 'tutorial_progress',
    columns: ['player_id'],
    name: 'player_tutorial_progress',
    unique: true,
    description: 'Fast lookup of player tutorial progress (unique constraint)',
  },
  {
    table: 'tutorial_progress',
    columns: ['tutorial_complete', 'completed_at DESC'],
    name: 'completed_tutorials',
    unique: false,
    description: 'Analytics: find completed tutorials sorted by completion date',
  },
  {
    table: 'tutorial_progress',
    columns: ['current_quest_id', 'tutorial_skipped'],
    name: 'active_quest_tracking',
    unique: false,
    description: 'Fast lookup of players on specific quest (for analytics)',
  },
  {
    table: 'tutorial_action_tracking',
    columns: ['player_id', 'step_id'],
    name: 'player_step_tracking',
    unique: true,
    description: 'Fast lookup of action tracking for specific step (unique constraint)',
  },
  {
    table: 'tutorial_action_tracking',
    columns: ['last_updated'],
    name: 'stale_tracking_cleanup',
    unique: false,
    description: 'Find stale action tracking records (for cleanup)',
  },
];

/**
 * Output SQL statements for Supabase index creation
 */
function outputIndexSQL(): void {
  console.log('🚀 Supabase Index creation SQL for DarkFrame database...\n');
  console.log('-- Copy the following SQL and run in your Supabase SQL editor:\n');

  for (const indexDef of indexes) {
    const uniqueClause = indexDef.unique ? 'UNIQUE ' : '';
    const columnsSQL = indexDef.columns.join(', ');
    const sql = `CREATE ${uniqueClause}INDEX IF NOT EXISTS ${indexDef.name} ON ${indexDef.table} (${columnsSQL});`;
    console.log(`-- ${indexDef.description}`);
    console.log(sql);
    console.log();
  }

  console.log('-- =====================================');
  console.log(`-- Total indexes: ${indexes.length}`);
  console.log('-- =====================================');
}

// Run the script
outputIndexSQL();
