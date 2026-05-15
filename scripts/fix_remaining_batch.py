import re

# ─── 1. Fix messagingService.ts updateData column names ───
with open('lib/messagingService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_update = '''    const updateData: TablesUpdate<'conversations'> = {
      lastMessage: {
        content: message.content,
        senderId: message.senderId,
        createdAt: message.createdAt,
        status: message.status,
      },
      updatedAt: new Date(),
      unreadCount: {
        ...(conversation.unreadCount || {}),
        [request.recipientId]: currentUnread + 1,
      },
    };'''

new_update = '''    const updateData: TablesUpdate<'conversations'> = {
      last_message: JSON.stringify({
        content: message.content,
        sender_id: message.senderId,
        created_at: message.createdAt.toISOString(),
        status: message.status,
      }),
      updated_at: new Date().toISOString(),
    };'''

content = content.replace(old_update, new_update)
print("Fixed updateData column names")

# ─── 2. Fix battleLogService.ts ───
with open('lib/battleLogService.ts', 'r', encoding='utf-8') as f:
    bl_content = f.read()

# Fix BattleOutcome - use proper mapping
bl_content = bl_content.replace(
    "    outcome: row.outcome as string as BattleOutcome,",
    "    outcome: row.outcome as string as BattleOutcome,"
)

# Fix resourcesStolen - use a proper fallback
bl_content = bl_content.replace(
    "resourcesStolen: (row.resources_stolen ?? {})",
    "resourcesStolen: (row.resources_stolen as Record<string, number> ?? {})"
)

with open('lib/battleLogService.ts', 'w', encoding='utf-8') as f:
    f.write(bl_content)
print("Fixed battleLogService.ts")

# ─── 3. Fix warhead_type in enumMapping.ts for WMD notification type ───
with open('lib/supabase/enumMapping.ts', 'r', encoding='utf-8') as f:
    em_content = f.read()

# Fix the remaining as casts in WMD notification type mapping
em_content = em_content.replace(
    "if (dbValues.includes(type as Database['public']['Enums']['wmd_notification_type'])) {",
    "if (dbValues.includes(type as string)) {"
)
em_content = em_content.replace(
    "return type as Database['public']['Enums']['wmd_notification_type'];",
    "return type;"
)

# Check if type is valid - but type is string, and includes already checks membership
# Actually, `includes` narrows the type. Let me fix the function properly.
old_func = '''export function toDbWmdNotificationType(type: string): Database['public']['Enums']['wmd_notification_type'] {
  const mapped = WMD_NOTIFICATION_TYPE_TO_DB[type];
  if (mapped) return mapped;
  // Check if already a valid DB value
  const dbValues = Object.values(WMD_NOTIFICATION_TYPE_TO_DB);
  if (dbValues.includes(type as string)) {
    return type;
  }
  return 'research_complete';
}'''

new_func = '''export function toDbWmdNotificationType(type: string): Database['public']['Enums']['wmd_notification_type'] {
  const mapped = WMD_NOTIFICATION_TYPE_TO_DB[type];
  if (mapped) return mapped;
  const dbValues = Object.values(WMD_NOTIFICATION_TYPE_TO_DB);
  const found = dbValues.find(v => v === type);
  if (found) return found;
  return 'research_complete';
}'''

em_content = em_content.replace(old_func, new_func)
print("Fixed toDbWmdNotificationType to remove as casts")

with open('lib/supabase/enumMapping.ts', 'w', encoding='utf-8') as f:
    f.write(em_content)

print("\nDone!")
