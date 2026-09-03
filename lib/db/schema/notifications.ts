import { pgTable, varchar, smallint, timestamp, jsonb, index, text } from 'drizzle-orm/pg-core';
import type { WmdAlertData } from '@/lib/wmd/admin/alert.types';

/**
 * Notification tables (FID-20260903-002) — designed from
 * lib/wmd/admin/alertService.ts call sites.
 */

export const playerNotifications = pgTable('player_notifications', {
  id: varchar('id', { length: 50 }).primaryKey(),
  playerId: varchar('player_id', { length: 20 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  alertId: varchar('alert_id', { length: 50 }),
  title: varchar('title', { length: 200 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  read: smallint('read').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  index('player_notifications_player_idx').on(table.playerId),
  index('player_notifications_read_idx').on(table.read),
  index('player_notifications_created_idx').on(table.createdAt),
]);

export const adminDashboardNotifications = pgTable('admin_dashboard_notifications', {
  id: varchar('id', { length: 50 }).primaryKey(),
  alertId: varchar('alert_id', { length: 50 }),
  type: varchar('type', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  data: jsonb('data').$type<WmdAlertData>(),
  read: smallint('read').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  index('admin_dash_notif_read_idx').on(table.read),
  index('admin_dash_notif_created_idx').on(table.createdAt),
]);

export const emailQueue = pgTable('email_queue', {
  id: varchar('id', { length: 50 }).primaryKey(),
  to: varchar('to', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 500 }).notNull(),
  body: text('body').notNull(),
  alertId: varchar('alert_id', { length: 50 }),
  status: varchar('status', { length: 20 }).notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  index('email_queue_status_idx').on(table.status),
  index('email_queue_created_idx').on(table.createdAt),
]);
