/**
 * WMD alert domain types.
 * Single source of truth shared by lib/wmd/admin/alertService.ts and
 * lib/db/schema/wmd.ts (wmdAlerts / wmdConfig column typings).
 */

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export enum AlertType {
  MISSILE_LAUNCH = 'MISSILE_LAUNCH',
  MISSILE_IMPACT = 'MISSILE_IMPACT',
  MISSILE_INTERCEPTED = 'MISSILE_INTERCEPTED',
  VOTE_PASSED = 'VOTE_PASSED',
  VOTE_FAILED = 'VOTE_FAILED',
  COOLDOWN_EXPIRED = 'COOLDOWN_EXPIRED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  EMERGENCY_DISARM = 'EMERGENCY_DISARM',
  VOTE_VETOED = 'VOTE_VETOED'
}

export enum AlertStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
  ARCHIVED = 'ARCHIVED'
}

export enum NotificationChannel {
  IN_GAME = 'IN_GAME',
  DASHBOARD = 'DASHBOARD',
  EMAIL = 'EMAIL'
}

/** JSON-serializable alert payload value (jsonb-compatible). */
export type WmdAlertDataValue =
  | string
  | number
  | boolean
  | WmdAlertDataValue[]
  | { [key: string]: WmdAlertDataValue };

/** Free-form alert payload persisted in wmd_alerts.data (jsonb). */
export type WmdAlertData = Record<string, WmdAlertDataValue>;

/** Notification-channel delivery tracking, keyed by channel name. */
export interface WmdAlertDeliveryStatus {
  sent: boolean;
  sentAt?: Date;
  error?: string;
}

/** Shape persisted under wmd_config key 'alerts'. */
export interface WmdAlertSettingsPayload {
  settings: AlertConfig;
}

export interface WMDAlert {
  id?: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;

  playerId?: string;
  playerName?: string;
  clanId?: string;
  clanName?: string;
  targetClanId?: string;
  targetClanName?: string;

  missileId?: string;
  voteId?: string;
  operationId?: string;

  data?: WmdAlertData;

  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  resolvedBy?: string;

  channels: NotificationChannel[];
  deliveryStatus: Record<string, WmdAlertDeliveryStatus>;
}

export interface AlertConfig {
  enabled: boolean;
  minSeverity: AlertSeverity;
  channels: NotificationChannel[];
  autoAcknowledge: boolean;
  autoArchiveDays: number;
}
