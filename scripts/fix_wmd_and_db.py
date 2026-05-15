import re

# ─── 1. Fix notification.types.ts ───
with open('types/wmd/notification.types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Update WMDEventType const with unique values
old_wmd_const = '''export const WMDEventType = {
  MISSILE_ASSEMBLED: 'missile_launched',
  MISSILE_LAUNCHED: 'missile_launched',
  MISSILE_DETECTED: 'missile_incoming',
  MISSILE_INTERCEPTED: 'missile_intercepted',
  MISSILE_IMPACTED: 'missile_impact',
  MISSILE_DISMANTLED: 'missile_launched',
  INTELLIGENCE_LEAK: 'spy_detected',
  SPY_MISSION_COMPLETED: 'spy_mission_complete',
  SPY_MISSION_FAILED: 'spy_mission_complete',
  SPY_DETECTED: 'spy_detected',
  SABOTAGE_SUCCESSFUL: 'sabotage_successful',
  ASSASSINATION: 'spy_captured',
  BATTERY_DEPLOYED: 'defense_activated',
  RADAR_ONLINE: 'defense_upgraded',
  DEFENSE_GRID_ACTIVATED: 'defense_activated',
  RESEARCH_COMPLETED: 'research_complete',
  TIER_10_UNLOCKED: 'tech_unlocked',
  CLAN_VOTE_STARTED: 'vote_started',
  CLAN_VOTE_PASSED: 'vote_complete',
  CLAN_AUTHORIZATION: 'vote_started',
} as const;'''

new_wmd_const = '''export const WMDEventType = {
  MISSILE_ASSEMBLED: 'missile_assembled',
  MISSILE_LAUNCHED: 'missile_launched',
  MISSILE_DETECTED: 'missile_incoming',
  MISSILE_INTERCEPTED: 'missile_intercepted',
  MISSILE_IMPACTED: 'missile_impact',
  MISSILE_DISMANTLED: 'missile_dismantled',
  INTELLIGENCE_LEAK: 'intelligence_leak',
  SPY_MISSION_COMPLETED: 'spy_mission_complete',
  SPY_MISSION_FAILED: 'spy_mission_failed',
  SPY_DETECTED: 'spy_detected',
  SABOTAGE_SUCCESSFUL: 'sabotage_successful',
  ASSASSINATION: 'spy_captured',
  BATTERY_DEPLOYED: 'defense_activated',
  RADAR_ONLINE: 'defense_upgraded',
  DEFENSE_GRID_ACTIVATED: 'defense_grid_activated',
  RESEARCH_COMPLETED: 'research_complete',
  TIER_10_UNLOCKED: 'tech_unlocked',
  CLAN_VOTE_STARTED: 'vote_started',
  CLAN_VOTE_PASSED: 'vote_complete',
  CLAN_AUTHORIZATION: 'clan_authorization',
} as const;'''

content = content.replace(old_wmd_const, new_wmd_const)

# Fix details index signature - use interface with both known props and index
old_details = '''export interface WMDNotification {
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
    [key: string]: string | number | boolean | null;
  };'''

new_details = '''export interface WMDNotification {
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
  details: WMDNotificationDetails;'''

content = content.replace(old_details, new_details)

# Add the WMDNotificationDetails type after the imports
old_imports_end = '''import { MissionType } from './intelligence.types';

// ============================================================================
// ENUMS
// ============================================================================'''

new_imports_end = '''import { MissionType } from './intelligence.types';

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Flexible notification details with known optional properties and index signature.
 */
export interface WMDNotificationDetails {
  missileId?: string;
  warheadType?: WarheadType;
  missionType?: MissionType;
  techId?: string;
  techTier?: number;
  damageDealt?: number;
  unitsDestroyed?: number;
}

// ============================================================================
// ENUMS
// ============================================================================'''

content = content.replace(old_imports_end, new_imports_end)

# Fix WMDNotificationDetails interface index signature
# It should allow flexible additional properties

# Fix flightTime arithmetic in template
old_flight = "Math.floor(data.flightTime / 60000)"
new_flight = "Math.floor(Number(data.flightTime) / 60000)"
content = content.replace(old_flight, new_flight)

# Fix NotificationRequest.details type
content = content.replace(
    '  details: Record<string, string | number | boolean | null>;',
    '  details: Record<string, string | number | boolean | null>;'
)

# Fix WMDWebSocketEvent.details type
content = content.replace(
    '  details: Record<string, string | number | boolean | null>;',
    '  details: Record<string, string | number | boolean | null>;'
)

with open('types/wmd/notification.types.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated notification.types.ts")

# ─── 2. Add new enum values to database.ts ───
with open('types/database.ts', 'r', encoding='utf-8') as f:
    db_content = f.read()

old_db_enum = '''      wmd_notification_type:
        | "missile_launched"
        | "missile_incoming"
        | "missile_impact"
        | "missile_intercepted"
        | "spy_dispatched"
        | "spy_detected"
        | "spy_captured"
        | "spy_mission_complete"
        | "sabotage_detected"
        | "sabotage_repelled"
        | "sabotage_successful"
        | "defense_activated"
        | "defense_upgraded"
        | "defense_breached"
        | "research_complete"
        | "tech_unlocked"
        | "vote_started"
        | "vote_complete"
        | "vote_tie"'''

new_db_enum = '''      wmd_notification_type:
        | "missile_assembled"
        | "missile_launched"
        | "missile_incoming"
        | "missile_impact"
        | "missile_intercepted"
        | "missile_dismantled"
        | "intelligence_leak"
        | "spy_dispatched"
        | "spy_detected"
        | "spy_captured"
        | "spy_mission_complete"
        | "spy_mission_failed"
        | "sabotage_detected"
        | "sabotage_repelled"
        | "sabotage_successful"
        | "defense_activated"
        | "defense_upgraded"
        | "defense_breached"
        | "defense_grid_activated"
        | "research_complete"
        | "tech_unlocked"
        | "vote_started"
        | "vote_complete"
        | "vote_tie"
        | "clan_authorization"'''

db_content = db_content.replace(old_db_enum, new_db_enum)
print("Updated wmd_notification_type enum in database.ts")

with open('types/database.ts', 'w', encoding='utf-8') as f:
    f.write(db_content)

print("Done!")
