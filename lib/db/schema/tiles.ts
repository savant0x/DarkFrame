import { pgTable, varchar, smallint, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import type { HarvestRecord } from '@/types/game.types';

export const tiles = pgTable('tiles', {
	x: smallint('x').notNull(),
	y: smallint('y').notNull(),
	terrain: varchar('terrain', { length: 20 }).notNull(),
	occupiedByBase: smallint('occupied_by_base'),
	baseOwner: varchar('base_owner', { length: 20 }),
	baseGreeting: varchar('base_greeting', { length: 500 }),
	lastHarvestedBy: jsonb('last_harvested_by').$type<HarvestRecord[]>(),
	bankType: varchar('bank_type', { length: 20 }),
	hasFlagBearer: smallint('has_flag_bearer'),
	hasTrail: smallint('has_trail'),
	trailTimestamp: timestamp('trail_timestamp'),
	trailExpiresAt: timestamp('trail_expires_at'),
}, (table) => [
	primaryKey({ columns: [table.x, table.y], name: 'tiles_pk' }),
]);
