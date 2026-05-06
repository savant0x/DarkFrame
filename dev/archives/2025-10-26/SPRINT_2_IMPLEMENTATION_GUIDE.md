# 🚀 SPRINT 2: Complete Social & Communication System
## Implementation Guide - FID-20251026-019

**Created:** 2025-10-26  
**Status:** IN PROGRESS - Phase 1 Starting  
**Estimate:** 11-14 hours (3 phases)  
**Complexity:** 5/5 (Very High)

---

## 📋 **QUICK REFERENCE**

**Current Phase:** Phase 1 - Chat Enhancements  
**Next Action:** Create `lib/moderationService.ts` with profanity filter

**Already Complete:**
- ✅ Professional emoji picker (enhanced during chat UI polish)
- ✅ HTTP Polling infrastructure (FID-20251026-017)
- ✅ 8 NPM packages installed (saves 23 hours!)

**Daily Progress Tracker:**
- [ ] **Day 1:** Phase 1 - Chat Enhancements (3-4h)
- [ ] **Day 2:** Phase 2 - Private Messaging (4-5h)
- [ ] **Day 3:** Phase 3 - Friend System (4-5h)

---

## 🎯 **PHASE 1: CHAT ENHANCEMENTS** (3-4 hours)

### ✅ 1.1 Profanity Filter Integration (45 mins)

**Goal:** Auto-replace profanity with asterisks, track violations

**Step 1: Create moderationService.ts** (NEW FILE - 250 lines)
```typescript
// lib/moderationService.ts

import Filter from 'bad-words';
import { connectDB } from '@/lib/db/mongodb';

/**
 * OVERVIEW:
 * Comprehensive chat moderation service with profanity filtering,
 * spam detection, and automated warning system. Integrates bad-words
 * library with custom word lists and severity tracking.
 */

// Initialize profanity filter
const profanityFilter = new Filter();

// Custom word list (add game-specific terms)
const customBadWords = ['badword1', 'badword2']; // Replace with actual words
profanityFilter.addWords(...customBadWords);

// Admin whitelist (users who bypass filter)
const ADMIN_WHITELIST = new Set<string>(); // Populate from database

interface ModerationWarning {
  userId: string;
  reason: 'PROFANITY' | 'SPAM' | 'CAPS';
  severity: 'MILD' | 'MODERATE' | 'SEVERE';
  timestamp: Date;
  content?: string; // Original message content
}

/**
 * Filter profanity from message content
 * @param content - Raw message text
 * @param userId - User ID (for admin bypass check)
 * @returns Filtered message with asterisks replacing bad words
 */
export function filterMessage(content: string, userId?: string): string {
  // Admin bypass
  if (userId && ADMIN_WHITELIST.has(userId)) {
    return content;
  }

  return profanityFilter.clean(content);
}

/**
 * Detect if message contains profanity
 * @param content - Message text to check
 * @returns true if profanity detected
 */
export function detectProfanity(content: string): boolean {
  return profanityFilter.isProfane(content);
}

/**
 * Record moderation warning for user
 * @param userId - User to warn
 * @param reason - Violation reason
 * @param severity - Severity level
 * @param content - Optional original content
 */
export async function recordWarning(
  userId: string,
  reason: ModerationWarning['reason'],
  severity: ModerationWarning['severity'],
  content?: string
): Promise<void> {
  const db = await connectDB();
  
  const warning: ModerationWarning = {
    userId,
    reason,
    severity,
    timestamp: new Date(),
    content
  };

  await db.collection('moderation_warnings').insertOne(warning);

  // Check if user should be auto-banned
  const warningCount = await db.collection('moderation_warnings').countDocuments({
    userId,
    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24h
  });

  if (warningCount >= 3) {
    await db.collection('players').updateOne(
      { _id: userId },
      { 
        $set: { 
          chatBannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h ban
        } 
      }
    );
  }
}

/**
 * Get user's warning count in last 24 hours
 * @param userId - User to check
 * @returns Warning count
 */
export async function getWarningCount(userId: string): Promise<number> {
  const db = await connectDB();
  return db.collection('moderation_warnings').countDocuments({
    userId,
    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  });
}

/**
 * Check if user is chat banned
 * @param userId - User to check
 * @returns true if user is currently banned
 */
export async function isUserChatBanned(userId: string): Promise<boolean> {
  const db = await connectDB();
  const player = await db.collection('players').findOne({ _id: userId });
  
  if (!player?.chatBannedUntil) return false;
  
  return new Date(player.chatBannedUntil) > new Date();
}
```

