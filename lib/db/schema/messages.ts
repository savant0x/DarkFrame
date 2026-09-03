import { pgTable, varchar, smallint, timestamp, jsonb, text, integer, index } from 'drizzle-orm/pg-core';

export const conversations = pgTable('conversations', {
	id: varchar('id', { length: 24 }).primaryKey(),
	participants: jsonb('participants').notNull().$type<string[]>(),
	participantDetails: jsonb('participant_details').$type<any>(),
	lastMessageContent: varchar('last_message_content', { length: 1000 }),
	lastMessageSenderId: varchar('last_message_sender_id', { length: 20 }),
	lastMessageCreatedAt: timestamp('last_message_created_at'),
	lastMessageStatus: varchar('last_message_status', { length: 20 }),
	unreadCount: jsonb('unread_count').notNull().$type<Record<string, number>>().default({}),
	createdAt: timestamp('created_at').notNull(),
	updatedAt: timestamp('updated_at').notNull(),
	isArchived: jsonb('is_archived').$type<Record<string, boolean>>(),
	isPinned: jsonb('is_pinned').$type<Record<string, boolean>>(),
	metadataTotalMessages: integer('metadata_total_messages'),
	metadataFirstMessageAt: timestamp('metadata_first_message_at'),
	metadataMuteUntil: jsonb('metadata_mute_until').$type<Record<string, string>>(),
}, (table) => [
	index('conversations_updated_at_idx').on(table.updatedAt),
]);

export const messages = pgTable('messages', {
	id: varchar('id', { length: 24 }).primaryKey(),
	conversationId: varchar('conversation_id', { length: 24 }).notNull(),
	senderId: varchar('sender_id', { length: 20 }).notNull(),
	recipientId: varchar('recipient_id', { length: 20 }).notNull(),
	content: varchar('content', { length: 1000 }).notNull(),
	contentType: varchar('content_type', { length: 20 }).notNull().default('text'),
	status: varchar('status', { length: 20 }).notNull().default('sent'),
	createdAt: timestamp('created_at').notNull(),
	readAt: timestamp('read_at'),
	editedAt: timestamp('edited_at'),
	deletedAt: timestamp('deleted_at'),
	metadataOriginalContent: varchar('metadata_original_content', { length: 1000 }),
	metadataEditHistory: jsonb('metadata_edit_history').$type<any[]>(),
	metadataSystemType: varchar('metadata_system_type', { length: 20 }),
	metadataRelatedEntityId: varchar('metadata_related_entity_id', { length: 50 }),
}, (table) => [
	index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
	index('messages_recipient_status_idx').on(table.recipientId, table.status),
	index('messages_deleted_at_idx').on(table.deletedAt),
]);
