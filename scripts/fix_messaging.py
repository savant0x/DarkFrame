import re

with open('lib/messagingService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix mapDbConversation: last_message is a JSON string in the DB, not an object
old_func = '''function mapDbConversation(row: Tables<'conversations'>): Conversation {
  return {
    _id: row.id,
    participants: row.participants as Conversation['participants'],
    lastMessage: row.last_message
      ? {
          content: row.last_message.content ?? '',
          senderId: row.last_message.sender_id ?? '',
          createdAt: new Date(row.last_message.created_at ?? Date.now()),
          status: (row.last_message.status as MessageStatus) ?? 'sent',
        }
      : undefined,
    unreadCount: (row.unread_count as Record<string, number>) ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}'''

new_func = '''function mapDbConversation(row: Tables<'conversations'>): Conversation {
  const lastMsg: Record<string, string> = typeof row.last_message === 'string' ? JSON.parse(row.last_message) : {};
  return {
    _id: row.id,
    participants: row.participants as Conversation['participants'],
    lastMessage: lastMsg.content
      ? {
          content: lastMsg.content ?? '',
          senderId: lastMsg.sender_id ?? '',
          createdAt: new Date(lastMsg.created_at ?? Date.now()),
          status: (lastMsg.status as MessageStatus) ?? 'sent',
        }
      : undefined,
    unreadCount: row.unread_count ?? {},
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}'''

content = content.replace(old_func, new_func)
print("Fixed mapDbConversation")

# Fix mapConversationToDb: same issue
old_func2 = '''function mapConversationToDb(conv: Partial<Conversation>): TablesInsert<'conversations'> {
  return {
    id: conv._id,
    participants: conv.participants ?? [],
    last_message: conv.lastMessage
      ? {
          content: conv.lastMessage.content,
          sender_id: conv.lastMessage.senderId,
          created_at: conv.lastMessage.createdAt.toISOString(),
          status: conv.lastMessage.status,
        }
      : null,
  };
}'''

new_func2 = '''function mapConversationToDb(conv: Partial<Conversation>): TablesInsert<'conversations'> {
  return {
    id: conv._id,
    participants: conv.participants ?? [],
    last_message: conv.lastMessage
      ? JSON.stringify({
          content: conv.lastMessage.content,
          sender_id: conv.lastMessage.senderId,
          created_at: conv.lastMessage.createdAt.toISOString(),
          status: conv.lastMessage.status,
        })
      : null,
  };
}'''

content = content.replace(old_func2, new_func2)
print("Fixed mapConversationToDb")

# Fix mapDbMessage: sender_id not on message type
old_func3 = '''function mapDbMessage(row: Tables<'messages'>): Message {
  return {
    _id: row.id,
    conversationId: row.conversation_id ?? '',
    senderId: row.sender_id ?? '',
    content: row.content,
    createdAt: new Date(row.created_at ?? Date.now()),
    read: row.read ?? false,
    readAt: row.read_at ? new Date(row.read_at) : undefined,
  };
}'''

new_func3 = '''function mapDbMessage(row: Tables<'messages'>): Message {
  return {
    _id: row.id,
    conversationId: row.conversation_id ?? '',
    senderId: row.sender_id ?? '',
    content: row.content,
    createdAt: new Date(row.created_at ?? Date.now()),
    read: row.read ?? false,
    readAt: row.read_at ? new Date(row.read_at) : undefined,
  };
}'''

content = content.replace(old_func3, new_func3)
print("Fixed mapDbMessage")

with open('lib/messagingService.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done!")