**Step 2: Integrate into Chat API** (MOD - app/api/chat/route.ts)
```typescript
// Add imports at top
import { filterMessage, detectProfanity, recordWarning } from '@/lib/moderationService';

// In POST handler, before saving message:
const filteredContent = filterMessage(content, userId);

// If profanity detected, record warning
if (detectProfanity(content)) {
  await recordWarning(userId, 'PROFANITY', 'MODERATE', content);
}

// Save message with filtered content
const newMessage = {
  content: filteredContent, // Use filtered instead of raw content
  // ... rest of message fields
};
```

**Acceptance Criteria:**
- ✅ Bad words replaced with asterisks (e.g., "f***")
- ✅ Warnings recorded in database
- ✅ 3 warnings = 24h auto-ban
- ✅ Admins can bypass filter

---

### ✅ 1.2 Professional Emoji Picker (ALREADY COMPLETE!)

**Status:** ✅ DONE during chat UI polish session  
**File:** `components/chat/ChatPanel.tsx` (lines ~974-1059)

**Features Implemented:**
- ✅ Header with "Common Emojis" title
- ✅ "Recently Used" section (8 emojis, grid-cols-8)
- ✅ "Smileys & People" scrollable grid (64 emojis, 8x8)
- ✅ Category tabs footer (7 categories with emoji icons)
- ✅ Professional dark theme (bg-gray-900, cyan borders)
- ✅ Hover effects (scale-110, bg-cyan-500/10)

**NO ACTION NEEDED** - Move to next feature!

---

### 🔄 1.3 @Mentions System (1 hour)

**Goal:** Type @ to autocomplete usernames, notify mentioned users

**Step 1: Install react-mentions types** (if not already)
```powershell
npm install --save-dev @types/react-mentions
```

**Step 2: Integrate MentionsInput** (MOD - components/chat/ChatPanel.tsx)
```typescript
// Add imports
import { MentionsInput, Mention } from 'react-mentions';

// Add state for online users
const [onlineUsers, setOnlineUsers] = useState<Array<{id: string, display: string}>>([]);

// Fetch online users (add to useEffect or polling)
useEffect(() => {
  const fetchOnlineUsers = async () => {
    const response = await fetch('/api/chat/online?channelId=GLOBAL&includeUsers=true');
    const data = await response.json();
    
    if (data.success && data.users) {
      setOnlineUsers(data.users.map(u => ({
        id: u.userId,
        display: `${u.username} (Lv ${u.level})`
      })));
    }
  };
  
  fetchOnlineUsers();
  const interval = setInterval(fetchOnlineUsers, 30000); // Refresh every 30s
  return () => clearInterval(interval);
}, []);

// Replace textarea with MentionsInput
<MentionsInput
  value={newMessage}
  onChange={(e) => setNewMessage(e.target.value)}
  placeholder="Type your message... (@ to mention)"
  className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2"
  style={{
    control: {
      backgroundColor: 'rgb(55 65 81)',
      color: 'white',
    },
    highlighter: {
      overflow: 'hidden',
    },
    input: {
      margin: 0,
      color: 'white',
    },
    suggestions: {
      list: {
        backgroundColor: 'rgb(31 41 55)',
        border: '1px solid rgb(75 85 99)',
        borderRadius: '0.5rem',
      },
      item: {
        padding: '8px 12px',
        color: 'white',
        '&focused': {
          backgroundColor: 'rgb(55 65 81)',
        },
      },
    },
  }}
>
  <Mention
    trigger="@"
    data={onlineUsers}
    renderSuggestion={(suggestion) => (
      <div className="flex items-center space-x-2">
        <span>{suggestion.display}</span>
      </div>
    )}
    style={{
      backgroundColor: 'rgb(59 130 246)', // Blue highlight
    }}
  />
</MentionsInput>
```

