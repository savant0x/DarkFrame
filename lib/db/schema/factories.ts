import { pgTable, varchar, integer, numeric, timestamp, smallint, primaryKey, index } from 'drizzle-orm/pg-core';

export const factories = pgTable('factories', {
	x: smallint('x').notNull(),
	y: smallint('y').notNull(),
	owner: varchar('owner', { length: 20 }),
	defense: integer('defense').notNull().default(0),
	level: integer('level').notNull().default(1),
	slots: integer('slots').notNull().default(0),
	usedSlots: integer('used_slots').notNull().default(0),
	productionRate: numeric('production_rate', { precision: 5, scale: 2 }).notNull().default('0'),
	lastSlotRegen: timestamp('last_slot_regen').notNull(),
	lastResourceGeneration: timestamp('last_resource_generation'),
	lastAttackedBy: varchar('last_attacked_by', { length: 20 }),
	lastAttackTime: timestamp('last_attack_time'),
}, (table) => [
	primaryKey({ columns: [table.x, table.y], name: 'factories_pk' }),
	index('factories_owner_idx').on(table.owner),
]);
