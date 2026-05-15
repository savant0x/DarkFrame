import re

# ─── 1. Add missing columns to messages table in database.ts ───
with open('types/database.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old_messages_row = '''      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          read: boolean | null
          read_at: string | null
          sender_username: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          sender_username: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          sender_username?: string
        }'''

new_messages_row = '''      messages: {
        Row: {
          content: string
          content_type: string
          conversation_id: string | null
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          read: boolean | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
          sender_username: string
          status: string
        }
        Insert: {
          content: string
          content_type?: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          sender_username: string
          status?: string
        }
        Update: {
          content?: string
          content_type?: string
          conversation_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read?: boolean | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
          sender_username?: string
          status?: string
        }'''

content = content.replace(old_messages_row, new_messages_row)
print("Added missing columns to messages table")

# ─── 2. Fix mapConversationToDb JSON.stringify in messagingService.ts ───
# with open('lib/messagingService.ts', 'r', encoding='utf-8') as f:
#     msg_content = f.read()
# 
# old_map_func = '''    last_message: conv.lastMessage
#       ? {
#           content: conv.lastMessage.content,
#           sender_id: conv.lastMessage.senderId,
#           created_at: conv.lastMessage.createdAt.toISOString(),
#           status: conv.lastMessage.status,
#         }
#       : null,'''
# 
# new_map_func = '''    last_message: conv.lastMessage
#       ? JSON.stringify({
#           content: conv.lastMessage.content,
#           sender_id: conv.lastMessage.senderId,
#           created_at: conv.lastMessage.createdAt.toISOString(),
#           status: conv.lastMessage.status,
#         })
#       : null,'''
# 
# msg_content = msg_content.replace(old_map_func, new_map_func)
# print("Fixed mapConversationToDb JSON.stringify")
# 
# with open('lib/messagingService.ts', 'w', encoding='utf-8') as f:
#     f.write(msg_content)

with open('types/database.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
