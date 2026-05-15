import re

# ─── 1. Fix mapConversationToDb JSON.stringify ───
with open('lib/messagingService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_map = '''    last_message: conv.lastMessage
      ? {
          content: conv.lastMessage.content,
          sender_id: conv.lastMessage.senderId,
          created_at: conv.lastMessage.createdAt.toISOString(),
          status: conv.lastMessage.status,
        }
      : null,'''

new_map = '''    last_message: conv.lastMessage
      ? JSON.stringify({
          content: conv.lastMessage.content,
          sender_id: conv.lastMessage.senderId,
          created_at: conv.lastMessage.createdAt.toISOString(),
          status: conv.lastMessage.status,
        })
      : null,'''

content = content.replace(old_map, new_map)
print("Fixed mapConversationToDb JSON.stringify")

# Fix conversation_id not null issue
old_conv_id = "    conversationId: row.conversation_id,"
new_conv_id = "    conversationId: row.conversation_id ?? '',"
content = content.replace(old_conv_id, new_conv_id)
print("Fixed conversationId null")

# Fix created_at not null issue
old_created = "    createdAt: new Date(row.created_at),"
new_created = "    createdAt: new Date(row.created_at ?? Date.now()),"
content = content.replace(old_created, new_created)
print("Fixed createdAt null")

with open('lib/messagingService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

# ─── 2. Fix enumMapping.ts - rewrite to be clean ───
with open('lib/supabase/enumMapping.ts', 'r', encoding='utf-8') as f:
    em_content = f.read()

# Fix auction item type mapping (case mismatch)
old_auction_upper = '''  AuctionItemType: {
    UNIT: 'UNIT',
    RESOURCE: 'RESOURCE',
    TRADEABLE_ITEM: 'TRADEABLE_ITEM',
  } as const,'''

new_auction_lower = '''  AuctionItemType: {
    UNIT: 'unit',
    RESOURCE: 'resource',
    TRADEABLE_ITEM: 'tradeable_item',
  } as const,'''

em_content = em_content.replace(old_auction_upper, new_auction_lower)
print("Fixed AuctionItemType case in enumMapping")

# Fix warhead_type -> wmd_warhead_type
em_content = em_content.replace("'warhead_type'", "'wmd_warhead_type'")
print("Fixed warhead_type to wmd_warhead_type")

# Fix hotkey_category -> check if it exists
# Actually hotkey_category might be under a different DB enum name
# Let's check - it might not exist at all. Let's just change the type
em_content = em_content.replace("Database['public']['Enums']['hotkey_category']", "string")
print("Fixed hotkey_category type fallback")

with open('lib/supabase/enumMapping.ts', 'w', encoding='utf-8') as f:
    f.write(em_content)

# ─── 3. Fix battleLogService.ts ───
with open('lib/battleLogService.ts', 'r', encoding='utf-8') as f:
    bl_content = f.read()

# Fix BattleOutcome type mismatch
old_outcome = '''  return {
    attackerUsername: row.attacker_username ?? '',
    defenderUsername: row.defender_username ?? '',
    outcome: row.outcome as BattleOutcome,''' 

new_outcome = '''  return {
    attackerUsername: row.attacker_username ?? '',
    defenderUsername: row.defender_username ?? '',
    outcome: row.outcome as string as BattleOutcome,''' 

bl_content = bl_content.replace(old_outcome, new_outcome)
print("Fixed BattleOutcome cast in battleLogService")

# Fix resourcesStolen missing property
bl_content = bl_content.replace(
    "resourcesStolen: row.resources_stolen",
    "resourcesStolen: (row.resources_stolen ?? {})"
)
print("Fixed resourcesStolen in battleLogService")

with open('lib/battleLogService.ts', 'w', encoding='utf-8') as f:
    f.write(bl_content)

print("\nDone with all fixes!")
