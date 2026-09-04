import { sql } from 'drizzle-orm';
import { pgTable, varchar, integer, smallint, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const migrations = pgTable('migrations', {
	id: varchar('id', { length: 100 }).primaryKey(),
	appliedAt: timestamp('applied_at').notNull(),
	details: jsonb('details').$type<Record<string, unknown>>(),
});

export const gameConfig = pgTable('game_config', {
	id: varchar('id', { length: 24 }).primaryKey(),
	type: varchar('type', { length: 30 }).notNull(),
	// eslint-disable-next-line @typescript-eslint/no-explicit-any -- interface without index signature
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
	itemData: jsonb('item_data').notNull().$type<Record<string, unknown>>(),
	startingPrice: integer('starting_price').notNull(),
	currentBid: integer('current_bid'),
	currentBidder: varchar('current_bidder', { length: 20 }),
	buyoutPrice: integer('buyout_price'),
	expiresAt: timestamp('expires_at').notNull(),
	status: varchar('status', { length: 20 }).notNull().default('active'),
	createdAt: timestamp('created_at').notNull(),
	// Domain bridge (migration 0008): `doc` jsonb holds the full AuctionListing document
	// (item, bids[], fees, timestamps); the plain columns below mirror the doc fields the
	// service filters/sorts/looks up on, so SQL indexes stay usable. They are NOT generated
	// columns — the service writes these fields directly via $set and generated columns
	// reject writes; the shim's DOC_TABLES mapping keeps columns and doc in sync.
	doc: jsonb('doc').notNull().default({}),
	auctionId: varchar('auction_id', { length: 64 }),
	sellerUsername: varchar('seller_username', { length: 20 }),
	highestBidder: varchar('highest_bidder', { length: 20 }),
	winnerUsername: varchar('winner_username', { length: 20 }),
	startingBid: integer('starting_bid'),
	reservePrice: integer('reserve_price'),
	listingFee: integer('listing_fee'),
	clanOnly: smallint('clan_only').notNull().default(0),
	settled: smallint('settled').notNull().default(0),
	finalPrice: integer('final_price'),
	durationHours: integer('duration_hours'),
	closedAt: timestamp('closed_at'),
}, (table) => [
	uniqueIndex('auctions_auction_id_uniq').on(table.auctionId).where(sql`auction_id IS NOT NULL`),
	index('auctions_seller_username_idx').on(table.sellerUsername),
	index('auctions_status_created_idx').on(table.status, table.createdAt),
]);

/** Completed trade records written at buyout (TradeHistory domain shape). */
export const tradeHistory = pgTable('trade_history', {
	id: varchar('id', { length: 24 }).primaryKey(),
	tradeId: varchar('trade_id', { length: 40 }).notNull(),
	auctionId: varchar('auction_id', { length: 64 }).notNull(),
	sellerUsername: varchar('seller_username', { length: 20 }).notNull(),
	buyerUsername: varchar('buyer_username', { length: 20 }).notNull(),
	item: jsonb('item').notNull(),
	finalPrice: integer('final_price').notNull(),
	saleFee: integer('sale_fee').notNull(),
	sellerReceived: integer('seller_received').notNull(),
	tradeType: varchar('trade_type', { length: 10 }).notNull().default('buyout'),
	completedAt: timestamp('completed_at').notNull(),
}, (table) => [
	index('trade_history_trade_id_idx').on(table.tradeId),
	index('trade_history_auction_id_idx').on(table.auctionId),
	index('trade_history_seller_idx').on(table.sellerUsername),
	index('trade_history_buyer_idx').on(table.buyerUsername),
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
	details: jsonb('details').$type<Record<string, unknown>>(),
	// Mongo-parity analytics fields (lib/activityLogger); nullable for legacy rows.
	sessionId: varchar('session_id', { length: 64 }),
	metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
}, (table) => [
	index('player_activity_player_timestamp_idx').on(table.playerId, table.timestamp),
]);

export const playerFlags = pgTable('player_flags', {
	id: varchar('id', { length: 24 }).primaryKey(),
	// Legacy pivot columns — nullable as of migration 0007: the anti-cheat detector's
	// domain insert doesn't supply them and no reader consumes them.
	playerId: varchar('player_id', { length: 20 }),
	flag: varchar('flag', { length: 50 }),
	details: jsonb('details').$type<Record<string, unknown>>(),
	createdAt: timestamp('created_at').notNull(),
	// Anti-cheat domain shape (lib/antiCheatDetector + admin flag endpoints).
	// Nullable where legacy rows may lack the value.
	username: varchar('username', { length: 20 }),
	flagType: varchar('flag_type', { length: 50 }),
	severity: varchar('severity', { length: 10 }).default('LOW'),
	evidence: text('evidence'),
	metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
	resolved: smallint('resolved').default(0),
	occurrenceCount: integer('occurrence_count').default(1),
}, (table) => [
	index('player_flags_player_id_idx').on(table.playerId),
	index('player_flags_username_idx').on(table.username),
	index('player_flags_resolved_idx').on(table.resolved),
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

