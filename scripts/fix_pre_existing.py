import re

# ─── 1. Fix messagingService.ts ───
with open('lib/messagingService.ts', 'r', encoding='utf-8') as f:
    msg_content = f.read()

# Fix unreadCount type: DB stores number, domain expects Record<string, number>
msg_content = msg_content.replace(
    '    unreadCount: row.unread_count ?? {},',
    "    unreadCount: typeof row.unread_count === 'number' ? { total: row.unread_count } : {},"
)
print("Fixed unreadCount conversion")

# Fix sender_id null handling
msg_content = msg_content.replace(
    "    senderId: row.sender_id,",
    "    senderId: row.sender_id ?? '',"
)
print("Fixed senderId null")

# Fix recipient_id null handling
msg_content = msg_content.replace(
    "    recipientId: row.recipient_id,",
    "    recipientId: row.recipient_id ?? '',"
)
print("Fixed recipientId null")

# Add TablesUpdate import
msg_content = msg_content.replace(
    "import type { Tables, TablesInsert } from '@/types/database';",
    "import type { Tables, TablesInsert, TablesUpdate } from '@/types/database';"
)
print("Added TablesUpdate import")

with open('lib/messagingService.ts', 'w', encoding='utf-8') as f:
    f.write(msg_content)

# ─── 2. Add missing exports to jsonb.ts ───
with open('lib/supabase/jsonb.ts', 'r', encoding='utf-8') as f:
    jsonb_content = f.read()

# Add helper functions at the end of the file
old_end = "export function toJsonbArray<T>(value: T[]): Json {\n  return value as unknown as Json;\n}\n"
new_end = old_end.rstrip('}\n').rstrip() + '''
export function toJsonbArray<T>(value: T[]): Json {
  return value as Json;
}

/**
 * Parse a JSONB column as a typed record, returning a default if null/undefined.
 */
export function parseJsonRecord<T>(value: Json | null | undefined, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  return value as T;
}

/**
 * Parse a JSON string field (stored as JSONB string).
 */
export function parseJsonString(value: Json | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Parse bot migration config from JSONB
 */
export function parseBotMigrationConfig(value: Json | null | undefined): Record<string, number> {
  const parsed = parseJsonRecord<Record<string, number>>(value, {});
  return parsed;
}

/**
 * Parse flag bot config from JSONB
 */
export function parseFlagBotConfig(value: Json | null | undefined): Record<string, unknown> {
  const parsed = parseJsonRecord<Record<string, unknown>>(value, {});
  return parsed;
}
'''

jsonb_content = jsonb_content.replace(old_end, new_end)
print("Added missing exports to jsonb.ts")

with open('lib/supabase/jsonb.ts', 'w', encoding='utf-8') as f:
    f.write(jsonb_content)

# ─── 3. Fix auctionService.ts Database import ───
with open('lib/auctionService.ts', 'r', encoding='utf-8') as f:
    auction_content = f.read()

# Add Database import if missing
if "import type { Database }" not in auction_content:
    auction_content = auction_content.replace(
        "import type { Tables }",
        "import type { Database, Tables }"
    )
    print("Added Database import to auctionService.ts")

with open('lib/auctionService.ts', 'w', encoding='utf-8') as f:
    f.write(auction_content)

print("\nDone!")
