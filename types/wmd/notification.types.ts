/**
 * @file types/wmd/notification.types.ts
 * @created 2025-10-22
 * @overview WMD Notification System Type Definitions
 * 
 * OVERVIEW:
 * Complete type system for WMD global notifications including event types,
 * broadcast priorities, user notification preferences, and WebSocket integration.
 * 
 * Features:
 * - Global event broadcasting
 * - Targeted clan notifications
 * - Personal alerts
 * - Notification preferences
 * - Real-time WebSocket events
 * 
 * Dependencies:
 * - /lib/websocket/broadcast.ts for broadcasting (REUSE EXISTING)
 * - MongoDB for notification storage
 */

type ObjectId = string;
import { WarheadType } from './missile.types';
import { MissionType } from './intelligence.types';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * WMD notification event types
 */
export enum WMDEventType {
  // Missile events
  MISSILE_ASSEMBLED = 'MISSILE_ASSEMBLED',         // All 5 components complete
  MISSILE_LAUNCHED = 'MISSILE_LAUNCHED',           // Launch initiated
  MISSILE_DETECTED = 'MISSILE_DETECTED',           // Radar detection
  MISSILE_INTERCEPTED = 'MISSILE_INTERCEPTED',     // Defense success
  MISSILE_IMPACTED = 'MISSILE_IMPACTED',           // Detonation
  MISSILE_DISMANTLED = 'MISSILE_DISMANTLED',       // Manually destroyed
  
  // Intelligence events
  INTELLIGENCE_LEAK = 'INTELLIGENCE_LEAK',         // Missile details exposed
  SPY_MISSION_COMPLETED = 'SPY_MISSION_COMPLETED', // Mission finished
  SPY_MISSION_FAILED = 'SPY_MISSION_FAILED',       // Mission failed
  SPY_DETECTED = 'SPY_DETECTED',                   // Spy caught
  SABOTAGE_SUCCESSFUL = 'SABOTAGE_SUCCESSFUL',     // Component destroyed
  ASSASSINATION = 'ASSASSINATION',                 // Spy killed
  
  // Defense events
  BATTERY_DEPLOYED = 'BATTERY_DEPLOYED',           // New battery online
  RADAR_ONLINE = 'RADAR_ONLINE',                   // Radar activated
  DEFENSE_GRID_ACTIVATED = 'DEFENSE_GRID_ACTIVATED', // Clan pooling enabled
  
  // Research events
  RESEARCH_COMPLETED = 'RESEARCH_COMPLETED',       // Tech unlocked
  TIER_10_UNLOCKED = 'TIER_10_UNLOCKED',           // Ultimate tech (global)
  
  // Clan events
  CLAN_VOTE_STARTED = 'CLAN_VOTE_STARTED',         // Vote initiated
  CLAN_VOTE_PASSED = 'CLAN_VOTE_PASSED',           // Vote approved
  CLAN_AUTHORIZATION = 'CLAN_AUTHORIZATION',       // Launch authorized
}

/**
 * Notification priority levels
 */
export enum NotificationPriority {
  INFO = 'INFO',                   // General information
  WARNING = 'WARNING',             // Important notice
  ALERT = 'ALERT',                 // Urgent action required
  CRITICAL = 'CRITICAL',           // Maximum priority (missile launch)
}

/**
 * Notification scopes
 */
export enum NotificationScope {
  GLOBAL = 'GLOBAL',               // Everyone sees it
  CLAN = 'CLAN',                   // Clan members only
  PERSONAL = 'PERSONAL',           // Individual player only
  TARGETED = 'TARGETED',           // Specific player/clan
}

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Main WMD notification document
 */
export interface WMDNotification {
  _id?: ObjectId;
  notificationId: string;          // Unique identifier
  eventType: WMDEventType;
  priority: NotificationPriority;
  scope: NotificationScope;
  
  // Source information
  sourceId: string;                // Player/clan who triggered event
  sourceName: string;
  sourceClanId?: string;
  sourceClanName?: string;
  
  // Target information (if applicable)
  targetId?: string;               // Affected player/clan
  targetName?: string;
  targetClanId?: string;
  targetClanName?: string;
  
