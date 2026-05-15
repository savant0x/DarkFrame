import re

with open('types/wmd/notification.types.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# ─── 1. Replace WMDEventType (type only) with const + type ───
old_wmd_type = '''export type WMDEventType = Database['public']['Enums']['wmd_notification_type'];'''

new_wmd_type = '''export const WMDEventType = {
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
} as const;

export type WMDEventType = typeof WMDEventType[keyof typeof WMDEventType];'''

assert old_wmd_type in content, f"Could not find old WMDEventType type"
content = content.replace(old_wmd_type, new_wmd_type)
print("Replaced WMDEventType type with const + type")

# ─── 2. Fix [key: string]: any → Record<string, string | number | boolean | null> ───
content = content.replace(
    '    [key: string]: any;            // Flexible for event-specific data',
    '    [key: string]: string | number | boolean | null;'
)
print("Fixed [key: string]: any in WMDNotification")

# ─── 3. Fix Record<string, any> → Record<string, string | number | boolean | null> ───
content = content.replace(
    '  details: Record<string, any>;',
    '  details: Record<string, string | number | boolean | null>;'
)
print("Fixed Record<string, any> in NotificationRequest")

content = content.replace(
    '  details: Record<string, any>;',
    '  details: Record<string, string | number | boolean | null>;'
)
print("Fixed Record<string, any> in WMDWebSocketEvent")

# ─── 4. Fix (data: any) → (data: Record<string, string | number | boolean | null>) ───
content = content.replace(
    '  message: (data: any) => string;',
    '  message: (data: Record<string, string | number | boolean | null>) => string;'
)
print("Fixed (data: any) in NOTIFICATION_TEMPLATES")

# ─── 5. Fix data: any in generateNotificationMessage ───
content = content.replace(
    '  data: any',
    '  data: Record<string, string | number | boolean | null>'
)
print("Fixed data: any in generateNotificationMessage")

# ─── 6. Fix WMDAction payload: any → Record<string, unknown> ───
# (in types/wmd/index.ts - this file is separate, but we check)
content = content.replace(
    "  payload: any;",
    "  payload: Record<string, unknown>;"
)
print("Fixed payload: any in WMDAction")

with open('types/wmd/notification.types.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
