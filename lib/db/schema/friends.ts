import { pgTable, varchar, smallint, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const friends = pgTable('friends', {
	id: varchar('id', { length: 24 }).primaryKey(),
	userId: varchar('user_id', { length: 20 }).notNull(),
	friendId: varchar('friend_id', { length: 20 }).notNull(),
	status: varchar('status', { length: 20 }).notNull(),
	initiatedBy: varchar('initiated_by', { length: 20 }).notNull(),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	isBlocked: smallint('is_blocked'),
	blockedBy: varchar('blocked_by', { length: 20 }),
}, (table) => [
	uniqueIndex('friends_user_friend_status_unique').on(table.userId, table.friendId, table.status),
	index('friends_friend_user_status_idx').on(table.friendId, table.userId, table.status),
	index('friends_status_created_idx').on(table.status, table.createdAt),
]);

export const friendRequests = pgTable('friend_requests', {
	id: varchar('id', { length: 24 }).primaryKey(),
	from: varchar('from_user', { length: 20 }).notNull(),
	to: varchar('to_user', { length: 20 }).notNull(),
	status: varchar('status', { length: 20 }).notNull().default('pending'),
	message: varchar('message', { length: 200 }),
	createdAt: timestamp('created_at').notNull(),
	respondedAt: timestamp('responded_at'),
	expiresAt: timestamp('expires_at'),
}, (table) => [
	uniqueIndex('friend_requests_from_to_status_unique').on(table.from, table.to, table.status),
	index('friend_requests_to_status_created_idx').on(table.to, table.status, table.createdAt),
	index('friend_requests_from_status_idx').on(table.from, table.status),
	index('friend_requests_expires_at_idx').on(table.expiresAt),
]);