  // Event details
  details: {
    missileId?: string;
    warheadType?: WarheadType;
    missionType?: MissionType;
    techId?: string;
    techTier?: number;
    damageDealt?: number;
    unitsDestroyed?: number;
    [key: string]: any;            // Flexible for event-specific data
  };
  
  // Message content
  title: string;
  message: string;
  icon?: string;                   // Icon/emoji
  color?: string;                  // Hex color code
  
  // Broadcast tracking
  broadcastAt: Date;
  expiresAt?: Date;                // When notification should be removed
  
  // Engagement
  viewCount: number;
  viewedBy: string[];              // Players who viewed
  
  createdAt: Date;
}

/**
 * Notification preference settings
 */
export interface NotificationPreferences {
  _id?: ObjectId;
  playerId: string;
  playerUsername: string;
  
  // Global notifications
  receiveGlobalNotifications: boolean;
  
  // Event type preferences
  preferences: Record<WMDEventType, boolean>;
  
  // Priority thresholds
  minPriority: NotificationPriority; // Minimum priority to receive
  
  // Clan notifications
  receiveClanNotifications: boolean;
  
  // Personal notifications
  receivePersonalNotifications: boolean;
  
  updatedAt: Date;
}

/**
 * Notification creation request
 */
export interface NotificationRequest {
  eventType: WMDEventType;
  priority: NotificationPriority;
  scope: NotificationScope;
  sourceId: string;
  sourceName: string;
  targetId?: string;
  targetName?: string;
  details: Record<string, any>;
  customMessage?: string;          // Override default message
}

/**
 * Notification broadcast result
 */
export interface NotificationBroadcastResult {
  success: boolean;
  notificationId: string;
  scope: NotificationScope;
  recipientCount: number;
  broadcastAt: Date;
  message: string;
}

/**
 * WebSocket WMD event payload
 */
export interface WMDWebSocketEvent {
  type: 'wmd_notification';
  eventType: WMDEventType;
  priority: NotificationPriority;
  notificationId: string;
  
  // Display data
  title: string;
  message: string;
  icon?: string;
  color?: string;
  
  // Event data
  sourceId: string;
  sourceName: string;
  targetId?: string;
  targetName?: string;
  details: Record<string, any>;
  
  timestamp: Date;
}

/**
 * Missile launch broadcast payload
 */
export interface MissileLaunchBroadcast {
  missileId: string;
  launchedBy: string;
  launchedByClan?: string;
  warheadType: WarheadType;
  targetId: string;
  targetName: string;
  impactAt: Date;
  flightTime: number;
  canIntercept: boolean;
}

/**
 * Intelligence leak broadcast payload
 */
export interface IntelligenceLeakBroadcast {
  leakedBy: string;
  leakedFrom: string;
  missileId: string;
  warheadType: WarheadType;
  progress: number;
  estimatedCompletion?: Date;
  targetId?: string;
}

/**
 * Notification history summary
 */
export interface NotificationHistory {
  playerId: string;
  
  // Recent notifications
  recentNotifications: WMDNotification[];
  
  // Stats
  totalReceived: number;
  totalViewed: number;
  unreadCount: number;
  
  // By priority
  criticalUnread: number;
  alertUnread: number;
  warningUnread: number;
  
