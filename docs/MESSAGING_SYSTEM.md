# Private Messaging System - Complete Documentation

> **Status (2026-09-16 audit):** current — Postgres/Drizzle persistence
> (`conversations` / `messages`, see `lib/db/schema/messages.ts`).

**Feature ID:** FID-20251025-102
**Created:** October 25, 2025
**Status:** ✅ COMPLETED
**Version:** 1.0.0 (backend: Postgres/Drizzle as of the pivot)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Setup Guide](#setup-guide)
5. [API Reference](#api-reference)
6. [Socket.io Events](#socketio-events)
7. [Component Usage](#component-usage)
8. [Database Schema](#database-schema)
9. [Security & Rate Limiting](#security--rate-limiting)
10. [Performance Optimization](#performance-optimization)
11. [Troubleshooting](#troubleshooting)
12. [Future Enhancements](#future-enhancements)

---

## 🎯 Overview

The Private Messaging System provides a complete real-time communication platform for DarkFrame players. It combines **persistent Postgres storage** with **real-time Socket.io delivery**, enabling both instant chat and traditional messaging functionality.

### Key Capabilities

- **Dual-Mode Messaging**: Real-time chat when online + persistent storage for offline messages
- **Rich Features**: Emoji picker, typing indicators, read receipts, message search
- **Security First**: Profanity filtering, rate limiting (20 msgs/min), input validation
- **Responsive Design**: Split-pane (desktop) and stacked (mobile) layouts
- **Performance**: Indexed Postgres tables for fast queries

### Technology Stack

- **Frontend**: React, Next.js 16, TypeScript, Tailwind CSS
- **Real-time**: Socket.io (custom HTTP server with JWT auth)
- **Storage**: Postgres/Drizzle (`conversations` / `messages` tables —
  see Database Schema below)
- **Packages**: bad-words, linkify-react, linkifyjs, react-mentions
  (installed — see `package.json`; `@emoji-mart` and `string-similarity`
  are NOT installed)

---

## ✨ Features

### Core Functionality

✅ **1-on-1 Private Conversations**
- Direct messaging between any two players
- Automatic conversation creation on first message
- Persistent message history (never deleted)

✅ **Real-Time Delivery**
- Instant message delivery when both users online
- Typing indicators show when recipient is typing
- Read receipts show when messages are read
- Live conversation updates (new messages, unread counts)

✅ **Offline Support**
- Messages saved to database even when recipient offline
- Full message history available on login
- Unread message counters
- Conversation list sorted by most recent activity

✅ **Rich Text Features**
- Emoji quick-insert row (built-in; `@emoji-mart` was removed as
  React-19-incompatible — see `components/messaging/MessageThread.tsx`)
- URL auto-linking with previews
- @mention support (react-mentions)
- Character counter (1000 char limit)
- Multi-line message support

✅ **Content Moderation**
- Profanity filtering (bad-words library)
- Spam control via rate limiting (20 msgs/min; no similarity library installed)
- Rate limiting (20 messages per minute per user)
- Input validation and sanitization

✅ **User Experience**
- Search conversations by username
- Filter: All, Unread, Pinned, Archived
- Message pagination (50 messages per page)
- Connection status indicator
- Mobile-responsive layout
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                        │
├─────────────────────────────────────────────────────────────┤
│  app/messages/page.tsx                                      │
│  ├── MessageInbox (conversation list)                       │
│  ├── MessageThread (chat interface)                         │
│  └── useWebSocket() hook                                    │
│                                                              │
│  Socket.io Client ←──────────────────┐                     │
└────────────────────────────────────────┼────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │    HTTP/WebSocket  │                    │
                    └────────────────────┼────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────┐
│                    SERVER              │                    │
├────────────────────────────────────────┼────────────────────┤
│  server.ts (Custom HTTP + Socket.io)   │                    │
│  lib/websocket/server.ts               │                    │
│  ├── JWT Authentication                │                    │
│  ├── messagingHandlers.ts (6 handlers) │                    │
│  └── Room-based broadcasting           │                    │
│                                         │                    │
│  API Routes                             │                    │
│  ├── /api/messages (GET/POST)          │                    │
│  ├── /api/messages/conversations        │                    │
│  └── /api/messages/read                 │                    │
│                                         │                    │
│  lib/messagingService.ts                │                    │
│  ├── validateMessage()                  │                    │
│  ├── checkRateLimit()                   │                    │
│  ├── sendMessage()                      │                    │
│  ├── getMessageHistory()                │                    │
│  └── markMessagesAsRead()               │                    │
└────────────────────────────────────────┼────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │    Drizzle → Postgres │                   │
                    └────────────────────┼────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────┐
│                   DATABASE             │                    │
├────────────────────────────────────────┼────────────────────┤
│  Postgres Tables                       │                    │
│  ├── conversations (metadata)          │                    │
│  │   └── Index: updated_at                                    │
│  └── messages (content)                │                    │
│      └── Indexes: (conversation_id, created_at),              │
│          (recipient_id, status)                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**Sending a Message:**
1. User types in MessageThread → clicks Send
2. MessageThread POST to `/api/messages` → returns message object
3. API route calls `messagingService.sendMessage()` → saves to Postgres
4. Client emits Socket.io `message:send` event
5. Server `handleMessageSend()` validates → broadcasts `message:receive` to recipient
6. Recipient's MessageThread receives event → updates UI instantly

**Receiving a Message:**
1. Server broadcasts `message:receive` event to recipient's Socket.io room
2. Messages page `on('message:receive')` handler updates conversation list
3. MessageThread (if open) receives event and appends to message list
4. Unread counter increments if conversation not focused
5. Read receipt sent when message viewed

---

## 🚀 Setup Guide

### Prerequisites

- Node.js 18+ installed
- Postgres database reachable (`DATABASE_URL` in `.env.local`)
- NPM packages installed (see package.json)

### Installation Steps

**1. Install Dependencies**

```bash
npm install bad-words linkify-react linkifyjs react-mentions
```

> Do not add other packages: `@emoji-mart/react`, `@emoji-mart/data`,
> `string-similarity`, and `web-push` (+ `@types/*`) are not installed or
> imported — the emoji row is built in and spam control is rate limiting.

**2. Environment Variables**

Add to `.env.local`:

```env
DATABASE_URL=postgresql://user:password@host:5432/darkframe
```

**3. Apply Migrations**

Messaging tables (`conversations`, `messages`) and their indexes ship in
`lib/db/schema/messages.ts` — apply migrations, no manual index setup.

**4. Start Development Server**

```bash
npm run dev
```

Server will start on `http://localhost:3000` with Socket.io enabled.

**5. Test Messaging**

1. Login as User A → Navigate to `/messages`
2. Login as User B in incognito window → Navigate to `/messages`
3. User A sends message to User B
4. Verify real-time delivery
5. Query Postgres (`messages` table) to confirm persistence

---

## 📡 API Reference

### GET `/api/messages`

Retrieve message history for a conversation.

**Query Parameters:**
- `playerId` (required): Current user's username
- `recipientId` (required): Other user's username
- `limit` (optional): Messages per page (default: 50, max: 100)
- `before` (optional): ISO timestamp for pagination (get messages before this time)

**Example Request:**
```typescript
const response = await fetch(
  `/api/messages?playerId=player1&recipientId=player2&limit=50`
);
const data = await response.json();
```

**Response (200 OK):**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "67123abc...",
      "conversationId": "67123def...",
      "senderId": "player1",
      "recipientId": "player2",
      "content": "Hello!",
      "status": "read",
      "createdAt": "2025-10-25T14:30:00.000Z",
      "readAt": "2025-10-25T14:31:00.000Z"
    }
  ],
  "hasMore": false
}
```

**Error Responses:**
- `400`: Missing required parameters
- `500`: Server error

---

### POST `/api/messages`

Send a new message.

**Request Body:**
```json
{
  "senderId": "player1",
  "recipientId": "player2",
  "content": "Hello, how are you?"
}
```

**Validation:**
- `senderId`: Required, non-empty string
- `recipientId`: Required, non-empty string, different from senderId
- `content`: Required, 1-1000 characters, trimmed

**Response (200 OK):**
```json
{
  "success": true,
  "message": {
    "_id": "67123abc...",
    "conversationId": "67123def...",
    "senderId": "player1",
    "recipientId": "player2",
    "content": "Hello, how are you?",
    "status": "sent",
    "createdAt": "2025-10-25T14:30:00.000Z"
  },
  "conversation": {
    "_id": "67123def...",
    "participants": ["player1", "player2"],
    "lastMessage": { ... },
    "unreadCount": { "player2": 1 }
  }
}
```

**Error Responses:**
- `400`: Validation failed (empty content, self-messaging, profanity, rate limit)
- `500`: Server error

---

### GET `/api/messages/conversations`

List all conversations for a user.

**Query Parameters:**
- `playerId` (required): Current user's username
- `limit` (optional): Conversations per page (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Example Request:**
```typescript
const response = await fetch(`/api/messages/conversations?playerId=player1`);
const data = await response.json();
```

**Response (200 OK):**
```json
{
  "success": true,
  "conversations": [
    {
      "_id": "67123def...",
      "participants": ["player1", "player2"],
      "lastMessage": {
        "content": "See you later!",
        "senderId": "player2",
        "createdAt": "2025-10-25T15:00:00.000Z"
      },
      "unreadCount": {
        "player1": 3,
        "player2": 0
      },
      "createdAt": "2025-10-25T10:00:00.000Z",
      "updatedAt": "2025-10-25T15:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/messages/read`

Mark messages as read.

**Request Body:**
```json
{
  "playerId": "player1",
  "conversationId": "67123def...",
  "messageId": "67123abc..."
}
```

**Note:** If `messageId` omitted, marks ALL messages in conversation as read.

**Response (200 OK):**
```json
{
  "success": true,
  "updatedCount": 5
}
```

---

## 🔌 Socket.io Events

### Client-to-Server Events

#### `message:send`

Send a message via Socket.io (alternative to REST API).

**Payload:**
```typescript
{
  recipientId: string;
  content: string;
  tempId?: string; // Optional client-side ID for optimistic updates
  callback?: (response: { success: boolean; message?: Message; error?: string }) => void;
}
```

**Example:**
```typescript
const { emit } = useWebSocket();

emit('message:send', {
  recipientId: 'player2',
  content: 'Hello via Socket.io!',
  tempId: 'temp-123',
}, (response) => {
  if (response.success) {
    console.log('Message sent:', response.message);
  } else {
    console.error('Failed:', response.error);
  }
});
```

**Server Response (via callback):**
```json
{
  "success": true,
  "message": { ... }
}
```

---

#### `message:mark_read`

Mark messages as read via Socket.io.

**Payload:**
```typescript
{
  conversationId: string;
  messageId?: string; // Optional, omit to mark all as read
}
```

**Example:**
```typescript
emit('message:mark_read', {
  conversationId: '67123def...',
  messageId: '67123abc...'
});
```

**Broadcasts:** `message:read` event to sender with read receipt.

---

#### `typing:start_private`

Notify recipient that user is typing.

**Payload:**
```typescript
{
  conversationId: string;
  recipientId: string;
}
```

**Example:**
```typescript
emit('typing:start_private', {
  conversationId: '67123def...',
  recipientId: 'player2'
});
```

**Broadcasts:** `typing:start` to recipient.

---

#### `typing:stop_private`

Notify recipient that user stopped typing.

**Payload:**
```typescript
{
  conversationId: string;
  recipientId: string;
}
```

---

#### `conversation:join`

Join a conversation's Socket.io room (for targeted broadcasts).

**Payload:**
```typescript
{
  conversationId: string;
}
```

**Example:**
```typescript
emit('conversation:join', { conversationId: '67123def...' });
```

**Effect:** Socket joins `conversation_{conversationId}` room.

---

#### `conversation:leave`

Leave a conversation's Socket.io room.

**Payload:**
```typescript
{
  conversationId: string;
}
```

---

### Server-to-Client Events

#### `message:receive`

New message received.

**Payload:**
```typescript
{
  _id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  tempId?: string;
}
```

**Example Handler:**
```typescript
const { on } = useWebSocket();

useEffect(() => {
  const unsub = on('message:receive', (payload) => {
    console.log('New message from', payload.senderId, ':', payload.content);
    // Update UI
  });
  
  return unsub;
}, [on]);
```

---

#### `conversation:updated`

Conversation metadata changed (new message, unread count, etc.).

**Payload:**
```typescript
{
  _id: string;
  participants: string[];
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: Date;
  };
  unreadCount: { [playerId: string]: number };
  updatedAt: Date;
}
```

---

#### `message:read`

Read receipt received.

**Payload:**
```typescript
{
  conversationId: string;
  messageId: string;
  playerId: string; // Who read it
  readAt: Date;
}
```

---

#### `typing:start`

User started typing.

**Payload:**
```typescript
{
  conversationId: string;
  playerId: string;
  username: string;
}
```

---

#### `typing:stop`

User stopped typing.

**Payload:**
```typescript
{
  conversationId: string;
  playerId: string;
}
```

---

#### `message:error`

Error occurred during message operation.

**Payload:**
```typescript
{
  error: string;
  code: 'RATE_LIMIT' | 'PROFANITY' | 'VALIDATION' | 'SERVER_ERROR';
  details?: any;
}
```

---

## 🧩 Component Usage

### MessageInbox

Displays list of conversations with search and filters.

**Import:**
```typescript
import { MessageInbox } from '@/components/messaging';
```

**Props:**
```typescript
interface MessageInboxProps {
  playerId: string; // Current user's username
  onConversationSelect: (conversationId: string) => void; // Selection callback
  selectedConversationId?: string; // Highlighted conversation
  className?: string; // Tailwind classes
}
```

**Example:**
```tsx
<MessageInbox
  playerId={player.username}
  onConversationSelect={(id) => setSelectedConv(id)}
  selectedConversationId={selectedConv}
  className="h-full"
/>
```

**Features:**
- Auto-loads conversations on mount
- Search by username
- Filters: All, Unread, Pinned, Archived
- Shows unread badges
- Displays last message preview
- Click to select conversation

---

### MessageThread

Displays chat interface for 1-on-1 conversation.

**Import:**
```typescript
import { MessageThread } from '@/components/messaging';
```

**Props:**
```typescript
interface MessageThreadProps {
  conversationId: string; // Conversation ID
  playerId: string; // Current user's username
  recipientId: string; // Other user's username
  recipientUsername: string; // Other user's display name
  className?: string; // Tailwind classes
}
```

**Example:**
```tsx
<MessageThread
  conversationId="67123def..."
  playerId={player.username}
  recipientId="player2"
  recipientUsername="Player Two"
  className="h-full"
/>
```

**Features:**
- Message history with pagination
- Emoji quick-insert row (built-in, not `@emoji-mart`)
- Typing indicators (placeholder for Socket.io)
- Character counter (1000 max)
- Auto-scroll to bottom
- Keyboard shortcuts (Enter to send, Shift+Enter for newline)

---

### Messages Page

Full messaging interface combining inbox and thread.

**Route:** `/messages`

**Features:**
- Split-pane layout (desktop): Inbox 1/3, Thread 2/3
- Stacked layout (mobile): Toggle between inbox and thread
- Real-time Socket.io integration
- Connection status indicator
- Unread message counter
- Automatic conversation room management
- Responsive design with back button (mobile)

**Access:**
Navigate to `/messages` in authenticated session. Uses `useGameContext()` for player data.

---

## 💾 Database Schema

### `conversations` Table

```typescript
{
  id: varchar(24);               // PK
  participants: string[];        // jsonb — [player1, player2]
  participantDetails?: object;   // jsonb
  lastMessageContent?: string;   // Last message text (≤1000 chars)
  lastMessageSenderId?: string;
  lastMessageCreatedAt?: Date;
  lastMessageStatus?: string;    // sent | delivered | read
  unreadCount: { [playerId: string]: number }; // jsonb
  createdAt: Date;
  updatedAt: Date;
  isArchived?: { [playerId: string]: boolean };  // jsonb
  isPinned?: { [playerId: string]: boolean };    // jsonb
  metadataTotalMessages?: number;
  metadataFirstMessageAt?: Date;
  metadataMuteUntil?: { [playerId: string]: string }; // jsonb
}
```

**Index:** `updated_at` (sorted conversation list)

---

### `messages` Table

```typescript
{
  id: varchar(24);               // PK
  conversationId: varchar(24);   // FK → conversations.id
  senderId: string;              // Sender's username
  recipientId: string;           // Recipient's username
  content: string;               // text — player messages zod-capped at
                                 // 1000 chars; system (battle-report)
                                 // messages may exceed it
  contentType: string;           // text | system | notification
  status: string;                // sent | delivered | read
  createdAt: Date;
  readAt?: Date;
  editedAt?: Date;
  deletedAt?: Date;              // Soft delete
  metadataOriginalContent?: string;
  metadataEditHistory?: Array<{ content: string; editedAt: Date }>;
  metadataSystemType?: string;   // achievement | battle | trade
  metadataRelatedEntityId?: string;
}
```

**Indexes:**
1. `(conversation_id, created_at)` — paginated history
2. `(recipient_id, status)` — unread filtering
3. `(deleted_at)` — soft-delete filtering

Full definition: `lib/db/schema/messages.ts`.

---

## 🔒 Security & Rate Limiting

### Profanity Filtering

**Library:** `bad-words`

**Implementation:**
```typescript
const filter = new Filter();
filter.addWords('custom', 'banned', 'words');

if (filter.isProfane(content)) {
  return { success: false, error: 'Message contains inappropriate language' };
}
```

**Customization:**
Add custom words to blocklist in `lib/messagingService.ts`:
```typescript
filter.addWords('word1', 'word2', 'word3');
```

---

### Rate Limiting

**Limit:** 20 messages per minute per user

**Storage:** In-memory Map (resets on server restart)

**Implementation:**
```typescript
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(playerId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(playerId);
  
  if (!limit || now > limit.resetTime) {
    rateLimits.set(playerId, { count: 1, resetTime: now + 60000 });
    return true;
  }
  
  if (limit.count >= 20) {
    return false; // Rate limit exceeded
  }
  
  limit.count++;
  return true;
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded. Please wait before sending more messages."
}
```

**Future Enhancement:**
Replace in-memory storage with Redis for distributed rate limiting.

---

### Input Validation

**Content Validation:**
- Minimum: 1 character (after trim)
- Maximum: 1000 characters
- No HTML tags (sanitized)
- No script injection

**User Validation:**
- Cannot send messages to self
- Sender and recipient must be non-empty strings
- ID validation: `conversationId` must reference an existing `conversations.id`

**Example:**
```typescript
if (!content || content.trim().length === 0) {
  return { success: false, error: 'Message cannot be empty' };
}

if (content.length > 1000) {
  return { success: false, error: 'Message too long (max 1000 characters)' };
}

if (senderId === recipientId) {
  return { success: false, error: 'Cannot send messages to yourself' };
}
```

---

## ⚡ Performance Optimization

### Postgres Indexes

**Impact:** 10-100x faster queries

**Declared Indexes** (`lib/db/schema/messages.ts`):
- `conversations_updated_at_idx`: sorted conversation list
- `messages_conversation_created_idx`: efficient pagination
- `messages_recipient_status_idx`: unread message filtering
- `messages_deleted_at_idx`: soft-delete filtering

---

### Message Pagination

**Default:** 50 messages per page  
**Maximum:** 100 messages per page

**Implementation** (`getMessageHistory` in `lib/messagingService.ts`):
```typescript
const results = await db
  .select()
  .from(messages)
  .where(and(...conditions))   // conversation + not soft-deleted + cursor
  .orderBy(desc(messages.createdAt))
  .limit(limit + 1);           // +1 probes hasMore
```

**Load More:**
```typescript
const olderMessages = await fetch(
  `/api/messages?playerId=player1&recipientId=player2&before=${oldestMessageTimestamp}`
);
```

---

### Socket.io Room Strategy

**Rooms:**
1. `user_{username}` - User-specific room (all devices)
2. `conversation_{conversationId}` - Conversation-specific room

**Broadcasting:**
```typescript
// Broadcast to specific user (all devices)
io.to(`user_${username}`).emit('message:receive', payload);

// Broadcast to conversation (both participants)
io.to(`conversation_${conversationId}`).emit('typing:start', payload);
```

**Benefits:**
- Targeted delivery (no unnecessary broadcasts)
- Supports multiple devices per user
- Efficient room management

---

### Client-Side Optimizations

**React Performance:**
- `useCallback` for all event handlers (prevent re-renders)
- `useMemo` for derived values (unread counts, filtered lists)
- Lazy loading for emoji picker (code splitting)
- Virtualized lists for long message histories (future enhancement)

**Network Optimization:**
- Debounced search (300ms delay)
- Pagination for message history
- Optimistic updates with tempId
- Connection state management (auto-reconnect)

---

## 🐛 Troubleshooting

### Issue: Messages not delivering in real-time

**Symptoms:** Messages appear after refresh but not instantly

**Diagnosis:**
1. Check connection status indicator (green = connected)
2. Open browser console → Network tab → Look for WebSocket connection
3. Verify Socket.io connection: `useWebSocket().isConnected` should be `true`

**Solutions:**
- **Reconnect:** Click "Reconnect" button in connection status
- **Check server:** Ensure `npm run dev` is running
- **Firewall:** Allow WebSocket connections on port 3000
- **Browser:** Try incognito mode (disable extensions)

**Debug Logs:**
```typescript
// Add to Messages page
console.log('Socket connected:', isConnected);
console.log('Connection state:', connectionState);
```

---

### Issue: "Rate limit exceeded" error

**Symptoms:** Cannot send messages, error appears in console

**Cause:** Sent more than 20 messages in 1 minute

**Solutions:**
- **Wait:** Rate limit resets after 1 minute
- **Check spam:** Ensure not accidentally clicking Send multiple times
- **Development:** Temporarily raise the limit in `lib/messagingService.ts`:
  ```typescript
  const config = {
    ...
    rateLimitPerMinute: 50, // dev-only bump (default 20)
  };
  ```

---

### Issue: Slow queries or timeouts

**Symptoms:** Slow query performance, timeout errors

**Diagnosis:**
- Confirm migrations are applied (indexes ship in
  `lib/db/schema/messages.ts`)
- Check slow-query logging on the messaging endpoints

**Solutions:**
- Re-apply migrations; never hand-create indexes outside them

---

### Issue: Profanity filter too strict

**Symptoms:** Legitimate messages blocked

**Solutions:**
- **Review the blocklist:** profanity filtering runs through the `bad-words`
  `Filter` in `lib/messagingService.ts` (`profanityFilter.clean`)
- **Disable filter (development only):** set `profanityFilter: false` in the
  `validateMessage` config in `lib/messagingService.ts`

---

### Issue: TypeScript errors in components

**Common Errors:**
- `Property 'username' does not exist on type 'Player'`
- `Type 'Message' is not assignable to...`

**Solutions:**
- **Regenerate types:** `npm run build` (re-compiles types)
- **Check imports:**
  ```typescript
  import type { Message, Conversation } from '@/types/messaging.types';
  ```
- **Clear cache:** Delete `.next` folder and restart dev server

---

### Issue: Emoji picker not loading

**Symptoms:** Blank emoji row or console errors

**Solutions:**
- The picker is a built-in quick-insert row (`MessageThread.tsx`) —
  `@emoji-mart/react` / `@emoji-mart/data` are NOT installed (removed as
  React-19-incompatible). Do not `npm install` them.
- **Check imports:** emoji UI lives in `components/messaging/MessageThread.tsx`;
  there is no external emoji package to verify or reinstall.

---

## 🚀 Future Enhancements

### Planned Features

**Phase 1: Core Improvements**
- [ ] Message editing (5 min time limit)
- [ ] Message deletion (soft delete)
- [ ] Message reactions (emoji reactions)
- [ ] File attachments (images, videos)
- [ ] Voice messages (audio recording)

**Phase 2: Advanced Features**
- [ ] Group conversations (3+ participants)
- [ ] Message pinning
- [ ] Conversation archiving
- [ ] Conversation muting
- [ ] Desktop notifications (future — `web-push` is NOT installed)
- [ ] Mobile push notifications

**Phase 3: Rich Media**
- [ ] GIF integration (Giphy API)
- [ ] Sticker packs
- [ ] Link previews (Open Graph)
- [ ] Video chat integration
- [ ] Screen sharing

**Phase 4: AI & Automation**
- [ ] Message translation (multi-language)
- [ ] Smart reply suggestions
- [ ] Spam detection (ML-based)
- [ ] Message search with semantic search
- [ ] Chatbots for game help

### Performance Upgrades

- [ ] Redis for rate limiting (distributed)
- [ ] CDN for emoji data (faster loading)
- [ ] Virtualized message lists (react-window)
- [ ] Service worker for offline support
- [ ] Message compression (gzip)

### Security Enhancements

- [ ] End-to-end encryption (E2EE)
- [ ] Message reporting system
- [ ] User blocking
- [ ] Admin moderation tools
- [ ] Audit logs for compliance

---

## 📊 Metrics & Analytics

### Key Performance Indicators

**Monitor these metrics:**
- Messages sent per day
- Average response time
- Active conversations
- Unread message rate
- WebSocket connection uptime
- API response times

**Postgres Queries:**
```sql
-- Total messages
SELECT COUNT(*) FROM messages;

-- Messages today
SELECT COUNT(*) FROM messages
WHERE created_at >= date_trunc('day', NOW());

-- Active conversations (last 7 days)
SELECT COUNT(*) FROM conversations
WHERE updated_at >= NOW() - INTERVAL '7 days';
```

---

## 📞 Support

### Getting Help

**Issues or Questions?**
1. Check this documentation first
2. Search closed GitHub issues
3. Review code comments in source files
4. Create new GitHub issue with:
   - Error message (full stack trace)
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/environment details

**Contact:**
- GitHub Issues: [Repository Issues](https://github.com/savant0x/DarkFrame/issues)
- Email: support@darkframe.game

---

## 📝 Changelog

### Version 1.0.0 (2025-10-25)

**Initial Release - FID-20251025-102**

✅ **Features Implemented:**
- Complete type system (types/messaging.types.ts)
- Core messaging service with profanity filtering and rate limiting
- MessageInbox component with search and filters
- MessageThread component with built-in emoji quick-insert
- 3 REST API routes (send, fetch, mark read)
- 6 Socket.io event handlers (send, read, typing, join/leave)
- Messages page with responsive layout
- Postgres indexes for performance (`lib/db/schema/messages.ts`)
- Comprehensive documentation

📊 **Statistics:**
- TypeScript errors: 0
- Postgres indexes: 4 (declared in schema)
- Socket.io events: 12 (6 client→server, 6 server→client)
- API endpoints: 4

🎯 **Test Coverage:**
- Manual testing: ✅ Complete
- Unit tests: ⏳ Planned for v1.1
- E2E tests: ⏳ Planned for v1.1

---

**End of Documentation**

*Last Updated: September 16, 2026*  
*Feature ID: FID-20251025-102*  
*Version: 1.0.0*
