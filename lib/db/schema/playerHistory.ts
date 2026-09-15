import { pgTable, varchar, integer, timestamp, primaryKey, index } from 'drizzle-orm/pg-core';

/**
 * FID-20260914-009 Phase B: player level snapshots for predictive Beer Base
 * spawning (lib/playerHistoryService.ts). Real home for the daily snapshot
 * cron — the service previously wrote to the unmapped `playerLevelHistory`
 * collection name, so every insert silently vanished since the pivot.
 *
 * The drizzle export identifier is deliberately `playerLevelHistory` (the
 * exact name the service addressed), so the shim's registry resolves it
 * directly — the service keeps its collection-style access with no alias
 * entry needed.
 */
export const playerLevelHistory = pgTable(
	'player_level_history',
	{
		/** players.username — stable, joinable, human-auditable (the Mongo-era _id died with the pivot). */
		username: varchar('username', { length: 20 }).notNull(),
		level: integer('level').notNull(),
		capturedAt: timestamp('captured_at').notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.username, table.capturedAt], name: 'player_level_history_pk' }),
		index('player_level_history_captured_idx').on(table.capturedAt),
		// (username, captured_at) is also the compound index the service's
		// per-user history scans want — the PK provides it directly.
	]
);