**Step 3: Parse Mentions in API** (MOD - app/api/chat/route.ts)
```typescript
// Parse mentions from message content
function parseMentions(content: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[2]); // Extract userId from @[Username](userId)
  }
  
  return mentions;
}

// In POST handler:
const mentions = parseMentions(content);

// Save message with mentions
const newMessage = {
  content: filteredContent,
  mentions, // Store array of mentioned userIds
  // ... rest
};

// Send notifications to mentioned users
for (const mentionedUserId of mentions) {
  // TODO: Send notification (Phase 2)
  console.log(`User ${mentionedUserId} was mentioned`);
}
```

**Acceptance Criteria:**
- ✅ Type @ triggers autocomplete dropdown
- ✅ Dropdown shows online users with levels
- ✅ Selected mention inserted as @Username
- ✅ Mentions stored in message metadata
- ✅ Mentioned users can be notified (later)

---

### 🔄 1.4 URL Detection & Auto-Linking (30 mins)

**Goal:** Automatically detect URLs and make them clickable

**Step 1: Install Linkify** (should already be installed)
```powershell
# Verify installation
npm list linkify-react
```

**Step 2: Wrap Message Content** (MOD - components/chat/ChatPanel.tsx)
```typescript
// Add import
import Linkify from 'linkify-react';

// In message rendering (replace plain {message.content} with):
<Linkify
  options={{
    className: 'text-cyan-400 underline hover:text-cyan-300',
    target: '_blank',
    rel: 'noopener noreferrer',
    format: (value, type) => {
      if (type === 'url' && value.length > 50) {
        return value.slice(0, 50) + '...'; // Truncate long URLs
      }
      return value;
    }
  }}
>
  {message.content}
</Linkify>
```

**Acceptance Criteria:**
- ✅ http:// URLs auto-detected
- ✅ https:// URLs auto-detected
- ✅ www. URLs auto-detected
- ✅ Links open in new tab
- ✅ Long URLs truncated with "..."

---

### 🔄 1.5 Spam Detection System (1 hour)

**Goal:** Prevent rapid-fire messages and duplicate content

**Step 1: Add Spam Detection to moderationService.ts** (+120 lines)
```typescript
// Add to lib/moderationService.ts

import stringSimilarity from 'string-similarity';

interface MessageRateRecord {
  userId: string;
  channelId: string;
  timestamps: Date[];
}

// In-memory rate tracking (use Redis in production)
const messageRateTracker = new Map<string, Date[]>();

/**
 * Detect spam based on rate limiting and content similarity
 * @param content - Message content
 * @param userId - User sending message
 * @param channelId - Channel where message sent
 * @returns true if spam detected
 */
export async function detectSpam(
  content: string,
  userId: string,
  channelId: string
): Promise<{ isSpam: boolean; reason?: string }> {
  const now = new Date();
  const key = `${userId}:${channelId}`;
  
  // Get user's recent messages in this channel
  const timestamps = messageRateTracker.get(key) || [];
  
  // Filter to last 10 seconds
  const recentTimestamps = timestamps.filter(
    ts => now.getTime() - ts.getTime() < 10000
  );
  
  // RATE CHECK: Max 5 messages per 10 seconds
  if (recentTimestamps.length >= 5) {
    return { isSpam: true, reason: 'Rate limit exceeded (5 msg/10s)' };
  }
  
  // CAPS CHECK: > 70% uppercase (minimum 10 chars)
  if (content.length >= 10) {
    const uppercaseCount = (content.match(/[A-Z]/g) || []).length;
    const uppercaseRatio = uppercaseCount / content.length;
    
    if (uppercaseRatio > 0.7) {
      return { isSpam: true, reason: 'Excessive caps (>70%)' };
    }
  }
  
  // DUPLICATE CHECK: Compare with last 5 messages
  const db = await connectDB();
  const recentMessages = await db.collection('chat_messages')
    .find({ senderId: userId, channelId })
    .sort({ timestamp: -1 })
    .limit(5)
    .toArray();
  
  for (const msg of recentMessages) {
    const similarity = stringSimilarity.compareTwoStrings(content, msg.content);
    
    if (similarity > 0.85) {
      return { isSpam: true, reason: 'Duplicate content detected' };
    }
  }
  
  // Update rate tracker
  recentTimestamps.push(now);
  messageRateTracker.set(key, recentTimestamps);
  
  return { isSpam: false };
}

/**
 * Mute user for spam violation
 * @param userId - User to mute
 * @param durationMinutes - Mute duration (default: 5 mins)
 */
export async function muteUserForSpam(userId: string, durationMinutes: number = 5): Promise<void> {
  const db = await connectDB();
  
  await db.collection('players').updateOne(
    { _id: userId },
    {
      $set: {
        chatMutedUntil: new Date(Date.now() + durationMinutes * 60 * 1000)
      }
    }
  );
}
```

