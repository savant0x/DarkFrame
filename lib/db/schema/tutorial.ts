import { pgTable, varchar, integer, smallint, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const tutorialProgress = pgTable('tutorial_progress', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	currentQuestId: varchar('current_quest_id', { length: 50 }),
	currentStepIndex: integer('current_step_index').notNull().default(0),
	completedQuests: jsonb('completed_quests').notNull().$type<string[]>().default([]),
	completedSteps: jsonb('completed_steps').notNull().$type<string[]>().default([]),
	skippedQuests: jsonb('skipped_quests').notNull().$type<string[]>().default([]),
	claimedRewards: jsonb('claimed_rewards').notNull().$type<string[]>().default([]),
	tutorialSkipped: smallint('tutorial_skipped').notNull().default(0),
	tutorialDeclined: smallint('tutorial_declined'),
	tutorialComplete: smallint('tutorial_complete').notNull().default(0),
	startedAt: timestamp('started_at').notNull(),
	currentStepStartedAt: timestamp('current_step_started_at'),
	completedAt: timestamp('completed_at'),
	declinedAt: timestamp('declined_at'),
	lastUpdated: timestamp('last_updated').notNull(),
	totalStepsCompleted: integer('total_steps_completed').notNull().default(0),
	totalTimeSpent: integer('total_time_spent').notNull().default(0),
}, (table) => [
	uniqueIndex('tutorial_progress_player_id_unique').on(table.playerId),
	index('tutorial_progress_complete_idx').on(table.tutorialComplete, table.completedAt),
	index('tutorial_progress_quest_skipped_idx').on(table.currentQuestId, table.tutorialSkipped),
]);

export const tutorialActionTracking = pgTable('tutorial_action_tracking', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	stepId: varchar('step_id', { length: 50 }).notNull(),
	actionType: varchar('action_type', { length: 30 }).notNull(),
	completed: smallint('completed').notNull().default(0),
	lastUpdated: timestamp('last_updated').notNull(),
}, (table) => [
	uniqueIndex('tutorial_action_player_step_unique').on(table.playerId, table.stepId),
	index('tutorial_action_last_updated_idx').on(table.lastUpdated),
]);
