import { pgTable, varchar, smallint, timestamp, text, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const mutes = pgTable('mutes', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	moderatorId: varchar('moderator_id', { length: 20 }).notNull(),
	reason: varchar('reason', { length: 500 }).notNull(),
	expiresAt: timestamp('expires_at'),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	index('mutes_player_id_idx').on(table.playerId),
]);

export const bans = pgTable('bans', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	moderatorId: varchar('moderator_id', { length: 20 }).notNull(),
	reason: text('reason').notNull(),
	expiresAt: timestamp('expires_at'),
	createdAt: timestamp('created_at').notNull(),
	// Account-ban domain columns (admin ban flow). The table is SHARED with channel bans
	// (lib/moderationService: playerId + moderatorId = channelId); account rows carry
	// bannedBy and are distinguished from channel rows by that column being set.
	username: varchar('username', { length: 20 }),
	bannedBy: varchar('banned_by', { length: 20 }),
	bannedAt: timestamp('banned_at'),
	isPermanent: smallint('is_permanent').default(0),
	active: smallint('active').default(0),
}, (table) => [
	index('bans_player_id_idx').on(table.playerId),
	index('bans_username_active_idx').on(table.username, table.active),
]);

export const modLog = pgTable('mod_log', {
	id: varchar('id', { length: 24 }).primaryKey().$defaultFn(() => crypto.randomUUID().slice(0, 24)),
	moderatorId: varchar('moderator_id', { length: 20 }).notNull(),
	action: varchar('action', { length: 50 }).notNull(),
	targetId: varchar('target_id', { length: 24 }).notNull(),
	reason: text('reason'),
	details: text('details'),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	index('mod_log_moderator_created_idx').on(table.moderatorId, table.createdAt),
	index('mod_log_target_id_idx').on(table.targetId),
]);

export const warnings = pgTable('warnings', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	moderatorId: varchar('moderator_id', { length: 20 }).notNull(),
	reason: varchar('reason', { length: 500 }).notNull(),
	expired: smallint('expired').notNull().default(0),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	index('warnings_player_id_idx').on(table.playerId),
]);

// FID-20260917-012: player-facing chat report persistence. The ChatMessage
// stubs used to toast "reported" with no backend; reports now land here and
// surface via GET /api/admin/moderation?type=reports.
export const chatReports = pgTable('chat_reports', {
	id: varchar('id', { length: 24 }).primaryKey(),
	messageId: varchar('message_id', { length: 64 }).notNull(),
	channelId: varchar('channel_id', { length: 40 }).notNull(),
	reporterId: varchar('reporter_id', { length: 20 }).notNull(),
	reportedUserId: varchar('reported_user_id', { length: 20 }).notNull(),
	reason: varchar('reason', { length: 40 }).notNull(),
	details: text('details'),
	status: varchar('status', { length: 12 }).notNull().default('open'),
	createdAt: timestamp('created_at').notNull(),
	resolvedAt: timestamp('resolved_at'),
	resolvedBy: varchar('resolved_by', { length: 20 }),
}, (table) => [
	index('chat_reports_status_idx').on(table.status, table.createdAt),
	index('chat_reports_reported_idx').on(table.reportedUserId),
]);

// FID-20260917-012: GLOBAL block (operator decision - chat + DMs + social).
// Enforcement is server-side reads (blockService), so a block everywhere at
// once; no per-surface flags.
export const blockedUsers = pgTable('blocked_users', {
	id: varchar('id', { length: 24 }).primaryKey(),
	blockerId: varchar('blocker_id', { length: 20 }).notNull(),
	blockedId: varchar('blocked_id', { length: 20 }).notNull(),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	uniqueIndex('blocked_pair_unique').on(table.blockerId, table.blockedId),
	index('blocked_users_blocker_idx').on(table.blockerId),
]);

export const wordBlacklist = pgTable('word_blacklist', {
	id: varchar('id', { length: 24 }).primaryKey(),
	word: varchar('word', { length: 100 }).notNull(),
}, (table) => [
	uniqueIndex('word_blacklist_word_unique').on(table.word),
]);
