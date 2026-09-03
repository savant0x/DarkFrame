import { pgTable, varchar, integer, smallint, timestamp, jsonb, index, uniqueIndex, numeric } from 'drizzle-orm/pg-core';
import type { MissileDamageRecord, MissionType, MissionStatus, SpyRank, SpyAgent, WMDEventType, NotificationPriority, NotificationScope } from '@/types/wmd';
import type { AlertType, AlertSeverity, AlertStatus, NotificationChannel, WmdAlertData, WmdAlertDeliveryStatus, WmdAlertSettingsPayload } from '@/lib/wmd/admin/alert.types';
import type { IntelligenceReport } from '@/types/wmd';
import type { SabotageDamage } from '@/types/wmd';

export const missiles = pgTable('missiles', {
  id: varchar('id', { length: 24 }).primaryKey(),
  missileId: varchar('missile_id', { length: 50 }).notNull(),
  ownerId: varchar('owner_id', { length: 20 }).notNull(),
  ownerClanId: varchar('owner_clan_id', { length: 24 }),
  warheadType: varchar('warhead_type', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  componentsWarhead: integer('components_warhead'),
  componentsPropulsion: integer('components_propulsion'),
  componentsGuidance: integer('components_guidance'),
  componentsPayload: integer('components_payload'),
  componentsStealth: integer('components_stealth'),
  targetId: varchar('target_id', { length: 20 }),
  targetType: varchar('target_type', { length: 20 }),
  secondaryTargets: jsonb('secondary_targets'),
  launchedAt: timestamp('launched_at'),
  launchedBy: varchar('launched_by', { length: 20 }),
  impactAt: timestamp('impact_at'),
  flightTime: integer('flight_time'),
  interceptAttempts: integer('intercept_attempts').default(0),
  interceptedBy: varchar('intercepted_by', { length: 20 }),
  interceptedAt: timestamp('intercepted_at'),
  damageDealt: jsonb('damage_dealt').$type<MissileDamageRecord>(),
  createdAt: timestamp('created_at').notNull(),
  completedAt: timestamp('completed_at'),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  index('missiles_owner_idx').on(table.ownerId),
  index('missiles_status_idx').on(table.status),
]);

export const playerResearch = pgTable('player_research', {
  id: varchar('id', { length: 24 }).primaryKey(),
  playerId: varchar('player_id', { length: 20 }).notNull(),
  playerUsername: varchar('player_username', { length: 20 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }),
  completedTechs: jsonb('completed_techs').$type<string[]>().default([]),
  availableTechs: jsonb('available_techs').$type<string[]>().default([]),
  lockedTechs: jsonb('locked_techs').$type<string[]>().default([]),
  currentResearchTechId: varchar('current_research_tech_id', { length: 50 }),
  currentResearchStartedAt: timestamp('current_research_started_at'),
  currentResearchRpSpent: integer('current_research_rp_spent'),
  currentResearchRpRequired: integer('current_research_rp_required'),
  currentResearchProgress: numeric('current_research_progress', { precision: 5, scale: 2 }),
  missileTier: integer('missile_tier').default(0),
  defenseTier: integer('defense_tier').default(0),
  intelligenceTier: integer('intelligence_tier').default(0),
  totalRPSpent: integer('total_rp_spent').default(0),
  totalTechsUnlocked: integer('total_techs_unlocked').default(0),
  clanResearchBonus: numeric('clan_research_bonus', { precision: 5, scale: 2 }).default('0'),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('player_research_player_id_unique').on(table.playerId),
  index('player_research_clan_id_idx').on(table.clanId),
]);

export const wmdNotifications = pgTable('wmd_notifications', {
  id: varchar('id', { length: 24 }).primaryKey(),
  notificationId: varchar('notification_id', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 30 }).notNull().$type<WMDEventType>(),
  priority: varchar('priority', { length: 20 }).notNull().$type<NotificationPriority>(),
  scope: varchar('scope', { length: 20 }).notNull().$type<NotificationScope>(),
  sourceId: varchar('source_id', { length: 20 }).notNull(),
  sourceName: varchar('source_name', { length: 50 }).notNull(),
  targetId: varchar('target_id', { length: 20 }),
  targetName: varchar('target_name', { length: 50 }),
  title: varchar('title', { length: 200 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
  viewCount: integer('view_count').default(0),
  viewedBy: jsonb('viewed_by').$type<string[]>().default([]),
  broadcastAt: timestamp('broadcast_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  index('wmd_notif_scope_idx').on(table.scope),
  index('wmd_notif_broadcast_idx').on(table.broadcastAt),
]);

export const wmdDefenseBatteries = pgTable('wmd_defense_batteries', {
  id: varchar('id', { length: 24 }).primaryKey(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  interceptChance: numeric('intercept_chance', { precision: 5, scale: 2 }).default('0'),
  cooldownDuration: integer('cooldown_duration').default(0),
  batteryId: varchar('battery_id', { length: 50 }).notNull(),
  builtAt: timestamp('built_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  repairCompletesAt: timestamp('repair_completes_at'),
}, (table) => [
  index('wmd_defense_clan_idx').on(table.clanId),
  index('wmd_defense_status_idx').on(table.status),
]);

export const wmdVotes = pgTable('wmd_votes', {
  id: varchar('id', { length: 24 }).primaryKey(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  eligibleVoters: integer('eligible_voters').notNull().default(0),
  votes: jsonb('votes').$type<Array<{ vote: string }>>(),
  finalApprovalRate: numeric('final_approval_rate', { precision: 5, scale: 2 }),
  requiredApprovalPercentage: numeric('required_approval_percentage', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('wmd_votes_clan_idx').on(table.clanId),
  index('wmd_votes_status_idx').on(table.status),
]);

export const wmdSpyMissions = pgTable('wmd_spy_missions', {
  id: varchar('id', { length: 24 }).primaryKey(),
  senderClanId: varchar('sender_clan_id', { length: 24 }).notNull(),
  targetClanId: varchar('target_clan_id', { length: 24 }).notNull(),
  spyId: varchar('spy_id', { length: 50 }).notNull(),
  spyName: varchar('spy_name', { length: 50 }).notNull(),
  targetName: varchar('target_name', { length: 50 }).notNull(),
  missionType: varchar('mission_type', { length: 30 }).$type<MissionType>(),
  status: varchar('status', { length: 20 }).notNull().$type<MissionStatus>(),
  estimatedCompletion: timestamp('estimated_completion'),
  actualCompletion: timestamp('actual_completion'),
  finalSuccessChance: numeric('final_success_chance', { precision: 5, scale: 2 }),
  detectionRisk: numeric('detection_risk', { precision: 5, scale: 2 }),
  roll: numeric('roll', { precision: 5, scale: 2 }),
  successful: smallint('successful').default(0),
  detected: smallint('detected').default(0),
  intelGathered: jsonb('intel_gathered').$type<IntelligenceReport[]>(),
  intelligenceGathered: jsonb('intelligence_gathered').$type<IntelligenceReport>(),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  index('wmd_spy_sender_idx').on(table.senderClanId),
  index('wmd_spy_target_idx').on(table.targetClanId),
  index('wmd_spy_status_idx').on(table.status),
]);

export const wmdClanVotes = pgTable('wmd_clan_votes', {
  id: varchar('id', { length: 24 }).primaryKey(),
  voteId: varchar('vote_id', { length: 50 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  proposerId: varchar('proposer_id', { length: 20 }).notNull(),
  proposerUsername: varchar('proposer_username', { length: 50 }).notNull(),
  voteType: varchar('vote_type', { length: 30 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  targetId: varchar('target_id', { length: 20 }),
  targetUsername: varchar('target_username', { length: 50 }),
  warheadType: varchar('warhead_type', { length: 20 }),
  votesFor: jsonb('votes_for').$type<string[]>().default([]),
  votesAgainst: jsonb('votes_against').$type<string[]>().default([]),
  requiredVotes: integer('required_votes').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('wmd_clan_votes_clan_idx').on(table.clanId),
  index('wmd_clan_votes_status_idx').on(table.status),
  index('wmd_clan_votes_expires_idx').on(table.expiresAt),
]);

export const wmdSuspiciousActivity = pgTable('wmd_suspicious_activity', {
  id: varchar('id', { length: 24 }).primaryKey(),
  playerId: varchar('player_id', { length: 20 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  activityType: varchar('activity_type', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  details: jsonb('details').$type<string>(),
  evidence: jsonb('evidence').$type<Record<string, unknown>>(),
  reportedBy: varchar('reported_by', { length: 20 }),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  index('wmd_activity_clan_idx').on(table.clanId),
  index('wmd_activity_severity_idx').on(table.severity),
]);

export const wmdAdminAlerts = pgTable('wmd_admin_alerts', {
  id: varchar('id', { length: 24 }).primaryKey(),
  type: varchar('type', { length: 30 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull(),
  resolvedAt: timestamp('resolved_at'),
}, (table) => [
  index('wmd_alert_status_idx').on(table.status),
  index('wmd_alert_severity_idx').on(table.severity),
]);

export const wmdConfig = pgTable('wmd_config', {
  id: varchar('id', { length: 24 }).primaryKey(),
  key: varchar('key', { length: 50 }).notNull(),
  value: jsonb('value').$type<WmdAlertSettingsPayload>().notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_config_key_unique').on(table.key),
]);

// ============================================================================
// Spy network tables (FID-20260903-002) — designed from spyService call sites
// ============================================================================

export const wmdSpies = pgTable('wmd_spies', {
  id: varchar('id', { length: 24 }).primaryKey(),
  spyId: varchar('spy_id', { length: 50 }).notNull(),
  ownerId: varchar('owner_id', { length: 20 }).notNull(),
  ownerUsername: varchar('owner_username', { length: 50 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }),
  codename: varchar('codename', { length: 50 }).notNull(),
  rank: varchar('rank', { length: 20 }).notNull().$type<SpyRank>(),
  experience: integer('experience').notNull().default(0),
  specialization: varchar('specialization', { length: 20 }).notNull().$type<SpyAgent['specialization']>(),
  status: varchar('status', { length: 20 }).notNull().$type<SpyAgent['status']>(),
  currentMissionId: varchar('current_mission_id', { length: 50 }),
  missionHistory: jsonb('mission_history').$type<string[]>().default([]),
  skillsStealth: smallint('skills_stealth').notNull().default(0),
  skillsHacking: smallint('skills_hacking').notNull().default(0),
  skillsSabotage: smallint('skills_sabotage').notNull().default(0),
  skillsIntelligence: smallint('skills_intelligence').notNull().default(0),
  lastMissionAt: timestamp('last_mission_at'),
  recruitedAt: timestamp('recruited_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_spies_spy_id_unique').on(table.spyId),
  index('wmd_spies_owner_idx').on(table.ownerId),
  index('wmd_spies_status_idx').on(table.status),
  index('wmd_spies_clan_idx').on(table.clanId),
]);

/** Payload actually persisted in wmd_sabotage_operations.damage_dealt. */
export interface SabotageOperationDamage {
  sabotageId: string;
  missionId: string;
  saboteurId: string;
  saboteurName: string;
  targetId: string;
  damage: number;
  componentsDestroyed: string[];
  progressLost: number;
  resourcesWasted: { metal: number; energy: number };
}

export const wmdSabotageOperations = pgTable('wmd_sabotage_operations', {
  id: varchar('id', { length: 24 }).primaryKey(),
  sabotageId: varchar('sabotage_id', { length: 50 }).notNull(),
  spyId: varchar('spy_id', { length: 50 }).notNull(),
  spyCodename: varchar('spy_codename', { length: 50 }),
  operatorId: varchar('operator_id', { length: 20 }).notNull(),
  operatorUsername: varchar('operator_username', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 30 }).notNull(),
  targetId: varchar('target_id', { length: 50 }).notNull(),
  targetPlayerId: varchar('target_player_id', { length: 20 }).notNull(),
  targetUsername: varchar('target_username', { length: 50 }),
  success: smallint('success').notNull().default(0),
  detected: smallint('detected').notNull().default(0),
  damageDealt: jsonb('damage_dealt').$type<SabotageOperationDamage | SabotageDamage>(),
  executedAt: timestamp('executed_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_sabotage_sabotage_id_unique').on(table.sabotageId),
  index('wmd_sabotage_target_player_idx').on(table.targetPlayerId),
  index('wmd_sabotage_executed_idx').on(table.executedAt),
]);

export const wmdIntelligenceReports = pgTable('wmd_intelligence_reports', {
  id: varchar('id', { length: 24 }).primaryKey(),
  reportId: varchar('report_id', { length: 50 }).notNull(),
  classification: varchar('classification', { length: 20 }).notNull(),
  gatheredBy: varchar('gathered_by', { length: 50 }).notNull(),
  gatheredFrom: varchar('gathered_from', { length: 50 }).notNull(),
  gatheredAt: timestamp('gathered_at').notNull(),
  missionId: varchar('mission_id', { length: 50 }).notNull(),
  targetId: varchar('target_id', { length: 20 }).notNull(),
  targetUsername: varchar('target_username', { length: 50 }).notNull(),
  targetLevel: integer('target_level').notNull().default(0),
  targetPower: integer('target_power').notNull().default(0),
  targetClanId: varchar('target_clan_id', { length: 24 }),
  targetClanName: varchar('target_clan_name', { length: 50 }),
  wmdCapabilities: jsonb('wmd_capabilities').$type<IntelligenceReport['wmdCapabilities']>(),
  vulnerabilities: jsonb('vulnerabilities').$type<string[]>().default([]),
  threats: jsonb('threats').$type<string[]>().default([]),
  recommendations: jsonb('recommendations').$type<string[]>().default([]),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_intel_report_id_unique').on(table.reportId),
  index('wmd_intel_mission_idx').on(table.missionId),
  index('wmd_intel_target_idx').on(table.targetId),
]);

export const wmdSecurityStatus = pgTable('wmd_security_status', {
  id: varchar('id', { length: 24 }).primaryKey(),
  playerId: varchar('player_id', { length: 20 }).notNull(),
  alertLevel: varchar('alert_level', { length: 50 }).notNull().default('0'),
  lastIncident: timestamp('last_incident'),
  updatedAt: timestamp('updated_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_security_player_unique').on(table.playerId),
]);

export const wmdCounterIntelOperations = pgTable('wmd_counter_intel_operations', {
  id: varchar('id', { length: 24 }).primaryKey(),
  operationId: varchar('operation_id', { length: 50 }).notNull(),
  operatorId: varchar('operator_id', { length: 20 }).notNull(),
  targetArea: varchar('target_area', { length: 30 }).notNull(),
  spiesDetected: integer('spies_detected').notNull().default(0),
  detectedSpies: jsonb('detected_spies').$type<Array<{
    spyId: string;
    codename: string;
    specialization: string;
    operatorId: string;
    operatorClanId: string | null;
  }>>().default([]),
  executedAt: timestamp('executed_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_counter_intel_op_id_unique').on(table.operationId),
  index('wmd_counter_intel_operator_idx').on(table.operatorId),
]);

export const wmdInterceptions = pgTable('wmd_interceptions', {
  id: varchar('id', { length: 24 }).primaryKey(),
  interceptionId: varchar('interception_id', { length: 50 }).notNull(),
  missileId: varchar('missile_id', { length: 50 }).notNull(),
  defenderId: varchar('defender_id', { length: 20 }).notNull(),
  batteryId: varchar('battery_id', { length: 50 }).notNull(),
  result: varchar('result', { length: 20 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
}, (table) => [
  uniqueIndex('wmd_interceptions_interception_id_unique').on(table.interceptionId),
  index('wmd_interceptions_missile_idx').on(table.missileId),
  index('wmd_interceptions_defender_idx').on(table.defenderId),
]);

export const wmdLaunchAuthorizations = pgTable('wmd_launch_authorizations', {
  id: varchar('id', { length: 24 }).primaryKey(),
  authId: varchar('auth_id', { length: 50 }).notNull(),
  playerId: varchar('player_id', { length: 20 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  warheadType: varchar('warhead_type', { length: 20 }),
  targetId: varchar('target_id', { length: 20 }),
  grantedAt: timestamp('granted_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_launch_auth_auth_id_unique').on(table.authId),
  index('wmd_launch_auth_player_idx').on(table.playerId),
  index('wmd_launch_auth_expires_idx').on(table.expiresAt),
]);

export const wmdResourcePools = pgTable('wmd_resource_pools', {
  id: varchar('id', { length: 24 }).primaryKey(),
  poolId: varchar('pool_id', { length: 50 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  resourceAmount: integer('resource_amount').notNull().default(0),
  contributorsAllowed: integer('contributors_allowed').notNull().default(0),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_resource_pool_pool_id_unique').on(table.poolId),
  index('wmd_resource_pool_clan_idx').on(table.clanId),
]);

export const wmdDefenseGrids = pgTable('wmd_defense_grids', {
  id: varchar('id', { length: 24 }).primaryKey(),
  gridId: varchar('grid_id', { length: 50 }).notNull(),
  clanId: varchar('clan_id', { length: 24 }).notNull(),
  isActive: smallint('is_active').notNull().default(0),
  activatedAt: timestamp('activated_at').notNull(),
}, (table) => [
  uniqueIndex('wmd_defense_grid_grid_id_unique').on(table.gridId),
  index('wmd_defense_grid_clan_idx').on(table.clanId),
]);

export const wmdAlerts = pgTable('wmd_alerts', {
  id: varchar('id', { length: 50 }).primaryKey(),
  type: varchar('type', { length: 30 }).notNull().$type<AlertType>(),
  severity: varchar('severity', { length: 20 }).notNull().$type<AlertSeverity>(),
  status: varchar('status', { length: 20 }).notNull().$type<AlertStatus>(),
  title: varchar('title', { length: 200 }).notNull(),
  message: varchar('message', { length: 500 }).notNull(),
  playerId: varchar('player_id', { length: 20 }),
  playerName: varchar('player_name', { length: 50 }),
  clanId: varchar('clan_id', { length: 24 }),
  clanName: varchar('clan_name', { length: 50 }),
  targetClanId: varchar('target_clan_id', { length: 24 }),
  targetClanName: varchar('target_clan_name', { length: 50 }),
  missileId: varchar('missile_id', { length: 50 }),
  voteId: varchar('vote_id', { length: 50 }),
  operationId: varchar('operation_id', { length: 50 }),
  data: jsonb('data').$type<WmdAlertData>(),
  channels: jsonb('channels').$type<NotificationChannel[]>().notNull().default([]),
  deliveryStatus: jsonb('delivery_status').$type<Record<string, WmdAlertDeliveryStatus>>().default({}),
  acknowledgedAt: timestamp('acknowledged_at'),
  acknowledgedBy: varchar('acknowledged_by', { length: 20 }),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 20 }),
  createdAt: timestamp('created_at').notNull(),
}, (table) => [
  index('wmd_alerts_status_idx').on(table.status),
  index('wmd_alerts_severity_idx').on(table.severity),
  index('wmd_alerts_type_idx').on(table.type),
  index('wmd_alerts_clan_idx').on(table.clanId),
  index('wmd_alerts_created_idx').on(table.createdAt),
]);

export const wmdRetaliationRights = pgTable('wmd_retaliation_rights', {
  id: varchar('id', { length: 50 }).primaryKey(),
  playerId: varchar('player_id', { length: 20 }).notNull(),
  playerClanId: varchar('player_clan_id', { length: 24 }).notNull(),
  canRetaliateAgainstClan: varchar('can_retaliate_against_clan', { length: 24 }).notNull(),
  grantedAt: timestamp('granted_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  used: smallint('used').notNull().default(0),
}, (table) => [
  index('wmd_retaliation_player_idx').on(table.playerId),
  index('wmd_retaliation_target_idx').on(table.canRetaliateAgainstClan),
  index('wmd_retaliation_expires_idx').on(table.expiresAt),
]);

export const wmdConsequenceEvents = pgTable('wmd_consequence_events', {
  id: varchar('id', { length: 24 }).primaryKey(),
  eventId: varchar('event_id', { length: 50 }).notNull(),
  launcherClanId: varchar('launcher_clan_id', { length: 24 }).notNull(),
  targetClanId: varchar('target_clan_id', { length: 24 }).notNull(),
  warheadType: varchar('warhead_type', { length: 20 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull(),
  reputationLoss: integer('reputation_loss').notNull().default(0),
  cooldownDays: integer('cooldown_days').notNull().default(0),
  timestamp: timestamp('timestamp').notNull(),
}, (table) => [
  uniqueIndex('wmd_consequence_event_id_unique').on(table.eventId),
  index('wmd_consequence_launcher_idx').on(table.launcherClanId),
  index('wmd_consequence_target_idx').on(table.targetClanId),
]);
