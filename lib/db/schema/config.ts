import { pgTable, varchar, integer, smallint, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const migrations = pgTable('migrations', {
	id: varchar('id', { length: 100 }).primaryKey(),
	appliedAt: timestamp('applied_at').notNull(),
	details: jsonb('details').$type<any>(),
});

export const gameConfig = pgTable('game_config', {
	id: varchar('id', { length: 24 }).primaryKey(),
	type: varchar('type', { length: 30 }).notNull(),
	config: jsonb('config').notNull().$type<any>(),
}, (table) => [
	index('game_config_type_idx').on(table.type),
]);

export const botConfig = pgTable('bot_config', {
	id: varchar('id', { length: 24 }).primaryKey(),
	spawnRate: integer('spawn_rate').notNull(),
	totalBots: integer('total_bots').notNull(),
	lastSpawn: timestamp('last_spawn'),
});

export const flags = pgTable('flags', {
	id: varchar('id', { length: 24 }).primaryKey(),
	currentHolder: varchar('current_holder', { length: 24 }),
	currentHolderUsername: varchar('current_holder_username', { length: 20 }),
	lastCapturedAt: timestamp('last_captured_at'),
	lastCapturedBy: varchar('last_captured_by', { length: 20 }),
	totalCaptures: integer('total_captures').notNull().default(0),
});

export const shrineBlessings = pgTable('shrine_blessings', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	tier: varchar('tier', { length: 20 }).notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	yieldBonus: integer('yield_bonus').notNull().default(0),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	index('shrine_blessings_player_id_idx').on(table.playerId),
	index('shrine_blessings_expires_at_idx').on(table.expiresAt),
]);

export const achievements = pgTable('achievements', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	achievementId: varchar('achievement_id', { length: 50 }).notNull(),
	name: varchar('name', { length: 100 }).notNull(),
	category: varchar('category', { length: 30 }).notNull(),
	rarity: varchar('rarity', { length: 20 }).notNull(),
	unlockedAt: timestamp('unlocked_at').notNull(),
}, (table) => [
	index('achievements_player_id_idx').on(table.playerId),
]);

export const auctions = pgTable('auctions', {
	id: varchar('id', { length: 24 }).primaryKey(),
	sellerId: varchar('seller_id', { length: 20 }).notNull(),
	itemData: jsonb('item_data').notNull().$type<any>(),
	startingPrice: integer('starting_price').notNull(),
	currentBid: integer('current_bid'),
	currentBidder: varchar('current_bidder', { length: 20 }),
	buyoutPrice: integer('buyout_price'),
	expiresAt: timestamp('expires_at').notNull(),
	status: varchar('status', { length: 20 }).notNull().default('active'),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	index('auctions_seller_id_idx').on(table.sellerId),
	index('auctions_status_idx').on(table.status),
	index('auctions_expires_at_idx').on(table.expiresAt),
]);

export const playerSessions = pgTable('player_sessions', {
	id: varchar('id', { length: 24 }).primaryKey(),
	userId: varchar('user_id', { length: 20 }).notNull(),
	token: varchar('token', { length: 255 }).notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	createdAt: timestamp('created_at').notNull(),
	// Session-analytics fields (Mongo-parity; consumed by lib/sessionTracker).
	// Nullable so legacy auth-token rows remain valid.
	sessionId: varchar('session_id', { length: 64 }),
	startTime: timestamp('start_time'),
	endTime: timestamp('end_time'),
	duration: integer('duration'),
	actionsCount: integer('actions_count').default(0),
	resourcesGainedMetal: integer('resources_gained_metal').default(0),
	resourcesGainedEnergy: integer('resources_gained_energy').default(0),
	ipAddress: varchar('ip_address', { length: 64 }),
}, (table) => [
	index('player_sessions_user_id_idx').on(table.userId),
	index('player_sessions_token_idx').on(table.token),
	index('player_sessions_session_id_idx').on(table.sessionId),
]);

export const playerActivity = pgTable('player_activity', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	action: varchar('action', { length: 50 }).notNull(),
	timestamp: timestamp('timestamp').notNull(),
	details: jsonb('details').$type<any>(),
	// Mongo-parity analytics fields (lib/activityLogger); nullable for legacy rows.
	sessionId: varchar('session_id', { length: 64 }),
	metadata: jsonb('metadata').$type<any>(),
}, (table) => [
	index('player_activity_player_timestamp_idx').on(table.playerId, table.timestamp),
]);

export const playerFlags = pgTable('player_flags', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	flag: varchar('flag', { length: 50 }).notNull(),
	details: jsonb('details').$type<any>(),
	createdAt: timestamp('created_at').notNull(),
}, (table) => [
	index('player_flags_player_id_idx').on(table.playerId),
]);

export const typingIndicators = pgTable('typing_indicators', {
	id: varchar('id', { length: 24 }).primaryKey(),
	channelId: varchar('channel_id', { length: 30 }).notNull(),
	userId: varchar('user_id', { length: 20 }).notNull(),
	expiresAt: timestamp('expires_at').notNull(),
}, (table) => [
	index('typing_indicators_channel_user_idx').on(table.channelId, table.userId),
	index('typing_indicators_expires_at_idx').on(table.expiresAt),
]);

export const userPresence = pgTable('user_presence', {
	id: varchar('id', { length: 24 }).primaryKey(),
	userId: varchar('user_id', { length: 20 }).notNull(),
	lastSeen: timestamp('last_seen').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
}, (table) => [
	uniqueIndex('user_presence_user_id_unique').on(table.userId),
	index('user_presence_expires_at_idx').on(table.expiresAt),
]);

export const botMagnetBeacons = pgTable('bot_magnet_beacons', {
	id: varchar('id', { length: 24 }).primaryKey(),
	playerId: varchar('player_id', { length: 20 }).notNull(),
	playerName: varchar('player_name', { length: 50 }).notNull(),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	deployedAt: timestamp('deployed_at').notNull(),
	expiresAt: timestamp('expires_at').notNull(),
	cooldownUntil: timestamp('cooldown_until').notNull(),
	attractionRadius: integer('attraction_radius').notNull().default(100),
	attractionChance: integer('attraction_chance').notNull().default(30),
	botsAttracted: integer('bots_attracted').notNull().default(0),
	active: smallint('active').notNull().default(1),
}, (table) => [
	index('bot_beacons_player_idx').on(table.playerId),
	index('bot_beacons_active_idx').on(table.active),
	index('bot_beacons_expires_at_idx').on(table.expiresAt),
]);


export const beerBaseSpawnEvents = pgTable('beer_base_spawn_events', {
	id: varchar('id', { length: 24 }).primaryKey(),
	t: timestamp('t').notNull(),
	tier: integer('tier').notNull(),
	x: integer('x').notNull(),
	y: integer('y').notNull(),
	by: varchar('by', { length: 50 }).notNull(),
	sid: varchar('sid', { length: 50 }),
}, (table) => [
	index('beer_spawn_t_idx').on(table.t),
]);

export const beerBaseDefeatEvents = pgTable('beer_base_defeat_events', {
	id: varchar('id', { length: 24 }).primaryKey(),
	t: timestamp('t').notNull(),
	tier: integer('tier').notNull(),
	by: varchar('by', { length: 50 }).notNull(),
	rewardsMetal: integer('rewards_metal').notNull().default(0),
	rewardsEnergy: integer('rewards_energy').notNull().default(0),
	alive: integer('alive').notNull(),
}, (table) => [
	index('beer_defeat_t_idx').on(table.t),
]);

