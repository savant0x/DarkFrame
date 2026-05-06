/**
 * @file lib/db/schemas/wmd.schema.ts
 * @created 2025-10-22
 * @overview Supabase Table Schema Definitions for WMD System
 * 
 * OVERVIEW:
 * Defines all Supabase table schemas and indexes
 * for the Weapons of Mass Destruction system. Includes 12 tables
 * covering missiles, defense, intelligence, research, and notifications.
 * 
 * Tables:
 * - wmd_player_research: Player research progress tracking
 * - wmd_missiles: Missile inventory and assembly
 * - wmd_missile_components: Component inventory tracking
 * - wmd_defense_batteries: Defense battery installations
 * - wmd_clan_defense_grid: Clan defense pooling
 * - wmd_spies: Spy agent roster
 * - wmd_spy_missions: Active and completed missions
 * - wmd_launch_history: Missile launch records
 * - wmd_interception_attempts: Defense interception logs
 * - wmd_sabotage_events: Sabotage operation records
 * - wmd_notifications: System notifications and alerts
 * - wmd_clan_votes: Authorization voting records
 * 
 * Dependencies:
 * - Supabase for database access
 * - /types/wmd for type definitions
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Initialize all WMD collections with proper schemas and indexes
 * In Supabase, schema is managed via SQL migrations. This function
 * verifies tables exist and logs their status.
 */
export async function initializeWMDCollections(): Promise<void> {
  const client = createServiceClient();
  const tables = [
    'wmd_player_research',
    'wmd_missiles',
    'wmd_missile_components',
    'wmd_defense_batteries',
    'wmd_clan_defense_grid',
    'wmd_spies',
    'wmd_spy_missions',
    'wmd_launch_history',
    'wmd_interception_attempts',
    'wmd_sabotage_events',
    'wmd_notifications',
    'wmd_clan_votes',
  ] as const;

  for (const table of tables) {
    const { error } = await client.from(table).select('id', { count: 'exact', head: true });
    if (error) {
      console.warn(`⚠️ Table ${table} may not exist: ${error.message}`);
    } else {
      console.log(`✅ Verified table: ${table}`);
    }
  }

  console.log('✅ All WMD collections checked');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get collection statistics
 */
export async function getWMDCollectionStats(supabase?: SupabaseClient<any>): Promise<Record<string, any>> {
  const client = supabase || createServiceClient();
  const stats: Record<string, any> = {};
  
  const tableNames = [
    'wmd_player_research',
    'wmd_missiles',
    'wmd_missile_components',
    'wmd_defense_batteries',
    'wmd_clan_defense_grid',
    'wmd_spies',
    'wmd_spy_missions',
    'wmd_launch_history',
    'wmd_interception_attempts',
    'wmd_sabotage_events',
    'wmd_notifications',
    'wmd_clan_votes',
  ] as const;
  
  for (const name of tableNames) {
    try {
      const { count, error } = await client.from(name).select('id', { count: 'exact', head: true });
      stats[name] = { documentCount: count || 0, error: error?.message };
    } catch (err: unknown) {
      stats[name] = { error: 'Table access failed: ' + (err instanceof Error ? err.message : 'unknown') };
    }
  }
  
  return stats;
}

// ============================================================================
// FOOTER
// ============================================================================

/**
 * IMPLEMENTATION NOTES:
 * - Table schemas managed through Supabase SQL migrations
 * - Indexes defined in Supabase dashboard or migration SQL files
 * - This file provides runtime verification utilities
 * - All column names use snake_case convention
 * 
 * TESTING:
 * - Run initializeWMDCollections() to verify tables exist
 * - Check Supabase dashboard for schema validation
 * - Run SQL migrations for indexes and constraints
 * 
 * MAINTENANCE:
 * - Monitor query performance in Supabase dashboard
 * - Add indexes via SQL migration files
 * - Archive old data (launch_history, notifications) via scheduled jobs
 */
