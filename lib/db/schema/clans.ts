import { pgTable, varchar, integer, smallint, timestamp, numeric, jsonb, text, index, uniqueIndex } from 'drizzle-orm/pg-core';
import type { ClanBankTransaction, ClanMember, ClanPerk, ClanTerritory, ClanWar } from '@/types/clan.types';
import type { ClanLevel } from '@/types/clan.types';
import { MonumentType } from '@/types/clan.types';

export const clans = pgTable('clans', {
	id: varchar('id', { length: 24 }).primaryKey(),
	name: varchar('name', { length: 30 }).notNull(),
	tag: varchar('tag', { length: 6 }).notNull(),
	description: text('description').notNull(),
	leaderId: varchar('leader_id', { length: 20 }).notNull(),
	members: jsonb('members').notNull().$type<ClanMember[]>().default([]),
	maxMembers: integer('max_members').notNull().default(20),
	levelCurrentLevel: integer('level_current_level').notNull().default(1),
	levelTotalXP: integer('level_total_xp').notNull().default(0),
	levelCurrentLevelXP: integer('level_current_level_xp').notNull().default(0),
	levelXpToNextLevel: integer('level_xp_to_next_level').notNull().default(0),
	levelFeaturesUnlocked: jsonb('level_features_unlocked').notNull().$type<string[]>().default([]),
	levelMilestonesCompleted: jsonb('level_milestones_completed').notNull().$type<ClanLevel['milestonesCompleted']>().default([]),
	levelLastLevelUp: timestamp('level_last_level_up'),
	createdAt: timestamp('created_at').notNull(),
	settingsMessageOfTheDay: varchar('settings_message_of_the_day', { length: 500 }).notNull().default(''),
	settingsIsRecruiting: smallint('settings_is_recruiting').notNull().default(1),
	settingsMinLevelToJoin: integer('settings_min_level_to_join').notNull().default(1),
	settingsRequiresApproval: smallint('settings_requires_approval').notNull().default(0),
	settingsAllowTerritoryControl: smallint('settings_allow_territory_control').notNull().default(0),
	settingsAllowWarDeclarations: smallint('settings_allow_war_declarations').notNull().default(0),
	statsTotalPower: integer('stats_total_power').notNull().default(0),
	statsTotalTerritories: integer('stats_total_territories').notNull().default(0),
	statsTotalMonuments: integer('stats_total_monuments').notNull().default(0),
	statsWarsWon: integer('stats_wars_won').notNull().default(0),
	statsWarsLost: integer('stats_wars_lost').notNull().default(0),
	statsTotalRP: integer('stats_total_rp').notNull().default(0),
	researchResearchPoints: integer('research_research_points').notNull().default(0),
	researchUnlockedTechs: jsonb('research_unlocked_techs').notNull().$type<string[]>().default([]),
	researchActiveResearch: varchar('research_active_research', { length: 50 }),
	bankTreasuryMetal: integer('bank_treasury_metal').notNull().default(0),
	bankTreasuryEnergy: integer('bank_treasury_energy').notNull().default(0),
	bankTreasuryResearchPoints: integer('bank_treasury_research_points').notNull().default(0),
	bankTaxRatesMetal: numeric('bank_tax_rates_metal', { precision: 5, scale: 2 }).notNull().default('0'),
	bankTaxRatesEnergy: numeric('bank_tax_rates_energy', { precision: 5, scale: 2 }).notNull().default('0'),
	bankTaxRatesResearchPoints: numeric('bank_tax_rates_research_points', { precision: 5, scale: 2 }).notNull().default('0'),
	bankUpgradeLevel: integer('bank_upgrade_level').notNull().default(1),
	bankCapacity: integer('bank_capacity').notNull().default(0),
	bankTransactions: jsonb('bank_transactions').notNull().$type<ClanBankTransaction[]>().default([]),
	activePerks: jsonb('active_perks').notNull().$type<ClanPerk[]>().default([]),
	territories: jsonb('territories').notNull().$type<ClanTerritory[]>().default([]),
	monuments: jsonb('monuments').notNull().$type<MonumentType[]>().default([]),
	warsActive: jsonb('wars_active').notNull().$type<ClanWar[]>().default([]),
	warsHistory: jsonb('wars_history').notNull().$type<ClanWar[]>().default([]),
	wmdCooldownUntil: timestamp('wmd_cooldown_until'),
	lastWMDLaunch: timestamp('last_wmd_launch'),
	lastTerritoryIncomeCollection: timestamp('last_territory_income_collection'),
}, (table) => [
	uniqueIndex('clans_name_unique').on(table.name),
	uniqueIndex('clans_tag_unique').on(table.tag),
	index('clans_level_power_idx').on(table.levelCurrentLevel, table.statsTotalPower),
	index('clans_power_idx').on(table.statsTotalPower),
]);

/**
 * Bilateral clan relations (FID-20260903-002). Writers canonicalize the pair
 * (lexicographically sorted) so the symmetric lookup in
 * clanConsequencesService matches regardless of argument order.
 */
export const clanRelations = pgTable('clan_relations', {
	id: varchar('id', { length: 24 }).primaryKey(),
	clanId1: varchar('clan_id1', { length: 24 }).notNull(),
	clanId2: varchar('clan_id2', { length: 24 }).notNull(),
	relation: varchar('relation', { length: 20 }).notNull(),
	reason: varchar('reason', { length: 500 }).notNull(),
	lastUpdated: timestamp('last_updated').notNull(),
}, (table) => [
	uniqueIndex('clan_relations_pair_unique').on(table.clanId1, table.clanId2),
	index('clan_relations_clan1_idx').on(table.clanId1),
	index('clan_relations_clan2_idx').on(table.clanId2),
]);
