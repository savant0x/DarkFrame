import { pgTable, varchar, integer, smallint, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const chatMessages = pgTable('chat_messages', {
	id: varchar('id', { length: 24 }).primaryKey(),
	channelId: varchar('channel_id', { length: 30 }).notNull(),
	clanId: varchar('clan_id', { length: 24 }),
	senderId: varchar('sender_id', { length: 20 }).notNull(),
	senderUsername: varchar('sender_username', { length: 20 }).notNull(),
	senderLevel: integer('sender_level').notNull(),
	isVIP: smallint('is_vip').notNull().default(0),
	isNewbie: smallint('is_newbie').notNull().default(0),
	message: varchar('message', { length: 1000 }).notNull(),
	itemLinks: jsonb('item_links').notNull().$type<string[]>().default([]),
	mentions: jsonb('mentions').notNull().$type<string[]>().default([]),
	timestamp: timestamp('timestamp').notNull(),
	monthCategory: varchar('month_category', { length: 7 }).notNull(),
	edited: smallint('edited').notNull().default(0),
	editedAt: timestamp('edited_at'),
	deleted: smallint('deleted').notNull().default(0),
	deletedBy: varchar('deleted_by', { length: 20 }),
	deletionReason: varchar('deletion_reason', { length: 255 }),
}, (table) => [
	index('chat_messages_channel_timestamp_idx').on(table.channelId, table.timestamp),
	index('chat_messages_month_category_idx').on(table.monthCategory),
	index('chat_messages_sender_id_idx').on(table.senderId),
	index('chat_messages_clan_id_idx').on(table.clanId),
]);

export const chatReadStatus = pgTable('chat_read_status', {
	id: varchar('id', { length: 24 }).primaryKey(),
	channelId: varchar('channel_id', { length: 30 }).notNull(),
	userId: varchar('user_id', { length: 20 }).notNull(),
	lastReadMessageId: varchar('last_read_message_id', { length: 24 }),
	lastReadAt: timestamp('last_read_at').notNull(),
}, (table) => [
	index('chat_read_status_user_channel_idx').on(table.userId, table.channelId),
]);