  updatedAt: Date;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default notification preferences
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: Partial<NotificationPreferences> = {
  receiveGlobalNotifications: true,
  receiveClanNotifications: true,
  receivePersonalNotifications: true,
  minPriority: NotificationPriority.INFO,
  preferences: {
    [WMDEventType.MISSILE_ASSEMBLED]: true,
    [WMDEventType.MISSILE_LAUNCHED]: true,
    [WMDEventType.MISSILE_DETECTED]: true,
    [WMDEventType.MISSILE_INTERCEPTED]: true,
    [WMDEventType.MISSILE_IMPACTED]: true,
    [WMDEventType.MISSILE_DISMANTLED]: false,
    [WMDEventType.INTELLIGENCE_LEAK]: true,
    [WMDEventType.SPY_MISSION_COMPLETED]: false,
    [WMDEventType.SPY_MISSION_FAILED]: false,
    [WMDEventType.SPY_DETECTED]: true,
    [WMDEventType.SABOTAGE_SUCCESSFUL]: true,
    [WMDEventType.ASSASSINATION]: true,
    [WMDEventType.BATTERY_DEPLOYED]: false,
    [WMDEventType.RADAR_ONLINE]: false,
    [WMDEventType.DEFENSE_GRID_ACTIVATED]: true,
    [WMDEventType.RESEARCH_COMPLETED]: false,
    [WMDEventType.TIER_10_UNLOCKED]: true,
    [WMDEventType.CLAN_VOTE_STARTED]: true,
    [WMDEventType.CLAN_VOTE_PASSED]: true,
    [WMDEventType.CLAN_AUTHORIZATION]: true,
  },
};

/**
 * Notification message templates
 */
export const NOTIFICATION_TEMPLATES: Record<WMDEventType, {
  title: string;
  message: (data: any) => string;
  icon: string;
  color: string;
  priority: NotificationPriority;
}> = {
  [WMDEventType.MISSILE_ASSEMBLED]: {
    title: '🚀 Missile Assembled',
    message: (data) => `${data.sourceName} has completed assembly of a ${data.warheadType} missile!`,
    icon: '🚀',
    color: '#FF6B35',
    priority: NotificationPriority.WARNING,
  },
  [WMDEventType.MISSILE_LAUNCHED]: {
    title: '⚠️ MISSILE LAUNCH DETECTED',
    message: (data) => `${data.sourceName} has launched a ${data.warheadType} missile targeting ${data.targetName}! Impact in ${Math.floor(data.flightTime / 60000)} minutes.`,
    icon: '⚠️',
    color: '#FF0000',
    priority: NotificationPriority.CRITICAL,
  },
  [WMDEventType.MISSILE_DETECTED]: {
    title: '📡 Missile Detected',
    message: (data) => `Radar has detected a ${data.warheadType} missile targeting ${data.targetName}.`,
    icon: '📡',
    color: '#FFA500',
    priority: NotificationPriority.ALERT,
  },
  [WMDEventType.MISSILE_INTERCEPTED]: {
    title: '🛡️ Interception Successful',
    message: (data) => `${data.sourceName}'s defense batteries intercepted a ${data.warheadType} missile!`,
    icon: '🛡️',
    color: '#00FF00',
    priority: NotificationPriority.INFO,
  },
  [WMDEventType.MISSILE_IMPACTED]: {
    title: '💥 MISSILE IMPACT',
    message: (data) => `${data.targetName} has been hit by a ${data.warheadType} missile! ${data.unitsDestroyed} units destroyed.`,
    icon: '💥',
    color: '#8B0000',
    priority: NotificationPriority.CRITICAL,
  },
  [WMDEventType.INTELLIGENCE_LEAK]: {
    title: '📰 Intelligence Leak',
    message: (data) => `BREAKING: ${data.leakedFrom} is developing a ${data.warheadType} missile (${data.progress}% complete)!`,
    icon: '📰',
    color: '#4169E1',
    priority: NotificationPriority.WARNING,
  },
  [WMDEventType.SABOTAGE_SUCCESSFUL]: {
    title: '🎯 Sabotage Success',
    message: (data) => `Enemy spies have sabotaged ${data.targetName}'s missile program!`,
    icon: '🎯',
    color: '#9932CC',
    priority: NotificationPriority.ALERT,
  },
  [WMDEventType.TIER_10_UNLOCKED]: {
    title: '🏆 Ultimate Technology Unlocked',
    message: (data) => `${data.sourceName} has unlocked ${data.techName}! The balance of power has shifted.`,
    icon: '🏆',
    color: '#FFD700',
    priority: NotificationPriority.CRITICAL,
  },
  // ... (additional templates for other event types)
  [WMDEventType.MISSILE_DISMANTLED]: {
    title: '🔧 Missile Dismantled',
    message: (data) => `${data.sourceName} has dismantled a ${data.warheadType} missile.`,
    icon: '🔧',
    color: '#808080',
    priority: NotificationPriority.INFO,
  },
  [WMDEventType.SPY_MISSION_COMPLETED]: {
    title: '🕵️ Mission Complete',
    message: (data) => `Your spy has completed a ${data.missionType} mission against ${data.targetName}.`,
    icon: '🕵️',
    color: '#006400',
    priority: NotificationPriority.INFO,
  },
  [WMDEventType.SPY_MISSION_FAILED]: {
    title: '❌ Mission Failed',
    message: (data) => `Your spy failed a ${data.missionType} mission against ${data.targetName}.`,
    icon: '❌',
    color: '#8B0000',
    priority: NotificationPriority.WARNING,
  },
  [WMDEventType.SPY_DETECTED]: {
    title: '🚨 Spy Detected',
    message: (data) => `Counter-intelligence detected a ${data.sourceName} spy attempting ${data.missionType}!`,
    icon: '🚨',
    color: '#FF4500',
    priority: NotificationPriority.ALERT,
  },
  [WMDEventType.ASSASSINATION]: {
    title: '⚰️ Spy Eliminated',
    message: (data) => `${data.sourceName}'s ${data.spyRank} spy has been assassinated!`,
    icon: '⚰️',
    color: '#000000',
    priority: NotificationPriority.CRITICAL,
  },
  [WMDEventType.BATTERY_DEPLOYED]: {
    title: '🛡️ Battery Deployed',
    message: (data) => `${data.sourceName} has deployed a ${data.batteryType} defense battery.`,
    icon: '🛡️',
    color: '#4682B4',
    priority: NotificationPriority.INFO,
  },
  [WMDEventType.RADAR_ONLINE]: {
    title: '📡 Radar Online',
    message: (data) => `${data.sourceName} has activated ${data.radarLevel} radar coverage.`,
    icon: '📡',
    color: '#1E90FF',
    priority: NotificationPriority.INFO,
  },
  [WMDEventType.DEFENSE_GRID_ACTIVATED]: {
    title: '🌐 Defense Grid Active',
    message: (data) => `${data.clanName} has activated their clan defense grid!`,
    icon: '🌐',
    color: '#20B2AA',
    priority: NotificationPriority.WARNING,
  },
  [WMDEventType.RESEARCH_COMPLETED]: {
    title: '🔬 Research Complete',
    message: (data) => `You have unlocked ${data.techName}!`,
    icon: '🔬',
    color: '#32CD32',
    priority: NotificationPriority.INFO,
  },
  [WMDEventType.CLAN_VOTE_STARTED]: {
    title: '🗳️ Vote Started',
    message: (data) => `${data.sourceName} initiated a vote to ${data.voteType}.`,
    icon: '🗳️',
    color: '#4169E1',
    priority: NotificationPriority.WARNING,
  },
  [WMDEventType.CLAN_VOTE_PASSED]: {
    title: '✅ Vote Passed',
    message: (data) => `Clan vote to ${data.voteType} has passed!`,
    icon: '✅',
    color: '#228B22',
    priority: NotificationPriority.ALERT,
  },
  [WMDEventType.CLAN_AUTHORIZATION]: {
    title: '🔓 Launch Authorized',
    message: (data) => `${data.clanName} has authorized a ${data.warheadType} missile launch!`,
    icon: '🔓',
    color: '#FF4500',
    priority: NotificationPriority.CRITICAL,
  },
};

/**
 * Notification expiration times (milliseconds)
 */
export const NOTIFICATION_EXPIRATION = {
  [NotificationPriority.INFO]: 86400000,      // 24 hours
  [NotificationPriority.WARNING]: 172800000,  // 48 hours
  [NotificationPriority.ALERT]: 259200000,    // 72 hours
  [NotificationPriority.CRITICAL]: 604800000, // 7 days
} as const;

// ============================================================================
// TYPE GUARDS & UTILITIES
// ============================================================================

/**
 * Check if event type is valid
 */
export function isValidEventType(type: string): type is WMDEventType {
  return Object.values(WMDEventType).includes(type as WMDEventType);
}

/**
 * Check if priority is valid
 */
export function isValidPriority(priority: string): priority is NotificationPriority {
  return Object.values(NotificationPriority).includes(priority as NotificationPriority);
}

/**
 * Get notification template
 */
export function getNotificationTemplate(eventType: WMDEventType) {
  return NOTIFICATION_TEMPLATES[eventType];
}

/**
 * Generate notification message
 */
export function generateNotificationMessage(
  eventType: WMDEventType,
  data: any
): { title: string; message: string; icon: string; color: string } {
  const template = NOTIFICATION_TEMPLATES[eventType];
  return {
    title: template.title,
    message: template.message(data),
    icon: template.icon,
    color: template.color,
  };
}

/**
 * Calculate notification expiration
 */
export function calculateExpiration(priority: NotificationPriority): Date {
  const now = new Date();
  const expirationMs = NOTIFICATION_EXPIRATION[priority];
  return new Date(now.getTime() + expirationMs);
}

/**
 * Should player receive notification?
 */
export function shouldReceiveNotification(
  prefs: NotificationPreferences,
  notification: WMDNotification
): boolean {
  // Check global setting
  if (!prefs.receiveGlobalNotifications && notification.scope === NotificationScope.GLOBAL) {
    return false;
  }
  
  // Check clan setting
  if (!prefs.receiveClanNotifications && notification.scope === NotificationScope.CLAN) {
    return false;
  }
  
  // Check personal setting
  if (!prefs.receivePersonalNotifications && notification.scope === NotificationScope.PERSONAL) {
    return false;
  }
  
  // Check priority threshold
  const priorityOrder = [
    NotificationPriority.INFO,
    NotificationPriority.WARNING,
    NotificationPriority.ALERT,
    NotificationPriority.CRITICAL,
  ];
  const notificationLevel = priorityOrder.indexOf(notification.priority);
  const minLevel = priorityOrder.indexOf(prefs.minPriority);
  if (notificationLevel < minLevel) {
    return false;
  }
  
  // Check event type preference
  if (prefs.preferences[notification.eventType] === false) {
    return false;
  }
  
  return true;
}

// ============================================================================
// IMPLEMENTATION NOTES
// ============================================================================
/**
 * 1. Notification Scopes:
 *    - GLOBAL: All players (missile launches, Tier 10 unlocks)
 *    - CLAN: Clan members only (votes, authorizations)
 *    - PERSONAL: Individual player (research complete, spy results)
 *    - TARGETED: Specific player/clan (missile impact, sabotage)
 * 
 * 2. Priority Levels:
 *    - INFO: General information, low urgency
 *    - WARNING: Important events, moderate urgency
 *    - ALERT: Urgent events requiring attention
 *    - CRITICAL: Maximum priority (missile launches, impacts)
 * 
 * 3. WebSocket Integration:
 *    - Reuses /lib/websocket/broadcast.ts functions
 *    - broadcastToAll() for GLOBAL scope
 *    - broadcastToClan() for CLAN scope
 *    - broadcastToUser() for PERSONAL/TARGETED scope
 *    - Event type: 'wmd_notification'
 * 
 * 4. Notification Preferences:
 *    - Players can opt out of specific event types
 *    - Minimum priority threshold filtering
 *    - Separate controls for global/clan/personal
 *    - Default: receive all notifications
 * 
 * 5. Message Templates:
 *    - Predefined templates for each event type
 *    - Dynamic data injection (player names, warhead types, etc.)
 *    - Consistent formatting with icons and colors
 *    - Customizable per notification if needed
 * 
 * 6. Expiration Strategy:
 *    - INFO: 24 hours
 *    - WARNING: 48 hours
 *    - ALERT: 72 hours
 *    - CRITICAL: 7 days
 *    (Prevents notification spam accumulation)
 * 
 * 7. Critical Events (Global Broadcast):
 *    - Missile launches (all warhead types)
 *    - Tier 10 tech unlocks (game-changing)
 *    - Intelligence leaks (public exposure)
 *    - Clan Buster detonations (affects many players)
 * 
 * 8. Real-Time Updates:
 *    - WebSocket for instant delivery
 *    - Database persistence for history
 *    - View tracking (who saw what)
 *    - Unread count management
 */

// ============================================================================
// END OF FILE
// ============================================================================