**Step 2: Integrate Spam Detection** (MOD - app/api/chat/route.ts)
```typescript
import { detectSpam, muteUserForSpam } from '@/lib/moderationService';

// In POST handler, before saving message:
const spamCheck = await detectSpam(content, userId, channelId);

if (spamCheck.isSpam) {
  // Mute user for 5 minutes
  await muteUserForSpam(userId, 5);
  
  return NextResponse.json({
    success: false,
    message: `Spam detected: ${spamCheck.reason}. Muted for 5 minutes.`
  }, { status: 429 }); // Too Many Requests
}
```

**Acceptance Criteria:**
- ✅ Rate limit enforced (5 msg/10s)
- ✅ Duplicate content detected (>85% similarity)
- ✅ Excessive caps flagged (>70%)
- ✅ Auto-mute for 5 minutes on spam
- ✅ Clear error message returned

---

### 🔄 1.6 Message Editing & Deletion (45 mins)

**Step 1: Create Edit API Route** (NEW - app/api/chat/edit/route.ts)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

/**
 * OVERVIEW:
 * Edit existing chat message. Users can edit their own messages
 * within 5 minutes of posting. Edited messages marked with 'edited' flag.
 */

export async function PUT(request: NextRequest) {
  try {
    const { messageId, newContent } = await request.json();
    const userId = request.cookies.get('userId')?.value;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectDB();
    const message = await db.collection('chat_messages').findOne({ _id: new ObjectId(messageId) });

    if (!message) {
      return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
    }

    // Check ownership
    if (message.senderId !== userId) {
      return NextResponse.json({ success: false, message: 'Not your message' }, { status: 403 });
    }

    // Check 5-minute edit window
    const messageAge = Date.now() - new Date(message.timestamp).getTime();
    if (messageAge > 5 * 60 * 1000) {
      return NextResponse.json({ success: false, message: 'Edit window expired (5 mins)' }, { status: 400 });
    }

    // Update message
    await db.collection('chat_messages').updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          content: newContent,
          edited: true,
          editedAt: new Date()
        }
      }
    );

    return NextResponse.json({ success: true, message: 'Message edited' });
  } catch (error) {
    console.error('Error editing message:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
```

**Step 2: Create Delete API Route** (NEW - app/api/chat/delete/route.ts)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

/**
 * OVERVIEW:
 * Soft-delete chat messages. User messages marked as deleted but
 * retained for moderation. Admins can hard-delete (remove from DB).
 */

export async function DELETE(request: NextRequest) {
  try {
    const { messageId, hardDelete } = await request.json();
    const userId = request.cookies.get('userId')?.value;
    const isAdmin = request.cookies.get('isAdmin')?.value === 'true';

    if (!userId) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await connectDB();
    const message = await db.collection('chat_messages').findOne({ _id: new ObjectId(messageId) });

    if (!message) {
      return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
    }

    // Check ownership (unless admin hard-delete)
    if (!isAdmin && message.senderId !== userId) {
      return NextResponse.json({ success: false, message: 'Not your message' }, { status: 403 });
    }

    // Hard delete (admins only)
    if (hardDelete && isAdmin) {
      await db.collection('chat_messages').deleteOne({ _id: new ObjectId(messageId) });
      return NextResponse.json({ success: true, message: 'Message permanently deleted' });
    }

    // Soft delete (mark as deleted)
    await db.collection('chat_messages').updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          deleted: true,
          deletedAt: new Date()
        }
      }
    );

    return NextResponse.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Error deleting message:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
```

**Step 3: Add Edit/Delete UI** (MOD - components/chat/ChatPanel.tsx)
```typescript
// Add state for editing
const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
const [editContent, setEditContent] = useState('');

// Edit handler
const handleEditMessage = async (messageId: string, newContent: string) => {
  const response = await fetch('/api/chat/edit', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId, newContent })
  });

  if (response.ok) {
    setEditingMessageId(null);
    loadMessages(); // Refresh messages
  }
};

// Delete handler
const handleDeleteMessage = async (messageId: string) => {
  if (!confirm('Delete this message?')) return;

  const response = await fetch('/api/chat/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId })
  });

  if (response.ok) {
    loadMessages(); // Refresh messages
  }
};

// In message rendering, add edit/delete buttons for own messages:
{message.senderId === currentUserId && !message.deleted && (
  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
    <button
      onClick={() => {
        setEditingMessageId(message.id);
        setEditContent(message.content);
      }}
      className="p-1 bg-gray-700 rounded hover:bg-gray-600 text-xs"
    >
      Edit
    </button>
    <button
      onClick={() => handleDeleteMessage(message.id)}
      className="p-1 bg-red-600 rounded hover:bg-red-500 text-xs"
    >
      Delete
    </button>
  </div>
)}

// Show "(edited)" label
{message.edited && <span className="text-xs text-gray-500 ml-2">(edited)</span>}

// Show "[deleted]" for deleted messages
{message.deleted ? (
  <p className="text-gray-500 italic">[deleted]</p>
) : editingMessageId === message.id ? (
  <input
    type="text"
    value={editContent}
    onChange={(e) => setEditContent(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        handleEditMessage(message.id, editContent);
      } else if (e.key === 'Escape') {
        setEditingMessageId(null);
      }
    }}
    className="bg-gray-700 px-2 py-1 rounded w-full"
    autoFocus
  />
) : (
  <Linkify>{message.content}</Linkify>
)}
```

**Acceptance Criteria:**
- ✅ Edit button shows on hover (own messages)
- ✅ Click Edit → Inline input appears
- ✅ Press Enter → Save edit
- ✅ Press Escape → Cancel edit
- ✅ "(edited)" label displays
- ✅ Delete button shows on hover
- ✅ Delete → Confirmation modal
- ✅ "[deleted]" placeholder shown
- ✅ Admins can hard-delete

---

## ✅ **PHASE 1 COMPLETION CHECKLIST**

Before moving to Phase 2, verify:

- [ ] Profanity filter working (bad words → asterisks)
- [ ] Warning system tracking violations (3 → ban)
- [ ] Emoji picker professional (multi-category, scrollable) ✅ DONE
- [ ] @Mentions autocomplete functional
- [ ] Mentioned users stored in metadata
- [ ] URLs auto-detected and clickable
- [ ] Spam detection enforces rate limit (5 msg/10s)
- [ ] Duplicate content detected (>85% similarity)
- [ ] Excessive caps flagged (>70%)
- [ ] Auto-mute for spam (5 minutes)
- [ ] Edit own messages within 5 minutes
- [ ] Delete own messages anytime
- [ ] "(edited)" label displays
- [ ] "[deleted]" placeholder shown
- [ ] Zero TypeScript errors

**When complete:** Update `dev/progress.md` with Phase 1 completion, move to Phase 2

---

## 📋 **PHASE 2: PRIVATE MESSAGING** (4-5 hours)

[Content truncated - See planned.md FID-20251026-019 for Phase 2 details]

**Key Features:**
- DM database schema & types
- DM service layer (7 functions)
- DM API routes (3 endpoints)
- DM UI components (DMPanel, ConversationList, MessageThread)
- Read receipts, typing indicators, unread counts

---

## 📋 **PHASE 3: FRIEND SYSTEM** (4-5 hours)

[Content truncated - See planned.md FID-20251026-019 for Phase 3 details]

**Key Features:**
- Friend database & types
- Friend service layer (11 functions)
- Friend API routes (3 endpoints)
- Friend UI components (FriendsPanel, FriendCard, FriendRequestCard)
- Online status, friend requests, blocking

---

## 📊 **PROGRESS TRACKING**

**Update After Each Feature:**
```markdown
### Phase 1 Progress:
- [x] 1.1 Profanity Filter (45 mins actual)
- [x] 1.2 Emoji Picker (SKIPPED - already done!)
- [x] 1.3 @Mentions (1h actual)
- [x] 1.4 URL Linking (30 mins actual)
- [x] 1.5 Spam Detection (1h actual)
- [x] 1.6 Edit/Delete (45 mins actual)

**Phase 1 Total:** 3.5 hours (Est: 3-4h) ✅
```

---

**Last Updated:** 2025-10-26  
**Next Update:** After Phase 1 completion  
**Reference:** FID-20251026-019 in `dev/planned.md` and `dev/progress.md`
